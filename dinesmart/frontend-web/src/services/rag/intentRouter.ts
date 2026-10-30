/**
 * TableTap / DineSmart Intent Router & Guardrails
 * Routes executive queries to Text-to-SQL, Semantic Search, Hybrid, Rooms Unavailable, or Out-of-Scope.
 */

import { RAG_CONFIG } from './ragConfig';

export type RouterIntent = 
  | 'GREETING'
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

// Strict word-boundary patterns for Hotel Lodging (avoids false positives like 'lost' matching 'los')
const ROOM_METRIC_PATTERNS = [
  /\boccupancy\b/i,
  /\boccupancy\s*rate\b/i,
  /\brevpar\b/i,
  /\baverage\s*daily\s*rate\b/i,
  /\bhotel\s*rooms?\b/i,
  /\broom\s*bookings?\b/i,
  /\blength\s*of\s*stay\b/i,
  /\balos\b/i,
  /\broom\s*nights?\b/i,
  /\broom\s*revenue\b/i,
  /\bhotel\s*check-?in\b/i,
  /\bhotel\s*check-?out\b/i,
  /\bdeluxe\s*room\b/i,
  /\bbed\s*nights\b/i
];

// Factual / Numerical / Aggregation keywords for SQL routing
const SQL_METRIC_KEYWORDS = [
  'how many orders', 'total revenue', 'total gross', 'sum of', 'count of', 'average order value',
  'aov', 'gross revenue', 'net revenue', 'sales report', 'order count', 'discounts given',
  'total tips', 'tip amount', 'salary', 'inventory count', 'stock count', 'least selling',
  'highest revenue', 'lowest revenue', 'yesterday revenue', 'revenue this month',
  'last week sales', 'last month revenue', '7 days revenue', '30 days sales', 'table turns'
];

// SOP / Policy / Recipe / Allergen keywords
const SEMANTIC_DOC_KEYWORDS = [
  'recipe', 'ingredients', 'how to make', 'how to prepare', 'allergen', 'allergens',
  'gluten', 'dairy', 'sop', 'standard operating procedure', 'policy', 'policies',
  'hygiene', 'dress code', 'refund policy', 'cancellation policy', 'order modification',
  'customer review', 'sentiment', 'feedback comments', 'guidelines', 'guideline',
  'standards', 'standard', 'protocol', 'protocols', 'etiquette', 'grace period',
  'operating hours', 'timings', 'opening', 'closing', 'expediter',
  'temperature', 'holding temperature', 'refrigeration', 'chopping board',
  'hand washing', 'fssai', 'last framework', 'complaint', 'service recovery',
  'payment methods', 'refund sla', 'service charge', 'tipping policy',
  'tax policy', 'gst', 'cgst', 'sgst', 'vat', 'luxury tax', 'excise',
  'vegan', 'celiac', 'safe for celiac', 'shift timings', 'two-bite',
  'greeting time', '5-step', 'service sequence', 'breakfast service',
  'items are served', 'walk-in dining', 'party reservations', 'capacity',
  'capacities', 'indoor dining tables', 'kds queue', 'delay alarms',
  'closing stock audit', 'wastage logging', 'food handlers', 'authorized to comp',
  'replace an unsatisfactory dish', 'nut allergens', 'walnut brownie'
];

// Strategic / Optimization keywords requiring both data and recommendations
const STRATEGIC_KEYWORDS = [
  'why did', 'how can we improve', 'strategy', 'recommend', 'recommendation',
  'optimize', 'boost profit', 'increase revenue', 'bottleneck', 'action plan',
  'what should we do', 'suggest promotion'
];

export function routeQuery(query: string): RouteClassification {
  const clean = query.toLowerCase().trim();

  // 1. Greetings Intercept
  if (/^(hi|hello|hey|hey there|greetings|good morning|good afternoon|good evening|help|sup)\b/i.test(clean)) {
    return {
      intent: 'GREETING',
      confidence: 1.0,
      reason: 'Standard conversational greeting.'
    };
  }

  // 2. Security / Prompt Injection check
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

  // 3. Hotel Lodging Rooms Check (Word-boundary matching, never false positives like 'lost')
  // Note: 'table booking' or 'today bookings' in a restaurant context is Table Management, not lodging rooms.
  if (!RAG_CONFIG.features.roomsDataEnabled) {
    const isTableContext = clean.includes('table') || clean.includes('dining') || clean.includes('restaurant') || clean === 'today bookings';
    if (!isTableContext) {
      for (const pattern of ROOM_METRIC_PATTERNS) {
        if (pattern.test(clean)) {
          return {
            intent: 'ROOMS_UNAVAILABLE',
            confidence: 0.99,
            reason: `Query requests hotel room lodging metric matching ${pattern} which is not connected to live tables.`
          };
        }
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

  // 4. Semantic Document Search Check (SOPs, Policies, Allergens, Guidelines, Service Protocols)
  if (hasSemantic || clean.includes('recipe') || clean.includes('allergen') || clean.includes('spicy') || clean.includes('taste')) {
    return {
      intent: 'SEMANTIC_DOC',
      confidence: 0.95,
      reason: 'Qualitative query requesting recipes, culinary attributes, SOPs, policies, or standards.'
    };
  }

  // 5. Pure Text-to-SQL Check
  if (hasNumbers || clean.match(/\b(sum|avg|count|total|orders?|revenue|sales|waiters?|aov|inventory)\b/i)) {
    const historicalKeywords = ['last year', '1 year', 'annual', 'historical', 'trend over year'];
    const requiresHistorical = historicalKeywords.some(kw => clean.includes(kw));

    return {
      intent: 'TEXT_TO_SQL',
      confidence: 0.95,
      reason: 'Factual or quantitative query requiring deterministic database aggregates.',
      requiresHistoricalData: requiresHistorical
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

