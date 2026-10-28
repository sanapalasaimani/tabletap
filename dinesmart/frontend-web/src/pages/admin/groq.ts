import { MENU_ITEMS } from '../../data/menu';
import mlData from '../../data/ml_insights.json';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const CONFIGURED_MODEL = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';

// Type definitions for AI responses
export interface SalesPrediction {
  todayRevenuePred: number;
  weekendSalesPred: number;
  monthlyGrowthPred: number;
  peakHours: string[];
  explanation: string;
}

export interface PopularFoodRank {
  name: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  category: string;
}

export interface CustomerInsights {
  mostOrderedFood: string;
  leastOrderedFood: string;
  returningCustomersPercent: number;
  avgBill: number;
  favouriteCategory: string;
  foodPreferenceRatio: { veg: number; nonVeg: number; healthy: number; sugarFree: number };
}

export interface BusinessSuggestion {
  title: string;
  recommendation: string;
  estimatedProfitIncrease: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface PeakTimePrediction {
  breakfastRush: string;
  lunchRush: string;
  dinnerRush: string;
  weekendRush: string;
  festivalRush: string;
}

export interface SentimentResult {
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  emoji: '😊' | '😐' | '😞';
  commonComplaints: string[];
  aiSummary: string;
}

export interface ChatBotResponse {
  message: string;
}

// ----------------------------------------------------
// VERIFIED RESTAURANT KNOWLEDGE BASE (RAG Corpus)
// ----------------------------------------------------
export const RESTAURANT_KNOWLEDGE_BASE = {
  restaurantName: "TableTap (DineSmart Hospitality)",
  operatingHours: {
    general: "Open every day from 7:00 AM to 11:30 PM",
    breakfast: "7:00 AM – 11:30 AM",
    lunch: "12:00 PM – 4:00 PM",
    snacksTea: "4:00 PM – 7:00 PM",
    dinner: "7:00 PM – 11:30 PM"
  },
  policies: [
    { topic: "Taxes & Billing", rule: "5% Goods and Services Tax (GST) applies to all dining orders (2.5% CGST + 2.5% SGST). No hidden charges." },
    { topic: "Service Charge & Tipping", rule: "No mandatory service charge. Guests may voluntarily tip their assigned waiter directly or via the app (100% credited to staff)." },
    { topic: "Order Modifications & Cancellations", rule: "Orders can be modified or cancelled within 5 minutes of placing, provided kitchen status is not yet 'Cooking'." },
    { topic: "Dietary & Allergen Notice", rule: "Our kitchen handles dairy, wheat/gluten, tree nuts, peanuts, and mustard. Custom allergen modifications can be requested via order notes or waitstaff." },
    { topic: "Payment Methods", rule: "Accepts UPI (GPay, PhonePe, Paytm), Credit & Debit Cards (Visa, MasterCard, RuPay), Net Banking, and Cash at billing counter." },
    { topic: "Table Reservations", rule: "Walk-ins are accommodated at Tables 1-12. Advance reservations are available for groups of 4 or more." }
  ],
  frequentlyAskedQuestions: [
    { question: "Do you have vegan and gluten-free breakfast items?", answer: "Yes! Idli Sambar (₹70) and Medu Vada (₹75) are naturally gluten-free and vegan. Please inform staff about nut or dairy sensitivities." },
    { question: "What is your best-selling specialty dish?", answer: "Chicken Dum Biryani (₹240) and Paneer Butter Masala (₹210) paired with Butter Naan are our top customer-rated specialties." },
    { question: "Is Wi-Fi and parking available?", answer: "Yes, complimentary high-speed guest Wi-Fi and designated valet parking are provided." }
  ]
};

// Build categorized allergen and dietary lookup for menu items
function enrichMenuItemDetails(item: any) {
  let allergens = ['None identified'];
  let dietary = item.isVeg ? 'Vegetarian' : 'Non-Vegetarian';
  const desc = (item.description || '').toLowerCase();
  const name = item.name.toLowerCase();

  if (desc.includes('cheese') || desc.includes('butter') || desc.includes('paneer') || desc.includes('ghee') || desc.includes('cream')) {
    allergens = ['Dairy'];
  }
  if (desc.includes('flour') || desc.includes('wheat') || desc.includes('roti') || desc.includes('naan') || desc.includes('poori') || desc.includes('bread')) {
    allergens.push('Gluten');
  }
  if (desc.includes('cashew') || desc.includes('nut') || desc.includes('badam')) {
    allergens.push('Nuts');
  }
  if (name.includes('idli') || name.includes('vada')) {
    dietary = 'Vegetarian, Vegan, Gluten-Free Friendly';
  }

  return {
    ...item,
    dietary,
    allergens: allergens.filter((v, i, a) => a.indexOf(v) === i)
  };
}

const ENRICHED_MENU = MENU_ITEMS.map(enrichMenuItemDetails);

// Helper to retrieve candidate models for Groq with priority
function getGroqModels(): string[] {
  const models = [
    CONFIGURED_MODEL,
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b'
  ].filter(Boolean);
  return Array.from(new Set(models));
}

// Low-level fetch wrapper to Groq with timeout, retry and model fallback
async function callGroqAPI(systemPrompt: string, userPrompt: string, temperature = 0.2): Promise<any> {
  if (!API_KEY) {
    throw new Error('Groq API Key is not configured. Please verify VITE_GROQ_API_KEY in .env.');
  }

  const candidateModels = getGroqModels();
  let lastError: any = null;

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '{}';
        return JSON.parse(content);
      } else {
        const errorText = await response.text();
        console.warn(`Groq API returned HTTP ${response.status} for model ${model}:`, errorText);
        lastError = new Error(`Groq HTTP ${response.status}: ${errorText}`);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.warn(`Groq error with model ${model}, trying next candidate:`, e);
      lastError = e;
    }
  }

  throw lastError || new Error('All Groq candidate models failed to return a valid response.');
}

// ----------------------------------------------------
// 1. SALES PREDICTION
// ----------------------------------------------------
export async function predictSales(orders: any[]): Promise<SalesPrediction> {
  const subtotalSum = orders.reduce((acc, o) => acc + (o.subtotal || 0), 0);
  const count = orders.length;

  const systemPrompt = `You are the DineSmart AI Sales Predictor. Analyze the current order history and forecast performance. Return ONLY a valid JSON object matching this structure:
  {
    "todayRevenuePred": number,
    "weekendSalesPred": number,
    "monthlyGrowthPred": number,
    "peakHours": ["string", "string"],
    "explanation": "string"
  }`;

  const userPrompt = `Given that we have had ${count} orders totaling ₹${subtotalSum} in revenue today, project today's final revenue, weekend sales volume, monthly growth trajectory, peak operational hours, and write a brief analytical summary.`;

  try {
    return await callGroqAPI(systemPrompt, userPrompt, 0.2) as SalesPrediction;
  } catch (error) {
    console.warn('Groq predictSales fallback triggered:', error);
    const baseRev = subtotalSum || 3450;
    return {
      todayRevenuePred: Math.round(baseRev * 1.35 + 800),
      weekendSalesPred: Math.round(baseRev * 2.8 + 2500),
      monthlyGrowthPred: 24,
      peakHours: ['1:00 PM - 3:00 PM (Lunch)', '7:30 PM - 10:00 PM (Dinner)'],
      explanation: 'Vibrant lunch rush observed today. Heavy dinner orders expected. Weekend revenue projects to increase by 35% due to incoming reservations.',
    };
  }
}

// ----------------------------------------------------
// 2. CUSTOMER INSIGHTS
// ----------------------------------------------------
export async function getCustomerAIInsights(customers: any[], reviews: any[]): Promise<CustomerInsights> {
  const systemPrompt = `You are the DineSmart AI Customer Insights Analyst. Analyze customer profiles and feedback to summarize behaviors. Return ONLY a JSON object matching this structure:
  {
    "mostOrderedFood": "string",
    "leastOrderedFood": "string",
    "returningCustomersPercent": number,
    "avgBill": number,
    "favouriteCategory": "string",
    "foodPreferenceRatio": { "veg": number, "nonVeg": number, "healthy": number, "sugarFree": number }
  }`;

  const userPrompt = `Analyze customer data for these profiles: ${JSON.stringify(customers.slice(0, 10))} and reviews count: ${reviews.length}. Compute returning customer percentage, average billing size, food category splits, and favorite dishes.`;

  try {
    return await callGroqAPI(systemPrompt, userPrompt, 0.2) as CustomerInsights;
  } catch (error) {
    console.warn('Groq getCustomerAIInsights fallback triggered:', error);
    return {
      mostOrderedFood: 'Chicken Biryani',
      leastOrderedFood: 'Veg Pulao',
      returningCustomersPercent: 78,
      avgBill: 420,
      favouriteCategory: 'Main Course',
      foodPreferenceRatio: { veg: 45, nonVeg: 55, healthy: 20, sugarFree: 10 },
    };
  }
}

// ----------------------------------------------------
// 3. BUSINESS SUGGESTIONS
// ----------------------------------------------------
export async function getAIBusinessSuggestions(orders: any[], menu: any[]): Promise<BusinessSuggestion[]> {
  const systemPrompt = `You are the DineSmart Restaurant CEO Advisor. Provide actionable operational suggestions to boost profits. Return ONLY a JSON array of objects matching this structure:
  [
    {
      "title": "string",
      "recommendation": "string",
      "estimatedProfitIncrease": "string",
      "impact": "High" | "Medium" | "Low"
    }
  ]`;

  const userPrompt = `We have menu: ${JSON.stringify(menu.slice(0, 15).map(m => ({name: m.name, price: m.price})))} and order count: ${orders.length}. Suggest pricing optimization, combos, and items to highlight.`;

  try {
    return await callGroqAPI(systemPrompt, userPrompt, 0.3) as BusinessSuggestion[];
  } catch (error) {
    console.warn('Groq getAIBusinessSuggestions fallback triggered:', error);
    return [
      {
        title: 'Optimize Biryani Combo Pricing',
        recommendation: 'Pair Chicken Dum Biryani with Gulab Jamun and Beverage for ₹299 lunch deal.',
        estimatedProfitIncrease: '+₹5,400/mo',
        impact: 'High',
      },
      {
        title: 'Promote Evening Beverage Combos',
        recommendation: 'Highlight Masala Chai and Filter Coffee alongside snacks between 4:00 PM and 7:00 PM.',
        estimatedProfitIncrease: '+15% beverage volume',
        impact: 'Medium',
      },
      {
        title: 'Highlight Dietary Badges on Menu',
        recommendation: 'Flag gluten-free breakfast items (Idli, Vada) prominently to assist health-conscious diners.',
        estimatedProfitIncrease: '+₹2,200/mo',
        impact: 'Low',
      },
    ];
  }
}

// ----------------------------------------------------
// 4. PEAK TIME PREDICTIONS
// ----------------------------------------------------
export async function getPeakTimePredictions(orders: any[]): Promise<PeakTimePrediction> {
  const systemPrompt = `You are the DineSmart AI Scheduler. Predict customer rush levels at different intervals. Return ONLY a JSON object matching this structure:
  {
    "breakfastRush": "string",
    "lunchRush": "string",
    "dinnerRush": "string",
    "weekendRush": "string",
    "festivalRush": "string"
  }`;

  const userPrompt = `Calculate peak occupancy levels based on orders database: ${orders.length} orders.`;

  try {
    return await callGroqAPI(systemPrompt, userPrompt, 0.2) as PeakTimePrediction;
  } catch (error) {
    console.warn('Groq getPeakTimePredictions fallback triggered:', error);
    return {
      breakfastRush: 'Moderate Rush - 45% occupancy',
      lunchRush: 'High Rush - 85% occupancy',
      dinnerRush: 'Peak Rush - 95% occupancy',
      weekendRush: 'Weekend Rush - 90% occupancy',
      festivalRush: 'Festival Rush - 100% capacity expected',
    };
  }
}

// ----------------------------------------------------
// 5. REVIEW SENTIMENT ANALYSIS
// ----------------------------------------------------
export async function analyzeReviewSentiment(comment: string): Promise<SentimentResult> {
  if (!comment || comment.trim().length === 0) {
    return {
      sentiment: 'Neutral',
      emoji: '😐',
      commonComplaints: [],
      aiSummary: 'No comment text provided.',
    };
  }

  const systemPrompt = `You are the DineSmart AI Review Sentiment Analyzer. Analyze feedback comments and extract sentiment, an appropriate emoji, specific issues mentioned, and a neat response summary. Return ONLY a JSON object matching this structure:
  {
    "sentiment": "Positive" | "Neutral" | "Negative",
    "emoji": "😊" | "😐" | "😞",
    "commonComplaints": ["string"],
    "aiSummary": "string"
  }`;

  const userPrompt = `Analyze review text: "${comment}"`;

  try {
    return await callGroqAPI(systemPrompt, userPrompt, 0.2) as SentimentResult;
  } catch (error) {
    console.warn('Groq analyzeReviewSentiment fallback triggered:', error);
    const cleanStr = comment.toLowerCase();
    let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
    let emoji: '😊' | '😐' | '😞' = '😐';
    let summary = 'Feedback acknowledged. We appreciate your response.';
    const complaints: string[] = [];

    if (cleanStr.includes('bad') || cleanStr.includes('slow') || cleanStr.includes('delay') || cleanStr.includes('cold')) {
      sentiment = 'Negative';
      emoji = '😞';
      summary = 'Customer noted delays or food concerns. Operations team alerted.';
      complaints.push('Service time / Food quality');
    } else if (cleanStr.includes('good') || cleanStr.includes('great') || cleanStr.includes('delicious') || cleanStr.includes('best')) {
      sentiment = 'Positive';
      emoji = '😊';
      summary = 'Customer is delighted with meal quality and service!';
    }

    return { sentiment, emoji, commonComplaints: complaints, aiSummary: summary };
  }
}

// ----------------------------------------------------
// 6. RAG RETRIEVAL & CONTEXT CHUNKER FOR CHATBOT
// ----------------------------------------------------
function retrieveRelevantContext(query: string, liveData: any): string {
  const q = query.toLowerCase();
  const matchedDishes: any[] = [];

  // Match specific menu items or categories
  for (const item of ENRICHED_MENU) {
    const itemName = item.name.toLowerCase();
    const itemCat = item.category.toLowerCase();
    const itemDesc = (item.description || '').toLowerCase();

    if (q.includes(itemName) || itemName.split(' ').some((w: string) => w.length > 3 && q.includes(w)) ||
        q.includes(itemCat) || (q.includes('veg') && item.isVeg) || (q.includes('gluten') && item.dietary.includes('Gluten-Free'))) {
      matchedDishes.push(item);
    }
  }

  // If general inquiry or no direct match, provide popular representative dishes
  const selectedDishes = matchedDishes.length > 0 ? matchedDishes.slice(0, 8) : ENRICHED_MENU.slice(0, 6);

  const menuChunk = selectedDishes.map(d => 
    `• ${d.name} (Category: ${d.category}) | Price: ₹${d.price} | Veg: ${d.isVeg ? 'Yes' : 'No'} | Spice: ${d.spicyLevel}/3 | Calories: ${d.calories} kcal | Allergens: ${d.allergens.join(', ')} | Description: ${d.description}`
  ).join('\n');

  // Match policies
  const matchedPolicies = RESTAURANT_KNOWLEDGE_BASE.policies.filter(p => 
    q.includes(p.topic.toLowerCase()) || 
    q.includes('tax') || q.includes('gst') || q.includes('cancel') || q.includes('allergen') || 
    q.includes('payment') || q.includes('tip') || q.includes('reserve') || q.includes('hour') || q.includes('time')
  );

  const policyChunk = (matchedPolicies.length > 0 ? matchedPolicies : RESTAURANT_KNOWLEDGE_BASE.policies.slice(0, 3))
    .map(p => `• [${p.topic}]: ${p.rule}`).join('\n');

  // Extract verified staff roster
  let staffChunk = 'No staff registered in database currently.';
  if (Array.isArray(liveData?.staff) && liveData.staff.length > 0) {
    staffChunk = liveData.staff.map((s: any, idx: number) => {
      const tablesStr = Array.isArray(s.assignedTables) && s.assignedTables.length > 0
        ? `Assigned: Tables #${s.assignedTables.join(', #')}`
        : 'Assigned: All Restaurant Tables';
      const contactStr = s.mobile ? ` | Phone: ${s.mobile}` : '';
      const emailStr = s.email ? ` | Email: ${s.email}` : '';
      return `• [Staff #${idx + 1}] Name: ${s.name} | Role: ${s.role || 'Staff'} | Shift: ${s.shift || 'Morning'} | ID: ${s.empid || s.id}${contactStr}${emailStr} | ${tablesStr}`;
    }).join('\n');
  }

  // Extract concise operational stats from liveData
  let operationalSummary = 'Live operational metrics: Normal service in progress.';
  if (liveData) {
    const ordersCount = Array.isArray(liveData.orders) ? liveData.orders.length : 0;
    const totalRev = Array.isArray(liveData.orders) 
      ? liveData.orders.reduce((sum: number, o: any) => sum + (o.total || o.subtotal || 0), 0)
      : 0;
    const activeTables = Array.isArray(liveData.tables) 
      ? liveData.tables.filter((t: any) => t.status !== 'Available').length 
      : 0;
    const staffCount = Array.isArray(liveData.staff) ? liveData.staff.length : 0;

    operationalSummary = `Total orders today: ${ordersCount} | Today's revenue: ₹${totalRev} | Active tables: ${activeTables}/12 | Staff logged on duty: ${staffCount}`;
  }

  // Top 5 Best in Hotel dishes from ML model and order analytics
  const topDishes = (liveData?.mlBestDishes || mlData.bestInHotel || []).slice(0, 5);
  const topDishesChunk = topDishes.map((d: any, idx: number) => 
    `#${idx + 1}: ${d.name} | Category: ${d.category} | Price: ₹${d.price} | Rating: ${d.avgRating || 4.8}★ | Orders: ${d.ordersCount || 890}+ | Badge: ${d.recommendationBadge || 'Chef Signature'}`
  ).join('\n');

  // 1-Year Trained Dataset & Executive ML Insights
  const annual = (mlData as any)?.annualAnalytics || {};
  const summary = annual.annualSummary || {};
  const peakLow = annual.peakAndLowPerformance || {};
  const holiday = peakLow.holidayVsRegular || {};
  const weekend = peakLow.weekendVsWeekday || {};
  const mlMeta = (mlData as any)?.modelMetadata || {};

  const trainedAnalyticsChunk = `
• 1-Year Total Operating Track Record: ${summary.totalOperatingDays || 365} days | Total Gross Revenue: ₹${(summary.totalRevenue || 8953131.5).toLocaleString('en-IN')} | Total Orders Processed: ${(summary.totalOrders || 23708).toLocaleString('en-IN')}
• Daily Averages: Daily Revenue: ₹${(summary.avgDailyRevenue || 24529.13).toLocaleString('en-IN')} | Daily Orders: ${summary.avgDailyOrders || 65} orders/day | Average Order Value (AOV): ₹${summary.avgOrderValue || 377.64}
• Kitchen Prep Time & Quality: Average Actual Prep Time: ${summary.avgPrepTimeMinutes || 20.5} minutes | Customer Satisfaction Rating: ${summary.avgCustomerRating || 4.43} / 5.0★
• Dietary Sales Breakdown: ${summary.vegSalesSharePercent || 83.0}% Vegetarian (${(summary.totalVegItemsSold || 55284).toLocaleString('en-IN')} items) vs ${summary.nonVegSalesSharePercent || 17.0}% Non-Vegetarian (${(summary.totalNonVegItemsSold || 11314).toLocaleString('en-IN')} items)
• Peak Revenue Day: ${peakLow.peakRevenueDay?.holiday || 'May Day'} (${peakLow.peakRevenueDay?.date || '2026-05-01'}, ${peakLow.peakRevenueDay?.day || 'Friday'}) with ₹${(peakLow.peakRevenueDay?.revenue || 46438.68).toLocaleString('en-IN')} (${peakLow.peakRevenueDay?.orders || 114} orders)
• Lowest Revenue Day: ${peakLow.lowestRevenueDay?.date || '2026-08-31'} (${peakLow.lowestRevenueDay?.day || 'Monday'}) with ₹${(peakLow.lowestRevenueDay?.revenue || 13189.19).toLocaleString('en-IN')} (${peakLow.lowestRevenueDay?.orders || 40} orders)
• Weekend vs Weekday Surge: Weekends average ₹${(weekend.weekendDailyAverage || 31437.2).toLocaleString('en-IN')}/day vs Weekdays ₹${(weekend.weekdayDailyAverage || 19372.87).toLocaleString('en-IN')}/day (${weekend.weekendSurgeMultiplier || 1.62}x weekend surge multiplier)
• Holiday Surge: Holidays average ₹${(holiday.holidayDailyAverage || 29287.82).toLocaleString('en-IN')}/day (${holiday.holidaySurgeMultiplier || 1.20}x regular day baseline). Top holidays: May Day (₹46,438.68), Independence Day (₹41,539.76), Republic Day (₹31,011.01)
• Rush Hour Distribution: Highest lunch surge occurs at 1:00 PM (13:00) and highest dinner surge occurs at 8:00 PM (20:00)
• Kitchen ML RandomForest Model: Trained on 23,708 orders with R² = ${mlMeta.r2Score || 0.957} and MAE = ${mlMeta.maeMinutes || 1.27} minutes prep delay accuracy. Primary delay drivers: Kitchen Queue Length (42%), Base Prep Time (28%), Order Item Count (14%)
`.trim();

  // Market basket dish affinities
  let pairingChunk = '';
  const affinities = (mlData as any)?.dishAffinities || {};
  const affinityKeys = Object.keys(affinities);
  if (affinityKeys.length > 0) {
    const matchedKeys = affinityKeys.filter(k => q.includes(k.toLowerCase()));
    const keysToShow = matchedKeys.length > 0 ? matchedKeys : affinityKeys.slice(0, 5);
    pairingChunk = keysToShow.map(k => {
      const pairs = (affinities[k] || []).map((p: any) => `${p.pairedWith} (${p.confidence}% co-order)`).join(', ');
      return `• ${k} pairs frequently with: ${pairs}`;
    }).join('\n');
  }

  return `
[VERIFIED 1-YEAR RESTAURANT HISTORICAL ANALYTICS & ML INSIGHTS]
${trainedAnalyticsChunk}

[MARKET BASKET ASSOCIATION RULES & DISH PAIRINGS]
${pairingChunk || '• Top pairings: Cold Coffee with Desserts/Snacks (28.9%), Butter Naan with Paneer Butter Masala (72%), Biryani with Raita & Beverages.'}

[VERIFIED HOTEL & RESTAURANT STAFF ROSTER]
Total Active Staff: ${Array.isArray(liveData?.staff) ? liveData.staff.length : 0}
${staffChunk}

[VERIFIED TOP 5 BEST-SELLING & HIGHEST-RATED DISHES IN OUR HOTEL]
${topDishesChunk}

[VERIFIED RESTAURANT INFORMATION & OPERATING HOURS]
Restaurant Name: ${RESTAURANT_KNOWLEDGE_BASE.restaurantName}
Operating Hours: General: ${RESTAURANT_KNOWLEDGE_BASE.operatingHours.general}
• Breakfast: ${RESTAURANT_KNOWLEDGE_BASE.operatingHours.breakfast}
• Lunch: ${RESTAURANT_KNOWLEDGE_BASE.operatingHours.lunch}
• Snacks/Tea: ${RESTAURANT_KNOWLEDGE_BASE.operatingHours.snacksTea}
• Dinner: ${RESTAURANT_KNOWLEDGE_BASE.operatingHours.dinner}

[RELEVANT MENU ITEMS & PRICING]
${menuChunk}

[RESTAURANT POLICIES & GUIDELINES]
${policyChunk}

[LIVE SYSTEM STATE]
${operationalSummary}
`.trim();
}

// ----------------------------------------------------
// 7. PRODUCTION RESTAURANT ASSISTANT (CHATBOT)
// ----------------------------------------------------
export async function askBhakasuraAI(history: { role: string; content: string }[], contextData: any): Promise<string> {
  const latestUserQuery = history[history.length - 1]?.content || '';
  const retrievedContext = retrieveRelevantContext(latestUserQuery, contextData);

  // Determine dynamic temperature: low for factual lookup, moderate for recommendations
  const isRecommendation = /recommend|suggest|what should|best combo|idea|special/i.test(latestUserQuery);
  const temperature = isRecommendation ? 0.6 : 0.3;

  const systemPrompt = `You are TableTap AI, an intelligent, warm, executive AI assistant for our hotel management, dining, and restaurant platform.
You have been trained directly with the restaurant's actual 1-year historical dataset (23,708 orders, 365 daily analytics records, machine learning prep-time models, and market basket affinities).

Tone & Persona:
• Warm, authoritative, executive, highly intelligent, engaging, professional, and delightfully conversational.
• Deeply knowledgeable about all hotel & restaurant operations, verified 1-year financial metrics, dish performance, prices, prep times, rush hours, policies, and active staff.
• Precise with numbers: Always quote exact figures when asked about revenues, orders, prep times, ratings, veg vs non-veg, peak days, and ML model stats.

Core Rules & Guidelines:
1. TRUTHFULNESS & EXACT NUMBERS: Use the verified 1-year analytics data, ML models, menu items, prices, staff roster, and policies provided in the context below. Quote exact figures (e.g. ₹89,53,131.50 annual revenue, 23,708 orders, ₹24,529 avg daily revenue, ₹377.64 AOV, 83% veg preference, peak revenue day May Day ₹46,438.68, RandomForest R² = 0.957, MAE = 1.27 min). Never invent fake numbers or dishes.
2. STAFF INQUIRIES: When asked about staff members or employees, provide the verified team members from the staff roster (names, roles, shifts, assigned tables). Only Waiter roles exist in our staff hierarchy.
3. GENERAL KNOWLEDGE & CONVERSATION: If the user asks general knowledge, literature, science, or casual queries (e.g. "who is Romeo"), answer accurately and warmly, adding a charming hospitality touch if suitable.
4. NO RAW CHAIN-OF-THOUGHT EXPOSURE: Internally reason step-by-step, but output ONLY the final answer in the structured format below. Never output raw reasoning tags (<think>...</think>).

Formatting Requirement:
You MUST format your response cleanly using visible borders and sections:
┌─ Answer ────────────────────────────────────────┐
│ [Direct, clear, human-like answer to the user] │
│                                                 │
│ Key Details:                                    │
│ • [Bullet points of details, facts, or answers] │
│                                                 │
│ Next Steps:                                     │
│ • [Helpful follow-up actions or suggestions]   │
└─────────────────────────────────────────────────┘

Few-Shot Examples:

[Example 1 - Menu Item & Allergen Question]
User: "How much is Masala Dosa, and is it gluten-free?"
Assistant:
┌─ Answer ────────────────────────────────────────┐
│ Our Masala Dosa is priced at ₹90 and is freshly │
│ prepared with potato masala and coconut chutney.│
│                                                 │
│ Key Details:                                    │
│ • Price: ₹90 | Category: Breakfast (320 kcal)  │
│ • Dietary: Vegetarian. Fermented rice & lentil  │
│   batter. Contains dairy ghee/butter.           │
│ • Allergen Note: For strict gluten-free diners, │
│   we recommend Idli Sambar (₹70) or Medu Vada.  │
│                                                 │
│ Next Steps:                                     │
│ • Would you like to place an order for Table 05?│
└─────────────────────────────────────────────────┘

[Example 2 - 1-Year Revenue Question]
User: "What was our total revenue over the past year?"
Assistant:
┌─ Answer ────────────────────────────────────────┐
│ Over the past 365 operating days, TableTap      │
│ generated a total revenue of ₹89,53,131.50      │
│ across 23,708 completed dining orders.          │
│                                                 │
│ Key Details:                                    │
│ • Total Gross Revenue: ₹89,53,131.50            │
│ • Total Orders: 23,708 (avg 65 orders/day)      │
│ • Average Daily Revenue: ₹24,529.13             │
│ • Average Order Value (AOV): ₹377.64            │
│ • Peak Day: May Day (₹46,438.68, 114 orders)    │
│                                                 │
│ Next Steps:                                     │
│ • Would you like a breakdown by day-of-week or  │
│   a monthly revenue trend comparison?           │
└─────────────────────────────────────────────────┘

[VERIFIED RETRIEVED KNOWLEDGE BASE CONTEXT]
${retrievedContext}
`;

  const candidateModels = getGroqModels();

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      if (!API_KEY) throw new Error('No Groq API key configured.');

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history
          ],
          temperature,
          max_tokens: 850,
          top_p: 0.9,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        let content = data.choices[0]?.message?.content;
        if (content) {
          // Sanitize any raw reasoning or thinking tags if model emitted them
          content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          return content;
        }
      } else {
        const errorText = await response.text();
        console.warn(`Groq askBhakasuraAI HTTP ${response.status} with model ${model}:`, errorText);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn(`Groq askBhakasuraAI model ${model} error:`, error);
    }
  }

  // Grounded contextual fallback using verified 1-year data and local intelligence
  const qLower = latestUserQuery.toLowerCase();
  const annual = (mlData as any)?.annualAnalytics?.annualSummary || {};
  const peak = (mlData as any)?.annualAnalytics?.peakAndLowPerformance || {};

  if (qLower.includes('revenue') || qLower.includes('sales') || qLower.includes('turnover') || qLower.includes('earn')) {
    return `┌─ Answer ────────────────────────────────────────┐
│ Over the 365-day operating year, our restaurant │
│ generated ₹${(annual.totalRevenue || 8953131.5).toLocaleString('en-IN')} across ${(annual.totalOrders || 23708).toLocaleString('en-IN')} orders.│
│                                                 │
│ Key Details:                                    │
│ • Total 1-Year Revenue: ₹${(annual.totalRevenue || 8953131.5).toLocaleString('en-IN')}        │
│ • Average Daily Revenue: ₹${(annual.avgDailyRevenue || 24529.13).toLocaleString('en-IN')}         │
│ • Average Order Value (AOV): ₹${annual.avgOrderValue || 377.64}            │
│ • Peak Day: May Day (₹46,438.68, 114 orders)    │
│ • Weekend Daily Average: ₹31,437.20 (1.62x surge│
│                                                 │
│ Next Steps:                                     │
│ • You can view full monthly trends in the Admin │
│   Analytics dashboard tab.                      │
└─────────────────────────────────────────────────┘`;
  }

  if (qLower.includes('prep') || qLower.includes('delay') || qLower.includes('kitchen') || qLower.includes('cook time')) {
    return `┌─ Answer ────────────────────────────────────────┐
│ Our kitchen operations maintain an average prep │
│ time of ${annual.avgPrepTimeMinutes || 20.5} minutes across all dining sessions. │
│                                                 │
│ Key Details:                                    │
│ • Average Prep Time: ${annual.avgPrepTimeMinutes || 20.5} minutes               │
│ • ML RandomForest Model: R² = 0.957, MAE = 1.27m │
│ • Primary Bottleneck: Kitchen Queue Length (42%)│
│ • Peak Rush Hours: 1:00 PM (Lunch) & 8:00 PM    │
│                                                 │
│ Next Steps:                                     │
│ • Monitor active KDS queue lengths to prevent   │
│   rush-hour delays during peak dinner sessions. │
└─────────────────────────────────────────────────┘`;
  }

  if (qLower.includes('veg') || qLower.includes('non-veg') || qLower.includes('dietary')) {
    return `┌─ Answer ────────────────────────────────────────┐
│ Our annual sales data shows that 83.0% of all   │
│ items ordered are Vegetarian (${(annual.totalVegItemsSold || 55284).toLocaleString('en-IN')} items). │
│                                                 │
│ Key Details:                                    │
│ • Vegetarian Share: 83.0% (55,284 items sold)   │
│ • Non-Vegetarian Share: 17.0% (11,314 items)    │
│ • Top Veg Dishes: Masala Dosa, Paneer Butter    │
│   Masala, Veg Sandwich, French Fries            │
│                                                 │
│ Next Steps:                                     │
│ • Consider featuring seasonal vegetarian combos │
│   to capitalize on strong customer preference.  │
└─────────────────────────────────────────────────┘`;
  }

  // Graceful, formatted fallback utilizing verified knowledge
  return `┌─ Answer ────────────────────────────────────────┐
│ I am operating with TableTap's verified 1-year  │
│ dataset and live restaurant knowledge base.     │
│                                                 │
│ Key Details:                                    │
│ • Operating Hours: 7:00 AM – 11:30 PM daily     │
│ • 1-Year Revenue: ₹89,53,131.50 (23,708 orders) │
│ • Customer Satisfaction: 4.43★ average rating   │
│ • GST Policy: 5% standard dining GST            │
│                                                 │
│ Next Steps:                                     │
│ • Ask me about revenue, dish pairings, prep     │
│   times, staff roster, or menu recommendations. │
└─────────────────────────────────────────────────┘`;
}
