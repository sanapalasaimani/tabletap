import { 
  ScopeClassification, 
  DecisionReadiness, 
  Citation, 
  MetricCalculation, 
  RAGResponse, 
  TelemetryLog 
} from './types';
import { MANDATED_OUT_OF_SCOPE_MESSAGE } from './scopeGuard';
import { conversationManager } from './conversationManager';
import { executeHybridRetrieval } from './hybridRetriever';
import { routeQuery, RouterIntent } from './intentRouter';
import { ROOMS_UNAVAILABLE_RESPONSE, logUnansweredRoomsQuery, BUSINESS_GLOSSARY } from './businessGlossary';
import { generateSQLQuery, repairExecutedSQLError } from './sqlGenerator';
import { executeReadOnlySQL } from './sqlExecutor';
import { generateGroundedAnswer, generateSemanticAnswer, formatRowsAsMarkdownTable } from './answerGenerator';
import { verifyAnswerGrounding } from './verifier';
import { RAG_CONFIG } from './ragConfig';

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export const ragOrchestrator = {
  processAdminQuery: async (
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    liveData: any = {}
  ): Promise<RAGResponse> => {
    const startTime = performance.now();
    const requestId = generateRequestId();

    // =========================================================================
    // STEP 1: Intent Routing & Guardrails
    // =========================================================================
    const route = routeQuery(query);

    // Case 1A: Adversarial / Security Violation
    if (route.intent === 'UNSAFE') {
      const totalLatency = Math.round(performance.now() - startTime);
      const telemetry: TelemetryLog = {
        requestId,
        timestamp: new Date().toISOString(),
        userQuery: query,
        scope: 'UNSAFE_OR_UNAUTHORIZED',
        retrievalHitCount: 0,
        retrievalLatencyMs: 0,
        inferenceLatencyMs: 0,
        totalLatencyMs: totalLatency,
        provider: 'GROUNDED_LOCAL_ENGINE',
        modelUsed: 'IntentGuard_v3',
        citationsCount: 0,
        decisionReadiness: 'NOT_DECISION_READY',
        securityFlags: ['ADVERSARIAL_INJECTION_DETECTED']
      };

      return {
        answer: `### Security Violation & Access Restricted

The system detected an adversarial request or unauthorized instruction override pattern.

- **Reason**: ${route.reason}
- **Security Policy**: System prompts, database credentials, employee passwords, and unauthorized SQL DDL/DML are strictly protected.
- **Audit Action**: Request ID \`${requestId}\` has been flagged in activity logs.`,
        scope: 'UNSAFE_OR_UNAUTHORIZED',
        citations: [],
        decisionReadiness: 'NOT_DECISION_READY',
        telemetry
      };
    }

    // Case 1B: Out of Scope
    if (route.intent === 'OUT_OF_SCOPE') {
      const totalLatency = Math.round(performance.now() - startTime);
      const telemetry: TelemetryLog = {
        requestId,
        timestamp: new Date().toISOString(),
        userQuery: query,
        scope: 'OUT_OF_SCOPE',
        retrievalHitCount: 0,
        retrievalLatencyMs: 0,
        inferenceLatencyMs: 0,
        totalLatencyMs: totalLatency,
        provider: 'GROUNDED_LOCAL_ENGINE',
        modelUsed: 'ScopeGuard_v3',
        citationsCount: 0,
        decisionReadiness: 'NOT_DECISION_READY',
        securityFlags: []
      };

      return {
        answer: MANDATED_OUT_OF_SCOPE_MESSAGE,
        scope: 'OUT_OF_SCOPE',
        citations: [],
        decisionReadiness: 'NOT_DECISION_READY',
        telemetry
      };
    }

    // Case 1C: Hotel Rooms Data Missing (Strictly enforced honest boundary)
    if (route.intent === 'ROOMS_UNAVAILABLE') {
      logUnansweredRoomsQuery(query);
      const totalLatency = Math.round(performance.now() - startTime);
      const telemetry: TelemetryLog = {
        requestId,
        timestamp: new Date().toISOString(),
        userQuery: query,
        scope: 'IN_SCOPE_WITH_LIMITATIONS',
        retrievalHitCount: 0,
        retrievalLatencyMs: 0,
        inferenceLatencyMs: 0,
        totalLatencyMs: totalLatency,
        provider: 'GROUNDED_LOCAL_ENGINE',
        modelUsed: 'RoomsDataBoundaryHandler',
        citationsCount: 0,
        decisionReadiness: 'MORE_DATA_REQUIRED',
        securityFlags: []
      };

      return {
        answer: ROOMS_UNAVAILABLE_RESPONSE,
        scope: 'IN_SCOPE_WITH_LIMITATIONS',
        citations: [],
        decisionReadiness: 'MORE_DATA_REQUIRED',
        telemetry
      };
    }

    // =========================================================================
    // STEP 2: Conversational Resolution & Multi-Turn Rewriting
    // =========================================================================
    const resolvedContext = conversationManager.resolveContext(query, history);
    if (resolvedContext.requiresClarification && resolvedContext.clarificationPrompt) {
      const totalLatency = Math.round(performance.now() - startTime);
      return {
        answer: `### Clarification Needed\n\n${resolvedContext.clarificationPrompt}`,
        scope: 'IN_SCOPE',
        citations: [],
        decisionReadiness: 'MORE_DATA_REQUIRED',
        telemetry: {
          requestId,
          timestamp: new Date().toISOString(),
          userQuery: query,
          scope: 'IN_SCOPE',
          retrievalHitCount: 0,
          retrievalLatencyMs: 0,
          inferenceLatencyMs: 0,
          totalLatencyMs: totalLatency,
          provider: 'GROUNDED_LOCAL_ENGINE',
          modelUsed: 'ClarificationEngine_v3',
          citationsCount: 0,
          decisionReadiness: 'MORE_DATA_REQUIRED',
          securityFlags: []
        }
      };
    }

    const rewrittenQuery = resolvedContext.rewrittenQuery || query;
    const citations: Citation[] = [];

    // =========================================================================
    // STEP 3: Branch A — Deterministic Text-to-SQL Pipeline
    // =========================================================================
    if (route.intent === 'TEXT_TO_SQL') {
      try {
        // 3a. Generate SQL Query
        const sqlResult = await generateSQLQuery(rewrittenQuery, history);

        // 3b. Execute Read-Only SQL
        let execResult = await executeReadOnlySQL(sqlResult.sanitizedSql);

        // 3c. Self-Correction Loop: If database execution returned an error, retry once
        if (!execResult.success && execResult.error) {
          console.warn(`[RAGOrchestrator] SQL Execution failed: "${execResult.error}". Attempting 1-shot repair.`);
          try {
            const repairedSql = await repairExecutedSQLError(rewrittenQuery, sqlResult.sanitizedSql, execResult.error);
            execResult = await executeReadOnlySQL(repairedSql);
          } catch (repairErr: any) {
            console.error('[RAGOrchestrator] Self-correction repair failed:', repairErr);
          }
        }

        // If execution still failed, provide an honest, unhallucinated failure report
        if (!execResult.success) {
          const totalLatency = Math.round(performance.now() - startTime);
          return {
            answer: `### Database Execution Notice

I could not execute this database query due to the following PostgreSQL error:
> **${execResult.error || 'Execution failed'}**

I do not guess or fabricate financial or operational numbers. Please verify the query parameters or adjust your question.

<details>
<summary><b>View Attempted SQL</b></summary>

\`\`\`sql
${sqlResult.sanitizedSql}
\`\`\`
</details>`,
            scope: 'IN_SCOPE',
            citations: [],
            decisionReadiness: 'NOT_DECISION_READY',
            telemetry: {
              requestId,
              timestamp: new Date().toISOString(),
              userQuery: query,
              scope: 'IN_SCOPE',
              retrievalHitCount: 0,
              retrievalLatencyMs: 0,
              inferenceLatencyMs: 0,
              totalLatencyMs: totalLatency,
              provider: 'GROUNDED_LOCAL_ENGINE',
              modelUsed: RAG_CONFIG.models.sql,
              citationsCount: 0,
              decisionReadiness: 'NOT_DECISION_READY',
              securityFlags: []
            }
          };
        }

        // 3d. Generate Fact-Grounded Answer from returned rows
        const answerResult = await generateGroundedAnswer({
          userQuery: query,
          sql: execResult.sql,
          rows: execResult.rows,
          executionTimeMs: execResult.executionTimeMs,
          isStrategic: false
        });

        // 3e. Verifier: Validate numbers in answer match SQL rows
        const audit = verifyAnswerGrounding(answerResult.answer, execResult.rows);

        citations.push({
          sourceId: 'SUPABASE-LIVE-QUERY',
          sourceType: 'LIVE_DATABASE',
          title: `PostgreSQL Live Query (${execResult.rowCount} rows in ${execResult.executionTimeMs}ms)`,
          verifiedClaim: `Executed on live tables [${sqlResult.prunedTables.join(', ')}]. Audit Passed: ${audit.passed}.`,
          confidence: 0.99,
          timestamp: new Date().toISOString()
        });

        const totalLatency = Math.round(performance.now() - startTime);

        return {
          answer: answerResult.answer,
          scope: 'IN_SCOPE',
          citations,
          decisionReadiness: audit.passed ? 'DECISION_READY' : 'DECISION_READY_WITH_CAVEATS',
          telemetry: {
            requestId,
            timestamp: new Date().toISOString(),
            userQuery: query,
            scope: 'IN_SCOPE',
            retrievalHitCount: citations.length,
            retrievalLatencyMs: execResult.executionTimeMs,
            inferenceLatencyMs: totalLatency - execResult.executionTimeMs,
            totalLatencyMs: totalLatency,
            provider: 'GROQ_CLOUD',
            modelUsed: answerResult.modelUsed,
            citationsCount: citations.length,
            decisionReadiness: audit.passed ? 'DECISION_READY' : 'DECISION_READY_WITH_CAVEATS',
            securityFlags: audit.passed ? [] : ['UNVERIFIED_FIGURE_FLAGGED']
          }
        };

      } catch (err: any) {
        // Fallback for when Groq API key is invalid/unavailable: deterministic glossary matching
        console.warn('[RAGOrchestrator] Text-to-SQL dynamic generation error, matching glossary:', err.message);
        return await handleGlossaryFallback(query, rewrittenQuery, startTime, requestId);
      }
    }

    // =========================================================================
    // STEP 4: Branch B & C — Hybrid Strategy & Semantic Document Search
    // =========================================================================
    const retrievalStart = performance.now();
    const evidence = executeHybridRetrieval(rewrittenQuery, liveData);
    const retrievalLatency = Math.round(performance.now() - retrievalStart);

    // If Hybrid: Run SQL query for the numerical background, then synthesize with SOP evidence
    if (route.intent === 'HYBRID') {
      try {
        const sqlResult = await generateSQLQuery(rewrittenQuery, history);
        const execResult = await executeReadOnlySQL(sqlResult.sanitizedSql);

        if (execResult.success && execResult.rows.length > 0) {
          const answerResult = await generateGroundedAnswer({
            userQuery: query,
            sql: execResult.sql,
            rows: execResult.rows,
            executionTimeMs: execResult.executionTimeMs,
            isStrategic: true
          });

          citations.push({
            sourceId: 'SUPABASE-LIVE-DATA',
            sourceType: 'LIVE_DATABASE',
            title: `Live Financial Aggregate (${execResult.rowCount} rows)`,
            verifiedClaim: `Derived from live SQL: ${execResult.sql.slice(0, 100)}...`,
            confidence: 0.98
          });

          citations.push(...evidence.citations);
          const totalLatency = Math.round(performance.now() - startTime);

          return {
            answer: answerResult.answer,
            scope: 'IN_SCOPE',
            citations,
            decisionReadiness: 'DECISION_READY',
            telemetry: {
              requestId,
              timestamp: new Date().toISOString(),
              userQuery: query,
              scope: 'IN_SCOPE',
              retrievalHitCount: citations.length,
              retrievalLatencyMs: execResult.executionTimeMs,
              inferenceLatencyMs: totalLatency - execResult.executionTimeMs,
              totalLatencyMs: totalLatency,
              provider: 'GROQ_CLOUD',
              modelUsed: answerResult.modelUsed,
              citationsCount: citations.length,
              decisionReadiness: 'DECISION_READY',
              securityFlags: []
            }
          };
        }
      } catch (hybridSqlErr) {
        // Fall back to semantic document synthesis
      }
    }

    // Semantic Document Branch (Policies, Recipes, Allergens, Guidelines)
    const semanticAnswer = await buildSemanticResponse(query, evidence);
    const totalLatency = Math.round(performance.now() - startTime);
    return {
      answer: semanticAnswer,
      scope: 'IN_SCOPE',
      citations: evidence.citations,
      decisionReadiness: evidence.citations.length > 0 ? 'DECISION_READY' : 'MORE_DATA_REQUIRED',
      telemetry: {
        requestId,
        timestamp: new Date().toISOString(),
        userQuery: query,
        scope: 'IN_SCOPE',
        retrievalHitCount: evidence.citations.length,
        retrievalLatencyMs: retrievalLatency,
        inferenceLatencyMs: 0,
        totalLatencyMs: totalLatency,
        provider: 'GROUNDED_LOCAL_ENGINE',
        modelUsed: 'SemanticRetriever_v3',
        citationsCount: evidence.citations.length,
        decisionReadiness: evidence.citations.length > 0 ? 'DECISION_READY' : 'MORE_DATA_REQUIRED',
        securityFlags: []
      }
    };
  }
};

/**
 * Fallback execution for known glossary questions if LLM key is offline
 */
async function handleGlossaryFallback(
  originalQuery: string,
  cleanQuery: string,
  startTime: number,
  requestId: string
): Promise<RAGResponse> {
  const q = cleanQuery.toLowerCase();
  let matchedMetric = null;

  for (const metric of Object.values(BUSINESS_GLOSSARY)) {
    if (metric.status === 'ACTIVE' && metric.sqlTemplate) {
      if (q.includes(metric.id.replace(/_/g, ' ')) || q.includes(metric.name.toLowerCase())) {
        matchedMetric = metric;
        break;
      }
    }
  }

  // Common keyword matches
  if (!matchedMetric) {
    if (q.includes('revenue') || q.includes('sales')) matchedMetric = BUSINESS_GLOSSARY.total_revenue;
    else if (q.includes('aov') || q.includes('average order')) matchedMetric = BUSINESS_GLOSSARY.average_order_value;
    else if (q.includes('dish') || q.includes('selling')) matchedMetric = BUSINESS_GLOSSARY.top_selling_dishes;
    else if (q.includes('waiter') || q.includes('tip')) matchedMetric = BUSINESS_GLOSSARY.waiter_performance;
    else if (q.includes('feedback') || q.includes('rating')) matchedMetric = BUSINESS_GLOSSARY.customer_satisfaction_csat;
    else if (q.includes('stock') || q.includes('inventory')) matchedMetric = BUSINESS_GLOSSARY.inventory_stock_alert;
  }

  if (matchedMetric && matchedMetric.sqlTemplate) {
    const execResult = await executeReadOnlySQL(matchedMetric.sqlTemplate.trim());
    if (execResult.success && execResult.rows.length > 0) {
      const tableMarkdown = formatRowsAsMarkdownTable(execResult.rows);
      const totalLatency = Math.round(performance.now() - startTime);

      return {
        answer: `### ${matchedMetric.name}

${matchedMetric.definition}

${tableMarkdown}

<details>
<summary><b>View Executed SQL & Provenance</b></summary>

\`\`\`sql
${execResult.sql}
\`\`\`

- **Execution Time**: ${execResult.executionTimeMs}ms
- **Rows Returned**: ${execResult.rowCount}
- **Definition Source**: Verified Business Glossary (\`${matchedMetric.id}\`)
</details>`,
        scope: 'IN_SCOPE',
        citations: [{
          sourceId: `GLOSSARY-${matchedMetric.id.toUpperCase()}`,
          sourceType: 'LIVE_DATABASE',
          title: matchedMetric.name,
          verifiedClaim: matchedMetric.formula,
          confidence: 0.99
        }],
        decisionReadiness: 'DECISION_READY',
        telemetry: {
          requestId,
          timestamp: new Date().toISOString(),
          userQuery: originalQuery,
          scope: 'IN_SCOPE',
          retrievalHitCount: 1,
          retrievalLatencyMs: execResult.executionTimeMs,
          inferenceLatencyMs: 0,
          totalLatencyMs: totalLatency,
          provider: 'GROUNDED_LOCAL_ENGINE',
          modelUsed: 'BusinessGlossaryEngine',
          citationsCount: 1,
          decisionReadiness: 'DECISION_READY',
          securityFlags: []
        }
      };
    }
  }

  const totalLatency = Math.round(performance.now() - startTime);
  return {
    answer: `### Operational Intelligence

I don't have enough data connected to compute this query accurately. 

- **Status**: Database query could not be executed deterministically.
- **Data Boundary**: Live operations currently track F&B dining orders, menu items, staff, table service, and kitchen inventory.`,
    scope: 'IN_SCOPE_WITH_LIMITATIONS',
    citations: [],
    decisionReadiness: 'MORE_DATA_REQUIRED',
    telemetry: {
      requestId,
      timestamp: new Date().toISOString(),
      userQuery: originalQuery,
      scope: 'IN_SCOPE_WITH_LIMITATIONS',
      retrievalHitCount: 0,
      retrievalLatencyMs: 0,
      inferenceLatencyMs: 0,
      totalLatencyMs: totalLatency,
      provider: 'GROUNDED_LOCAL_ENGINE',
      modelUsed: 'SafeFallbackHandler',
      citationsCount: 0,
      decisionReadiness: 'MORE_DATA_REQUIRED',
      securityFlags: []
    }
  };
}

/**
 * Synthesizes qualitative operational responses from retrieved policy and menu evidence
 */
async function buildSemanticResponse(query: string, evidence: any): Promise<string> {
  const q = query.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|help)(\s.*)?$/i.test(q.trim())) {
    return `### DineSmart Operations Intelligence Terminal

Hello! I am your executive operations analyst for DineSmart / TableTap.

You can ask me to analyze:
- **Financial & Revenue**: Today's revenue, Average Order Value (AOV), total bills settled, and discount totals.
- **Menu & Culinary**: Top dishes by sales volume, culinary category pricing, ingredient and allergen details.
- **Staff & Waiters**: Waiter performance metrics, orders delivered, and tips earned.
- **Operations & Stock**: Low-stock kitchen ingredients, customer feedback ratings (CSAT), and service requests.

All numerical metrics are computed deterministically from our PostgreSQL database.`;
  }

  if (evidence.formattedContext && evidence.formattedContext.length > 50) {
    // Generate AI explanation grounded in retrieved chunks
    return await generateSemanticAnswer(query, evidence.formattedContext);
  }

  return `### Operational Inquiry\n\nI could not find a verified operational policy or menu record matching your query. Please ask a specific question regarding menu catalog items, dining GST, staff shifts, or kitchen ingredients.`;
}
