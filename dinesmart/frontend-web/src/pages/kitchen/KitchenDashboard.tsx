import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../supabase';
import { Order, MenuItem } from '../../types';
import { MENU_ITEMS } from '../../data/menu';
import { 
  Clock, PlayCircle, CheckCircle, RefreshCw, LogOut,
  ChefHat, Calendar, Check, X, ShieldAlert, ShoppingBag, 
  Settings, Flame, Search, Plus, Maximize2, Minimize2, ClipboardList,
  Download, ExternalLink, MessageSquare, AlertTriangle, ThumbsUp, ThumbsDown
} from 'lucide-react';

interface KitchenDashboardProps {
  onLogout: () => void;
}

type SidebarTab = 'dashboard' | 'menu' | 'reviews';
type ChefSubTab = 'food' | 'ready-made';
type VirtualStatus = 'Confirmed' | 'Preparing' | 'Ready to Serve' | 'Delivered';

interface VirtualCard {
  id: string; // "orderId-food" or "orderId-ready"
  orderId: string;
  tableId: string;
  createdAt: string;
  type: 'food' | 'ready-made';
  items: Order['items'];
  status: VirtualStatus;
}

export const KitchenDashboard: React.FC<KitchenDashboardProps> = ({ onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  
  // Console state (Waiter Desk removed, Chef Console only)
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [chefSubTab, setChefSubTab] = useState<ChefSubTab>('food');
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Menu configuration states
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [editingLimitItemId, setEditingLimitItemId] = useState<string | null>(null);
  const [tempLimit, setTempLimit] = useState<number>(0);
  
  // Sync states
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Web Audio Context for notification sounds
  const prevPendingCountRef = useRef<number>(0);
  
  // Local virtual statuses for split orders (persisted in localStorage)
  const [virtualStatuses, setVirtualStatuses] = useState<Record<string, VirtualStatus>>(() => {
    const saved = localStorage.getItem('dinesmart_virtual_statuses');
    return saved ? JSON.parse(saved) : {};
  });

  // Save virtual statuses to localStorage when changed
  useEffect(() => {
    localStorage.setItem('dinesmart_virtual_statuses', JSON.stringify(virtualStatuses));
  }, [virtualStatuses]);

  // Keep current time updated for live elapsed counters
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // update every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // Web Audio API beep sound generator
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playBeep(880, now, 0.08); // A5 note
      playBeep(1046.5, now + 0.1, 0.12); // C6 note
    } catch (e) {
      console.warn('AudioContext failed to trigger (interaction required):', e);
    }
  };

  // Fetch orders and menu items
  const fetchData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch Orders
      const data = await db.getAllOrders();
      setOrders(data);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // 2. Fetch Menu Items (includes soldCount)
      const items = await db.getMenuItems();
      setMenuItems(items);

      // 3. Fetch Customer Reviews & NLP Insights
      const revs = await db.getReviews();
      setReviews(revs || []);
    } catch (err) {
      console.error('KDS: Failed to sync data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load and periodic polling (every 3 seconds)
  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Check for new incoming pending cards to trigger audio alarm
  useEffect(() => {
    const activeParentOrders = orders.filter(o => o.status === 'Confirmed');
    if (activeParentOrders.length > prevPendingCountRef.current) {
      playNotificationSound();
    }
    prevPendingCountRef.current = activeParentOrders.length;
  }, [orders]);

  // Helper to determine if an item is ready-made or needs preparation
  const isReadyMadeItem = (name: string) => {
    const lower = name.toLowerCase();
    return (
      lower.includes('water') ||
      lower.includes('bottle') ||
      lower.includes('soft drink') ||
      lower.includes('cool drink') ||
      lower.includes('coke') ||
      lower.includes('sprite') ||
      lower.includes('soda') ||
      lower.includes('juice') ||
      lower.includes('ice cream') ||
      lower.includes('dessert') ||
      lower.includes('packaged') ||
      lower.includes('coffee') ||
      lower.includes('tea') ||
      lower.includes('brownie') ||
      lower.includes('jamun')
    );
  };

  // Helper to initialize status of virtual card based on parent order status
  const getInitialVirtualStatus = (order: Order, type: 'food' | 'ready-made'): VirtualStatus => {
    if (order.status === 'Delivered') return 'Delivered';
    if (order.status === 'Ready to Serve') return 'Ready to Serve';
    if (order.status === 'Preparing' || order.status === 'Cooking') {
      return type === 'food' ? 'Preparing' : 'Ready to Serve';
    }
    return 'Confirmed';
  };

  // Process and partition orders into food and ready-made virtual cards
  const virtualCards: VirtualCard[] = [];
  const activeOrders = orders.filter(o => o.status !== 'Delivered');

  activeOrders.forEach(order => {
    const foodItems = order.items.filter(item => !isReadyMadeItem(item.name));
    const readyItems = order.items.filter(item => isReadyMadeItem(item.name));

    if (foodItems.length > 0) {
      const vId = `${order.id}-food`;
      const status = virtualStatuses[vId] || getInitialVirtualStatus(order, 'food');
      if (status !== 'Delivered') {
        virtualCards.push({
          id: vId,
          orderId: order.id,
          tableId: order.tableId,
          createdAt: order.createdAt,
          type: 'food',
          items: foodItems,
          status
        });
      }
    }

    if (readyItems.length > 0) {
      const vId = `${order.id}-ready`;
      const status = virtualStatuses[vId] || getInitialVirtualStatus(order, 'ready-made');
      if (status !== 'Delivered') {
        virtualCards.push({
          id: vId,
          orderId: order.id,
          tableId: order.tableId,
          createdAt: order.createdAt,
          type: 'ready-made',
          items: readyItems,
          status
        });
      }
    }
  });

  // Note 21: FIFO sorting in Chef dashboard - Oldest orders first, newest orders last
  virtualCards.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Update virtual card status and sync parent order to DB
  const handleUpdateVirtualStatus = async (vId: string, nextStatus: VirtualStatus) => {
    const updated = { ...virtualStatuses, [vId]: nextStatus };
    setVirtualStatuses(updated);

    const [orderId] = vId.split('-');
    const parentOrder = orders.find(o => o.id === orderId);
    if (parentOrder) {
      const foodItems = parentOrder.items.filter(item => !isReadyMadeItem(item.name));
      const readyItems = parentOrder.items.filter(item => isReadyMadeItem(item.name));

      let aggregateStatus: Order['status'] = 'Confirmed';
      const hasFood = foodItems.length > 0;
      const hasReady = readyItems.length > 0;

      const fStatus = updated[`${orderId}-food`] || getInitialVirtualStatus(parentOrder, 'food');
      const rStatus = updated[`${orderId}-ready`] || getInitialVirtualStatus(parentOrder, 'ready-made');

      if (hasFood && hasReady) {
        if (fStatus === 'Delivered' && rStatus === 'Delivered') {
          aggregateStatus = 'Delivered';
        } else if (
          (fStatus === 'Ready to Serve' || fStatus === 'Delivered') &&
          (rStatus === 'Ready to Serve' || rStatus === 'Delivered')
        ) {
          aggregateStatus = 'Ready to Serve';
        } else if (fStatus === 'Preparing' || rStatus === 'Preparing') {
          aggregateStatus = 'Preparing';
        } else {
          aggregateStatus = 'Confirmed';
        }
      } else if (hasFood) {
        aggregateStatus = fStatus as Order['status'];
      } else if (hasReady) {
        aggregateStatus = rStatus as Order['status'];
      }

      // Update actual status in DB/LocalStorage
      await db.updateOrderStatus(orderId, aggregateStatus);
      
      // Update local state for snappy response
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: aggregateStatus } : o));
    }
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('tabletap_kitchen_token');
    onLogout();
  };

  // Availability setup updates
  const handleToggleUnlimited = async (item: MenuItem) => {
    const newUnlimited = !item.isUnlimited;
    const currentLimit = item.dailyLimit || 50;
    await db.updateMenuAvailability(item.id, newUnlimited, currentLimit);
    fetchData();
  };

  const handleSaveFixedLimit = async (itemId: string) => {
    await db.updateMenuAvailability(itemId, false, tempLimit);
    setEditingLimitItemId(null);
    fetchData();
  };

  const handleStartEditingLimit = (item: MenuItem) => {
    setEditingLimitItemId(item.id);
    setTempLimit(item.dailyLimit || 50);
  };

  // Live Stats calculations (for today's orders)
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);
  const completedOrdersCount = todayOrders.filter(o => o.status === 'Delivered').length;

  const itemCounts: Record<string, number> = {};
  let totalItemsPreparedToday = 0;

  todayOrders.forEach(o => {
    o.items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      if (o.status === 'Delivered' || o.status === 'Ready to Serve') {
        totalItemsPreparedToday += item.quantity;
      }
    });
  });

  let mostOrderedItem = 'None';
  let maxCount = 0;
  Object.entries(itemCounts).forEach(([name, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostOrderedItem = `${name} (×${count})`;
    }
  });

  const preparingFoodCount = virtualCards.filter(vc => vc.type === 'food' && vc.status === 'Preparing').length;
  const waitingForWaiterCount = virtualCards.filter(vc => vc.status === 'Ready to Serve').length;

  // Filtered menu items for Menu availability screen
  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(menuSearchQuery.toLowerCase())
  );

  // Time formatting helper
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Card component for split virtual orders in White Mode (frosted white glass appearance)
  const LightVirtualCard: React.FC<{ card: VirtualCard; actions: React.ReactNode }> = ({ card, actions }) => {
    const timeDiff = currentTime.getTime() - new Date(card.createdAt).getTime();
    const minutesElapsed = Math.floor(timeDiff / 60000);
    const orderPlacingTime = new Date(card.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Warning highlights if cooking takes too long
    const isOverdue = card.status === 'Preparing' && minutesElapsed >= 15;

    return (
      <div className={`backdrop-blur-md rounded-2xl border transition-all duration-300 flex flex-col justify-between p-4 shadow-sm ${
        isOverdue 
          ? 'bg-red-50/90 border-red-200 hover:border-red-300' 
          : 'bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white'
      }`}>
        <div>
          <div className="flex justify-between items-start border-b border-slate-100 pb-2.5 mb-3.5">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Table {card.tableId}</span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                  card.status === 'Confirmed' 
                    ? 'bg-amber-100 text-amber-700' 
                    : card.status === 'Preparing' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {card.status === 'Confirmed' ? 'New' : card.status === 'Preparing' ? 'Preparing' : 'Waiting Waiter'}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm">Order #{card.orderId}</h4>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock size={10} />
                {orderPlacingTime}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                minutesElapsed >= 15 ? 'text-red-600 animate-pulse' : 'text-slate-400'
              }`}>
                {minutesElapsed <= 0 ? 'Just now' : `${minutesElapsed}m ago`}
              </span>
            </div>
          </div>

          {/* Ordered items */}
          <div className="space-y-3 mb-4">
            {card.items.map((item, idx) => (
              <div key={idx} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700">{item.name}</span>
                  <span className="font-extrabold text-primary text-sm">× {item.quantity}</span>
                </div>
                {item.instructions && item.instructions.length > 0 && (
                  <p className="text-[10px] text-primary font-semibold ml-1.5 mt-0.5">
                    ↳ {item.instructions.join(', ')}
                  </p>
                )}
                {item.customNotes && (
                  <p className="text-[10px] text-orange-600 italic ml-1.5 mt-0.5">
                    Note: "{item.customNotes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="border-t border-slate-100 pt-3 mt-2 flex flex-col gap-2">
          {actions}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden max-w-none font-sans">
      
      {/* 1. SIDEBAR CONTAINER (Light Theme) */}
      {!isMaximized && (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0 z-20">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-primary to-orange-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-primary/20">
              <ChefHat size={22} className="rotate-3" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight leading-none bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent font-sans">
                TableTap
              </h2>
              <span className="text-[10px] text-slate-700 font-black tracking-wide uppercase mt-1 block italic">
                kitchen Warriors ⚔️
              </span>
            </div>
          </div>

          {/* Navigation Options (Completed orders tab removed) */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-primary/10 text-primary border-l-4 border-primary font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock size={16} />
                <span>Orders Dashboard</span>
              </div>
              {virtualCards.length > 0 && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary text-white">
                  {virtualCards.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'menu' 
                  ? 'bg-primary/10 text-primary border-l-4 border-primary font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Settings size={16} />
              <span>Today's Menu</span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reviews' 
                  ? 'bg-primary/10 text-primary border-l-4 border-primary font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={16} />
                <span>Guest NLP Reviews</span>
              </div>
              {reviews.filter(r => r.kitchen_alert).length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                  {reviews.filter(r => r.kitchen_alert).length} Alerts
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-500 hover:text-white hover:bg-red-500 transition-all text-left cursor-pointer border border-transparent hover:border-red-200"
          >
            <LogOut size={16} />
            <span>Logout Console</span>
          </button>
        </div>
        </aside>
      )}

      {/* 2. MAIN KDS BOARD WRAPPER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top bar header */}
        {!isMaximized && (
          <header className="bg-white border-b border-slate-200 p-5 flex justify-between items-center z-10 flex-shrink-0">
          <div>
            <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span>{activeTab === 'dashboard' ? 'Orders Dashboard' : 'Daily Menu Availability'}</span>
              {loading && <RefreshCw size={14} className="text-primary animate-spin" />}
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span>Live Synced • Sync Time: {lastRefreshed || 'Just now'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs">


            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-600 font-medium">
              <Calendar size={13} className="text-primary" />
              <span>{getFormattedDate()}</span>
            </div>
          </div>
          </header>
        )}

        {/* Quick Metrics Statistics Row */}
        {activeTab === 'dashboard' && !isMaximized && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 pb-0 flex-shrink-0">
            {/* Stat 1: Active Cards */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Active Cards</span>
              <strong className="text-xl text-slate-800 font-black mt-1 block">{virtualCards.length}</strong>
            </div>

            {/* Stat 2: Preparing Food */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Preparing Food</span>
              <strong className="text-xl text-blue-600 font-black mt-1 block">{preparingFoodCount}</strong>
            </div>

            {/* Stat 3: Waiting for Waiter */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Waiting for Waiter</span>
              <strong className="text-xl text-emerald-600 font-black mt-1 block">{waitingForWaiterCount}</strong>
            </div>
          </div>
        )}

        {/* Scrollable Column Boards / Workspace Views */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          
          {/* TAB A: KDS MAIN WORKSPACE */}
          {activeTab === 'dashboard' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col min-h-0">
                {/* Sub-tabs & Maximize Row */}
                <div className="flex justify-between items-center mb-4 flex-shrink-0 w-full">
                  <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-200 gap-1">
                    <button
                      onClick={() => setChefSubTab('food')}
                      className={`px-6 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        chefSubTab === 'food' 
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ChefHat size={14} className="text-primary" />
                      <span>Food Tab</span>
                    </button>
                    <button
                      onClick={() => setChefSubTab('ready-made')}
                      className={`px-6 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        chefSubTab === 'ready-made' 
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ShoppingBag size={14} className="text-primary" />
                      <span>Ready-Made / Non-Food Tab</span>
                    </button>
                  </div>

                  {/* Maximize / Minimize Button */}
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-95 cursor-pointer"
                    title={isMaximized ? 'Minimize Screen' : 'Maximize Screen'}
                  >
                    {isMaximized ? <Minimize2 size={14} className="text-primary" /> : <Maximize2 size={14} className="text-primary" />}
                    <span>{isMaximized ? 'Restore View' : 'Maximize Board'}</span>
                  </button>
                </div>
                {/* KDS Grid Workspace (Row-wise state transitions) */}
                <div className="flex-1 min-h-0 overflow-y-auto pb-4">
                  {chefSubTab === 'food' ? (
                    /* FOOD PREPARATION VIEW */
                    <div>
                      {virtualCards.filter(vc => vc.type === 'food').length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {virtualCards.filter(vc => vc.type === 'food').map(card => {
                            let buttonText = 'Accept';
                            let buttonColor = 'bg-amber-500 hover:bg-amber-600 text-white';
                            let nextStatus: VirtualStatus = 'Preparing';
                            const isWaiting = card.status === 'Ready to Serve';

                            if (card.status === 'Confirmed') {
                              buttonText = 'Accept';
                              buttonColor = 'bg-amber-500 hover:bg-amber-600 text-white';
                              nextStatus = 'Preparing';
                            } else if (card.status === 'Preparing') {
                              buttonText = 'Prepared';
                              buttonColor = 'bg-blue-500 hover:bg-blue-600 text-white';
                              nextStatus = 'Ready to Serve';
                            } else if (card.status === 'Ready to Serve') {
                              buttonText = 'Waiting for Waiter';
                              buttonColor = 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold animate-pulse cursor-not-allowed';
                              nextStatus = 'Delivered';
                            }

                            return (
                              <LightVirtualCard 
                                key={card.id} 
                                card={card} 
                                actions={
                                  <button
                                    onClick={isWaiting ? undefined : () => handleUpdateVirtualStatus(card.id, nextStatus)}
                                    disabled={isWaiting}
                                    className={`w-full font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-sm text-center ${
                                      isWaiting ? buttonColor : `${buttonColor} cursor-pointer`
                                    }`}
                                  >
                                    {buttonText}
                                  </button>
                                }
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-16 font-semibold">No active food orders</p>
                      )}
                    </div>
                  ) : (
                    /* READY-MADE / NON-FOOD VIEW */
                    <div>
                      {virtualCards.filter(vc => vc.type === 'ready-made').length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {virtualCards.filter(vc => vc.type === 'ready-made').map(card => {
                            let buttonText = 'Accept';
                            let buttonColor = 'bg-amber-500 hover:bg-amber-600 text-white';
                            let nextStatus: VirtualStatus = 'Ready to Serve';
                            const isWaiting = card.status === 'Ready to Serve';

                            if (card.status === 'Confirmed') {
                              buttonText = 'Accept';
                              buttonColor = 'bg-amber-500 hover:bg-amber-600 text-white';
                              nextStatus = 'Ready to Serve';
                            } else if (card.status === 'Ready to Serve') {
                              buttonText = 'Waiting for Waiter';
                              buttonColor = 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold animate-pulse cursor-not-allowed';
                              nextStatus = 'Delivered';
                            }

                            return (
                              <LightVirtualCard 
                                key={card.id} 
                                card={card} 
                                actions={
                                  <button
                                    onClick={isWaiting ? undefined : () => handleUpdateVirtualStatus(card.id, nextStatus)}
                                    disabled={isWaiting}
                                    className={`w-full font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-sm text-center ${
                                      isWaiting ? buttonColor : `${buttonColor} cursor-pointer`
                                    }`}
                                  >
                                    {buttonText}
                                  </button>
                                }
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-16 font-semibold">No active ready-made items</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB B: TODAY'S MENU MANAGEMENT */}
          {activeTab === 'menu' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 h-full flex flex-col shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Daily Menu Availability Settings</h2>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Configure item quantities or toggle unlimited availability for today's customers</p>
                </div>
                {/* Menu Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                    placeholder="Search menu items..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:border-primary font-medium"
                  />
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto no-scrollbar pb-6 flex-1">
                {filteredMenuItems.length > 0 ? (
                  filteredMenuItems.map(item => {
                    const isSoldOut = !item.isUnlimited && item.dailyLimit !== undefined && (item.soldCount || 0) >= item.dailyLimit;
                    const remaining = item.isUnlimited ? 9999 : Math.max(0, (item.dailyLimit || 50) - (item.soldCount || 0));

                    return (
                      <div 
                        key={item.id} 
                        className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                          isSoldOut 
                            ? 'border-red-300 bg-red-50/20' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          {/* Item Card header */}
                          <div className="flex gap-3 mb-4">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-14 h-14 rounded-xl object-cover border border-slate-100 bg-slate-50"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{item.category}</span>
                              <h4 className="font-extrabold text-slate-800 text-xs truncate mt-0.5">{item.name}</h4>
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 ${
                                isSoldOut 
                                  ? 'bg-red-100 text-red-700 border border-red-200/30' 
                                  : 'bg-green-100 text-green-700 border border-green-200/30'
                              }`}>
                                {isSoldOut ? 'Sold Out' : 'Available'}
                              </span>
                            </div>
                          </div>

                          {/* Mode settings */}
                          <div className="space-y-4 pt-3 border-t border-slate-100">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-500">Availability Mode</span>
                              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  onClick={() => handleToggleUnlimited(item)}
                                  className={`px-3 py-1 text-[9px] font-bold rounded cursor-pointer ${
                                    item.isUnlimited ? 'bg-primary text-white shadow-sm' : 'text-slate-500'
                                  }`}
                                >
                                  Unlimited
                                </button>
                                <button
                                  onClick={() => handleToggleUnlimited(item)}
                                  className={`px-3 py-1 text-[9px] font-bold rounded cursor-pointer ${
                                    !item.isUnlimited ? 'bg-primary text-white shadow-sm' : 'text-slate-500'
                                  }`}
                                >
                                  Fixed Limit
                                </button>
                              </div>
                            </div>

                            {/* Limit Input details */}
                            {!item.isUnlimited ? (
                              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-slate-500">Daily Limit</span>
                                  {editingLimitItemId === item.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        value={tempLimit}
                                        onChange={(e) => setTempLimit(Math.max(1, parseInt(e.target.value) || 0))}
                                        className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center text-xs text-slate-800 focus:outline-none focus:border-primary"
                                      />
                                      <button 
                                        onClick={() => handleSaveFixedLimit(item.id)}
                                        className="p-1 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer"
                                      >
                                        <Check size={10} />
                                      </button>
                                      <button 
                                        onClick={() => setEditingLimitItemId(null)}
                                        className="p-1 bg-red-650 hover:bg-red-700 text-white rounded cursor-pointer"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => handleStartEditingLimit(item)}
                                      className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                                    >
                                      Edit ({item.dailyLimit || 50})
                                    </button>
                                  )}
                                </div>

                                <div className="pt-1.5">
                                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                    <span>Sold: {item.soldCount || 0} / {item.dailyLimit || 50}</span>
                                    <span>{remaining} Left</span>
                                  </div>
                                  {/* Progress bar */}
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-550 ${isSoldOut ? 'bg-red-500' : 'bg-primary'}`}
                                      style={{ width: `${Math.min(100, (((item.soldCount || 0) / (item.dailyLimit || 50)) * 100))}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-200 p-3 rounded-xl flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-500">Sold Today</span>
                                <span className="font-extrabold text-slate-800 text-sm">{item.soldCount || 0}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
                    <Search size={32} className="text-slate-300 mb-3" />
                    <p className="text-slate-500 font-semibold text-sm">No menu items found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. REVIEWS & NLP SENTIMENT ANALYSIS TAB */}
          {activeTab === 'reviews' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span>Guest Reviews & Kitchen Sentiment (NLP)</span>
                    <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Real-time NLP
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Live natural language processing of food ratings, taste alerts, and customer polarity.
                  </p>
                </div>
              </div>

              {/* Metrics Header */}
              {(() => {
                const totalRevs = reviews.length;
                const posCount = reviews.filter(r => r.sentiment === 'Positive').length;
                const negCount = reviews.filter(r => r.sentiment === 'Negative').length;
                const alertCount = reviews.filter(r => r.kitchen_alert).length;
                const posPercent = totalRevs ? Math.round((posCount / totalRevs) * 100) : 100;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Feedback</span>
                      <strong className="text-2xl font-black text-slate-800 block mt-1">{totalRevs}</strong>
                    </div>
                    <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/60 shadow-xs">
                      <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Positive Sentiment</span>
                      <strong className="text-2xl font-black text-emerald-700 block mt-1">{posPercent}% ({posCount})</strong>
                    </div>
                    <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/60 shadow-xs">
                      <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Negative Sentiment</span>
                      <strong className="text-2xl font-black text-rose-700 block mt-1">{negCount}</strong>
                    </div>
                    <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 shadow-xs">
                      <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Critical Food Alerts</span>
                      <strong className="text-2xl font-black text-amber-700 block mt-1">{alertCount}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Reviews List */}
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                    <MessageSquare size={36} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold">No guest reviews submitted yet.</p>
                  </div>
                ) : (
                  reviews.map((rev) => {
                    const isPositive = rev.sentiment === 'Positive';
                    const isNegative = rev.sentiment === 'Negative';
                    return (
                      <div
                        key={rev.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          rev.kitchen_alert 
                            ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200' 
                            : isPositive 
                              ? 'bg-white border-slate-200 hover:border-emerald-200' 
                              : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{rev.emoji || (isPositive ? '😊' : isNegative ? '😞' : '😐')}</span>
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {rev.customer_name || 'Valued Guest'}
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                Table {rev.table_id || '05'} • Order #{rev.order_id} • {rev.date}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                              isPositive
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : isNegative
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              NLP: {rev.sentiment || 'Positive'} ({Math.round(rev.sentiment_score || 80)}%)
                            </span>
                            <span className="text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                              ★ {rev.rating || 5}/5
                            </span>
                          </div>
                        </div>

                        {rev.kitchen_alert && (
                          <div className="bg-rose-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl mb-2 flex items-center gap-1.5 animate-pulse">
                            <AlertTriangle size={14} />
                            <span>KITCHEN ATTENTION REQUIRED: {rev.kitchen_alert_reason || 'Negative taste / prep note'}</span>
                          </div>
                        )}

                        <p className="text-xs font-medium text-slate-700 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 italic">
                          "{rev.comment}"
                        </p>

                        {rev.key_phrases && rev.key_phrases.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {rev.key_phrases.map((phrase: string, idx: number) => (
                              <span key={idx} className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md">
                                #{phrase}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}



        </div>

      </div>

    </div>
  );
};
