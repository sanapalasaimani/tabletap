/**
 * TableTap / DineSmart RAG Configuration & Model Registry
 * Grounded Executive Operations Analyst Architecture
 */

export interface RAGConfig {
  models: {
    sql: string;
    answer: string;
    router: string;
    verifier: string;
  };
  temperatures: {
    sql: number;
    answerFactual: number;
    answerStrategy: number;
    router: number;
    verifier: number;
  };
  maxTokens: {
    sql: number;
    answer: number;
    router: number;
    verifier: number;
  };
  timeouts: {
    sqlExecutionMs: number;
    llmRequestMs: number;
  };
  features: {
    roomsDataEnabled: boolean;
    useAstValidator: boolean;
    streamResponses: boolean;
  };
  localization: {
    currencyCode: string;
    currencySymbol: string;
    timezone: string;
    locale: string;
  };
  databaseAllowlist: Record<string, string[]>;
}

// Active Groq flagship & fast inference models (Verified 2026)
export const RAG_CONFIG: RAGConfig = {
  models: {
    sql: (import.meta.env.VITE_LLM_MODEL_SQL as string) || (import.meta.env.VITE_GROQ_MODEL as string) || 'openai/gpt-oss-120b',
    answer: (import.meta.env.VITE_LLM_MODEL_ANSWER as string) || (import.meta.env.VITE_GROQ_MODEL as string) || 'openai/gpt-oss-120b',
    router: (import.meta.env.VITE_LLM_MODEL_ROUTER as string) || 'openai/gpt-oss-20b',
    verifier: (import.meta.env.VITE_LLM_MODEL_VERIFIER as string) || 'openai/gpt-oss-20b',
  },
  temperatures: {
    sql: 0.0,             // Zero temperature for deterministic SQL generation
    answerFactual: 0.0,   // Zero temperature for reporting exact database numbers
    answerStrategy: 0.3,  // Slight flexibility for strategic insights backed by numbers
    router: 0.0,          // Deterministic routing
    verifier: 0.0,        // Deterministic fact-checking
  },
  maxTokens: {
    sql: 600,
    answer: 1500,
    router: 256,
    verifier: 512,
  },
  timeouts: {
    sqlExecutionMs: 10000, // 10 seconds statement timeout
    llmRequestMs: 25000,
  },
  features: {
    roomsDataEnabled: false, // Hotel room metrics intentionally marked MISSING until table integration
    useAstValidator: true,
    streamResponses: false,
  },
  localization: {
    currencyCode: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
  },
  // Strict Table & Column Allowlist for Client AST Validation before invoking RPC
  databaseAllowlist: {
    orders: [
      'id', 'table_id', 'items', 'subtotal', 'gst', 'discount', 
      'tip', 'total', 'status', 'payment_status', 'payment_method', 
      'customer_phone', 'created_at'
    ],
    menu_items: [
      'id', 'name', 'price', 'category', 'image', 'rating', 
      'reviews_count', 'is_veg', 'spicy_level', 'is_special', 
      'calories', 'prep_time', 'description', 'available'
    ],
    staff: [
      'id', 'name', 'mobile', 'role', 'shift', 'salary', 
      'attendance', 'performance', 'empid'
      // NOTE: 'password' is strictly omitted and rejected
    ],
    loyalty_profiles: [
      'phone', 'name', 'points', 'tier'
    ],
    waiter_requests: [
      'id', 'table_id', 'request_type', 'status', 'created_at'
    ],
    reviews: [
      'id', 'order_id', 'customer_name', 'rating', 'comment', 'date', 'reply'
    ],
    inventory: [
      'id', 'name', 'stock', 'min_stock', 'unit', 'cost'
    ],
    feedback: [
      'id', 'order_id', 'food_rating', 'service_rating', 'ambience_rating', 'comments', 'created_at'
    ],
    promotions: [
      'id', 'code', 'discount', 'type', 'min_bill', 'active'
    ],
    tables: [
      'id', 'name', 'status', 'customer_name', 'capacity', 'qr_token'
    ],
    activity_logs: [
      'id', 'user_role', 'action', 'timestamp'
    ],
  },
};

/**
 * Provides dynamic temporal context for LLM prompt grounding.
 * Prevents hallucinations on relative terms like "today", "yesterday", "this month", "last 7 days".
 */
export function getSystemTemporalContext(): {
  iso: string;
  date: string;
  time: string;
  dayOfWeek: string;
  timezone: string;
  currentYear: number;
  currentMonth: number;
} {
  const now = new Date();
  
  // Format in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: RAG_CONFIG.localization.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  parts.forEach(p => { partMap[p.type] = p.value; });

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const timeStr = `${partMap.hour}:${partMap.minute}:${partMap.second}`;

  return {
    iso: now.toISOString(),
    date: dateStr,
    time: timeStr,
    dayOfWeek: partMap.weekday || '',
    timezone: RAG_CONFIG.localization.timezone,
    currentYear: parseInt(partMap.year, 10),
    currentMonth: parseInt(partMap.month, 10),
  };
}

