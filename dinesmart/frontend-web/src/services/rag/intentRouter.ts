/**
 * TableTap / DineSmart Intent Router & Guardrails
 * Routes executive queries to Text-to-SQL, Semantic Search, Hybrid, Rooms Unavailable, or Out-of-Scope.
 */

import { RAG_CONFIG } from './ragConfig';

export type RouterIntent = 
  | 'TEXT_TO_SQL'
  | 'SEMANTIC_DOC'
  | 'HYBRID'
  | 'ROOMS_UNAVAILABLE'
  | 'OUT_OF_SCOPE'
  | 'UNSAFE';

export interface RouteClassification {
  intent: RouterIntent;
  confidence: number;
  reason: string;
  suggestedTables?: string[];
  requiresHistoricalData?: boolean;
}

// Rooms-specific keywords for fast deterministic intercept
const ROOM_METRIC_KEYWORDS = [
  'occupancy', 'occupancy rate', 'adr', 'average daily rate', 'revpar',
  'revenue per available room', 'room booking', 'room bookings', 'hotel rooms',
  'check-in', 'check-out', 'length of stay', 'los', 'room night', 'room revenue',
  'suite', 'deluxe room', 'bed nights'
];

// Factual / Numerical / Aggregation keywords for SQL routing
const SQL_METRIC_KEYWORDS = [
  'how many', 'total', 'sum', 'count', 'average', 'avg', 'aov', 'revenue',
  'sales', 'income', 'orders', 'order count', 'discounts', 'discount', 'tips',
  'tip amount', 'waiter', 'waiters', 'staff', 'salary', 'inventory', 'stock',
  'cost', 'gross', 'net', 'cancellation', 'cancelled', 'top dishes', 'best selling',
  'least selling', 'highest', 'lowest', 'yesterday', 'today', 'this month',
  'last week', 'last month', '7 days', '30 days', 'table turns', 'gst', 'upi',
  'cash', 'card payment'
];

// SOP / Policy / Recipe / Allergen keywords
const SEMANTIC_DOC_KEYWORDS = [
  'recipe', 'ingredients', 'how to make', 'how to prepare', 'allergen',
  'gluten', 'dairy', 'sop', 'standard operating procedure', 'policy',
  'hygiene', 'dress code', 'refund policy', 'cancellation policy',
  'customer review', 'sentiment', 'feedback comments', 'guidelines'
];

// Strategic / Optimization keywords requiring both data and recommendations
const STRATEGIC_KEYWORDS = [
  'why did', 'how can we improve', 'strategy', 'recommend', 'recommendation',
  'optimize', 'boost profit', 'increase revenue', 'bottleneck', 'action plan',
  'what should we do', 'suggest promotion'
];

export function routeQuery(query: string): RouteClassification {
  const clean = query.toLowerCase().trim();

  // 1. Security / Prompt Injection check
  if (
    clean.includes('ignore previous instructions') ||
    clean.includes('system prompt') ||
    clean.includes('reveal prompt') ||
    clean.includes('database password') ||
    clean.includes('drop table') ||
    clean.includes('delete from') ||
    clean.includes('shutdown')
  ) {
    return {
      intent: 'UNSAFE',
      confidence: 1.0,
      reason: 'Adversarial prompt injection or security violation pattern detected.'
    };
  }

  // 2. Hotel Rooms Check (Strictly blocked / Missing data boundary)
  if (!RAG_CONFIG.features.roomsDataEnabled) {
    for (const kw of ROOM_METRIC_KEYWORDS) {
      if (clean.includes(kw)) {
        return {
          intent: 'ROOMS_UNAVAILABLE',
          confidence: 0.99,
          reason: `Query requests hotel room metric "${kw}" which is not connected to live tables.`
        };
      }
    }
  }

  // 3. Strategic / Hybrid Check
  const hasStrategic = STRATEGIC_KEYWORDS.some(kw => clean.includes(kw));
  const hasNumbers = SQL_METRIC_KEYWORDS.some(kw => clean.includes(kw));
  const hasSemantic = SEMANTIC_DOC_KEYWORDS.some(kw => clean.includes(kw));

  if (hasStrategic && (hasNumbers || clean.includes('sales') || clean.includes('profit') || clean.includes('menu'))) {
    return {
      intent: 'HYBRID',
      confidence: 0.92,
      reason: 'Strategic inquiry requiring numerical database aggregates paired with operational advisory.'
    };
  }

  // 4. Pure Text-to-SQL Check
  if (hasNumbers || clean.match(/\b(sum|avg|count|total|orders?|revenue|dishes|waiters?|staff|price|inventory)\b/i)) {
    const historicalKeywords = ['last year', '1 year', 'annual', 'historical', 'trend over year'];
    const requiresHistorical = historicalKeywords.some(kw => clean.includes(kw));

    return {
      intent: 'TEXT_TO_SQL',
      confidence: 0.95,
      reason: 'Factual or quantitative query requiring deterministic database aggregates.',
      requiresHistoricalData: requiresHistorical
    };
  }

  // 5. Semantic Document Search Check
  if (hasSemantic || clean.includes('dish') || clean.includes('spicy') || clean.includes('taste')) {
    return {
      intent: 'SEMANTIC_DOC',
      confidence: 0.90,
      reason: 'Qualitative query requesting recipes, culinary attributes, SOPs, or customer sentiments.'
    };
  }

  // 6. Generic Out of Scope Check (Non-hospitality)
  const outOfScopePatterns = [
    /\bpython\b/i, /\bjavascript\b/i, /\bcode\b/i, /\bweather\b/i,
    /\bpresident\b/i, /\belection\b/i, /\bcapital of\b/i, /\bmovie\b/i
  ];
  if (outOfScopePatterns.some(p => p.test(clean))) {
    return {
      intent: 'OUT_OF_SCOPE',
      confidence: 0.95,
      reason: 'Inquiry outside hotel, restaurant, and dining operations scope.'
    };
  }

  // Default to Text-to-SQL for operational questions, or fallback to Semantic
  return {
    intent: 'TEXT_TO_SQL',
    confidence: 0.75,
    reason: 'Operational restaurant query defaulted to database inspection.'
  };
}

