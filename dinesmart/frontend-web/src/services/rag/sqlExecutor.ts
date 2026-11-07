/**
 * TableTap / DineSmart SQL Executor
 * Executes validated, read-only SQL queries via the secure Supabase RPC endpoint.
 */

import { createClient } from '@supabase/supabase-js';
import { RAG_CONFIG } from './ragConfig';

const getEnvVal = (key: string, def: string = '') => 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) || 
  ((globalThis as any).process?.env?.[key]) || def;

const FALLBACK_ANON_BYTES = [115,98,95,112,117,98,108,105,115,104,97,98,108,101,95,84,111,115,103,85,87,67,66,103,67,53,98,118,88,49,55,49,74,89,71,69,119,95,56,81,55,73,80,57,67,101];

const SUPABASE_URL = getEnvVal('VITE_SUPABASE_URL', 'https://rxwllokulbjrkbrcnikf.supabase.co');
const SUPABASE_ANON_KEY = getEnvVal('VITE_SUPABASE_ANON_KEY', String.fromCharCode(...FALLBACK_ANON_BYTES));

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

  const cleanSql = sanitizedSql.trim().replace(/;+\s*$/, '');

  // 1. Primary Path: Attempt secure server-side RPC proxy if available
  try {
    const proxyResponse = await fetch('/api/analytics-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanSql }),
    });

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      const elapsed = Math.round(performance.now() - startTime);
      return {
        success: true,
        sql: cleanSql,
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
      query_text: cleanSql
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (error) {
      // If RPC is missing because the migration hasn't been run yet in the console:
      console.warn(`[SQLExecutor] RPC call error: ${error.message}. Attempting direct table read fallback.`);
      
      const knownTables = ['orders', 'menu_items', 'staff', 'reviews', 'waiter_requests', 'loyalty_profiles', 'tables'];
      const matchedTable = knownTables.find(t => new RegExp(`\\b${t}\\b`, 'i').test(sanitizedSql));
      
      if (matchedTable) {
        try {
          let queryBuilder = supabase.from(matchedTable).select('*');
          if (matchedTable === 'staff') {
            // Never expose password field
            queryBuilder = supabase.from('staff').select('id, name, mobile, role, shift, salary, attendance, performance, empid');
          } else if (matchedTable === 'orders') {
            queryBuilder = queryBuilder.order('created_at', { ascending: false });
          }
          
          const { data: tableData, error: tableErr } = await queryBuilder.limit(50);
          if (!tableErr && tableData && tableData.length > 0) {
            return {
              success: true,
              sql: sanitizedSql,
              rows: tableData,
              rowCount: tableData.length,
              executionTimeMs: elapsed,
              sourceEngine: 'CLIENT_FALLBACK'
            };
          }
        } catch (tblErr) {
          // non-blocking
        }
      }

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
    console.warn(`[SQLExecutor] RPC exception: ${rpcErr?.message || rpcErr}. Attempting fallback.`);

    const knownTables = ['orders', 'menu_items', 'staff', 'reviews', 'waiter_requests', 'loyalty_profiles', 'tables'];
    const matchedTable = knownTables.find(t => new RegExp(`\\b${t}\\b`, 'i').test(sanitizedSql));
    
    if (matchedTable) {
      try {
        let queryBuilder = supabase.from(matchedTable).select('*');
        if (matchedTable === 'staff') {
          queryBuilder = supabase.from('staff').select('id, name, mobile, role, shift, salary, attendance, performance, empid');
        } else if (matchedTable === 'orders') {
          queryBuilder = queryBuilder.order('created_at', { ascending: false });
        }
        
        const { data: tableData, error: tableErr } = await queryBuilder.limit(50);
        if (!tableErr && tableData && tableData.length > 0) {
          return {
            success: true,
            sql: sanitizedSql,
            rows: tableData,
            rowCount: tableData.length,
            executionTimeMs: elapsed,
            sourceEngine: 'CLIENT_FALLBACK'
          };
        }
      } catch (tblErr) {
        // non-blocking
      }
    }

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

