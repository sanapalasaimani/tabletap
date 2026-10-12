import { createClient } from '@supabase/supabase-js';
import { MenuItem, CartItem, Order, UserProfile, WaiterRequest } from './types';
import { MENU_ITEMS } from './data/menu';
import { analyzeReviewSentiment } from './utils/nlpSentiment';

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

// Mapping helpers between Supabase snake_case columns and TypeScript MenuItem
const mapSupabaseToMenuItem = (row: any): MenuItem => ({
  id: String(row.id),
  name: row.name || 'Unnamed Dish',
  price: Number(row.price || 0),
  category: row.category || 'Main Course',
  subcategory: row.subcategory || undefined,
  image: row.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
  rating: Number(row.rating || 4.5),
  reviewsCount: Number(row.reviews_count ?? row.reviewsCount ?? 50),
  isVeg: row.is_veg !== undefined ? Boolean(row.is_veg) : Boolean(row.isVeg),
  spicyLevel: row.spicy_level !== undefined ? (row.spicy_level as 0 | 1 | 2 | 3) : ((row.spicyLevel ?? 1) as 0 | 1 | 2 | 3),
  isSpecial: row.is_special !== undefined ? Boolean(row.is_special) : Boolean(row.isSpecial),
  calories: Number(row.calories || 300),
  prepTime: row.prep_time || row.prepTime || '15 mins',
  description: row.description || '',
});

const mapMenuItemToSupabase = (item: MenuItem): any => ({
  id: String(item.id),
  name: item.name,
  price: Number(item.price),
  category: item.category,
  image: item.image,
  rating: Number(item.rating || 4.5),
  reviews_count: Number(item.reviewsCount || 50),
  is_veg: Boolean(item.isVeg),
  spicy_level: Number(item.spicyLevel || 1),
  is_special: Boolean(item.isSpecial),
  calories: Number(item.calories || 300),
  prep_time: item.prepTime || '15 mins',
  description: item.description || '',
  available: true,
});

export const mapSupabaseToOrder = (row: any): Order => ({
  id: String(row.id || ''),
  tableId: String(row.table_id || row.tableId || '05'),
  items: Array.isArray(row.items) ? row.items : [],
  subtotal: Number(row.subtotal || 0),
  gst: Number(row.gst || 0),
  discount: Number(row.discount || 0),
  tip: Number(row.tip || 0),
  total: Number(row.total || 0),
  status: row.status || 'Confirmed',
  createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  paymentStatus: row.payment_status || row.paymentStatus || 'Pending',
  paymentMethod: row.payment_method || row.paymentMethod,
  feedbackSubmitted: Boolean(row.feedback_submitted || row.feedbackSubmitted)
});

export const mapSupabaseToWaiterRequest = (row: any): WaiterRequest => ({
  id: String(row.id || ''),
  tableId: String(row.table_id || row.tableId || '05'),
  requestType: row.request_type || row.requestType || 'Assistance',
  status: row.status || 'Pending',
  createdAt: row.created_at || row.createdAt || new Date().toISOString()
});

// EXPORTED SERVICES
export const db = {
  isSupabase: () => isRealSupabase,

  // 1. MENU ITEMS
  getMenuItems: async (): Promise<MenuItem[]> => {
    let items: MenuItem[] = [];
    if (isRealSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from('menu_items')
          .select('*')
          .order('id')
          .limit(1000);

        if (!error && data && data.length > 0) {
          items = data.map(mapSupabaseToMenuItem);

          // If Supabase somehow has less than 40 dishes, automatically seed the 40 curated dishes
          if (items.length < 40 && MENU_ITEMS.length >= 40) {
            console.log(`DineSmart: Supabase returned ${items.length} items. Syncing full ${MENU_ITEMS.length} dishes...`);
            const payload = MENU_ITEMS.map(mapMenuItemToSupabase);
            await supabaseClient.from('menu_items').upsert(payload);
            items = MENU_ITEMS;
          }
          saveMockData('menu', items);
        } else {
          items = getMockData<MenuItem[]>('menu', MENU_ITEMS);
          if (items.length < 40) items = MENU_ITEMS;
          saveMockData('menu', items);
        }
      } catch (err) {
        console.warn('DineSmart: Error retrieving menu from Supabase, fallback to cache:', err);
        items = getMockData<MenuItem[]>('menu', MENU_ITEMS);
        if (items.length < 40) items = MENU_ITEMS;
      }
    } else {
      items = getMockData<MenuItem[]>('menu', []);
      if (items.length < 40) {
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
      try {
        const payload = mapMenuItemToSupabase(item);
        const { data, error } = await supabaseClient
          .from('menu_items')
          .upsert(payload)
          .select()
          .single();
        if (!error && data) {
          const saved = mapSupabaseToMenuItem(data);
          const menu = getMockData<MenuItem[]>('menu', []);
          const idx = menu.findIndex(m => m.id === saved.id);
          if (idx !== -1) menu[idx] = saved; else menu.push(saved);
          saveMockData('menu', menu);
          return saved;
        }
        if (error) console.error('Supabase error saving menu item:', error);
      } catch (err) {
        console.error('Exception saving menu item to Supabase:', err);
      }
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

  syncAllMenuToSupabase: async (): Promise<number> => {
    if (isRealSupabase) {
      const payload = MENU_ITEMS.map(mapMenuItemToSupabase);
      const { error } = await supabaseClient
        .from('menu_items')
        .upsert(payload);
      if (error) {
        console.error('Error syncing all dishes to Supabase:', error);
        throw error;
      }
    }
    saveMockData('menu', MENU_ITEMS);
    return MENU_ITEMS.length;
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
        const mapped = mapSupabaseToOrder(data);
        const orders = getMockData<Order[]>('orders', []);
        orders.unshift(mapped);
        saveMockData('orders', orders);

        if (phone) {
          const rules = await db.getLoyaltyRules();
          await db.addLoyaltyPoints(phone, Math.floor((pricing.total / 100) * rules.pointsPerHundred));
        }
        return mapped;
      }
      console.error('Supabase error placing order, using mock:', error);
    }

    const orders = getMockData<Order[]>('orders', []);
    orders.unshift(newOrder);
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
      if (!error && data) return mapSupabaseToOrder(data);
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
      if (!error && data) return data.map(mapSupabaseToOrder);
    }
    const orders = getMockData<Order[]>('orders', []);
    return orders
      .filter(o => o.items.length > 0 && (phone ? true : false))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getAllOrders: async (): Promise<Order[]> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          const mapped = data.map(mapSupabaseToOrder);
          saveMockData('orders', mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getAllOrders failed, fallback to cache:', err);
      }
    }
    const orders = getMockData<Order[]>('orders', []);
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  updateOrderStatus: async (orderId: string, status: Order['status']): Promise<Order | null> => {
    let result: Order | null = null;
    if (isRealSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .update({ status })
          .eq('id', orderId)
          .select()
          .single();
        if (!error && data) {
          result = mapSupabaseToOrder(data);
        }
      } catch (err) {
        console.warn('Supabase updateOrderStatus failed:', err);
      }
    }
    const orders = getMockData<Order[]>('orders', []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = status;
      if (!result) result = orders[idx];
      saveMockData('orders', orders);
    } else if (result) {
      orders.unshift(result);
      saveMockData('orders', orders);
    }
    return result;
  },

  payOrder: async (orderId: string, method: string): Promise<Order | null> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('orders')
        .update({ payment_status: 'Paid', payment_method: method })
        .eq('id', orderId)
        .select()
        .single();
      if (!error && data) return mapSupabaseToOrder(data);
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

  clearAllOrders: async (): Promise<boolean> => {
    if (isRealSupabase) {
      try {
        await supabaseClient.from('orders').delete().neq('id', 'placeholder_id');
      } catch (e) {
        console.warn('Supabase clearAllOrders error:', e);
      }
    }
    saveMockData('orders', []);
    localStorage.removeItem('dinesmart_virtual_statuses');
    localStorage.removeItem('dinesmart_active_order');
    localStorage.removeItem('dinesmart_active_cart');
    return true;
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
      try {
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
        if (!error && data) {
          const mapped = mapSupabaseToWaiterRequest(data);
          const reqs = getMockData<WaiterRequest[]>('waiter_requests', []);
          reqs.unshift(mapped);
          saveMockData('waiter_requests', reqs);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase requestWaiter failed, using fallback:', err);
      }
    }

    const requests = getMockData<WaiterRequest[]>('waiter_requests', []);
    requests.unshift(request);
    saveMockData('waiter_requests', requests);
    return request;
  },

  getWaiterRequests: async (): Promise<WaiterRequest[]> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from('waiter_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          const mapped = data.map(mapSupabaseToWaiterRequest);
          saveMockData('waiter_requests', mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getWaiterRequests failed:', err);
      }
    }
    return getMockData<WaiterRequest[]>('waiter_requests', []);
  },

  updateWaiterRequestStatus: async (id: string, status: WaiterRequest['status']): Promise<boolean> => {
    if (isRealSupabase) {
      try {
        const { error } = await supabaseClient
          .from('waiter_requests')
          .update({ status })
          .eq('id', id);
        if (!error) {
          const requests = getMockData<WaiterRequest[]>('waiter_requests', []);
          const idx = requests.findIndex(r => r.id === id);
          if (idx !== -1) {
            requests[idx].status = status;
            saveMockData('waiter_requests', requests);
          }
          return true;
        }
      } catch (err) {
        console.warn('Supabase updateWaiterRequestStatus failed:', err);
      }
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
    // Instant local-first retrieval (0ms)
    const localTables = getMockData<any[]>('tables', []);
    if (isRealSupabase) {
      try {
        const { data, error } = await Promise.race([
          supabaseClient.from('tables').select('*').order('id'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]) as any;
        if (!error && data && data.length > 0) {
          saveMockData('tables', data);
          return data;
        }
      } catch (err) {
        // Fallback
      }
    }
    return localTables;
  },

  getTable: async (id: number): Promise<any | null> => {
    const tableNum = Number(id);
    const tables = getMockData<any[]>('tables', []);
    const local = tables.find(t => Number(t.id) === tableNum);
    if (isRealSupabase) {
      try {
        const { data, error } = await Promise.race([
          supabaseClient.from('tables').select('*').eq('id', tableNum).single(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]) as any;
        if (!error && data) {
          const idx = tables.findIndex(t => Number(t.id) === tableNum);
          if (idx !== -1) tables[idx] = data;
          else tables.push(data);
          saveMockData('tables', tables);
          return data;
        }
      } catch (err) {
        // Fallback
      }
    }
    if (local) return local;

    // Auto-create table entry if it didn't exist so user is never locked out
    const fallbackTable = {
      id: tableNum,
      name: `Table ${tableNum}`,
      status: 'Available',
      capacity: 4,
      qr_token: `qr_table_${tableNum}_session`
    };
    tables.push(fallbackTable);
    saveMockData('tables', tables);
    return fallbackTable;
  },

  saveTable: async (table: any): Promise<any> => {
    // ⚡ INSTANT LOCAL SAVE (0ms)
    const tables = getMockData<any[]>('tables', []);
    const idx = tables.findIndex(t => t.id === table.id);
    if (idx !== -1) {
      tables[idx] = table;
    } else {
      tables.push(table);
    }
    saveMockData('tables', tables);

    // Non-blocking background sync to Supabase
    if (isRealSupabase) {
      Promise.race([
        supabaseClient.from('tables').upsert(table),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]).catch(() => {});
    }
    return table;
  },

  saveTables: async (newTables: any[]): Promise<any[]> => {
    // ⚡ INSTANT BATCH LOCAL SAVE (0ms)
    saveMockData('tables', newTables);

    // Non-blocking background batch sync to Supabase
    if (isRealSupabase) {
      Promise.race([
        supabaseClient.from('tables').upsert(newTables),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]).catch(() => {});
    }
    return newTables;
  },

  deleteTable: async (id: number): Promise<boolean> => {
    // ⚡ INSTANT LOCAL DELETE (0ms)
    const tables = getMockData<any[]>('tables', []);
    const updated = tables.filter(t => t.id !== id);
    saveMockData('tables', updated);

    // Non-blocking background delete from Supabase
    if (isRealSupabase) {
      Promise.race([
        supabaseClient.from('tables').delete().eq('id', id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]).catch(() => {});
    }
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
    
    // Run real-time NLP Sentiment & Aspect Analysis on customer review
    const nlp = analyzeReviewSentiment(comments, ratings.food);
    const ordersList = getMockData<Order[]>('orders', []);
    const orderObj = ordersList.find(o => o.id === orderId);
    
    const newReview = {
      id: `rev_${Date.now()}`,
      order_id: orderId,
      customer_name: orderObj ? `Guest (Table ${orderObj.tableId})` : 'Guest Customer',
      table_id: orderObj?.tableId || '05',
      rating: ratings.food,
      service_rating: ratings.service,
      ambience_rating: ratings.ambience,
      comment: comments,
      sentiment: nlp.sentiment,
      sentiment_score: nlp.score,
      emoji: nlp.emoji,
      key_phrases: nlp.keyPhrases,
      kitchen_alert: nlp.kitchenAlert,
      kitchen_alert_reason: nlp.kitchenAlertReason,
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
  },

  // 13. PENDING STAFF (WAITER ONBOARDING)
  getPendingStaff: async (): Promise<any[]> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('pending_staff')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return getMockData<any[]>('pending_staff', []);
  },

  updatePendingStaff: async (staff: any): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('pending_staff')
        .upsert(staff)
        .select()
        .single();
      if (!error && data) return data;
    }
    const staffList = getMockData<any[]>('pending_staff', []);
    const idx = staffList.findIndex(s => s.id === staff.id);
    if (idx !== -1) {
      staffList[idx] = staff;
    } else {
      staffList.push(staff);
    }
    saveMockData('pending_staff', staffList);
    return staff;
  },

  deletePendingStaff: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('pending_staff')
        .delete()
        .eq('id', id);
      if (!error) return true;
    }
    const staffList = getMockData<any[]>('pending_staff', []);
    const updated = staffList.filter(s => s.id !== id);
    saveMockData('pending_staff', updated);
    return true;
  },

  // 14. HOTEL SETTINGS
  getSettings: async (): Promise<any> => {
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('hotel_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (!error && data) return data;
    }
    return getMockData<any>('hotel_settings', { 
      tax: 5, 
      currency: '₹', 
      gstNo: '27AAAAA1111A1Z1',
      restaurantName: 'DineSmart Hotel & Resto',
      ownerName: '',
      branchName: '',
      email: '',
      mobile: '',
      alternateMobile: '',
      fssai: '',
      address: '',
      city: '',
      state: '',
      country: '',
      pinCode: '',
      landmark: '',
      mapsLocation: ''
    });
  },

  saveSettings: async (settings: any): Promise<any> => {
    const defaultSettings = { ...settings, id: 'default' };
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('hotel_settings')
        .upsert(defaultSettings)
        .select()
        .single();
      if (!error && data) return data;
      console.error('Supabase error saving settings:', error);
    }
    saveMockData('hotel_settings', defaultSettings);
    return defaultSettings;
  }
};
