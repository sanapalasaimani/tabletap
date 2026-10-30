/**
 * TableTap / DineSmart Grounded Answer Generator
 * Explains deterministic SQL results and formats provenance without hallucinating numbers.
 */

import { RAG_CONFIG } from './ragConfig';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface AnswerGenerationInput {
  userQuery: string;
  sql: string;
  rows: any[];
  executionTimeMs: number;
  isStrategic?: boolean;
}

export interface GroundedAnswerResult {
  answer: string;
  sqlUsed: string;
  rowCount: number;
  executionTimeMs: number;
  modelUsed: string;
}

/**
 * Builds formatted prompt enforcing that all numbers originate strictly from returned rows.
 */
function buildAnswerSystemPrompt(isStrategic: boolean): string {
  const temperatureNote = isStrategic
    ? 'Provide data-backed strategic recommendations strictly derived from the numbers below.'
    : 'Report exact facts and figures directly from the SQL result set. Do NOT calculate, estimate, or modify values.';

  return `You are the DineSmart Executive Operations Analyst.
Your goal is to provide a clear, executive-ready explanation of the PostgreSQL query results below.

CRITICAL OPERATIONAL RULES:
1. STRICT DATA GROUNDING: Every number, total, count, average, and entity name in your answer MUST come directly from the SQL RESULT ROWS below.
2. NO HALLUCINATIONS: Never invent, extrapolate, or estimate figures. If a metric or column is null or empty, state that the database has no records.
3. ${temperatureNote}
4. FORMATTING: Use Markdown tables where appropriate. Format currency with the ₹ symbol (e.g. ₹2,450.00). Keep explanations concise and professional.
5. NEVER OUTPUT THE SQL CODE DIRECTLY IN YOUR EXPLANATORY TEXT. The SQL query will be attached automatically in the provenance metadata.
`.trim();
}

const getGroqKey = () => (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GROQ_API_KEY) || ((globalThis as any).process?.env?.VITE_GROQ_API_KEY) || '';

export async function generateGroundedAnswer(input: AnswerGenerationInput): Promise<GroundedAnswerResult> {
  const apiKey = getGroqKey();
  const isStrategic = Boolean(input.isStrategic);
  const temperature = isStrategic 
    ? RAG_CONFIG.temperatures.answerStrategy 
    : RAG_CONFIG.temperatures.answerFactual;

  // Handle empty result set honestly
  if (!input.rows || input.rows.length === 0) {
    const emptyAnswer = `### Database Query Result

The database executed your request successfully but returned **0 matching records** for this time period or filter.

- **Status**: No records found in the database.
- **Tables Queried**: Verified live schema.

<details>
<summary><b>View Executed SQL & Provenance</b></summary>

\`\`\`sql
${input.sql}
\`\`\`

- **Execution Time**: ${input.executionTimeMs}ms
- **Rows Returned**: 0
</details>`;

    return {
      answer: emptyAnswer,
      sqlUsed: input.sql,
      rowCount: 0,
      executionTimeMs: input.executionTimeMs,
      modelUsed: 'GroundedLocalFilter'
    };
  }

  // If Groq API key is missing or invalid, generate high-fidelity deterministic table representation locally
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    const tableMarkdown = formatRowsAsMarkdownTable(input.rows);
    const provenanceBlock = `
<details>
<summary><b>View Executed SQL & Provenance</b></summary>

\`\`\`sql
${input.sql}
\`\`\`

- **Execution Time**: ${input.executionTimeMs}ms
- **Rows Returned**: ${input.rows.length}
</details>`;

    return {
      answer: `### Operational Analytics Summary\n\n${tableMarkdown}\n${provenanceBlock}`,
      sqlUsed: input.sql,
      rowCount: input.rows.length,
      executionTimeMs: input.executionTimeMs,
      modelUsed: 'DeterministicTableEngine'
    };
  }

  const systemPrompt = buildAnswerSystemPrompt(isStrategic);
  const rowsSummary = JSON.stringify(input.rows.slice(0, 30), null, 2);

  const userPrompt = `
User Question: "${input.userQuery}"

SQL QUERY EXECUTED:
${input.sql}

SQL RESULT ROWS (${input.rows.length} rows returned):
${rowsSummary}

Explain these results to the restaurant operations manager clearly and accurately.
`.trim();

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: RAG_CONFIG.models.answer,
        temperature,
        max_tokens: RAG_CONFIG.maxTokens.answer,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq Answer API error ${response.status}`);
    }

    const data = await response.json();
    let answerText = data.choices?.[0]?.message?.content || '';

    // Append structured provenance block
    const provenanceBlock = `\n\n<details>
<summary><b>View Executed SQL & Provenance</b></summary>

\`\`\`sql
${input.sql}
\`\`\`

- **Execution Time**: ${input.executionTimeMs}ms
- **Rows Returned**: ${input.rows.length}
- **Engine**: Supabase Read-Only Analytics RPC
</details>`;

    answerText += provenanceBlock;

    return {
      answer: answerText,
      sqlUsed: input.sql,
      rowCount: input.rows.length,
      executionTimeMs: input.executionTimeMs,
      modelUsed: RAG_CONFIG.models.answer
    };
  } catch (error: any) {
    // Graceful deterministic table fallback on API failure
    console.warn('[AnswerGenerator] Groq inference error, using deterministic table formatter:', error);
    const tableMarkdown = formatRowsAsMarkdownTable(input.rows);
    return {
      answer: `### Operational Analytics Summary\n\n${tableMarkdown}\n\n<details>\n<summary><b>View Executed SQL & Provenance</b></summary>\n\n\`\`\`sql\n${input.sql}\n\`\`\`\n\n- **Execution Time**: ${input.executionTimeMs}ms\n- **Rows Returned**: ${input.rows.length}\n</details>`,
      sqlUsed: input.sql,
      rowCount: input.rows.length,
      executionTimeMs: input.executionTimeMs,
      modelUsed: 'DeterministicTableEngine'
    };
  }
}

/**
 * Generates an executive natural-language answer grounded strictly in retrieved SOPs and menu documentation.
 */
export async function generateSemanticAnswer(userQuery: string, evidenceContext: string): Promise<string> {
  const apiKey = getGroqKey();
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    return evidenceContext;
  }

  const systemPrompt = `You are the DineSmart Executive Operations Analyst.
Your goal is to answer the user's question accurately using ONLY the retrieved policies, SOPs, recipes, and menu information below.

CRITICAL RULES:
1. ONLY state facts present in the retrieved evidence below.
2. If an allergen, ingredient, or rule is not mentioned, say "The documentation does not specify this." Never guess.
3. Use clean GitHub-style Markdown with bullet points or tables.
4. Keep the tone professional, objective, and executive-ready.

[VERIFIED RETRIEVED EVIDENCE]
${evidenceContext}
`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: RAG_CONFIG.models.answer,
        temperature: RAG_CONFIG.temperatures.answerFactual,
        max_tokens: RAG_CONFIG.maxTokens.answer,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq API error ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || evidenceContext;
  } catch (err) {
    console.warn('[AnswerGenerator] Semantic inference error, returning direct evidence context:', err);
    return evidenceContext;
  }
}

/**
 * Deterministically formats array of objects into GitHub-flavored Markdown table
 */
export function formatRowsAsMarkdownTable(rows: any[]): string {
  if (!rows || rows.length === 0) return '_No rows returned._';

  const first = rows[0];
  if (typeof first !== 'object' || first === null) {
    return rows.map(r => `- ${String(r)}`).join('\n');
  }

  const headers = Object.keys(first);
  const headerRow = `| ${headers.map(h => formatHeader(h)).join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

  const dataRows = rows.slice(0, 25).map(row => {
    return `| ${headers.map(h => formatCellValue(row[h])).join(' | ')} |`;
  });

  return `${headerRow}\n${separatorRow}\n${dataRows.join('\n')}`;
}

function formatHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString('en-IN') : val.toFixed(2);
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

