/**
 * DineSmart Live Executive Operations Orchestrator
 * Parameterized Tool Calling over Live Supabase Data with Plain-Language Synthesis.
 * Strict time-zone resolution in Asia/Kolkata (+05:30).
 */

import { RAGResponse, TelemetryLog, Citation } from './types';
import { TOOL_SCHEMAS, executeToolCall } from './liveTools';

const getEnv = (key: string, def = '') => 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) || 
  ((globalThis as any).process?.env?.[key]) || def;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const getApiKey = () => getEnv('VITE_GROQ_API_KEY');
const MODEL = getEnv('VITE_GROQ_MODEL', 'openai/gpt-oss-120b');

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

/**
 * Prompt Injection & Security Guards
 */
const SECURITY_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|initial\s+instructions|instructions|prompt)/i,
  /print\s+(the\s+)?(system\s+prompt|raw\s+prompt|developer\s+mode)/i,
  /you\s+are\s+now\s+(in\s+developer\s+mode|DAN|an\s+unfiltered\s+AI)/i,
  /override\s+(all\s+)?(safety|system|security)\s+(rules|guidelines)/i,
  /drop\s+table/i,
  /delete\s+from/i,
  /database\s+password/i,
  /employee\s+password/i
];

const FIRST_PASS_SYSTEM = `You are the DineSmart AI Operations Assistant for TableTap hotel & restaurant management.
Current Date in Asia/Kolkata: ${new Date().toISOString().slice(0, 10)}.
Select the most appropriate tool to fetch live data for the restaurant owner, or reply directly if it is a general conversational greeting or simple clarification.`;

const SYNTHESIS_SYSTEM = `You are the DineSmart Executive Operations Assistant for TableTap hotel and restaurant management.
You communicate directly with the restaurant owner / general manager in plain, executive English.

CRITICAL RULES:
1. START WITH DIRECT ANSWER: Always begin with a crisp, one-sentence direct answer containing the key metric(s). (e.g., "Today you have 1 order and ₹305 in revenue (all-time recorded: 34 orders, ₹7,078).")
2. PLAIN LANGUAGE: Write for a busy restaurant owner. Never output developer jargon, SQL queries, database table names, or internal tags (like [POL-TAX-01] or [MENU-SP6]).
3. SHORT BULLETS OR TABLES: Use a short 2-4 row Markdown table or clean bullets only when it clarifies rankings or comparisons.
4. INDIAN NUMBER FORMATTING: Always use the ₹ symbol with standard Indian number grouping (e.g., ₹7,078, ₹24,500).
5. STATE DATE RANGE: Always explicitly mention the date range or timeframe used for the figures.
6. PRACTICAL INSIGHTS: Add 1-2 practical operational tips or suggested actions when supported by the data.
7. CONCISE: Keep the entire response under ~150 words unless asked for detail.
8. HONESTY: Never invent or estimate numbers. If data is not tracked (e.g. kitchen prep timestamps), state plainly that it is not yet recorded and what is needed to track it.
9. AMBIGUITY: If a question is ambiguous, provide what data is available and ask one short clarifying question.`;

/**
 * Robust Groq API caller with automatic 429 rate limit backoff
 */
async function callGroqWithBackoff(payload: any, retries = 3): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('VITE_GROQ_API_KEY is not configured.');
  }

  for (let i = 0; i < retries; i++) {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 429) {
      // Respect Groq token rate limit with backoff
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    return await res.json();
  }

  throw new Error('Groq rate limit exceeded after retries.');
}

function formatToolResultFallback(toolName: string, result: any): string {
  if (!result || typeof result !== 'object') return 'I could not retrieve data for that request. Please try again.';

  if (toolName === 'get_sales_summary') {
    const s = result.summary || result;
    const rev = Number(s.gross_revenue || s.total_revenue || 0).toLocaleString('en-IN');
    const orders = s.total_orders || s.order_count || 0;
    return `During the requested period (${result.date_range || 'Today'}), there were **${orders} orders** recorded, generating **₹${rev}** in gross revenue.`;
  }

  if (toolName === 'get_top_items') {
    const items = result.top_dishes || result.items || [];
    if (!items.length) return `No dish sales recorded for ${result.date_range || 'the requested period'}.`;
    const list = items.slice(0, 5).map((it: any, i: number) => `${i + 1}. **${it.name}** — ${it.total_quantity_sold || it.quantity || 0} sold (₹${Number(it.revenue || 0).toLocaleString('en-IN')})`).join('\n');
    return `Here are the top-selling dishes (${result.date_range || 'recent'}):\n\n${list}`;
  }

  if (toolName === 'get_table_status') {
    return `Currently, **${result.occupied_tables || 0} out of ${result.total_tables || 12} tables** are occupied (${result.occupancy_rate || 0}% occupancy). ${result.available_tables || 0} tables are currently available for seating.`;
  }

  if (toolName === 'get_restaurant_policy') {
    return result.policy_text || result.policy || 'Our standard restaurant policy is active.';
  }

  if (toolName === 'get_cancellations') {
    return `For ${result.date_range || 'the recorded period'}, there were **${result.cancellation_count || 0} cancelled orders** out of ${result.total_orders || 0} total orders (${result.cancellation_rate || 0}% cancellation rate).`;
  }

  if (toolName === 'get_low_stock_items') {
    return result.message || `There are currently **${result.low_stock_count || 0} ingredients** below minimum stock levels.`;
  }

  // General clean bullet summary
  const summaryParts = Object.entries(result)
    .filter(([k]) => k !== 'date_range' && k !== 'citations')
    .slice(0, 5)
    .map(([k, v]) => `• **${k.replace(/_/g, ' ')}**: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');
  return `Verified data for ${result.date_range || 'your request'}:\n\n${summaryParts}`;
}

export const ragOrchestrator = {
  processAdminQuery: async (
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    liveData: any = {}
  ): Promise<RAGResponse> => {
    const startTime = performance.now();
    const requestId = generateRequestId();
    const cleanQuery = (query || '').trim();

    // 1. Security & Guardrails
    for (const pattern of SECURITY_PATTERNS) {
      if (pattern.test(cleanQuery)) {
        const totalLatency = Math.round(performance.now() - startTime);
        return {
          answer: `### Security Violation & Access Restricted\n\nThe system detected an unauthorized instruction override or adversarial request.\n\n- **Security Policy**: Database credentials, passwords, and system prompts are strictly protected.\n- **Audit Action**: Request ID \`${requestId}\` has been flagged.`,
          scope: 'UNSAFE_OR_UNAUTHORIZED',
          citations: [],
          decisionReadiness: 'NOT_DECISION_READY',
          telemetry: {
            requestId,
            timestamp: new Date().toISOString(),
            userQuery: query,
            scope: 'UNSAFE_OR_UNAUTHORIZED',
            retrievalHitCount: 0,
            retrievalLatencyMs: 0,
            inferenceLatencyMs: 0,
            totalLatencyMs: totalLatency,
            provider: 'GROUNDED_LOCAL_ENGINE',
            modelUsed: 'SecurityGuard',
            citationsCount: 0,
            decisionReadiness: 'NOT_DECISION_READY',
            securityFlags: ['PROMPT_INJECTION_DETECTED']
          }
        };
      }
    }

    // 2. Step 1: Tool Selection or Natural Direct Reply
    let choice1: any = null;
    let toolUsed = 'NONE';
    let toolResult: any = null;
    const citations: Citation[] = [];

    try {
      const groqRes1 = await callGroqWithBackoff({
        model: MODEL,
        messages: [
          { role: 'system', content: FIRST_PASS_SYSTEM },
          ...history.slice(-4).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: cleanQuery }
        ],
        tools: TOOL_SCHEMAS,
        tool_choice: 'auto',
        max_tokens: 300,
        reasoning_format: 'hidden',
        temperature: 0.1
      });

      choice1 = groqRes1.choices?.[0]?.message;
    } catch (err: any) {
      console.warn('[RAGOrchestrator] First-pass tool selection error:', err.message);
    }

    // 3. If direct conversational answer (e.g. Greeting or direct question)
    if (choice1 && (!choice1.tool_calls || choice1.tool_calls.length === 0) && choice1.content) {
      const totalLatency = Math.round(performance.now() - startTime);
      return {
        answer: choice1.content.trim(),
        scope: 'IN_SCOPE',
        citations: [],
        decisionReadiness: 'DECISION_READY',
        telemetry: {
          requestId,
          timestamp: new Date().toISOString(),
          userQuery: query,
          scope: 'IN_SCOPE',
          retrievalHitCount: 0,
          retrievalLatencyMs: 0,
          inferenceLatencyMs: totalLatency,
          totalLatencyMs: totalLatency,
          provider: 'GROQ_CLOUD',
          modelUsed: MODEL,
          citationsCount: 0,
          decisionReadiness: 'DECISION_READY',
          securityFlags: []
        }
      };
    }

    // 4. Execute Selected Tool on Live Supabase Tables
    let toolStart = performance.now();
    if (choice1?.tool_calls && choice1.tool_calls.length > 0) {
      const call = choice1.tool_calls[0];
      toolUsed = call.function.name;
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(call.function.arguments || '{}');
      } catch (e) {}

      toolResult = await executeToolCall(toolUsed, toolArgs);
      citations.push({
        sourceId: `SUPABASE-${toolUsed.toUpperCase()}`,
        sourceType: 'LIVE_DATABASE',
        title: `Supabase Live Tool: ${toolUsed}`,
        verifiedClaim: `Executed on live database tables with parameters: ${JSON.stringify(toolArgs)}`,
        confidence: 0.99,
        timestamp: new Date().toISOString()
      });
    } else {
      // Fallback: Default to sales summary if no tool was picked
      toolUsed = 'get_sales_summary';
      toolResult = await executeToolCall('get_sales_summary', {});
    }
    const retrievalLatency = Math.round(performance.now() - toolStart);

    // 5. Step 2: Plain-Language Executive Synthesis
    let finalAnswer = '';
    const inferStart = performance.now();

    try {
      const groqRes2 = await callGroqWithBackoff({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 350,
        reasoning_format: 'hidden',
        messages: [
          { role: 'system', content: SYNTHESIS_SYSTEM },
          { 
            role: 'user', 
            content: `User Question: "${cleanQuery}"\n\nLIVE DATABASE DATA / VERIFIED FACTS:\n${JSON.stringify(toolResult, null, 2)}\n\nAnswer the restaurant owner directly following the critical rules.` 
          }
        ]
      });

      finalAnswer = groqRes2.choices?.[0]?.message?.content?.trim() || '';
    } catch (err: any) {
      console.warn('[RAGOrchestrator] Synthesis error:', err.message);
      // Graceful plain-language fallback from raw tool result
      finalAnswer = formatToolResultFallback(toolUsed, toolResult);
    }

    const inferenceLatency = Math.round(performance.now() - inferStart);
    const totalLatency = Math.round(performance.now() - startTime);

    return {
      answer: finalAnswer,
      scope: 'IN_SCOPE',
      citations,
      decisionReadiness: 'DECISION_READY',
      telemetry: {
        requestId,
        timestamp: new Date().toISOString(),
        userQuery: query,
        scope: 'IN_SCOPE',
        retrievalHitCount: citations.length,
        retrievalLatencyMs: retrievalLatency,
        inferenceLatencyMs: inferenceLatency,
        totalLatencyMs: totalLatency,
        provider: 'GROQ_CLOUD',
        modelUsed: `${MODEL} + ${toolUsed}`,
        citationsCount: citations.length,
        decisionReadiness: 'DECISION_READY',
        securityFlags: []
      }
    };
  }
};
