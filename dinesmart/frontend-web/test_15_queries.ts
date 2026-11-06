import fs from 'fs';
import path from 'path';

// Load .env into process.env if not set
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import { ragOrchestrator } from './src/services/rag/ragOrchestrator';

const queries = [
  { id: 1, type: "Live Revenue & Order Volume", query: "What is our total revenue today and how many orders did we get?" },
  { id: 2, type: "Top Selling Dishes", query: "What are the top 5 best selling dishes?" },
  { id: 3, type: "Specific Dish Price & Details", query: "What is the price and ingredients of Masala Dosa?" },
  { id: 4, type: "Staff & Waiter Performance", query: "Show me the waiter performance and tips earned" },
  { id: 5, type: "Dietary & Allergens", query: "What vegan and gluten-free items do we have on the menu?" },
  { id: 6, type: "Order Cancellations & Voids", query: "How many orders were cancelled and what is our cancellation rate?" },
  { id: 7, type: "Customer Reviews & Sentiment", query: "What do customers say in their reviews and what is our average rating?" },
  { id: 8, type: "Table Status & Floor Health", query: "How many tables are currently occupied and what is the table turnaround time?" },
  { id: 9, type: "Kitchen Prep Time & Delays", query: "What is the average kitchen prep time for orders?" },
  { id: 10, type: "Peak Rush Timings", query: "When are our peak rush hours for lunch and dinner?" },
  { id: 11, type: "Taxes & Restaurant Policies", query: "What is the GST rate and tipping policy at our restaurant?" },
  { id: 12, type: "Inventory & Low Stock", query: "Which ingredients or inventory items are running low on stock?" },
  { id: 13, type: "Category Sales Breakdown", query: "Show the revenue breakdown by food category" },
  { id: 14, type: "Strategic Recommendation", query: "How can we increase beverage sales and optimize profits?" },
  { id: 15, type: "Greeting / Persona Check", query: "Hello, who are you and how can you help me?" }
];

async function runAll() {
  console.log("=== EXECUTING 15 TEST QUERIES AGAINST CURRENT AI SYSTEM ===");
  const results: any[] = [];

  for (const item of queries) {
    const start = performance.now();
    try {
      const res = await ragOrchestrator.processAdminQuery(item.query);
      const elapsed = Math.round(performance.now() - start);
      results.push({
        id: item.id,
        type: item.type,
        query: item.query,
        elapsed,
        provider: res.telemetry?.provider || 'Unknown',
        model: res.telemetry?.modelUsed || 'Unknown',
        answer: res.answer
      });
      console.log(`[Q${item.id}] Completed in ${elapsed}ms | Type: ${item.type} | Model: ${res.telemetry?.modelUsed}`);
    } catch (err: any) {
      results.push({
        id: item.id,
        type: item.type,
        query: item.query,
        elapsed: 0,
        provider: 'ERROR',
        model: 'ERROR',
        answer: `ERROR: ${err?.message || err}`
      });
      console.error(`[Q${item.id}] Error:`, err?.message || err);
    }
  }

  // Write full output to a JSON file for inspection
  const fs = await import('fs');
  fs.writeFileSync('test_15_results.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log("=== ALL 15 QUERIES FINISHED. Output saved to test_15_results.json ===");
}

runAll().catch(console.error);
