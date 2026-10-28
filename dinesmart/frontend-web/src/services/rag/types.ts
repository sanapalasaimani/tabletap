// RAG & Hotel Intelligence Platform Type Definitions

export type ScopeClassification = 
  | 'IN_SCOPE'
  | 'IN_SCOPE_WITH_LIMITATIONS'
  | 'OUT_OF_SCOPE'
  | 'UNSAFE_OR_UNAUTHORIZED';

export type DecisionReadiness =
  | 'DECISION_READY'
  | 'DECISION_READY_WITH_CAVEATS'
  | 'MORE_DATA_REQUIRED'
  | 'NOT_DECISION_READY';

export interface Citation {
  sourceId: string;
  sourceType: 'LIVE_DATABASE' | 'HISTORICAL_1YEAR_DATASET' | 'HOTEL_POLICY_KB' | 'MENU_CATALOG' | 'ML_MODEL_WEIGHTS';
  title: string;
  verifiedClaim: string;
  confidence: number;
  timestamp?: string;
}

export interface MetricCalculation {
  metricName: string;
  formula: string;
  inputs: Record<string, number | string>;
  calculatedValue: number;
  formattedValue: string;
  unit: string;
  benchmarkOrTarget?: string;
  interpretation: string;
}

export interface ConversationalState {
  conversationId: string;
  activeEntity?: string;
  activeTimeframe?: string;
  activeDepartment?: 'Front Desk & Rooms' | 'Food & Beverage' | 'Kitchen Operations' | 'Staff & HR' | 'Finance & Revenue';
  activeMetric?: string;
  lastCalculatedMetrics?: Record<string, any>;
  turns: Array<{
    role: 'user' | 'assistant';
    content: string;
    scope?: ScopeClassification;
    citations?: Citation[];
    timestamp: string;
  }>;
}

export interface TelemetryLog {
  requestId: string;
  timestamp: string;
  userQuery: string;
  scope: ScopeClassification;
  retrievalHitCount: number;
  retrievalLatencyMs: number;
  inferenceLatencyMs: number;
  totalLatencyMs: number;
  provider: 'GROQ_CLOUD' | 'GROUNDED_LOCAL_ENGINE';
  modelUsed: string;
  citationsCount: number;
  decisionReadiness: DecisionReadiness;
  securityFlags: string[];
}

export interface RAGResponse {
  answer: string;
  scope: ScopeClassification;
  citations: Citation[];
  calculations?: MetricCalculation[];
  decisionReadiness: DecisionReadiness;
  telemetry: TelemetryLog;
}
