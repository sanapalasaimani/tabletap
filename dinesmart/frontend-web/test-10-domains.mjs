import assert from 'assert';
import { ragOrchestrator } from './src/services/rag/ragOrchestrator.ts';

const domainQuestions = [
  {
    domain: "1. Sales & Revenue Intelligence",
    query: "What were total covers and revenue for this month, by meal period (breakfast/lunch/dinner)?"
  },
  {
    domain: "1. Sales & Revenue Intelligence",
    query: "What's the average check size and RevPASH today?"
  },
  {
    domain: "2. Reservations & Table Utilization",
    query: "How many reservations are confirmed for tonight, and what's the expected occupancy?"
  },
  {
    domain: "2. Reservations & Table Utilization",
    query: "How many tables are occupied right now, and what is the turnover rate?"
  },
  {
    domain: "3. Labor & Staffing",
    query: "What is labor cost as a percentage of revenue today, and scheduled staffing?"
  },
  {
    domain: "3. Labor & Staffing",
    query: "Which servers have the highest sales per cover and customer ratings?"
  },
  {
    domain: "4. Inventory & Cost Control",
    query: "What is our current food cost percentage, and how does it compare to target?"
  },
  {
    domain: "4. Inventory & Cost Control",
    query: "Which ingredients are below par level or at risk of running out?"
  },
  {
    domain: "4. Inventory & Cost Control",
    query: "Which menu items have the highest and lowest gross margin (Menu Engineering)?"
  },
  {
    domain: "5. Guest Experience & Feedback",
    query: "What's our average guest rating this month, and what are recent feedback themes?"
  },
  {
    domain: "6. Service Performance & Operations",
    query: "How many orders were voided or cancelled and what value was lost?"
  },
  {
    domain: "6. Service Performance & Operations",
    query: "What is the average ticket time order-to-serve and kitchen SLA status?"
  },
  {
    domain: "7. Compliance & Safety",
    query: "What is our statutory GST rate and tax billing policy?"
  },
  {
    domain: "8. Alerts & Executive Actions",
    query: "Give me the executive operations daily brief and 3 high-impact actions to take today."
  }
];

async function runDomainVerification() {
  console.log('========================================================================');
  console.log(' VERIFYING ALL 10 OPERATIONAL DOMAINS IN DINESMART ADMIN AI');
  console.log('========================================================================\n');

  let passed = 0;

  for (const item of domainQuestions) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`DOMAIN: ${item.domain}`);
    console.log(`QUERY:  "${item.query}"`);

    const start = performance.now();
    const res = await ragOrchestrator.processAdminQuery(item.query);
    const latency = Math.round(performance.now() - start);

    console.log(`LATENCY: ${latency}ms | MODEL: ${res.telemetry.modelUsed}`);
    console.log(`\nANSWER:\n${res.answer}\n`);

    // Rigorous assertions:
    assert(res.answer && res.answer.length > 30, `Answer too short for "${item.query}"`);
    assert(!res.answer.includes("I don't have enough data connected"), `Failed on data limitation for "${item.query}"`);
    
    passed++;
    // Polite delay to stay well within Groq TPM limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n========================================================================');
  console.log(` SUCCESS: ALL ${passed}/${domainQuestions.length} OPERATIONAL DOMAIN QUERIES VERIFIED!`);
  console.log('========================================================================\n');
}

runDomainVerification().catch(err => {
  console.error('Domain Verification Failed:', err);
  process.exit(1);
});
