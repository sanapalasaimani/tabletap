import { ConversationalState } from './types';

export interface ResolvedQueryContext {
  originalQuery: string;
  rewrittenQuery: string;
  inferredTimeframe?: string;
  inferredEntity?: string;
  inferredMetric?: string;
  isHypotheticalScenario: boolean;
  requiresClarification: boolean;
  clarificationPrompt?: string;
}

export const conversationManager = {
  // Evaluates query against recent history to resolve pronouns, references, and implicit contexts
  resolveContext: (
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): ResolvedQueryContext => {
    const qTrimmed = query.trim();
    const qLower = qTrimmed.toLowerCase();

    let inferredTimeframe: string | undefined = undefined;
    let inferredEntity: string | undefined = undefined;
    let inferredMetric: string | undefined = undefined;
    let isHypothetical = /estimate\s+the\s+impact|what\s+if|suppose|scenario|if\s+we\s+(increase|decrease|change)/i.test(qLower);

    // Scan backwards through history to find previously discussed timeframe or metric
    const recentTurns = history.slice(-4);
    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const text = recentTurns[i].content.toLowerCase();
      if (!inferredTimeframe) {
        if (text.includes('july')) inferredTimeframe = 'July';
        else if (text.includes('june')) inferredTimeframe = 'June';
        else if (text.includes('may')) inferredTimeframe = 'May';
        else if (text.includes('weekend')) inferredTimeframe = 'Weekends';
        else if (text.includes('weekday')) inferredTimeframe = 'Weekdays';
        else if (text.includes('past year') || text.includes('1-year') || text.includes('annual')) inferredTimeframe = '1-Year Annual';
      }
      if (!inferredMetric) {
        if (text.includes('occupancy')) inferredMetric = 'Occupancy';
        else if (text.includes('revpar')) inferredMetric = 'RevPAR';
        else if (text.includes('adr')) inferredMetric = 'ADR';
        else if (text.includes('revenue') || text.includes('sales')) inferredMetric = 'Revenue';
        else if (text.includes('prep time') || text.includes('kitchen')) inferredMetric = 'Kitchen Prep Time';
      }
    }

    // Pronoun and reference expansion
    let rewritten = qTrimmed;

    // E.g. "Which segment contributed the most?" or "Compare it with June"
    if (/\b(it|that|which segment|compare it|those costs|the previous month)\b/i.test(qLower)) {
      if (qLower.includes('compare it with june') && inferredMetric) {
        rewritten = `Compare ${inferredMetric} in ${inferredTimeframe || 'July'} with June`;
      } else if (qLower.includes('which segment contributed the most') && inferredTimeframe) {
        rewritten = `Which revenue or dining segment contributed the most during ${inferredTimeframe}?`;
      } else if (qLower.includes('what should we change next month') && inferredTimeframe) {
        rewritten = `What operational and pricing adjustments should we implement for the month following ${inferredTimeframe}?`;
      } else if (qLower.includes('estimate the impact if we increase weekday adr by 5%')) {
        rewritten = `Estimate the financial impact on room revenue and RevPAR if weekday ADR is increased by 5%`;
        isHypothetical = true;
      }
    }

    // Check if query is materially ambiguous and needs a clarifying question
    let requiresClarification = false;
    let clarificationPrompt: string | undefined = undefined;

    if (qLower === 'compare' || qLower === 'what about next month?' || qLower === 'details?') {
      if (!inferredMetric && !inferredTimeframe) {
        requiresClarification = true;
        clarificationPrompt = 'Could you specify which metric (e.g., Room Occupancy, RevPAR, Dining Revenue) or time period you would like to analyze?';
      }
    }

    return {
      originalQuery: qTrimmed,
      rewrittenQuery: rewritten,
      inferredTimeframe,
      inferredEntity,
      inferredMetric,
      isHypotheticalScenario: isHypothetical,
      requiresClarification,
      clarificationPrompt
    };
  }
};
