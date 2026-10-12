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
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt?: string;
}
