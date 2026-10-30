import { createClient } from '@supabase/supabase-js';
import { MenuItem, CartItem, Order, UserProfile, WaiterRequest } from './types';
import { MENU_ITEMS } from './data/menu';
import { analyzeReviewSentiment } from './utils/nlpSentiment';
import { spoonacularService } from './services/spoonacularService';

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
const mapSupabaseToMenuItem = (row: any): MenuItem => {
  const dishId = String(row.id);
  const dishName = row.name || 'Unnamed Dish';
  return {
    id: dishId,
    name: dishName,
    price: Number(row.price || 0),
    category: row.category || 'Main Course',
    subcategory: row.subcategory || undefined,
    image: row.image || spoonacularService.getDishImage(dishId, dishName, row.image),
    rating: Number(row.rating || 4.7),
    reviewsCount: Number(row.reviews_count ?? row.reviewsCount ?? 65),
    isVeg: row.is_veg !== undefined ? Boolean(row.is_veg) : Boolean(row.isVeg),
    spicyLevel: row.spicy_level !== undefined ? (row.spicy_level as 0 | 1 | 2 | 3) : ((row.spicyLevel ?? 1) as 0 | 1 | 2 | 3),
    isSpecial: row.is_special !== undefined ? Boolean(row.is_special) : Boolean(row.isSpecial),
    calories: Number(row.calories || 250),
    caloriesApprox: row.calories_approx || row.caloriesApprox,
    prepTime: row.prep_time || row.prepTime || '15 mins',
    description: row.description || '',
    dietaryTags: row.dietary_tags || row.dietaryTags,
    allergens: row.allergens,
    customizationOptions: row.customization_options || row.customizationOptions,
  };
};

const mapMenuItemToSupabase = (item: MenuItem): any => ({
  id: String(item.id),
  name: item.name,
  price: Number(item.price),
  category: item.category,
  image: item.image,
  rating: Number(item.rating || 4.7),
  reviews_count: Number(item.reviewsCount || 65),
  is_veg: Boolean(item.isVeg),
  spicy_level: Number(item.spicyLevel ?? 1),
  is_special: Boolean(item.isSpecial),
  calories: Number(item.calories || 250),
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
          saveMockData('menu', items);
        } else {
          items = getMockData<MenuItem[]>('menu', MENU_ITEMS);
          if (items.length === 0) items = MENU_ITEMS;
          saveMockData('menu', items);
        }
      } catch (err) {
        console.warn('DineSmart: Error retrieving menu from Supabase, fallback to cache:', err);
        items = getMockData<MenuItem[]>('menu', MENU_ITEMS);
        if (items.length === 0) items = MENU_ITEMS;
      }
    } else {
      items = getMockData<MenuItem[]>('menu', MENU_ITEMS);
      if (items.length === 0) items = MENU_ITEMS;
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
    let result = item;
    if (isRealSupabase) {
      try {
        const payload = mapMenuItemToSupabase(item);
        const { data, error } = await supabaseClient
          .from('menu_items')
          .upsert(payload)
          .select()
          .single();
        if (!error && data) {
          result = mapSupabaseToMenuItem(data);
        } else if (error) {
          console.error('Supabase error saving menu item:', error);
        }
      } catch (err) {
        console.error('Exception saving menu item to Supabase:', err);
      }
    }
    const menu = getMockData<MenuItem[]>('menu', MENU_ITEMS);
    const idx = menu.findIndex(m => m.id === result.id);
    if (idx !== -1) {
      menu[idx] = result;
    } else {
      menu.push(result);
    }
    saveMockData('menu', menu);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dinesmart_menu_updated', { detail: result }));
    }
    return result;
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dinesmart_menu_updated'));
    }
    return MENU_ITEMS.length;
  },

  deleteMenuItem: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      const { error } = await supabaseClient
        .from('menu_items')
        .delete()
        .eq('id', id);
      if (error) console.error('Supabase error deleting menu item:', error);
    }
    const menu = getMockData<MenuItem[]>('menu', MENU_ITEMS);
    const updated = menu.filter(m => m.id !== id);
    saveMockData('menu', updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dinesmart_menu_updated', { detail: { id } }));
    }
    return true;
  },

  deleteAllMenuItems: async (): Promise<boolean> => {
    if (isRealSupabase) {
      try {
        const { data } = await supabaseClient.from('menu_items').select('id');
        if (data && data.length > 0) {
          const ids = data.map((d: any) => d.id);
          await supabaseClient.from('menu_items').delete().in('id', ids);
        }
      } catch (err) {
        console.error('Error deleting all items from Supabase:', err);
      }
    }
    saveMockData('menu', []);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dinesmart_menu_updated'));
    }
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
    let localStaff = getMockData<any[]>('staff', []);
    if (isRealSupabase) {
      try {
        const { data, error } = await Promise.race([
          supabaseClient
            .from('staff')
            .select('*')
            .order('name'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]) as any;
        if (!error && data && data.length > 0) {
          const enriched = data.map((emp: any) => ({
            ...emp,
            photo: emp.photo || emp.performance?.photo || '',
            email: emp.email || emp.performance?.email || '',
            assignedTables: emp.assignedTables || emp.performance?.assignedTables || []
          }));
          saveMockData('staff', enriched);
          return enriched;
        }
      } catch (err) {
        console.warn('getStaff fallback to local storage:', err);
      }
    }
    return localStaff;
  },

  saveStaffMember: async (member: any): Promise<any> => {
    const perf = {
      ...(member.performance || { score: 90, ordersDelivered: 0, avgServingTime: 'N/A', ratings: 5.0, tips: 0 }),
      photo: member.photo || member.performance?.photo || '',
      email: member.email || member.performance?.email || '',
      assignedTables: member.assignedTables || member.performance?.assignedTables || []
    };

    const dbPayload: any = {
      id: member.id,
      name: member.name,
      mobile: member.mobile || '',
      role: member.role,
      shift: member.shift || 'Morning',
      salary: member.salary || 0,
      attendance: member.attendance || 100,
      empid: member.empid,
      password: member.password,
      performance: perf
    };

    // Instant local-first save
    const currentStaff = getMockData<any[]>('staff', []);
    const existingIdx = currentStaff.findIndex(s => s.id === member.id || s.empid === member.empid);
    if (existingIdx !== -1) {
      currentStaff[existingIdx] = { ...currentStaff[existingIdx], ...dbPayload, ...member, performance: perf };
    } else {
      currentStaff.push({ ...dbPayload, ...member, performance: perf });
    }
    saveMockData('staff', currentStaff);

    // Sync to active waiter session in localStorage if matching
    try {
      const activeWaiterStr = localStorage.getItem('tabletap_waiter_staff');
      if (activeWaiterStr) {
        const activeWaiter = JSON.parse(activeWaiterStr);
        if (activeWaiter.empid === member.empid || activeWaiter.empid === member.id || activeWaiter.id === member.id) {
          const updatedActive = {
            ...activeWaiter,
            name: member.name,
            empid: member.empid,
            mobile: member.mobile || '',
            role: member.role || 'Waiter',
            assignedTables: member.assignedTables || [],
            photo: member.photo || ''
          };
          localStorage.setItem('tabletap_waiter_staff', JSON.stringify(updatedActive));
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('staff_updated', { detail: member }));
      }
    } catch (e) {
      /* ignore */
    }

    if (isRealSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from('staff')
          .upsert(dbPayload)
          .select()
          .single();
        if (!error && data) {
          const enriched = {
            ...data,
            photo: data.photo || data.performance?.photo || member.photo || '',
            email: data.email || data.performance?.email || member.email || '',
            assignedTables: data.assignedTables || data.performance?.assignedTables || member.assignedTables || []
          };
          const staff = getMockData<any[]>('staff', []);
          const idx = staff.findIndex(s => s.id === member.id || s.empid === member.empid);
          if (idx !== -1) staff[idx] = enriched; else staff.push(enriched);
          saveMockData('staff', staff);
          return enriched;
        }
      } catch (err) {
        console.warn('Supabase upsert staff error:', err);
      }
    }
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
    return null;
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

  // STRICT TABLE SESSION LOCKING SYSTEM (PREVENTS QR OVERFLOW)
  claimTableSession: async (tableId: number, deviceId: string, phone?: string, name?: string): Promise<{
    status: 'success' | 'locked' | 'invalid';
    table?: any;
    sessionId?: string;
    message?: string;
    activeSession?: any;
  }> => {
    const table = await db.getTable(tableId);
    if (!table) return { status: 'invalid', message: 'Table not found in restaurant directory.' };

    let sessionData: any = null;
    if (table.customer_name) {
      try {
        sessionData = typeof table.customer_name === 'string' && table.customer_name.startsWith('{')
          ? JSON.parse(table.customer_name)
          : { name: table.customer_name, deviceId: '', startedAt: Date.now() };
      } catch {
        sessionData = { name: table.customer_name, deviceId: '', startedAt: Date.now() };
      }
    }

    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const isExpired = sessionData?.lastActivityAt && (now - Number(sessionData.lastActivityAt) > TWO_HOURS_MS);

    // If table is occupied, not expired, and device does not match
    if (table.status === 'Occupied' && !isExpired && sessionData?.deviceId && sessionData.deviceId !== deviceId) {
      // Check if phone matches (allow same party/phone to re-join session)
      if (phone && sessionData.phone && sessionData.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) {
        sessionData.deviceId = deviceId;
        sessionData.lastActivityAt = now;
        const updatedTable = { ...table, customer_name: JSON.stringify(sessionData) };
        await db.saveTable(updatedTable);
        return { status: 'success', table: updatedTable, sessionId: sessionData.sessionId };
      }

      return {
        status: 'locked',
        table,
        activeSession: sessionData,
        message: `Table #${tableId} is currently occupied by an active dining party.`
      };
    }

    // Table is available or expired or belongs to current device: claim it!
    const newSessionId = (table.status === 'Occupied' && !isExpired && sessionData?.sessionId) 
      ? sessionData.sessionId 
      : `sess_${tableId}_${now}`;

    const newSession = {
      sessionId: newSessionId,
      deviceId,
      phone: phone || sessionData?.phone || '',
      name: name || sessionData?.name || 'Diner',
      startedAt: (table.status === 'Occupied' && !isExpired && sessionData?.startedAt) ? sessionData.startedAt : now,
      lastActivityAt: now
    };

    const updatedTable = {
      ...table,
      status: 'Occupied',
      customer_name: JSON.stringify(newSession)
    };

    await db.saveTable(updatedTable);
    return { status: 'success', table: updatedTable, sessionId: newSessionId };
  },

  releaseTableSession: async (tableId: number): Promise<boolean> => {
    const table = await db.getTable(tableId);
    if (!table) return false;
    const updated = {
      ...table,
      status: 'Available',
      customer_name: null
    };
    await db.saveTable(updated);
    return true;
  },

  touchTableActivity: async (tableId: number, deviceId: string): Promise<void> => {
    const table = await db.getTable(tableId);
    if (!table || !table.customer_name) return;
    try {
      if (typeof table.customer_name === 'string' && table.customer_name.startsWith('{')) {
        const session = JSON.parse(table.customer_name);
        if (session.deviceId === deviceId) {
          session.lastActivityAt = Date.now();
          await db.saveTable({ ...table, customer_name: JSON.stringify(session) });
        }
      }
    } catch {}
  },

  joinTableSession: async (tableId: number, deviceId: string, phone: string): Promise<boolean> => {
    const table = await db.getTable(tableId);
    if (!table || !table.customer_name) return false;
    try {
      if (typeof table.customer_name === 'string' && table.customer_name.startsWith('{')) {
        const session = JSON.parse(table.customer_name);
        const cleanEntered = phone.replace(/\D/g, '');
        const cleanSaved = (session.phone || '').replace(/\D/g, '');
        if (cleanSaved && cleanSaved === cleanEntered) {
          session.deviceId = deviceId;
          session.lastActivityAt = Date.now();
          await db.saveTable({ ...table, customer_name: JSON.stringify(session) });
          return true;
        }
      }
    } catch {}
    return false;
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
    // ⚡ Instant local-first save
    const coupons = getMockData<any[]>('coupons', []);
    const cleanCode = String(promo.code).toUpperCase().trim();
    const formattedPromo = {
      ...promo,
      code: cleanCode,
      min_bill: Number(promo.min_bill ?? promo.minBill ?? 0),
      discount: Number(promo.discount || 0),
      active: promo.active !== undefined ? Boolean(promo.active) : true
    };

    const idx = coupons.findIndex(c => c.id === promo.id || c.code === cleanCode);
    if (idx !== -1) {
      coupons[idx] = formattedPromo;
    } else {
      coupons.push(formattedPromo);
    }
    saveMockData('coupons', coupons);

    // Sync to Supabase
    if (isRealSupabase) {
      try {
        const dbPayload = {
          id: String(formattedPromo.id),
          code: cleanCode,
          discount: formattedPromo.discount,
          type: formattedPromo.type || 'Fixed',
          min_bill: formattedPromo.min_bill,
          active: formattedPromo.active
        };
        await supabaseClient.from('promotions').upsert(dbPayload);
      } catch (err) {
        console.warn('Supabase promotion upsert error, saved locally:', err);
      }
    }
    return formattedPromo;
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
      if (!error && data) {
        saveMockData('reviews', data);
        return data;
      }
    }
    return getMockData<any[]>('reviews', []);
  },

  saveReview: async (review: any): Promise<any> => {
    // Sanitize payload to match exact schema columns in Supabase reviews table:
    // id, order_id, customer_name, rating, comment, date, reply
    const dbPayload = {
      id: String(review.id || `rev_${Date.now()}`),
      order_id: String(review.order_id || review.orderId || ''),
      customer_name: String(review.customer_name || review.customerName || 'Guest'),
      rating: Number(review.rating || 5),
      comment: review.comment || '',
      date: review.date || new Date().toISOString().split('T')[0],
      reply: review.reply || null
    };

    if (isRealSupabase) {
      try {
        await supabaseClient
          .from('reviews')
          .upsert(dbPayload);
      } catch (err) {
        console.warn('Supabase reviews upsert fallback to local:', err);
      }
    }

    const reviewsList = getMockData<any[]>('reviews', []);
    const idx = reviewsList.findIndex(r => r.id === review.id);
    if (idx !== -1) {
      reviewsList[idx] = review;
    } else {
      reviewsList.unshift(review);
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
      try {
        await supabaseClient.from('feedback').insert({
          order_id: orderId,
          food_rating: ratings.food,
          service_rating: ratings.service,
          ambience_rating: ratings.ambience,
          comments,
        });
      } catch (e) {
        console.warn('Supabase feedback insert warning:', e);
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

    // Mark feedback as submitted on the order in Supabase and local storage
    if (orderObj) {
      orderObj.feedbackSubmitted = true;
      saveMockData('orders', ordersList);
    }
    if (isRealSupabase) {
      supabaseClient.from('orders').update({ feedback_submitted: true }).eq('id', orderId).catch(() => {});
    }

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

  // 13. PENDING STAFF (WAITERS & STAFF ONBOARDING)
  getPendingStaff: async (): Promise<any[]> => {
    let list: any[] = [];
    if (isRealSupabase) {
      const { data, error } = await supabaseClient
        .from('pending_staff')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        list = data;
      }
    }
    if (!list || list.length === 0) {
      list = getMockData<any[]>('pending_staff', []);
    }

    const localMeta = getMockData<Record<string, any>>('pending_staff_meta', {});
    return list.map(item => {
      const meta = localMeta[item.id] || {};
      return {
        ...item,
        role: item.role || meta.role || 'Waiter',
        photo: item.photo || meta.photo || '',
        shift: item.shift || meta.shift || 'Morning',
        notes: item.notes || meta.notes || '',
        whatsapp: item.whatsapp || item.mobile
      };
    });
  },

  submitPendingStaff: async (staff: any): Promise<any> => {
    const isUuid = staff.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staff.id);
    const candidateId = isUuid ? staff.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'b' + Math.random().toString(36).substring(2, 11) + '-0000-0000-0000-000000000000');
    
    const candidate = {
      id: candidateId,
      name: staff.name ? staff.name.trim() : 'New Applicant',
      mobile: staff.mobile ? staff.mobile.trim() : '',
      whatsapp: (staff.whatsapp || staff.mobile || '').trim(),
      email: staff.email ? staff.email.trim() : '',
      role: staff.role || 'Waiter',
      photo: staff.photo || '',
      shift: staff.shift || 'Morning',
      notes: staff.notes || '',
      status: 'Pending',
      created_at: new Date().toISOString()
    };

    if (isRealSupabase) {
      let { data, error } = await supabaseClient
        .from('pending_staff')
        .insert([{
          id: candidate.id,
          name: candidate.name,
          mobile: candidate.mobile,
          whatsapp: candidate.whatsapp,
          email: candidate.email,
          role: candidate.role,
          photo: candidate.photo,
          status: 'Pending'
        }])
        .select()
        .single();

      if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('column')))) {
        const fallbackRes = await supabaseClient
          .from('pending_staff')
          .insert([{
            id: candidate.id,
            name: candidate.name,
            mobile: candidate.mobile,
            whatsapp: candidate.whatsapp,
            email: candidate.email,
            status: 'Pending'
          }])
          .select()
          .single();

        if (!fallbackRes.error) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (!error && data) {
        const localMeta = getMockData<Record<string, any>>('pending_staff_meta', {});
        localMeta[candidate.id] = {
          role: candidate.role,
          photo: candidate.photo,
          shift: candidate.shift,
          notes: candidate.notes
        };
        saveMockData('pending_staff_meta', localMeta);
        return { ...data, ...candidate };
      }
    }

    const staffList = getMockData<any[]>('pending_staff', []);
    staffList.unshift(candidate);
    saveMockData('pending_staff', staffList);

    const localMeta = getMockData<Record<string, any>>('pending_staff_meta', {});
    localMeta[candidate.id] = {
      role: candidate.role,
      photo: candidate.photo,
      shift: candidate.shift,
      notes: candidate.notes
    };
    saveMockData('pending_staff_meta', localMeta);
    return candidate;
  },

  updatePendingStaff: async (staff: any): Promise<any> => {
    const isUuid = staff.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staff.id);
    
    if (isRealSupabase && isUuid) {
      let { error } = await supabaseClient
        .from('pending_staff')
        .upsert({
          id: staff.id,
          name: staff.name,
          mobile: staff.mobile,
          whatsapp: staff.whatsapp || staff.mobile,
          email: staff.email,
          role: staff.role || 'Waiter',
          photo: staff.photo || '',
          status: staff.status || 'Pending'
        });

      if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('column')))) {
        await supabaseClient
          .from('pending_staff')
          .upsert({
            id: staff.id,
            name: staff.name,
            mobile: staff.mobile,
            whatsapp: staff.whatsapp || staff.mobile,
            email: staff.email,
            status: staff.status || 'Pending'
          });
      }
    }

    const localMeta = getMockData<Record<string, any>>('pending_staff_meta', {});
    localMeta[staff.id] = {
      role: staff.role || localMeta[staff.id]?.role || 'Waiter',
      photo: staff.photo !== undefined ? staff.photo : (localMeta[staff.id]?.photo || ''),
      shift: staff.shift || localMeta[staff.id]?.shift || 'Morning',
      notes: staff.notes || localMeta[staff.id]?.notes || ''
    };
    saveMockData('pending_staff_meta', localMeta);

    const staffList = getMockData<any[]>('pending_staff', []);
    const idx = staffList.findIndex(s => s.id === staff.id);
    const enriched = { ...staff, ...localMeta[staff.id] };
    if (idx !== -1) {
      staffList[idx] = enriched;
    } else {
      staffList.push(enriched);
    }
    saveMockData('pending_staff', staffList);
    return enriched;
  },

  deletePendingStaff: async (id: string): Promise<boolean> => {
    const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isRealSupabase && isUuid) {
      await supabaseClient
        .from('pending_staff')
        .delete()
        .eq('id', id);
    }
    const staffList = getMockData<any[]>('pending_staff', []);
    const updated = staffList.filter(s => s.id !== id);
    saveMockData('pending_staff', updated);

    const localMeta = getMockData<Record<string, any>>('pending_staff_meta', {});
    delete localMeta[id];
    saveMockData('pending_staff_meta', localMeta);
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
