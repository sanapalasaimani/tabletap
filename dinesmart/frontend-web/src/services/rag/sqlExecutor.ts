/**
 * TableTap / DineSmart SQL Executor
 * Executes validated, read-only SQL queries via the secure Supabase RPC endpoint.
 */

import { createClient } from '@supabase/supabase-js';
import { RAG_CONFIG } from './ragConfig';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

export interface SQLExecutionResult {
  success: boolean;
  sql: string;
  rows: any[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  sourceEngine: 'SUPABASE_RPC' | 'SERVER_PROXY' | 'CLIENT_FALLBACK';
}

/**
 * Executes a sanitized read-only SQL statement through Supabase RPC `execute_readonly_sql`.
 */
export async function executeReadOnlySQL(sanitizedSql: string): Promise<SQLExecutionResult> {
  const startTime = performance.now();

  if (!supabase) {
    return {
      success: false,
      sql: sanitizedSql,
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: 'Supabase client is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      sourceEngine: 'SUPABASE_RPC'
    };
  }

  // 1. Primary Path: Attempt secure server-side RPC proxy if available
  try {
    const proxyResponse = await fetch('/api/analytics-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sanitizedSql }),
    });

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      const elapsed = Math.round(performance.now() - startTime);
      return {
        success: true,
        sql: sanitizedSql,
        rows: Array.isArray(data) ? data : (data.rows || []),
        rowCount: Array.isArray(data) ? data.length : (data.rows?.length || 0),
        executionTimeMs: elapsed,
        sourceEngine: 'SERVER_PROXY'
      };
    }
  } catch (proxyErr) {
    // Non-blocking: Server proxy not present (e.g. standalone client execution)
  }

  // 2. Secondary Path: Invoke Supabase RPC `execute_readonly_sql` directly
  try {
    const { data, error } = await supabase.rpc('execute_readonly_sql', {
      query_text: sanitizedSql
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (error) {
      // If RPC is missing because the migration hasn't been run yet in the console:
      console.warn(`[SQLExecutor] RPC call error: ${error.message}`);
      return {
        success: false,
        sql: sanitizedSql,
        rows: [],
        rowCount: 0,
        executionTimeMs: elapsed,
        error: error.message,
        sourceEngine: 'SUPABASE_RPC'
      };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      success: true,
      sql: sanitizedSql,
      rows,
      rowCount: rows.length,
      executionTimeMs: elapsed,
      sourceEngine: 'SUPABASE_RPC'
    };
  } catch (rpcErr: any) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: false,
      sql: sanitizedSql,
      rows: [],
      rowCount: 0,
      executionTimeMs: elapsed,
      error: rpcErr?.message || String(rpcErr),
      sourceEngine: 'SUPABASE_RPC'
    };
  }
}

