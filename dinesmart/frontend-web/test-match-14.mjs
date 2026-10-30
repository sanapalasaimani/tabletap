import { operationsAnalytics } from './src/services/rag/operationsAnalytics.ts';

const queries = [
  "hey",
  "today bookings",
  "what is total revenue",
  "What was our total revenue this month?",
  "Which are the top 5 best-selling items by units this month?",
  "Which menu item has the highest gross margin percentage?",
  "Which items are low-selling and low-margin (menu engineering 'Dogs')?",
  "How did our food cost percentage in the last 7 days compare with target?",
  "What is the average order value on weekends versus weekdays?",
  "Which menu categories bring in the most revenue?",
  "What percentage of orders include a beverage?",
  "How many orders were voided or cancelled in the last 7 days and what value was lost?",
  "How does this month's revenue compare with last month so far?",
  "What is the revenue split between veg and non-veg dishes this month?"
];

function matchQuery(q) {
  const clean = q.toLowerCase();
  if (/^(hi|hello|hey|greetings|help)\b/i.test(clean)) return { type: 'GREETING' };
  if (clean.includes('booking') || clean.includes('table')) return operationsAnalytics.getTableBookingsStatus();
  if (clean.includes('this month') && clean.includes('revenue') && !clean.includes('last month') && !clean.includes('veg')) return operationsAnalytics.getTotalRevenue(true);
  if (clean.includes('total revenue') || clean.includes('gross revenue')) return operationsAnalytics.getTotalRevenue(false);
  if (clean.includes('top 5') || clean.includes('best-selling') || clean.includes('best selling')) return operationsAnalytics.getTopSellingDishes();
  if (clean.includes('margin') && (clean.includes('highest') || clean.includes('gross margin'))) return operationsAnalytics.getMenuEngineering('MARGIN');
  if (clean.includes('dog') || clean.includes('low-selling') || clean.includes('low selling')) return operationsAnalytics.getMenuEngineering('DOGS');
  if (clean.includes('food cost')) return operationsAnalytics.getFoodCostComparison();
  if (clean.includes('weekend') && clean.includes('weekday')) return operationsAnalytics.getWeekendVsWeekday();
  if (clean.includes('categor') && clean.includes('revenue')) return operationsAnalytics.getCategoryRevenueBreakdown();
  if (clean.includes('beverage')) return operationsAnalytics.getBeverageAttachRate();
  if (clean.includes('void') || clean.includes('cancel')) return operationsAnalytics.getCancellationsAndVoids();
  if (clean.includes('last month') && clean.includes('this month')) return operationsAnalytics.getMonthOverMonthComparison();
  if (clean.includes('veg') && clean.includes('split')) return operationsAnalytics.getVegNonVegSplit();
  return null;
}

console.log('Testing all 14 queries:');
for (const q of queries) {
  const res = matchQuery(q);
  console.log(`Q: "${q}" -> Matched:`, res ? (res.title || res.type) : 'FAILED!');
}

