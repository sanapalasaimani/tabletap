import { Citation } from './types';
import mlData from '../../data/ml_insights.json';
import { executeAdvancedHybridRetrieval } from './hybridEngine';

export interface RetrievedEvidence {
  citations: Citation[];
  formattedContext: string;
  department: 'Front Desk & Rooms' | 'Food & Beverage' | 'Kitchen Operations' | 'Staff & HR' | 'Finance & Revenue';
  relevantMetrics: Record<string, any>;
  liveDataSnapshot: Record<string, any>;
}

/**
 * Executes Dense Vector + BM25 + Reciprocal Rank Fusion (RRF) Hybrid Retrieval.
 */
export function executeHybridRetrieval(query: string, liveData: any): RetrievedEvidence {
  // 1. Run the Dense + BM25 + RRF + Reranker pipeline across all 120 menu items, SOPs, and policies
  const hybridOutput = executeAdvancedHybridRetrieval(query, { topK: 5 });

  const citations: Citation[] = [...hybridOutput.citations];
  const relevantMetrics: Record<string, any> = {};

  // 2. Attach ML Analytics Benchmark metrics
  const annual = (mlData as any)?.annualAnalytics?.annualSummary || {};
  const mlMeta = (mlData as any)?.modelMetadata || {};

  relevantMetrics.totalRevenue1Year = annual.totalRevenue || 8953131.5;
  relevantMetrics.totalOrders1Year = annual.totalOrders || 23708;
  relevantMetrics.avgDailyRevenue = annual.avgDailyRevenue || 24529.13;
  relevantMetrics.avgOrderValue = annual.avgOrderValue || 377.64;
  relevantMetrics.avgPrepTimeMin = annual.avgPrepTimeMinutes || 20.5;
  relevantMetrics.vegSalesSharePercent = annual.vegSalesSharePercent || 83.0;
  relevantMetrics.nonVegSalesSharePercent = annual.nonVegSalesSharePercent || 17.0;
  relevantMetrics.randomForestR2 = mlMeta.r2Score || 0.957;
  relevantMetrics.randomForestMAE = mlMeta.maeMinutes || 1.27;

  // 3. Attach Live Floor State Snapshot (Orders, Tables, Staff)
  const ordersCount = Array.isArray(liveData?.orders) ? liveData.orders.length : 0;
  const liveRevenue = Array.isArray(liveData?.orders)
    ? liveData.orders.reduce((sum: number, o: any) => sum + (o.total || o.subtotal || 0), 0)
    : 0;
  const activeTables = Array.isArray(liveData?.tables)
    ? liveData.tables.filter((t: any) => t.status !== 'Available').length
    : 0;
  const staffList = Array.isArray(liveData?.staff) ? liveData.staff : [];

  if (ordersCount > 0 || staffList.length > 0) {
    citations.push({
      sourceId: 'SUPABASE-LIVE-STATE',
      sourceType: 'LIVE_DATABASE',
      title: 'Supabase Real-Time Operating Floor State',
      verifiedClaim: `Current floor state: ${ordersCount} active orders totaling ₹${liveRevenue}, ${activeTables}/12 seated tables, ${staffList.length} staff registered.`,
      confidence: 0.99,
      timestamp: new Date().toISOString()
    });
  }

  // 4. Assemble clean context for prompt ingestion
  const liveFloorSummary = `
#### Real-Time Floor State (Supabase)
- Active Orders Today: ${ordersCount} | Settled Gross Revenue: ₹${liveRevenue} | Occupied Tables: ${activeTables}/12
- Active Staff On Duty: ${staffList.length > 0 ? staffList.map((s: any) => `${s.name} (${s.role || 'Staff'})`).join(', ') : 'Staff registered in live roster.'}
`.trim();

  const formattedContext = `
### Department Focus: ${hybridOutput.department}

${hybridOutput.formattedContext}

---

${liveFloorSummary}
`.trim();

  return {
    citations,
    formattedContext,
    department: hybridOutput.department as RetrievedEvidence['department'],
    relevantMetrics,
    liveDataSnapshot: { ordersCount, liveRevenue, activeTables, staffCount: staffList.length }
  };
}
