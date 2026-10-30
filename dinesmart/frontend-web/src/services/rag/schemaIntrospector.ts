/**
 * TableTap / DineSmart Schema Introspector & Semantic Schema Pruner
 * Generates accurate, grounded database schema contexts with real data types,
 * foreign keys, and low-cardinality sample values for Text-to-SQL generation.
 */

export interface TableColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  sampleValues?: string[];
  description?: string;
}

export interface TableSchemaMetadata {
  tableName: string;
  description: string;
  primaryKey: string;
  columns: TableColumnMetadata[];
  keywords: string[];
  notes?: string;
}

/**
 * Ground Truth Table Metadata matching Supabase PostgreSQL live schema
 */
export const LIVE_SCHEMA_REGISTRY: Record<string, TableSchemaMetadata> = {
  orders: {
    tableName: 'orders',
    description: 'Customer dining orders, financials, table identifiers, and items ordered.',
    primaryKey: 'id',
    keywords: [
      'order', 'orders', 'sales', 'revenue', 'income', 'bill', 'billing', 'table',
      'subtotal', 'discount', 'tip', 'tips', 'gst', 'tax', 'payment', 'paid', 'cash', 'upi', 'card'
    ],
    notes: 'items column is JSONB array with structure: [{"name":"Dish Name","price":240,"quantity":1,"menuItemId":"st1"}]. To query individual dishes, use jsonb_array_elements(items).',
    columns: [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true, description: 'Order ID, e.g. "ord_8899"' },
      { name: 'table_id', type: 'text', nullable: false, description: 'Dining table number or ID, e.g. "2"' },
      { name: 'items', type: 'jsonb', nullable: false, description: 'JSON array of ordered dish items' },
      { name: 'subtotal', type: 'numeric', nullable: false, description: 'Total food cost before tax & discounts' },
      { name: 'gst', type: 'numeric', nullable: false, description: '5% dining GST' },
      { name: 'discount', type: 'numeric', nullable: true, description: 'Discount applied to the bill' },
      { name: 'tip', type: 'numeric', nullable: true, description: 'Customer gratuity' },
      { name: 'total', type: 'numeric', nullable: false, description: 'Final settled amount' },
      { name: 'status', type: 'text', nullable: false, sampleValues: ['Delivered', 'Completed', 'Preparing', 'Ready', 'Cancelled'], description: 'Order workflow status' },
      { name: 'payment_status', type: 'text', nullable: false, sampleValues: ['Paid', 'Pending', 'Failed'], description: 'Settlement status' },
      { name: 'payment_method', type: 'text', nullable: true, sampleValues: ['UPI', 'Card', 'Cash'], description: 'Payment tender' },
      { name: 'customer_phone', type: 'text', nullable: true, description: 'Contact phone for loyalty' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Timestamp when order was placed' }
    ]
  },

  menu_items: {
    tableName: 'menu_items',
    description: 'Restaurant food catalog, culinary categories, pricing, ratings, and dietary flags.',
    primaryKey: 'id',
    keywords: [
      'menu', 'dish', 'dishes', 'item', 'items', 'food', 'price', 'pricing', 'category',
      'veg', 'vegetarian', 'non-veg', 'spicy', 'calories', 'prep time', 'recipe', 'dessert', 'beverage'
    ],
    notes: 'Contains 120 live dishes across 8 distinct categories. Available column flags active menu items.',
    columns: [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true, description: 'Dish code, e.g. "bf6", "st1", "m5"' },
      { name: 'name', type: 'text', nullable: false, description: 'Dish name, e.g. "Paneer Tikka", "Onion Uttapam"' },
      { name: 'price', type: 'numeric', nullable: false, description: 'Price in INR' },
      { name: 'category', type: 'text', nullable: false, sampleValues: ['Breakfast', 'Starters', 'Main Course', 'Breads & Rice', 'Desserts', 'Beverages', 'Soups & Salads', 'Snacks'] },
      { name: 'rating', type: 'numeric', nullable: true, description: 'Average rating (1.0 - 5.0)' },
      { name: 'reviews_count', type: 'integer', nullable: true, description: 'Number of customer reviews' },
      { name: 'is_veg', type: 'boolean', nullable: false, sampleValues: ['true', 'false'], description: 'True if 100% vegetarian' },
      { name: 'spicy_level', type: 'integer', nullable: false, sampleValues: ['0', '1', '2', '3'], description: 'Spice rating 0 (mild) to 3 (extra hot)' },
      { name: 'is_special', type: 'boolean', nullable: false, description: 'Chef special recommendation' },
      { name: 'calories', type: 'integer', nullable: true, description: 'Estimated calories per serving' },
      { name: 'prep_time', type: 'text', nullable: true, description: 'Kitchen preparation time, e.g. "12-15 mins"' },
      { name: 'description', type: 'text', nullable: true, description: 'Detailed ingredient and sensory description' },
      { name: 'available', type: 'boolean', nullable: false, sampleValues: ['true', 'false'], description: 'Whether item is in stock and orderable' }
    ]
  },

  staff: {
    tableName: 'staff',
    description: 'Hotel & restaurant employees including service waiters, chefs, and managers.',
    primaryKey: 'id',
    keywords: [
      'staff', 'employee', 'waiter', 'waiters', 'server', 'chef', 'manager', 'shift',
      'salary', 'attendance', 'tips', 'empid', 'performance'
    ],
    notes: 'NOTE: Waiters are staff where role = "Waiter". password column is excluded from access.',
    columns: [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true, description: 'Staff internal ID' },
      { name: 'name', type: 'text', nullable: false, description: 'Employee full name' },
      { name: 'mobile', type: 'text', nullable: true, description: 'Contact phone' },
      { name: 'role', type: 'text', nullable: false, sampleValues: ['Waiter', 'Chef', 'Manager', 'Cashier', 'Admin'], description: 'Designation' },
      { name: 'shift', type: 'text', nullable: false, sampleValues: ['Morning', 'Evening', 'Night'], description: 'Work shift schedule' },
      { name: 'salary', type: 'numeric', nullable: false, description: 'Monthly salary in INR' },
      { name: 'attendance', type: 'numeric', nullable: false, description: 'Attendance percentage (0-100)' },
      { name: 'performance', type: 'jsonb', nullable: false, description: 'JSON object: {"tips": 0, "score": 90, "ratings": 5, "ordersDelivered": 0}' },
      { name: 'empid', type: 'text', nullable: false, description: 'Employee code, e.g. "EMP-2519"' }
    ]
  },

  loyalty_profiles: {
    tableName: 'loyalty_profiles',
    description: 'Customer loyalty members, accumulated reward points, and tier standing.',
    primaryKey: 'phone',
    keywords: [
      'customer', 'loyalty', 'points', 'rewards', 'tier', 'bronze', 'silver', 'gold', 'platinum', 'member', 'repeat'
    ],
    columns: [
      { name: 'phone', type: 'text', nullable: false, isPrimaryKey: true, description: 'Customer mobile phone' },
      { name: 'name', type: 'text', nullable: false, description: 'Customer name' },
      { name: 'points', type: 'integer', nullable: false, description: 'Accumulated reward points' },
      { name: 'tier', type: 'text', nullable: false, sampleValues: ['Bronze', 'Silver', 'Gold', 'Platinum'], description: 'Loyalty tier' }
    ]
  },

  feedback: {
    tableName: 'feedback',
    description: 'Customer post-dining satisfaction ratings and subjective qualitative comments.',
    primaryKey: 'id',
    keywords: [
      'feedback', 'rating', 'ratings', 'review', 'csat', 'satisfaction', 'food rating',
      'service rating', 'ambience rating', 'comment', 'complaint'
    ],
    columns: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, description: 'Survey ID' },
      { name: 'order_id', type: 'text', nullable: false, description: 'Associated order ID' },
      { name: 'food_rating', type: 'numeric', nullable: false, sampleValues: ['1', '2', '3', '4', '5'], description: 'Rating 1-5' },
      { name: 'service_rating', type: 'numeric', nullable: false, sampleValues: ['1', '2', '3', '4', '5'], description: 'Rating 1-5' },
      { name: 'ambience_rating', type: 'numeric', nullable: false, sampleValues: ['1', '2', '3', '4', '5'], description: 'Rating 1-5' },
      { name: 'comments', type: 'text', nullable: true, description: 'Customer written remarks' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Submission timestamp' }
    ]
  },

  inventory: {
    tableName: 'inventory',
    description: 'Raw kitchen ingredients, supplies, stock in hand, and reorder levels.',
    primaryKey: 'id',
    keywords: [
      'inventory', 'stock', 'ingredient', 'raw material', 'min stock', 'unit', 'cost', 'shortage', 'reorder'
    ],
    columns: [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true, description: 'Inventory item ID' },
      { name: 'name', type: 'text', nullable: false, description: 'Item name, e.g. "basmati", "paneer", "oil"' },
      { name: 'stock', type: 'numeric', nullable: false, description: 'Current quantity in stock' },
      { name: 'min_stock', type: 'numeric', nullable: false, description: 'Minimum safety threshold' },
      { name: 'unit', type: 'text', nullable: false, sampleValues: ['Kg', 'L', 'Pcs', 'Bags'], description: 'Measurement unit' },
      { name: 'cost', type: 'numeric', nullable: false, description: 'Unit cost in INR' }
    ]
  },

  waiter_requests: {
    tableName: 'waiter_requests',
    description: 'In-dining service bell requests initiated from table digital menus.',
    primaryKey: 'id',
    keywords: [
      'waiter request', 'bell', 'call waiter', 'water', 'cutlery', 'bill request', 'assistance'
    ],
    columns: [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true, description: 'Request ID' },
      { name: 'table_id', type: 'text', nullable: false, description: 'Table number' },
      { name: 'request_type', type: 'text', nullable: false, sampleValues: ['Request Bill', 'Water', 'Cutlery', 'Call Waiter', 'Cleaning'], description: 'Assistance category' },
      { name: 'status', type: 'text', nullable: false, sampleValues: ['Pending', 'Completed', 'In Progress'], description: 'Resolution status' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Request timestamp' }
    ]
  },

  promotions: {
    tableName: 'promotions',
    description: 'Active discount coupons, seasonal campaigns, and promotion codes.',
    primaryKey: 'id',
    keywords: [
      'promo', 'promotion', 'coupon', 'code', 'discount campaign', 'offer'
    ],
    columns: [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true, description: 'Coupon ID' },
      { name: 'code', type: 'text', nullable: false, description: 'Voucher code, e.g. "JAGAN200"' },
      { name: 'discount', type: 'numeric', nullable: false, description: 'Deduction amount or percentage' },
      { name: 'type', type: 'text', nullable: false, sampleValues: ['Fixed', 'Percent'], description: 'Discount type' },
      { name: 'min_bill', type: 'numeric', nullable: false, description: 'Minimum spend required' },
      { name: 'active', type: 'boolean', nullable: false, sampleValues: ['true', 'false'], description: 'Whether coupon is valid' }
    ]
  }
};

/**
 * Semantically prunes the database schema to the top 3-6 relevant tables
 * matching the user query. This protects context window and prevents hallucination.
 */
export function pruneSchemaForQuery(query: string, maxTables: number = 4): TableSchemaMetadata[] {
  const cleanQuery = query.toLowerCase();
  const scoredTables: Array<{ table: TableSchemaMetadata; score: number }> = [];

  for (const [key, schema] of Object.entries(LIVE_SCHEMA_REGISTRY)) {
    let score = 0;
    
    // Exact table name mention
    if (cleanQuery.includes(key)) score += 10;
    
    // Keyword matches
    for (const kw of schema.keywords) {
      if (cleanQuery.includes(kw)) {
        score += 3;
      }
    }

    // Default bias for core business tables
    if (key === 'orders') score += 2;
    if (key === 'menu_items') score += 1;

    scoredTables.push({ table: schema, score });
  }

  scoredTables.sort((a, b) => b.score - a.score);

  // Return top N tables
  return scoredTables.slice(0, Math.max(2, maxTables)).map(item => item.table);
}

/**
 * Renders pruned tables into an ultra-precise, formatted PostgreSQL DDL / schema prompt.
 */
export function formatSchemaForPrompt(tables: TableSchemaMetadata[]): string {
  return tables.map(table => {
    const colDefs = table.columns.map(c => {
      let extra = '';
      if (c.isPrimaryKey) extra += ' [PRIMARY KEY]';
      if (!c.nullable) extra += ' NOT NULL';
      if (c.sampleValues && c.sampleValues.length > 0) {
        extra += ` (Sample values: ${c.sampleValues.map(v => `'${v}'`).join(', ')})`;
      }
      if (c.description) extra += ` -- ${c.description}`;
      return `    ${c.name} ${c.type.toUpperCase()}${extra}`;
    }).join('\n');

    const note = table.notes ? `\n    -- NOTE: ${table.notes}` : '';

    return `TABLE ${table.tableName} (\n${colDefs}${note}\n);`;
  }).join('\n\n');
}

