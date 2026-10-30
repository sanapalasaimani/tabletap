/**
 * TableTap / DineSmart Operational Knowledge Base Corpus
 * Verified Standard Operating Procedures (SOPs), Regulatory Policies, and Culinary Guides.
 */

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: 'POLICIES' | 'SOPS' | 'ALLERGENS' | 'SERVICE_STANDARDS' | 'CULINARY';
  department: 'Front Desk & Rooms' | 'Food & Beverage' | 'Kitchen Operations' | 'Staff & HR' | 'Finance & Revenue';
  content: string;
  keywords: string[];
  lastUpdated: string;
}

export const KNOWLEDGE_BASE_CORPUS: KnowledgeDocument[] = [
  // ----------------------------------------------------
  // 1. RESTAURANT POLICIES & REGULATORY GUIDELINES
  // ----------------------------------------------------
  {
    id: 'POL-TAX-01',
    title: 'Goods and Services Tax (GST) & Dining Billing Policy',
    category: 'POLICIES',
    department: 'Finance & Revenue',
    content: `Goods and Services Tax (GST) Policy:
1. All food and beverage dining bills incur a statutory 5% dining GST.
2. The 5% rate is equally apportioned as 2.5% Central GST (CGST) and 2.5% State GST (SGST).
3. Alcohol is not served and therefore no state excise or luxury surcharge applies.
4. DineSmart guarantees 100% billing transparency with zero hidden service fees, administrative surcharges, or cover charges.
5. Invoices clearly print GSTIN registration, taxable subtotal, itemized taxes, and final round-off total.`,
    keywords: ['gst', 'tax', 'cgst', 'sgst', 'taxes', 'bill', 'billing', 'vat', 'charges', 'hidden fee'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'POL-TIP-02',
    title: 'Gratuity, Tipping, and Service Charge Guidelines',
    category: 'POLICIES',
    department: 'Staff & HR',
    content: `Service Charge & Staff Tipping Policy:
1. DineSmart does NOT impose any mandatory service charge on guest checks in accordance with consumer protection guidelines.
2. Diners have the full discretion to provide voluntary gratuity (tips) either in cash or through the TableTap digital payment terminal.
3. 100% of tips collected via the digital terminal are credited directly to the assigned service waiter or pooled transparently per the staff scorecard.
4. Management takes zero commission or deduction from employee gratuities.`,
    keywords: ['tip', 'tips', 'tipping', 'service charge', 'gratuity', 'voluntary', 'waiter tip', 'scorecard'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'POL-CAN-03',
    title: 'Order Modification, Cancellation & Void Protocols',
    category: 'POLICIES',
    department: 'Kitchen Operations',
    content: `Order Cancellation & Modification Policy:
1. Diners or floor staff may modify or cancel an order within 5 minutes of order placement provided the Kitchen Display System (KDS) has not marked the ticket as 'Cooking'.
2. Once food preparation has begun on the line ('Cooking' or 'Ready' status), cancellations require Manager on Duty (MOD) authorization.
3. Voided items due to kitchen delay or kitchen shortage are logged in inventory loss and void records with manager approval.
4. Pre-paid cancellations are refunded immediately to the original payment source.`,
    keywords: ['cancel', 'cancellation', 'modify', 'void', 'change order', 'refund', 'kds', 'cooking'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'POL-ALG-04',
    title: 'FSSAI Allergen Declaration & Cross-Contact Protocols',
    category: 'ALLERGENS',
    department: 'Kitchen Operations',
    content: `Food Safety & Allergen Cross-Contact Management:
1. DineSmart food production strictly complies with FSSAI regulations identifying 8 major food allergens: Dairy, Wheat/Gluten, Peanuts, Tree Nuts, Soy, Mustard, Sesame, and Sulphites.
2. Dishes containing allergens are labeled in the digital menu catalog (e.g. Paneer Butter Masala contains Dairy; Walnut Brownie contains Tree Nuts; Idli contains Mustard seeds in tempering).
3. Diners with severe celiac disease or nut allergies must alert the server. Kitchen uses dedicated sanitized cookware and clean utensils for allergy-modified orders.
4. While separate preparation protocols are practiced, the kitchen operates in a shared prep environment handling wheat and dairy.`,
    keywords: ['allergen', 'allergy', 'allergens', 'dairy', 'gluten', 'wheat', 'nuts', 'peanuts', 'fssai', 'celiac', 'vegan'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'POL-TAB-05',
    title: 'Table Allocation, Capacity, and Reservation Standards',
    category: 'SERVICE_STANDARDS',
    department: 'Food & Beverage',
    content: `Table Allocation & Seating Guidelines:
1. DineSmart features 12 indoor dining tables with standard capacity ranging from 2-top to 6-top seating.
2. Tables 1 through 8 are prioritized for walk-in dining guests.
3. Tables 9 through 12 accommodate advance party reservations (minimum party size of 4 guests).
4. Reservations are held for a 15-minute grace period past the confirmed arrival time before release to waiting walk-in parties.
5. Large banquets or dining groups exceeding 12 guests require 24-hour advance coordination with the restaurant manager.`,
    keywords: ['table', 'tables', 'reservation', 'booking', 'walk-in', 'capacity', 'seats', 'grace period'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'POL-HRS-06',
    title: 'Operational Hours & Meal Service Timings',
    category: 'SERVICE_STANDARDS',
    department: 'Food & Beverage',
    content: `Restaurant Operating Schedule:
1. DineSmart opens daily at 7:00 AM and closes at 11:30 PM (365 days a year).
2. Service Sessions:
   - Breakfast: 7:00 AM – 11:30 AM (Dosas, Idli, Uttapam, Pongal, Poori, Coffee)
   - Lunch: 12:00 PM – 4:00 PM (Biryani, Thali, Curries, Naan, Rice)
   - High Tea & Snacks: 4:00 PM – 7:00 PM (Sandwiches, Chaat, French Fries, Beverages)
   - Dinner: 7:00 PM – 11:30 PM (Full Dinner Catalog, Tandoor, Desserts)
3. Last kitchen orders are accepted at 11:00 PM sharp.`,
    keywords: ['hours', 'timings', 'opening', 'closing', 'breakfast', 'lunch', 'dinner', 'snack', 'schedule'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'POL-REF-07',
    title: 'Payment Settlement, Failed Transactions, and Refund SLA',
    category: 'POLICIES',
    department: 'Finance & Revenue',
    content: `Payment Methods & Refund Policy:
1. Accepted tenders: UPI (PhonePe, Google Pay, Paytm), Credit/Debit Cards (Visa, Mastercard, RuPay), and Cash.
2. In the event of a duplicate payment or failed UPI debit where funds left the customer account without clearing POS:
   - The transaction ID is recorded in the POS shift log.
   - Bank settlement automatically reverses failed UPI transactions within 24–48 banking hours.
3. If cash was erroneously charged, the cashier initiates immediate on-the-spot cash reimbursement with signed voucher.`,
    keywords: ['payment', 'upi', 'card', 'cash', 'refund', 'failed payment', 'duplicate debit', 'settlement'],
    lastUpdated: '2026-10-15'
  },

  // ----------------------------------------------------
  // 2. STANDARD OPERATING PROCEDURES (SOPS)
  // ----------------------------------------------------
  {
    id: 'SOP-SVC-01',
    title: 'Waiter Table Service Sequence and Etiquette',
    category: 'SOPS',
    department: 'Staff & HR',
    content: `Waitstaff 5-Step Service Protocol:
1. Step 1 (Greeting & Seating - within 90 seconds): Welcome guests warmly, offer chilled or warm water, present table QR menu.
2. Step 2 (Order Taking & Upselling): Inquire about dietary restrictions, recommend chef specials (e.g. Chicken Dum Biryani, Paneer Tikka), confirm customization notes.
3. Step 3 (Kitchen Relay & KDS Staging): Enter order into TableTap terminal immediately; kitchen queue target SLA is 12–15 mins for appetizers, 18–22 mins for mains.
4. Step 4 (Two-Bite Check-Back): Within 3 minutes of serving hot food, check back with table to verify satisfaction, refill water, and take additional requests.
5. Step 5 (Settlement & Farewell): Present itemized bill promptly upon request, handle payment cleanly, thank guests warmly, and clear table within 3 minutes of departure.`,
    keywords: ['waiter', 'service sequence', 'etiquette', 'greeting', 'upselling', 'check-back', 'table turnaround', 'sla'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'SOP-KTN-02',
    title: 'Kitchen Expediter & KDS Queue Balancing SOP',
    category: 'SOPS',
    department: 'Kitchen Operations',
    content: `Kitchen Line Rush Hour Balancing:
1. Designated Expediter (active during 1:00–2:30 PM lunch and 8:00–10:00 PM dinner peaks):
   - Audits tickets on the KDS board.
   - Synchronizes tandoor, curry, and rice stations so all items on a ticket finish simultaneously.
2. Prep Delay Alarms:
   - If an order ticket exceeds 20 minutes elapsed time without 'Plating' status, KDS flashes Amber.
   - If ticket reaches 25 minutes, KDS flashes Red and notifies Head Chef and Floor Manager immediately.
3. Expediter performs garnish check, plate rim wipe, and issues table bell call to waitstaff.`,
    keywords: ['kitchen', 'expediter', 'kds', 'rush hour', 'delay', 'queue', 'plating', 'head chef', 'bottleneck'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'SOP-SAN-03',
    title: 'Food Safety, Holding Temperatures & Sanitation Guidelines',
    category: 'SOPS',
    department: 'Kitchen Operations',
    content: `Food Hygiene & Temperature Standard Operating Procedure:
1. Hot Holding Standard: All prepared curries, gravies, and cooked gravies must be held at or above 60°C (140°F) in bain-marie steamers.
2. Cold Storage Standard: Dairy, fresh paneer, and raw meats must be maintained at 1°C to 4°C in walk-in refrigeration.
3. Color-Coded Chopping Boards: Green for raw vegetables/fruits, Red for raw poultry/meat, Yellow for cooked meats, White for dairy and bakery.
4. Hand Washing Rule: Food handlers wash hands every 30 minutes and after any task switch using antibacterial soap for at least 20 seconds.`,
    keywords: ['food safety', 'temperature', 'hygiene', 'holding', 'refrigeration', 'chopping board', 'sanitation', 'fssai'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'SOP-INV-04',
    title: 'Daily Kitchen Closing, Stock Audit & Wastage Logging',
    category: 'SOPS',
    department: 'Kitchen Operations',
    content: `Inventory Audit & Kitchen Closing SOP:
1. Every evening at 11:15 PM, Sous Chef conducts visual physical count of high-value inventory items (basmati rice, paneer, chicken, cooking oil, dairy cream).
2. Any ingredient where stock falls below safety min_stock triggers an automated re-order alert in the inventory module.
3. Kitchen Wastage Log: Unusable prep batches or expired perishables must be entered into POS wastage log stating item, weight in grams, and cause.
4. Refrigerator log sheets must record closing compressor temperatures.`,
    keywords: ['inventory', 'stock', 'closing', 'wastage', 'reorder', 'min stock', 'perishables', 'basmati', 'paneer'],
    lastUpdated: '2026-10-15'
  },
  {
    id: 'SOP-GST-06',
    title: 'Guest Complaint Resolution & Service Recovery Guidelines',
    category: 'SERVICE_STANDARDS',
    department: 'Staff & HR',
    content: `Guest Recovery & Complaint Resolution Protocol:
1. The L.A.S.T. Recovery Framework:
   - Listen: Listen attentively without interruption to guest concern.
   - Apologize: Offer a sincere, non-defensive apology for the inconvenience.
   - Solve: Replace unsatisfactory dish within 6–8 minutes or adjust spice level immediately.
   - Thank: Thank guest for bringing the feedback to management's attention.
2. Compensation Authority:
   - Floor Waiter: Authorized to comp a complimentary beverage or dessert (up to ₹120 value).
   - Manager on Duty: Authorized to discount 15%–50% or completely comp the problematic meal ticket.
3. Every guest complaint must be entered into the POS feedback log for weekly management review.`,
    keywords: ['complaint', 'dissatisfaction', 'recovery', 'comp', 'complimentary', 'discount', 'manager', 'apology'],
    lastUpdated: '2026-10-15'
  }
];

