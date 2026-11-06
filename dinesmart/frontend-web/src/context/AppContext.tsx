import React, { createContext, useContext, useState, useEffect } from 'react';
import { MenuItem, CartItem, Order, UserProfile, WaiterRequest } from '../types';
import { db } from '../supabase';

interface AppContextProps {
  tableId: string;
  setTableId: (id: string) => void;
  phone: string;
  customerName: string;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity: number, instructions: string[], notes: string) => void;
  updateCartQuantity: (menuItemId: string, instructionsKey: string, delta: number) => void;
  removeFromCart: (menuItemId: string, instructionsKey: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  placeOrder: (tip: number, discountCoupon?: string) => Promise<Order>;
  activeOrder: Order | null;
  setActiveOrder: (order: Order | null) => void;
  orderHistory: Order[];
  refreshOrderHistory: () => Promise<void>;
  callWaiter: (type: WaiterRequest['requestType']) => Promise<void>;
  loginCustomer: (phone: string, name: string) => Promise<UserProfile>;
  logoutCustomer: () => void;
  isLoggedIn: boolean;
  favorites: MenuItem[];
  toggleFavorite: (item: MenuItem) => void;
  isFavorite: (itemId: string) => boolean;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tableId, setTableId] = useState<string>('05'); // Default Table 5
  const [phone, setPhone] = useState<string>(() => localStorage.getItem('dinesmart_user_phone') || '');
  const [customerName, setCustomerName] = useState<string>(() => localStorage.getItem('dinesmart_user_name') || '');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('dinesmart_active_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => {
    const saved = localStorage.getItem('dinesmart_active_order');
    return saved ? JSON.parse(saved) : null;
  });
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('dinesmart_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('dinesmart_active_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('dinesmart_active_order', JSON.stringify(activeOrder));
  }, [activeOrder]);

  useEffect(() => {
    localStorage.setItem('dinesmart_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Load customer profile when phone is set
  useEffect(() => {
    const loadProfile = async () => {
      if (phone) {
        let prof = await db.getCustomerProfile(phone);
        if (!prof) {
          // Auto create basic bronze profile if not exists
          prof = await db.saveCustomerProfile({
            phone,
            name: customerName || 'Valued Customer',
            points: 150, // default starter reward points to encourage them
            tier: 'Bronze',
          });
        }
        setProfile(prof);
        localStorage.setItem('dinesmart_user_phone', phone);
        localStorage.setItem('dinesmart_user_name', prof.name);
        setCustomerName(prof.name);
      } else {
        setProfile(null);
        localStorage.removeItem('dinesmart_user_phone');
        localStorage.removeItem('dinesmart_user_name');
      }
    };
    loadProfile();
  }, [phone]);

  // Load order history
  useEffect(() => {
    if (phone) {
      refreshOrderHistory();
    }
  }, [phone]);

  // Live polling: synchronize active order status directly from Kitchen & Waiter actions
  useEffect(() => {
    if (!activeOrder || activeOrder.status === 'Delivered') return;

    const interval = setInterval(async () => {
      try {
        const liveOrder = await db.getOrder(activeOrder.id);
        if (liveOrder && liveOrder.status !== activeOrder.status) {
          setActiveOrder(liveOrder);
          refreshOrderHistory();
        }
      } catch (err) {
        console.warn('AppContext: Failed to poll order status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeOrder?.id, activeOrder?.status]);

  const loginCustomer = async (num: string, name: string) => {
    setCustomerName(name);
    setPhone(num);
    const prof = await db.saveCustomerProfile({
      phone: num,
      name: name,
      points: 150, // default starter reward points
      tier: 'Bronze',
    });
    setProfile(prof);
    return prof;
  };

  const logoutCustomer = () => {
    setPhone('');
    setCustomerName('');
    setProfile(null);
    setActiveOrder(null);
    setCart([]);
  };

  // Unique key helper for instructions + menuItemId
  const getInstructionsKey = (instructions: string[], notes: string) => {
    return [...instructions.sort(), notes].join('|');
  };

  const addToCart = (menuItem: MenuItem, quantity: number, instructions: string[], notes: string) => {
    setCart(prev => {
      const targetKey = getInstructionsKey(instructions, notes);
      const existingIdx = prev.findIndex(item => {
        const itemKey = getInstructionsKey(item.selectedInstructions, item.customNotes);
        return item.menuItem.id === menuItem.id && itemKey === targetKey;
      });

      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += quantity;
        return updated;
      } else {
        return [...prev, { menuItem, quantity, selectedInstructions: instructions, customNotes: notes }];
      }
    });
  };

  const updateCartQuantity = (menuItemId: string, instructionsKey: string, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(item => {
        const itemKey = getInstructionsKey(item.selectedInstructions, item.customNotes);
        return item.menuItem.id === menuItemId && itemKey === instructionsKey;
      });

      if (idx === -1) return prev;

      const updated = [...prev];
      const newQuantity = updated[idx].quantity + delta;

      if (newQuantity <= 0) {
        updated.splice(idx, 1);
      } else {
        updated[idx].quantity = newQuantity;
      }
      return updated;
    });
  };

  const removeFromCart = (menuItemId: string, instructionsKey: string) => {
    setCart(prev => prev.filter(item => {
      const itemKey = getInstructionsKey(item.selectedInstructions, item.customNotes);
      return !(item.menuItem.id === menuItemId && itemKey === instructionsKey);
    }));
  };

  const clearCart = () => setCart([]);

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  };

  const refreshOrderHistory = async () => {
    if (phone) {
      const history = await db.getOrderHistory(phone);
      setOrderHistory(history);
    }
  };

  const placeOrder = async (tip: number, discountCoupon?: string) => {
    const subtotal = getCartTotal();
    const gst = Math.round(subtotal * 0.05); // 5% GST
    let discount = 0;
    
    // Strict checkout validation of coupon conditions
    if (discountCoupon) {
      const code = discountCoupon.toUpperCase();
      if (code === 'WELCOME50' && subtotal >= 150) {
        discount = 50;
        if (subtotal >= 600) discount += 25;
      } else if ((code === 'SAVE20' || code === 'FESTIVE20') && subtotal >= 300) {
        discount = Math.min(150, Math.round(subtotal * 0.20));
        if (subtotal >= 800) discount += 20;
      } else if (code === 'LOYA100' && subtotal >= 250 && profile && profile.points >= 100) {
        discount = 100;
        // Deduct loyalty points
        await db.addLoyaltyPoints(phone, -100);
      } else {
        // Dynamic promotion check
        try {
          const promos = await db.getPromotions();
          const matched = promos?.find((p: any) => p.code?.toUpperCase() === code && p.active);
          if (matched) {
            const minBill = Number(matched.min_bill || matched.minBill || 0);
            if (subtotal >= minBill) {
              if (matched.type === 'Percentage') {
                discount = Math.round((subtotal * Number(matched.discount)) / 100);
                if (matched.maxDiscount) discount = Math.min(discount, matched.maxDiscount);
              } else {
                discount = Number(matched.discount);
              }
            }
          }
        } catch (e) {
          console.warn('Checkout promo check error', e);
        }
      }
    }

    discount = Math.min(discount, subtotal);
    const total = Math.max(0, subtotal + gst + tip - discount);
    
    const order = await db.placeOrder(
      tableId,
      cart,
      { subtotal, gst, discount, tip, total },
      phone
    );

    setActiveOrder(order);
    clearCart();
    refreshOrderHistory();
    return order;
  };

  const callWaiter = async (type: WaiterRequest['requestType']) => {
    await db.requestWaiter(tableId, type);
  };

  const toggleFavorite = (item: MenuItem) => {
    setFavorites(prev => {
      const isFav = prev.some(f => f.id === item.id);
      if (isFav) {
        return prev.filter(f => f.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const isFavorite = (itemId: string) => {
    return favorites.some(f => f.id === itemId);
  };

  return (
    <AppContext.Provider
      value={{
        tableId,
        setTableId,
        phone,
        customerName,
        profile,
        setProfile,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        getCartTotal,
        placeOrder,
        activeOrder,
        setActiveOrder,
        orderHistory,
        refreshOrderHistory,
        callWaiter,
        loginCustomer,
        logoutCustomer,
        isLoggedIn: !!phone,
        favorites,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
