/**
 * TableTap / DineSmart SQL AST Validator & Sanitizer
 * Enforces zero-trust database security before executing queries against Supabase.
 */

import { parse, parseFirst, Statement } from 'pgsql-ast-parser';
import { RAG_CONFIG } from './ragConfig';

export interface ValidationResult {
  valid: boolean;
  sanitizedSql?: string;
  error?: string;
  referencedTables?: string[];
}

const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
  'grant', 'revoke', 'reset', 'copy', 'vacuum', 'reindex', 'cluster',
  'pg_sleep', 'pg_read_file', 'pg_write_file', 'pg_terminate_backend'
];

/**
 * Validates generated SQL against AST grammar, table allowlists, and execution limits.
 */
export function validateAndSanitizeSQL(rawSql: string): ValidationResult {
  if (!rawSql || typeof rawSql !== 'string') {
    return { valid: false, error: 'Empty or non-string SQL statement received.' };
  }

  // 1. Strip markdown fences if LLM wrapped SQL in ```sql ... ```
  let sql = rawSql.trim();
  if (sql.startsWith('```')) {
    sql = sql.replace(/^```(?:sql)?/i, '').replace(/```$/, '').trim();
  }

  // Strip trailing semicolons
  while (sql.endsWith(';')) {
    sql = sql.slice(0, -1).trim();
  }

  // 2. Reject multi-statement queries
  if (sql.includes(';')) {
    return {
      valid: false,
      error: 'Security Violation: Multi-statement queries containing semicolons are forbidden.'
    };
  }

  // 3. Fast keyword scan for destructive DDL/DML
  const lowerSql = sql.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const wordBoundaryRegex = new RegExp(`\\b${kw}\\b`, 'i');
    if (wordBoundaryRegex.test(lowerSql)) {
      return {
        valid: false,
        error: `Security Violation: Prohibited SQL token or function "${kw}" detected.`
      };
    }
  }

  // 4. Must begin with SELECT or WITH
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    return {
      valid: false,
      error: 'Security Violation: Only read-only SELECT or WITH statements are allowed.'
    };
  }

  // 5. AST Parsing using pgsql-ast-parser
  let astList: Statement[];
  try {
    astList = parse(sql);
  } catch (parseError: any) {
    return {
      valid: false,
      error: `SQL Syntax Error: Could not parse statement. Details: ${parseError.message || parseError}`
    };
  }

  if (astList.length !== 1) {
    return {
      valid: false,
      error: 'Security Violation: Exactly one SQL statement is permitted.'
    };
  }

  const statement = astList[0];
  if (statement.type !== 'select') {
    return {
      valid: false,
      error: `Security Violation: Expected a SELECT query but received statement type "${statement.type}".`
    };
  }

  // 6. Table & Column Allowlist Verification
  const referencedTables: string[] = [];
  const allowlist = RAG_CONFIG.databaseAllowlist;

  function inspectFrom(fromNode: any) {
    if (!fromNode) return;
    if (Array.isArray(fromNode)) {
      fromNode.forEach(inspectFrom);
      return;
    }

    if (fromNode.type === 'table') {
      const name = (fromNode.name?.name || '').toLowerCase();
      if (name) referencedTables.push(name);
    } else if (fromNode.type === 'statement') {
      // Subquery
      inspectSelect(fromNode.statement);
    }

    if (fromNode.join) {
      inspectFrom(fromNode.join);
    }
  }

  function inspectSelect(sel: any) {
    if (!sel) return;
    if (sel.from) inspectFrom(sel.from);
  }

  inspectSelect(statement);

  // Check extracted tables against allowlist
  for (const tbl of referencedTables) {
    if (!allowlist[tbl]) {
      return {
        valid: false,
        error: `Access Denied: Table "${tbl}" is not on the permitted database allowlist.`
      };
    }
  }

  // Specific check: Prohibit 'password' column anywhere in queries on staff
  if (lowerSql.includes('password')) {
    return {
      valid: false,
      error: 'Access Denied: Querying the "password" column is strictly prohibited.'
    };
  }

  // 7. Enforce LIMIT on result set (defaults to 50 rows if missing or unbounded)
  let sanitizedSql = sql;
  if (!statement.limit && !/\bLIMIT\s+\d+/i.test(sanitizedSql)) {
    sanitizedSql = `${sanitizedSql} LIMIT 50`;
  }

  return {
    valid: true,
    sanitizedSql,
    referencedTables
  };
}

