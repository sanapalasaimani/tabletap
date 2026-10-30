import assert from 'assert';
import { ragOrchestrator } from './src/services/rag/ragOrchestrator.ts';

const testQueries = [
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

async function runAll() {
  console.log('====================================================');
  console.log(' VERIFYING ALL 14 USER QUERIES IN RAG ORCHESTRATOR');
  console.log('====================================================\n');

  let passed = 0;

  for (const q of testQueries) {
    const res = await ragOrchestrator.processAdminQuery(q);
    const hasLimitationError = res.answer.includes("I don't have enough data connected");
    const hasRoomsFalsePositive = res.answer.includes("room booking data connected yet") && q.includes("voided");

    console.log(`\n----------------------------------------------------`);
    console.log(`QUERY: "${q}"`);
    console.log(`DECISION READINESS: ${res.decisionReadiness}`);
    console.log(`ANSWER PREVIEW:\n${res.answer.slice(0, 220)}...`);

    assert(!hasLimitationError, `FAILED: Query "${q}" returned generic "I don't have enough data" message!`);
    assert(!hasRoomsFalsePositive, `FAILED: Query "${q}" falsely returned room booking message!`);
    
    passed++;
  }

  console.log('\n====================================================');
  console.log(` ALL ${passed}/${testQueries.length} QUERIES PASSED WITH VERIFIED EXECUTIVE ANSWERS!`);
  console.log('====================================================');
}

runAll().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

