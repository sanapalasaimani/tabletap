/**
 * TableTap / DineSmart Business Glossary & SQL Mapping Registry
 * Maps business operations vocabulary to exact, deterministic PostgreSQL queries.
 */

export interface GlossaryMetric {
  id: string;
  name: string;
  category: 'REVENUE_SALES' | 'MENU_ITEMS' | 'STAFF_OPERATIONS' | 'CUSTOMER_EXPERIENCE' | 'INVENTORY' | 'HOTEL_ROOMS';
  status: 'ACTIVE' | 'MISSING';
  definition: string;
  formula: string;
  underlyingTables: string[];
  sqlTemplate?: string;
  notes?: string;
}

export const BUSINESS_GLOSSARY: Record<string, GlossaryMetric> = {
  // ----------------------------------------------------
  // 1. REVENUE & SALES METRICS (ACTIVE)
  // ----------------------------------------------------
  total_revenue: {
    id: 'total_revenue',
    name: 'Total Gross Revenue',
    category: 'REVENUE_SALES',
    status: 'ACTIVE',
    definition: 'Total revenue collected from all confirmed/delivered orders including GST, less discounts, plus tips.',
    formula: 'SUM(total) WHERE status != "Cancelled"',
    underlyingTables: ['orders'],
    sqlTemplate: `
      SELECT COALESCE(SUM(total), 0) AS total_revenue
      FROM orders
      WHERE status != 'Cancelled';
    `,
    notes: 'In DineSmart, orders.total is the final settlement amount.'
  },

  net_sales: {
    id: 'net_sales',
    name: 'Net Sales (Subtotal)',
    category: 'REVENUE_SALES',
    status: 'ACTIVE',
    definition: 'Total food and beverage sales before taxes, tips, and discounts.',
    formula: 'SUM(subtotal) WHERE status != "Cancelled"',
    underlyingTables: ['orders'],
    sqlTemplate: `
      SELECT COALESCE(SUM(subtotal), 0) AS net_sales
      FROM orders
      WHERE status != 'Cancelled';
    `
  },

  average_order_value: {
    id: 'average_order_value',
    name: 'Average Order Value (AOV)',
    category: 'REVENUE_SALES',
    status: 'ACTIVE',
    definition: 'Average amount spent per non-cancelled order ticket.',
    formula: 'SUM(total) / COUNT(id) WHERE status != "Cancelled"',
    underlyingTables: ['orders'],
    sqlTemplate: `
      SELECT 
        COALESCE(ROUND(AVG(total), 2), 0) AS aov,
        COUNT(id) AS order_count,
        COALESCE(SUM(total), 0) AS gross_revenue
      FROM orders
      WHERE status != 'Cancelled';
    `
  },

  discount_total: {
    id: 'discount_total',
    name: 'Discounts Granted',
    category: 'REVENUE_SALES',
    status: 'ACTIVE',
    definition: 'Total promotional and coupon deductions granted across orders.',
    formula: 'SUM(discount) WHERE status != "Cancelled"',
    underlyingTables: ['orders'],
    sqlTemplate: `
      SELECT COALESCE(SUM(discount), 0) AS total_discounts
      FROM orders
      WHERE status != 'Cancelled';
    `
  },

  cancellation_rate: {
    id: 'cancellation_rate',
    name: 'Order Cancellation Rate (Voids)',
    category: 'REVENUE_SALES',
    status: 'ACTIVE',
    definition: 'Percentage and count of orders voided or cancelled by customer or kitchen.',
    formula: '(COUNT(Cancelled) / COUNT(*)) * 100',
    underlyingTables: ['orders'],
    sqlTemplate: `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Cancelled') AS cancelled_count,
        COUNT(*) AS total_orders,
        ROUND((COUNT(*) FILTER (WHERE status = 'Cancelled')::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS cancellation_rate_percent
      FROM orders;
    `
  },

  // ----------------------------------------------------
  // 2. MENU & DISH METRICS (ACTIVE)
  // ----------------------------------------------------
  top_selling_dishes: {
    id: 'top_selling_dishes',
    name: 'Top Selling Dishes by Volume and Revenue',
    category: 'MENU_ITEMS',
    status: 'ACTIVE',
    definition: 'Dish sales ranked by unit count and total generated revenue extracted from JSON order item arrays.',
    formula: 'SUM(quantity) & SUM(quantity * price) GROUP BY item_name',
    underlyingTables: ['orders', 'menu_items'],
    sqlTemplate: `
      SELECT 
        item->>'name' AS dish_name,
        SUM((item->>'quantity')::int) AS units_sold,
        SUM((item->>'quantity')::int * (item->>'price')::numeric) AS item_revenue
      FROM orders o,
           jsonb_array_elements(o.items) AS item
      WHERE o.status != 'Cancelled'
      GROUP BY item->>'name'
      ORDER BY item_revenue DESC
      LIMIT 10;
    `,
    notes: 'Orders table stores dishes in a JSONB array column named items.'
  },

  menu_pricing_by_category: {
    id: 'menu_pricing_by_category',
    name: 'Menu Catalog Distribution & Pricing',
    category: 'MENU_ITEMS',
    status: 'ACTIVE',
    definition: 'Breakdown of active dishes, average price, veg vs non-veg split by culinary category.',
    formula: 'COUNT(*) & AVG(price) GROUP BY category',
    underlyingTables: ['menu_items'],
    sqlTemplate: `
      SELECT 
        category,
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE is_veg = true) AS veg_items,
        COUNT(*) FILTER (WHERE is_veg = false) AS non_veg_items,
        ROUND(AVG(price), 2) AS avg_price,
        MIN(price) AS min_price,
        MAX(price) AS max_price
      FROM menu_items
      WHERE available = true
      GROUP BY category
      ORDER BY total_items DESC;
    `
  },

  // ----------------------------------------------------
  // 3. STAFF & WAITER OPERATIONS (ACTIVE)
  // ----------------------------------------------------
  waiter_performance: {
    id: 'waiter_performance',
    name: 'Waiter Staff Performance & Tips',
    category: 'STAFF_OPERATIONS',
    status: 'ACTIVE',
    definition: 'Performance statistics for service staff (waiters) including tips earned, orders delivered, and ratings.',
    formula: 'Filter staff by role = "Waiter"',
    underlyingTables: ['staff'],
    sqlTemplate: `
      SELECT 
        id,
        name,
        empid,
        mobile,
        shift,
        salary,
        attendance,
        (performance->>'ordersDelivered')::int AS orders_delivered,
        (performance->>'tips')::numeric AS tips_earned,
        (performance->>'ratings')::numeric AS waiter_rating,
        (performance->>'score')::numeric AS performance_score
      FROM staff
      WHERE role = 'Waiter'
      ORDER BY performance_score DESC;
    `,
    notes: 'Password column is excluded at the database role level. Waiters are identified by role = "Waiter" in staff table.'
  },

  waiter_call_requests: {
    id: 'waiter_call_requests',
    name: 'Table Service Assistance Requests',
    category: 'STAFF_OPERATIONS',
    status: 'ACTIVE',
    definition: 'Customer requests for table service, bill requests, or water.',
    formula: 'COUNT(*) GROUP BY request_type, status',
    underlyingTables: ['waiter_requests'],
    sqlTemplate: `
      SELECT 
        request_type,
        status,
        COUNT(*) AS request_count
      FROM waiter_requests
      GROUP BY request_type, status
      ORDER BY request_count DESC;
    `
  },

  // ----------------------------------------------------
  // 4. CUSTOMER EXPERIENCE & INVENTORY (ACTIVE)
  // ----------------------------------------------------
  customer_satisfaction_csat: {
    id: 'customer_satisfaction_csat',
    name: 'Customer Feedback & Ratings (CSAT)',
    category: 'CUSTOMER_EXPERIENCE',
    status: 'ACTIVE',
    definition: 'Averaged customer survey ratings across food quality, service attentiveness, and ambience.',
    formula: 'AVG(food_rating), AVG(service_rating), AVG(ambience_rating)',
    underlyingTables: ['feedback'],
    sqlTemplate: `
      SELECT 
        COUNT(*) AS total_feedbacks,
        ROUND(AVG(food_rating), 2) AS avg_food_rating,
        ROUND(AVG(service_rating), 2) AS avg_service_rating,
        ROUND(AVG(ambience_rating), 2) AS avg_ambience_rating,
        ROUND((AVG(food_rating) + AVG(service_rating) + AVG(ambience_rating)) / 3.0, 2) AS overall_csat
      FROM feedback;
    `
  },

  inventory_stock_alert: {
    id: 'inventory_stock_alert',
    name: 'Raw Materials & Inventory Levels',
    category: 'INVENTORY',
    status: 'ACTIVE',
    definition: 'Kitchen stock levels compared to minimum safety threshold.',
    formula: 'stock <= min_stock',
    underlyingTables: ['inventory'],
    sqlTemplate: `
      SELECT 
        name,
        stock,
        min_stock,
        unit,
        cost,
        CASE WHEN stock <= min_stock THEN 'REORDER_NOW' ELSE 'HEALTHY' END AS stock_status
      FROM inventory
      ORDER BY (stock - min_stock) ASC;
    `
  },

  // ----------------------------------------------------
  // 5. HOTEL ROOM METRICS (MISSING / NOT CONNECTED)
  // ----------------------------------------------------
  hotel_occupancy_rate: {
    id: 'hotel_occupancy_rate',
    name: 'Hotel Room Occupancy Rate',
    category: 'HOTEL_ROOMS',
    status: 'MISSING',
    definition: 'The percentage of available hotel rooms occupied during a specific period.',
    formula: '(Total Occupied Rooms / Total Available Rooms) * 100',
    underlyingTables: ['hotel_rooms (future)', 'room_bookings (future)'],
    notes: 'ROOMS_DATA_ENABLED is false. No live table in Supabase currently tracks hotel rooms.'
  },

  hotel_adr: {
    id: 'hotel_adr',
    name: 'Average Daily Rate (ADR)',
    category: 'HOTEL_ROOMS',
    status: 'MISSING',
    definition: 'Average rental revenue earned per occupied room in a given day.',
    formula: 'Total Room Revenue / Number of Rooms Sold',
    underlyingTables: ['room_bookings (future)'],
    notes: 'ROOMS_DATA_ENABLED is false.'
  },

  hotel_revpar: {
    id: 'hotel_revpar',
    name: 'Revenue Per Available Room (RevPAR)',
    category: 'HOTEL_ROOMS',
    status: 'MISSING',
    definition: 'Total room revenue divided by the total number of available rooms, measuring hotel operational performance.',
    formula: 'ADR * Occupancy Rate = Total Room Revenue / Total Available Rooms',
    underlyingTables: ['hotel_rooms (future)', 'room_bookings (future)'],
    notes: 'ROOMS_DATA_ENABLED is false.'
  },

  hotel_length_of_stay: {
    id: 'hotel_length_of_stay',
    name: 'Average Length of Stay (ALOS)',
    category: 'HOTEL_ROOMS',
    status: 'MISSING',
    definition: 'Average number of nights guests spend in hotel rooms per booking.',
    formula: 'Total Room Nights / Total Bookings',
    underlyingTables: ['room_bookings (future)'],
    notes: 'ROOMS_DATA_ENABLED is false.'
  },

  hotel_room_revenue: {
    id: 'hotel_room_revenue',
    name: 'Hotel Room Rental Revenue',
    category: 'HOTEL_ROOMS',
    status: 'MISSING',
    definition: 'Gross revenue derived strictly from guest lodging and accommodation.',
    formula: 'SUM(room_rate * nights)',
    underlyingTables: ['room_bookings (future)'],
    notes: 'ROOMS_DATA_ENABLED is false.'
  },
};

/**
 * Standard notice returned when a query requests room booking or lodging data.
 */
export const ROOMS_UNAVAILABLE_RESPONSE = `I don't have room booking data connected yet, so I can't calculate this.

TableTap's live database is currently integrated with restaurant dining operations (orders, menu items, staff, inventory, customer loyalty, and table service). Hotel room booking tables have not been provisioned yet.`;

/**
 * Tracks queries asking for missing hotel room metrics for business intelligence demand tracking.
 */
export function logUnansweredRoomsQuery(query: string): void {
  try {
    const timestamp = new Date().toISOString();
    console.warn(`[BusinessGlossary] Demand Log: Unanswered Hotel Room query: "${query}" at ${timestamp}`);
    // Can be persisted to Supabase activity_logs if service role is enabled
  } catch (err) {
    // Non-blocking log
  }
}

