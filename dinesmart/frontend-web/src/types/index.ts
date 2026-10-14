export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: 'Breakfast' | 'Soups' | 'Starters' | 'Main Course' | 'Combos' | 'Breads' | 'Beverages' | 'Desserts' | string;
  subcategory?: string;
  image: string;
  rating: number;
  reviewsCount: number;
  isVeg: boolean;
  spicyLevel?: 0 | 1 | 2 | 3; // 0=none, 1=mild, 2=medium, 3=hot
  isSpecial?: boolean;
  calories: number;
  prepTime: string; // e.g. "20-25 mins"
  description: string;
  isUnlimited?: boolean;
  dailyLimit?: number;
  soldCount?: number;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedInstructions: string[]; // e.g., ["Less Spicy", "No Onion"]
  customNotes: string;
}

export interface Order {
  id: string;
  tableId: string;
  items: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    instructions: string[];
    customNotes: string;
  }[];
  subtotal: number;
  gst: number;
  discount: number;
  tip: number;
  total: number;
  status: 'Confirmed' | 'Preparing' | 'Cooking' | 'Ready to Serve' | 'Delivered';
  createdAt: string;
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod?: string;
  feedbackSubmitted?: boolean;
}

export interface UserProfile {
  name: string;
  phone: string;
  points: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

export interface WaiterRequest {
  id: string;
  tableId: string;
  requestType: 'Water' | 'Cutlery' | 'Tissue' | 'Call Waiter' | 'Request Bill';
  status: 'Pending' | 'Completed';
  createdAt: string;
}

export interface PendingStaff {
  id: string;
  name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  photo?: string;
  role?: 'Waiter' | 'Chef' | 'Manager' | 'Cashier' | 'Cleaner' | 'Delivery Staff';
  shift?: 'Morning' | 'Evening' | 'Night';
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt?: string;
}

export interface TableSession {
  sessionId: string;
  tableId: string;
  deviceId: string;
  customerPhone?: string;
  customerName?: string;
  startedAt: string;
  lastActivityAt: string;
  status: 'active' | 'completed' | 'expired';
}

export interface TableItem {
  id: number;
  name: string;
  status: 'Available' | 'Occupied' | 'Billing';
  customer_name?: string;
  capacity?: number;
  qr_token?: string;
  active_session_id?: string;
  active_session_device?: string;
  active_session_phone?: string;
  session_started_at?: string;
  last_activity_at?: string;
}

export interface Review {
  id: string;
  orderId: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  reply?: string;
  category?: string;
  foodRating?: number;
  serviceRating?: number;
  ambienceRating?: number;
}

export interface Promotion {
  id: string;
  code: string;
  discount: number;
  type: 'Fixed' | 'Percentage';
  minBill?: number;
  applicableCategory?: string;
  active: boolean;
  maxDiscount?: number;
  usageCount?: number;
}
