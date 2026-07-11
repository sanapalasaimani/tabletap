import { createClient } from '@supabase/supabase-js';
import { MenuItem, CartItem, Order, UserProfile, WaiterRequest } from './types';
import { MENU_ITEMS } from './data/menu';

// Read Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: any = null;
let isRealSupabase = false;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    isRealSupabase = true;
    console.log('DineSmart AI: Connected to Supabase Database.');
  } catch (error) {
    console.error('DineSmart AI: Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('DineSmart AI: Supabase credentials not found. Falling back to empty Mock LocalStorage Database.');
}

// Helper to manage mock state in LocalStorage (initialized empty, no demo data)
const getMockData = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(`dinesmart_${key}`);
  return data ? JSON.parse(data) : defaultValue;
};

const saveMockData = <T>(key: string, data: T): void => {
  localStorage.setItem(`dinesmart_${key}`, JSON.stringify(data));
};

// EXPORTED SERVICES
export const db = {
  isSupabase: () => isRealSupabase,

  // 1. MENU ITEMS
  getMenuItems: async (): Promise<MenuItem[]> => {
    let items: MenuItem[] = [];
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .order('name');
      if (!error && data) {
        items = data;
      } else {
        console.error('Supabase error fetching menu:', error);
      }
    } else {
      items = getMockData<MenuItem[]>('menu', []);
      if (items.length === 0) {
        items = MENU_ITEMS;
        saveMockData('menu', items);
      }
    }

    // Merge availability configurations and calculate sold count dynamically
    const availability = getMockData<Record<string, { isUnlimited: boolean; dailyLimit: number }>>('menu_availability', {});
    const orders = getMockData<Order[]>('orders', []);
    
    // Count quantities sold today
    const todayStr = new Date().toDateString();
    const itemSoldTodayCount: Record<string, number> = {};
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt).toDateString();
      if (orderDate === todayStr) {
        order.items.forEach(item => {
          itemSoldTodayCount[item.menuItemId] = (itemSoldTodayCount[item.menuItemId] || 0) + item.quantity;
        });
      }
    });

    return items.map(item => {
      const config = availability[item.id] || { isUnlimited: true, dailyLimit: 50 };
      return {
        ...item,
        isUnlimited: config.isUnlimited,
        dailyLimit: config.dailyLimit,
        soldCount: itemSoldTodayCount[item.id] || 0
      };
    });
  },

  updateMenuAvailability: async (itemId: string, isUnlimited: boolean, dailyLimit: number): Promise<void> => {
    const config = getMockData<Record<string, { isUnlimited: boolean; dailyLimit: number }>>('menu_availability', {});
    config[itemId] = { isUnlimited, dailyLimit };
    saveMockData('menu_availability', config);
  },

  saveMenuItem: async (item: MenuItem): Promise<MenuItem> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('menu_items')
        .upsert(item)
        .select()
        .single();
      if (!error && data) return data;
      console.error('Supabase error saving menu item:', error);
    }
    const menu = getMockData<MenuItem[]>('menu', []);
    const idx = menu.findIndex(m => m.id === item.id);
    if (idx !== -1) {
      menu[idx] = item;
    } else {
      menu.push(item);
    }
    saveMockData('menu', menu);
    return item;
  },

  deleteMenuItem: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('menu_items')
        .delete()
        .eq('id', id);
      if (!error) return true;
      console.error('Supabase error deleting menu item:', error);
    }
    const menu = getMockData<MenuItem[]>('menu', []);
    const updated = menu.filter(m => m.id !== id);
    saveMockData('menu', updated);
    return true;
  },

  // 2. CUSTOMER PROFILES
  getCustomerProfile: async (phone: string): Promise<UserProfile | null> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('loyalty_profiles')
        .select('*')
        .eq('phone', phone)
        .single();
      if (!error && data) return data as UserProfile;
    }
    const profiles = getMockData<Record<string, UserProfile>>('profiles', {});
    return profiles[phone] || null;
  },

  saveCustomerProfile: async (profile: UserProfile): Promise<UserProfile> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('loyalty_profiles')
        .upsert(profile)
        .select()
        .single();
      if (!error && data) return data as UserProfile;
    }
    const profiles = getMockData<Record<string, UserProfile>>('profiles', {});
    profiles[profile.phone] = profile;
    saveMockData('profiles', profiles);
    return profile;
  },

  getCustomerProfiles: async (): Promise<UserProfile[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('loyalty_profiles')
        .select('*')
        .order('name');
      if (!error && data) return data as UserProfile[];
    }
    const profiles = getMockData<Record<string, UserProfile>>('profiles', {});
    return Object.values(profiles);
  },

  // 3. ORDERS
  placeOrder: async (
    tableId: string,
    cartItems: CartItem[],
    pricing: { subtotal: number; gst: number; discount: number; tip: number; total: number },
    phone: string
  ): Promise<Order> => {
    const orderItems = cartItems.map(item => ({
      menuItemId: item.menuItem.id,
      name: item.menuItem.name,
      price: item.menuItem.price,
      quantity: item.quantity,
      instructions: item.selectedInstructions,
      customNotes: item.customNotes,
    }));

    const newOrder: Order = {
      id: `ord_${Math.floor(1000 + Math.random() * 9000)}`,
      tableId,
      items: orderItems,
      ...pricing,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
      paymentStatus: 'Pending',
    };

    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .insert({
          id: newOrder.id,
          table_id: tableId,
          customer_phone: phone || null,
          items: orderItems,
          subtotal: pricing.subtotal,
          gst: pricing.gst,
          discount: pricing.discount,
          tip: pricing.tip,
          total: pricing.total,
          status: newOrder.status,
          payment_status: newOrder.paymentStatus,
        })
        .select()
        .single();
      if (!error && data) {
        if (phone) {
          const rules = await db.getLoyaltyRules();
          await db.addLoyaltyPoints(phone, Math.floor((pricing.total / 100) * rules.pointsPerHundred));
        }
        return data as unknown as Order;
      }
      console.error('Supabase error placing order, using mock:', error);
    }

    const orders = getMockData<Order[]>('orders', []);
    orders.push(newOrder);
    saveMockData('orders', orders);

    if (phone) {
      const rules = await db.getLoyaltyRules();
      await db.addLoyaltyPoints(phone, Math.floor((pricing.total / 100) * rules.pointsPerHundred));
    }
    return newOrder;
  },

  getOrder: async (orderId: string): Promise<Order | null> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (!error && data) return data as unknown as Order;
    }
    const orders = getMockData<Order[]>('orders', []);
    return orders.find(o => o.id === orderId) || null;
  },

  getOrderHistory: async (phone: string): Promise<Order[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false });
      if (!error && data) return data as unknown as Order[];
    }
    const orders = getMockData<Order[]>('orders', []);
    return orders
      .filter(o => o.items.length > 0 && (phone ? true : false))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getAllOrders: async (): Promise<Order[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as unknown as Order[];
    }
    const orders = getMockData<Order[]>('orders', []);
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  updateOrderStatus: async (orderId: string, status: Order['status']): Promise<Order | null> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();
      if (!error && data) return data as unknown as Order;
    }
    const orders = getMockData<Order[]>('orders', []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = status;
      saveMockData('orders', orders);
      return orders[idx];
    }
    return null;
  },

  payOrder: async (orderId: string, method: string): Promise<Order | null> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .update({ payment_status: 'Paid', payment_method: method })
        .eq('id', orderId)
        .select()
        .single();
      if (!error && data) return data as unknown as Order;
    }
    const orders = getMockData<Order[]>('orders', []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].paymentStatus = 'Paid';
      orders[idx].paymentMethod = method;
      saveMockData('orders', orders);
      return orders[idx];
    }
    return null;
  },

  // 4. WAITER REQUESTS
  requestWaiter: async (tableId: string, type: WaiterRequest['requestType']): Promise<WaiterRequest> => {
    const request: WaiterRequest = {
      id: `req_${Math.floor(1000 + Math.random() * 9000)}`,
      tableId,
      requestType: type,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('waiter_requests')
        .insert({
          id: request.id,
          table_id: tableId,
          request_type: type,
          status: 'Pending',
        })
        .select()
        .single();
      if (!error && data) return data as WaiterRequest;
    }

    const requests = getMockData<WaiterRequest[]>('waiter_requests', []);
    requests.push(request);
    saveMockData('waiter_requests', requests);
    return request;
  },

  getWaiterRequests: async (): Promise<WaiterRequest[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('waiter_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as WaiterRequest[];
    }
    return getMockData<WaiterRequest[]>('waiter_requests', []);
  },

  updateWaiterRequestStatus: async (id: string, status: WaiterRequest['status']): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('waiter_requests')
        .update({ status })
        .eq('id', id);
      if (!error) return true;
    }
    const requests = getMockData<WaiterRequest[]>('waiter_requests', []);
    const idx = requests.findIndex(r => r.id === id);
    if (idx !== -1) {
      requests[idx].status = status;
      saveMockData('waiter_requests', requests);
      return true;
    }
    return false;
  },

  // 5. INVENTORY
  getInventory: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('inventory')
        .select('*')
        .order('name');
      if (!error && data) return data;
    }
    return getMockData<any[]>('inventory', []);
  },

  saveInventoryItem: async (item: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('inventory')
        .upsert(item)
        .select()
        .single();
      if (!error && data) return data;
    }
    const inv = getMockData<any[]>('inventory', []);
    const idx = inv.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      inv[idx] = item;
    } else {
      inv.push(item);
    }
    saveMockData('inventory', inv);
    return item;
  },

  deleteInventoryItem: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('inventory')
        .delete()
        .eq('id', id);
      if (!error) return true;
    }
    const inv = getMockData<any[]>('inventory', []);
    const updated = inv.filter(i => i.id !== id);
    saveMockData('inventory', updated);
    return true;
  },

  // 6. STAFF
  getStaff: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('staff')
        .select('*')
        .order('name');
      if (!error && data) return data;
    }
    return getMockData<any[]>('staff', []);
  },

  saveStaffMember: async (member: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('staff')
        .upsert(member)
        .select()
        .single();
      if (!error && data) return data;
    }
    const staff = getMockData<any[]>('staff', []);
    const idx = staff.findIndex(s => s.id === member.id);
    if (idx !== -1) {
      staff[idx] = member;
    } else {
      staff.push(member);
    }
    saveMockData('staff', staff);
    return member;
  },

  deleteStaffMember: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('staff')
        .delete()
        .eq('id', id);
      if (!error) return true;
    }
    const staff = getMockData<any[]>('staff', []);
    const updated = staff.filter(s => s.id !== id);
    saveMockData('staff', updated);
    return true;
  },

  // 7. TABLES
  getTables: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('tables')
        .select('*')
        .order('id');
      if (!error && data) return data;
    }
    return getMockData<any[]>('tables', []);
  },

  getTable: async (id: number): Promise<any | null> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('tables')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) return data;
    }
    const tables = getMockData<any[]>('tables', []);
    return tables.find(t => t.id === id) || null;
  },

  saveTable: async (table: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('tables')
        .upsert(table)
        .select()
        .single();
      if (!error && data) return data;
    }
    const tables = getMockData<any[]>('tables', []);
    const idx = tables.findIndex(t => t.id === table.id);
    if (idx !== -1) {
      tables[idx] = table;
    } else {
      tables.push(table);
    }
    saveMockData('tables', tables);
    return table;
  },

  deleteTable: async (id: number): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('tables')
        .delete()
        .eq('id', id);
      if (!error) return true;
    }
    const tables = getMockData<any[]>('tables', []);
    const updated = tables.filter(t => t.id !== id);
    saveMockData('tables', updated);
    return true;
  },

  // 8. PROMOTIONS / COUPONS
  getPromotions: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('promotions')
        .select('*')
        .order('code');
      if (!error && data) return data;
    }
    return getMockData<any[]>('coupons', []);
  },

  savePromotion: async (promo: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('promotions')
        .upsert(promo)
        .select()
        .single();
      if (!error && data) return data;
    }
    const coupons = getMockData<any[]>('coupons', []);
    const idx = coupons.findIndex(c => c.id === promo.id);
    if (idx !== -1) {
      coupons[idx] = promo;
    } else {
      coupons.push(promo);
    }
    saveMockData('coupons', coupons);
    return promo;
  },

  deletePromotion: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('promotions')
        .delete()
        .eq('id', id);
      if (!error) return true;
    }
    const coupons = getMockData<any[]>('coupons', []);
    const updated = coupons.filter(c => c.id !== id);
    saveMockData('coupons', updated);
    return true;
  },

  // 9. REVIEWS & SENTIMENT FEEDBACK
  getReviews: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('reviews')
        .select('*')
        .order('date', { ascending: false });
      if (!error && data) return data;
    }
    return getMockData<any[]>('reviews', []);
  },

  saveReview: async (review: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('reviews')
        .upsert(review)
        .select()
        .single();
      if (!error && data) return data;
    }
    const reviewsList = getMockData<any[]>('reviews', []);
    const idx = reviewsList.findIndex(r => r.id === review.id);
    if (idx !== -1) {
      reviewsList[idx] = review;
    } else {
      reviewsList.push(review);
    }
    saveMockData('reviews', reviewsList);
    return review;
  },

  // 10. ACTIVITY LOGS
  getActivityLogs: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false });
      if (!error && data) return data;
    }
    return getMockData<any[]>('activity_log', []);
  },

  saveActivityLog: async (log: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('activity_logs')
        .upsert(log)
        .select()
        .single();
      if (!error && data) return data;
    }
    const logs = getMockData<any[]>('activity_log', []);
    logs.unshift(log);
    saveMockData('activity_log', logs);
    return log;
  },

  // 11. FEEDBACK RATINGS
  submitFeedback: async (
    orderId: string,
    ratings: { food: number; service: number; ambience: number },
    comments: string
  ): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient.from('feedback').insert({
        order_id: orderId,
        food_rating: ratings.food,
        service_rating: ratings.service,
        ambience_rating: ratings.ambience,
        comments,
      });
      if (error) {
        console.error('Supabase error submitting feedback:', error);
        return false;
      }
    }
    
    // Also save in reviews collection as customer review
    const ordersList = getMockData<Order[]>('orders', []);
    const orderObj = ordersList.find(o => o.id === orderId);
    
    const newReview = {
      id: `rev_${Date.now()}`,
      order_id: orderId,
      customer_name: orderObj ? `Guest (Table ${orderObj.tableId})` : 'Guest Customer',
      rating: ratings.food,
      comment: comments,
      date: new Date().toISOString().split('T')[0],
      reply: null
    };
    
    await db.saveReview(newReview);
    return true;
  },

  // 12. LOYALTY POINTS
  addLoyaltyPoints: async (phone: string, pointsEarned: number): Promise<void> => {
    const profile = await db.getCustomerProfile(phone);
    if (profile) {
      profile.points += pointsEarned;
      const pts = profile.points;
      const rules = await db.getLoyaltyRules();
      
      if (pts >= rules.goldTierPoints) profile.tier = 'Gold';
      else if (pts >= rules.silverTierPoints) profile.tier = 'Silver';
      else profile.tier = 'Bronze';

      await db.saveCustomerProfile(profile);
    }
  },

  getLoyaltyRules: async (): Promise<any> => {
    return getMockData<any>('loyaltyConfig', {
      pointsPerHundred: 10,
      silverTierPoints: 500,
      goldTierPoints: 1000,
      goldDiscountPercent: 10
    });
  },

  saveLoyaltyRules: async (rules: any): Promise<void> => {
    saveMockData('loyaltyConfig', rules);
  }
};
