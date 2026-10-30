/**
 * TableTap / DineSmart Text-to-SQL Generator with 1-Shot Self-Correction Loop
 * Generates deterministic, strictly-grounded PostgreSQL queries for executive analytics.
 */

import { RAG_CONFIG, getSystemTemporalContext } from './ragConfig';
import { pruneSchemaForQuery, formatSchemaForPrompt } from './schemaIntrospector';
import { validateAndSanitizeSQL } from './sqlValidator';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY as string) || '';

/**
 * 6 High-Quality Few-Shot Examples ground the LLM in real table schemas and JSONB syntax
 */
const FEW_SHOT_EXAMPLES = `
-- Example 1: Total Revenue and Average Order Value today
-- User: "What is today's total revenue and average order value?"
SELECT 
  COALESCE(SUM(total), 0) AS todays_gross_revenue,
  COALESCE(ROUND(AVG(total), 2), 0) AS todays_aov,
  COUNT(id) AS todays_order_count
FROM orders
WHERE status != 'Cancelled'
  AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE;

-- Example 2: Top 5 selling dishes by volume and revenue (Unnesting JSONB items array)
-- User: "What are our top 5 best selling dishes and how much revenue did they make?"
SELECT 
  item->>'name' AS dish_name,
  SUM((item->>'quantity')::int) AS units_sold,
  SUM((item->>'quantity')::int * (item->>'price')::numeric) AS dish_revenue
FROM orders o,
     jsonb_array_elements(o.items) AS item
WHERE o.status != 'Cancelled'
GROUP BY item->>'name'
ORDER BY dish_revenue DESC
LIMIT 5;

-- Example 3: Waiter performance and tips (Filtering staff by role = 'Waiter')
-- User: "Show waiter performance, delivered orders, and tips earned"
SELECT 
  id,
  name,
  empid,
  shift,
  (performance->>'ordersDelivered')::int AS orders_delivered,
  (performance->>'tips')::numeric AS tips_earned,
  (performance->>'ratings')::numeric AS rating,
  (performance->>'score')::numeric AS score
FROM staff
WHERE role = 'Waiter'
ORDER BY orders_delivered DESC;

-- Example 4: Order cancellations and void rate
-- User: "How many orders were cancelled and what is our cancellation rate?"
SELECT 
  COUNT(*) FILTER (WHERE status = 'Cancelled') AS cancelled_orders,
  COUNT(*) AS total_orders,
  ROUND((COUNT(*) FILTER (WHERE status = 'Cancelled')::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS cancellation_rate_percent
FROM orders;

-- Example 5: Menu items count and pricing distribution by category
-- User: "Break down our menu items, average price, and veg count by category"
SELECT 
  category,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE is_veg = true) AS veg_count,
  COUNT(*) FILTER (WHERE is_veg = false) AS non_veg_count,
  ROUND(AVG(price), 2) AS average_price
FROM menu_items
WHERE available = true
GROUP BY category
ORDER BY total_items DESC;

-- Example 6: Kitchen inventory low-stock alert
-- User: "Which ingredients are running low on stock and need reordering?"
SELECT 
  name,
  stock,
  min_stock,
  unit,
  cost,
  (min_stock - stock) AS shortage_qty
FROM inventory
WHERE stock <= min_stock
ORDER BY (stock - min_stock) ASC;
`;

export interface SQLGenerationResult {
  sql: string;
  sanitizedSql: string;
  prunedTables: string[];
  wasCorrected: boolean;
  correctionRounds: number;
}

/**
 * Invokes Groq Chat Completion API for Text-to-SQL
 */
async function callGroqChat(messages: Array<{ role: string; content: string }>, model: string, temperature: number): Promise<string> {
  const apiKey = (import.meta.env.VITE_GROQ_API_KEY as string) || '';
  if (!apiKey) {
    throw new Error('VITE_GROQ_API_KEY is not configured.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: RAG_CONFIG.maxTokens.sql,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errBody}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

/**
 * Builds the grounded system prompt with schema, dates, and PostgreSQL rules
 */
function buildSqlSystemPrompt(prunedSchemaText: string): string {
  const temporal = getSystemTemporalContext();

  return `You are an expert PostgreSQL Database Analyst for DineSmart / TableTap hotel and restaurant operations.
Your ONLY task is to write a single, valid, highly-optimized PostgreSQL read-only query that answers the user's question.

CURRENT TEMPORAL CONTEXT:
- Current Date: ${temporal.date} (${temporal.dayOfWeek})
- Current Time: ${temporal.time}
- Timezone: ${temporal.timezone}
- Currency: ${RAG_CONFIG.localization.currencyCode} (${RAG_CONFIG.localization.currencySymbol})

AVAILABLE POSTGRESQL TABLES (PRUNED TO THIS QUERY):
${prunedSchemaText}

CRITICAL RULES:
1. DIALECT: PostgreSQL 15+.
2. STATEMENT TYPE: ONLY a single SELECT or WITH statement. Never output INSERT, UPDATE, DELETE, DROP, or ALTER.
3. NO SELECT *: Always explicitly enumerate required columns (e.g., SELECT id, total, status FROM orders).
4. QUALIFIED COLUMNS: When joining multiple tables, always prefix columns with table alias (e.g. o.total, s.name).
5. AGGREGATES & NULL HANDLING: Wrap aggregations with COALESCE (e.g. COALESCE(SUM(total), 0)) and round averages with ROUND(AVG(total), 2).
6. JSONB ITEMS UNNESTING: In table 'orders', dishes are in column 'items' (JSONB array). To query dishes, unnest via:
   FROM orders o, jsonb_array_elements(o.items) AS item
   Extract fields as item->>'name', (item->>'quantity')::int, (item->>'price')::numeric.
7. WAITER QUERIES: Waiters are in table 'staff'. ALWAYS include WHERE role = 'Waiter' when answering waiter questions. NEVER query 'password'.
8. LIMIT: Always append LIMIT 50 unless an explicit small limit is required.
9. OUTPUT FORMAT: Return ONLY the raw SQL statement. Do not wrap in conversational prose or explanations.

FEW-SHOT EXAMPLES:
${FEW_SHOT_EXAMPLES}
`.trim();
}

/**
 * Generates SQL for a natural language user query with 1-shot self-correction if invalid.
 */
export async function generateSQLQuery(
  userQuery: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<SQLGenerationResult> {
  // 1. Semantic schema pruning
  const relevantTables = pruneSchemaForQuery(userQuery);
  const prunedSchemaText = formatSchemaForPrompt(relevantTables);
  const tableNames = relevantTables.map(t => t.tableName);

  // 2. Build Prompt
  const systemPrompt = buildSqlSystemPrompt(prunedSchemaText);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-3).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userQuery }
  ];

  // 3. First Generation Attempt
  const rawSql = await callGroqChat(messages, RAG_CONFIG.models.sql, RAG_CONFIG.temperatures.sql);
  let validation = validateAndSanitizeSQL(rawSql);

  // If valid on first attempt, return immediately
  if (validation.valid && validation.sanitizedSql) {
    return {
      sql: rawSql.trim(),
      sanitizedSql: validation.sanitizedSql,
      prunedTables: tableNames,
      wasCorrected: false,
      correctionRounds: 0,
    };
  }

  // 4. 1-Shot Self-Correction Loop on AST or Validation Failure
  console.warn(`[SQLGenerator] First generation failed validation: ${validation.error}. Triggering 1-shot self-correction.`);

  const correctionMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery },
    { role: 'assistant', content: rawSql },
    { 
      role: 'user', 
      content: `Your generated SQL failed security or syntax validation with the following error:\n"${validation.error}"\n\nPlease fix this error and return ONLY the corrected, valid PostgreSQL SELECT statement.` 
    }
  ];

  const correctedRawSql = await callGroqChat(correctionMessages, RAG_CONFIG.models.sql, RAG_CONFIG.temperatures.sql);
  const secondValidation = validateAndSanitizeSQL(correctedRawSql);

  if (!secondValidation.valid || !secondValidation.sanitizedSql) {
    throw new Error(`SQL Generation Error: Self-correction failed validation. Reason: ${secondValidation.error}`);
  }

  return {
    sql: correctedRawSql.trim(),
    sanitizedSql: secondValidation.sanitizedSql,
    prunedTables: tableNames,
    wasCorrected: true,
    correctionRounds: 1,
  };
}

/**
 * Repairs a SQL statement that was valid according to AST but failed execution in PostgreSQL.
 */
export async function repairExecutedSQLError(
  userQuery: string,
  failedSql: string,
  dbErrorMessage: string
): Promise<string> {
  const relevantTables = pruneSchemaForQuery(userQuery);
  const prunedSchemaText = formatSchemaForPrompt(relevantTables);

  const systemPrompt = `You are an expert PostgreSQL Database Analyst. A previously generated SQL query failed at runtime in PostgreSQL. Fix the error. Return ONLY the corrected SQL query.

AVAILABLE SCHEMA:
${prunedSchemaText}
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Original Question: ${userQuery}` },
    { role: 'assistant', content: failedSql },
    { role: 'user', content: `PostgreSQL database returned runtime error:\n${dbErrorMessage}\n\nFix the query to eliminate this PostgreSQL runtime error. Return ONLY valid SQL.` }
  ];

  const repairedSql = await callGroqChat(messages, RAG_CONFIG.models.sql, RAG_CONFIG.temperatures.sql);
  const validation = validateAndSanitizeSQL(repairedSql);

  if (!validation.valid || !validation.sanitizedSql) {
    throw new Error(`Self-Correction Repair Failed: ${validation.error}`);
  }

  return validation.sanitizedSql;
}

