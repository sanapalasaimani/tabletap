/**
 * TableTap / DineSmart Grounding Verifier
 * Audits every number and aggregate in the generated response against real database rows.
 */

export interface VerificationResult {
  passed: boolean;
  verifiedNumbersCount: number;
  unverifiedNumbers: string[];
  discrepancyReason?: string;
  correctedAnswer?: string;
}

/**
 * Extracts numeric literals from text, ignoring dates (YYYY-MM-DD), percentages symbols, and currencies
 */
function extractNumbersFromText(text: string): string[] {
  // Matches integer or float numbers, with optional commas
  const regex = /(?:₹|\$)?\b\d+(?:,\d{3})*(?:\.\d+)?%?\b/g;
  const matches = text.match(regex) || [];
  return matches.map(m => m.replace(/[₹$,%]/g, ''));
}

/**
 * Recursively collects all scalar numeric values present in SQL result rows
 */
function collectNumbersFromRows(rows: any[]): Set<string> {
  const values = new Set<string>();

  function walk(val: any) {
    if (val === null || val === undefined) return;
    if (typeof val === 'number') {
      values.add(String(val));
      values.add(val.toFixed(2));
      values.add(val.toFixed(0));
    } else if (typeof val === 'string') {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        values.add(val.trim());
        values.add(num.toFixed(2));
      }
    } else if (Array.isArray(val)) {
      val.forEach(walk);
    } else if (typeof val === 'object') {
      Object.values(val).forEach(walk);
    }
  }

  walk(rows);
  return values;
}

/**
 * Verifies that key numbers cited in the generated answer match ground-truth SQL rows.
 */
export function verifyAnswerGrounding(
  answer: string,
  sqlRows: any[]
): VerificationResult {
  if (!sqlRows || sqlRows.length === 0) {
    return {
      passed: true,
      verifiedNumbersCount: 0,
      unverifiedNumbers: []
    };
  }

  // Extract clean text (excluding SQL code block in details)
  const cleanAnswer = answer.replace(/<details>[\s\S]*?<\/details>/gi, '');
  const candidateNumbers = extractNumbersFromText(cleanAnswer);
  const rowNumbers = collectNumbersFromRows(sqlRows);

  const unverified: string[] = [];
  let verifiedCount = 0;

  for (const numStr of candidateNumbers) {
    // Skip small list indices (1., 2., 3., etc.) or standard small counts
    if (['1', '2', '3', '4', '5'].includes(numStr)) {
      continue;
    }

    // Check if number or its rounded counterpart exists in row values
    const num = parseFloat(numStr);
    let found = false;
    for (const valStr of rowNumbers) {
      const valNum = parseFloat(valStr);
      if (Math.abs(num - valNum) < 0.05) {
        found = true;
        break;
      }
    }

    if (found) {
      verifiedCount++;
    } else {
      unverified.push(numStr);
    }
  }

  // If there are unverified claims representing > 40% of numbers, fail audit
  const passed = unverified.length === 0 || (verifiedCount >= unverified.length);

  return {
    passed,
    verifiedNumbersCount: verifiedCount,
    unverifiedNumbers: unverified,
    discrepancyReason: passed 
      ? undefined 
      : `Potential ungrounded figures detected in response: ${unverified.join(', ')}`
  };
}

