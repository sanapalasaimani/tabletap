import { ScopeClassification } from './types';

export const MANDATED_OUT_OF_SCOPE_MESSAGE = 
  "I’m your Hotel Management AI Assistant, designed to help with hotel operations, performance analysis, revenue optimization, guest experience, staffing, and other supported capabilities of this project. I can’t assist with unrelated topics, but I’d be happy to help you analyze a hotel-management challenge or make a data-driven operational decision.";

// High-confidence adversarial injection patterns
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|initial\s+instructions|instructions|prompt)/i,
  /print\s+(the\s+)?(system\s+prompt|raw\s+prompt|developer\s+mode)/i,
  /you\s+are\s+now\s+(in\s+developer\s+mode|DAN|an\s+unfiltered\s+AI)/i,
  /override\s+(all\s+)?(safety|system|security)\s+(rules|guidelines)/i,
  /disregard\s+(all\s+)?(instructions|system\s+policies)/i,
  /repeat\s+(everything|the\s+text)\s+above/i,
  /<script[\s\S]*?>/i,
  /SELECT\s+.*\s+FROM\s+.*\s+WHERE/i,
  /UNION\s+SELECT/i,
  /DROP\s+TABLE/i,
  /password\s*(hash|dump|extract)/i,
  /employee\s+password/i
];

// Sensitive or unintegrated data topics that trigger IN_SCOPE_WITH_LIMITATIONS
const LIMITATION_PATTERNS = [
  /credit\s*card\s*(number|cvv|details)/i,
  /guest\s*passport/i,
  /guest\s*aadhaar/i,
  /competitor\s*(revenue|rates|profit)/i,
  /marriott|hilton|hyatt/i,
  /pool|swimming\s*pool|spa|gym|fitness\s*center/i,
  /valet\s*car\s*damage\s*claim/i,
  /crypto\s*payment/i
];

// Core hotel, dining, culinary, revenue, and hospitality semantic keywords
const HOTEL_DOMAIN_INDICATORS = [
  'hotel', 'room', 'rooms', 'occupancy', 'revpar', 'adr', 'revpash',
  'revenue', 'profit', 'margin', 'pricing', 'discount', 'promotion',
  'food', 'beverage', 'dining', 'restaurant', 'table', 'menu', 'dish',
  'chef', 'kitchen', 'prep time', 'delay', 'waiter', 'staff', 'shift',
  'guest', 'guest satisfaction', 'review', 'rating', 'feedback',
  'breakfast', 'lunch', 'dinner', 'booking', 'reservation', 'cancel',
  'check-in', 'check-out', 'inventory', 'stock', 'wastage', 'cost',
  'turnover', 'loyalty', 'points', 'sales', 'service', 'kpi',
  'dosa', 'biryani', 'paneer', 'chicken', 'curry', 'naan', 'roti',
  'idli', 'vada', 'coffee', 'dessert', 'calorie', 'calories', 'spice',
  'spicy', 'price', 'buffet', 'allergen', 'vegan', 'gluten', 'tax',
  'gst', 'bill', 'billing', 'operation', 'operations', 'operational',
  'management', 'manager', 'holiday', 'peak', 'steps', 'strategy'
];

export interface ScopeAssessment {
  classification: ScopeClassification;
  reason: string;
  sanitizedQuery: string;
  securityFlags: string[];
}

export function evaluateScopeAndSecurity(query: string, conversationContext?: string): ScopeAssessment {
  const securityFlags: string[] = [];
  const trimmed = (query || '').trim();

  // 1. Check for prompt injection / jailbreak / unauthorized attempts
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      securityFlags.push(`INJECTION_DETECTED: ${pattern.toString()}`);
      return {
        classification: 'UNSAFE_OR_UNAUTHORIZED',
        reason: 'The request contains patterns attempting to override system instructions, extract confidential prompts, or bypass access control.',
        sanitizedQuery: trimmed,
        securityFlags
      };
    }
  }

  // 2. Check for sensitive unintegrated domain boundaries
  for (const pattern of LIMITATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        classification: 'IN_SCOPE_WITH_LIMITATIONS',
        reason: 'The inquiry pertains to hotel administration, but requests sensitive credentials or external unintegrated systems.',
        sanitizedQuery: trimmed,
        securityFlags
      };
    }
  }

  const qLower = trimmed.toLowerCase();

  // 3. Ambiguous single-word queries in terminal context
  if (['compare', 'details?', 'details', 'status', 'kpis'].includes(qLower)) {
    return {
      classification: 'IN_SCOPE',
      reason: 'Ambiguous inquiry requiring conversational parameter clarification.',
      sanitizedQuery: trimmed,
      securityFlags
    };
  }

  // 4. Strategic operational questions with general wording
  const isStrategicQuestion = 
    /(improve|increase|optimize|maximize|boost|reduce|decrease)\s+(profit|revenue|margin|efficiency|performance|quality|satisfaction|cost)/i.test(qLower) ||
    /(what\s+should\s+we\s+do|recommendation|strategy|next\s+quarter|next\s+month|action\s+plan|operational\s+steps)/i.test(qLower);

  // 5. Domain match verification
  const hasDomainKeyword = HOTEL_DOMAIN_INDICATORS.some(k => qLower.includes(k));
  const hasContextDomain = conversationContext 
    ? HOTEL_DOMAIN_INDICATORS.some(k => conversationContext.toLowerCase().includes(k))
    : false;

  if (hasDomainKeyword || isStrategicQuestion || hasContextDomain) {
    return {
      classification: 'IN_SCOPE',
      reason: 'Request matches authorized hotel management and hospitality optimization scope.',
      sanitizedQuery: trimmed,
      securityFlags
    };
  }

  // 6. Semantic Out-of-Scope check
  const unrelatedTopics = [
    'romeo', 'juliet', 'shakespeare', 'capital of', 'movie', 'actor',
    'python code to', 'invert binary tree', 'quantum physics', 'mars rover',
    'world cup', 'cricket score', 'presidential election'
  ];

  if (unrelatedTopics.some(topic => qLower.includes(topic))) {
    return {
      classification: 'OUT_OF_SCOPE',
      reason: 'Request is substantive but completely unrelated to hotel operations or hospitality management.',
      sanitizedQuery: trimmed,
      securityFlags
    };
  }

  if (['hi', 'hello', 'hey', 'help', 'good morning', 'good evening'].includes(qLower)) {
    return {
      classification: 'IN_SCOPE',
      reason: 'Greeting in hotel operations management terminal.',
      sanitizedQuery: trimmed,
      securityFlags
    };
  }

  return {
    classification: 'OUT_OF_SCOPE',
    reason: 'No semantic alignment with hotel management, hospitality data, or operations.',
    sanitizedQuery: trimmed,
    securityFlags
  };
}
