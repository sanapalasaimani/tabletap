import React, { useState, useEffect } from 'react';
import { db } from '../../supabase';
import { MenuItem, Order, UserProfile, WaiterRequest } from '../../types';
import { 
  LayoutDashboard, ShoppingBag, ChefHat, Utensils, Layers, Users, 
  Map, CreditCard, Award, Megaphone, UserCheck, BarChart3, Bell, 
  Settings, Shield, QrCode, Image, MessageSquare, Search, Trash2, 
  Edit3, Plus, X, ChevronRight, Download, Sparkles, Filter, Check, 
  AlertTriangle, Moon, Sun, RefreshCw, FileText, Mail, MessageCircle, 
  CornerDownRight, UserPlus, Heart, TrendingUp, DollarSign, Calendar
} from 'lucide-react';
import { 
  predictSales, predictInventoryDepletion, getCustomerAIInsights, 
  getAIBusinessSuggestions, getPeakTimePredictions, analyzeReviewSentiment,
  SalesPrediction, CustomerInsights, BusinessSuggestion, InventoryDepletion, 
  PeakTimePrediction, SentimentResult 
} from './groq';

interface AdminDashboardProps {
  role: string;
  onLogout: () => void;
}

type TabType = 
  | 'overview' | 'orders' | 'kitchen' | 'menu' | 'inventory' | 'staff'
  | 'tables' | 'billing' | 'loyalty' | 'promotions' | 'customers' | 'ai_analytics'
  | 'reports' | 'notifications' | 'settings' | 'security' | 'qrcodes' | 'gallery' | 'reviews';

interface Employee {
  id: string;
  name: string;
  mobile: string;
  role: 'Manager' | 'Chef' | 'Waiter' | 'Cashier' | 'Cleaner' | 'Delivery Staff';
  shift: 'Morning' | 'Evening' | 'Night';
  salary: number;
  attendance: number;
  performance: {
    score: number;
    ordersDelivered: number;
    avgServingTime: string;
    ratings: number;
    tips: number;
  };
  empid: string;
  password?: string;
}

interface TableStatus {
  id: number;
  name: string;
  status: 'Available' | 'Ordered' | 'Cooking' | 'Serving' | 'Billing' | 'Reserved' | 'Cleaning';
  customer_name?: string;
  capacity: number;
  qr_token?: string;
}

interface ActivityLog {
  id: string;
  user_role: string;
  action: string;
  timestamp: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ role, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Real-time Database States
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [syncTime, setSyncTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [alertSettings, setAlertSettings] = useState<any>({ tax: 5, currency: '₹', gstNo: '27AAAAA1111A1Z1' });

  // Modals & Overlay Drawers
  const [newMenuItemForm, setNewMenuItemForm] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [newStaffForm, setNewStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Employee | null>(null);
  const [splitBillModal, setSplitBillModal] = useState<Order | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Order | null>(null);
  const [newPromotionModal, setNewPromotionModal] = useState(false);
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  
  // OTP Modal State
  const [otpModal, setOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [pendingEditStaff, setPendingEditStaff] = useState<Employee | null>(null);

  // Form Fields State
  const [menuFormState, setMenuFormState] = useState({
    name: '',
    price: 0,
    category: 'Main Course' as MenuItem['category'],
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    description: '',
    calories: 300,
    prepTime: '15 mins',
    isVeg: true,
    isSpecial: false,
  });

  const [staffFormState, setStaffFormState] = useState({
    name: '',
    mobile: '',
    role: 'Waiter' as Employee['role'],
    shift: 'Morning' as Employee['shift'],
    salary: 18000,
    empid: '',
    password: ''
  });

  const [couponFormState, setCouponFormState] = useState({
    code: '',
    discount: 50,
    minBill: 200
  });

  const [newStockModal, setNewStockModal] = useState(false);
  const [stockFormState, setStockFormState] = useState({
    name: '',
    stock: 0,
    minStock: 0,
    unit: 'Units'
  });

  const [loyaltyRules, setLoyaltyRules] = useState({
    pointsPerHundred: 10,
    silverTierPoints: 500,
    goldTierPoints: 1000,
    goldDiscountPercent: 10
  });
  const [editLoyaltyModal, setEditLoyaltyModal] = useState(false);

  // AI Insights State
  const [aiSalesPred, setAiSalesPred] = useState<SalesPrediction | null>(null);
  const [aiInventoryPred, setAiInventoryPred] = useState<InventoryDepletion[] | null>(null);
  const [aiCustomerInsights, setAiCustomerInsights] = useState<CustomerInsights | null>(null);
  const [aiBusinessSuggestions, setAiBusinessSuggestions] = useState<BusinessSuggestion[] | null>(null);
  const [aiPeakTimePred, setAiPeakTimePred] = useState<PeakTimePrediction | null>(null);
  const [aiReviewSentiment, setAiReviewSentiment] = useState<Record<string, SentimentResult>>({});

  // Sync Data function from Supabase
  const fetchData = async () => {
    try {
      const dbOrders = await db.getAllOrders();
      setOrders(dbOrders);
      
      const dbMenu = await db.getMenuItems();
      setMenuItems(dbMenu);

      const dbInventory = await db.getInventory();
      setInventory(dbInventory);

      const dbStaff = await db.getStaff();
      setStaff(dbStaff);

      const dbTables = await db.getTables();
      setTables(dbTables);

      const dbRules = await db.getLoyaltyRules();
      if (dbRules) setLoyaltyRules(dbRules);

      const dbPromotions = await db.getPromotions();
      setCoupons(dbPromotions);

      const dbReviews = await db.getReviews();
      setReviews(dbReviews);

      const dbLogs = await db.getActivityLogs();
      setActivityLogs(dbLogs);

      const dbRequests = await db.getWaiterRequests();
      setWaiterRequests(dbRequests);

      // Simple low stock warning alert generation
      const lowStockAlerts = dbInventory
        .filter((item: any) => item.stock <= item.min_stock)
        .map((item: any) => ({
          id: `low_${item.id}`,
          type: 'low_stock',
          title: 'Stock Warning',
          message: `${item.name} stock level is at ${item.stock} ${item.unit}. Recommended threshold: ${item.min_stock}.`,
          read: false,
          time: 'Just now'
        }));

      // Kitchen delay alerts check
      const delayAlerts = dbRequests
        .filter(r => r.status === 'Pending')
        .map(r => ({
          id: `req_${r.id}`,
          type: 'delay',
          title: 'Service Call Alert',
          message: `Table ${r.tableId} requests ${r.requestType}. Action required.`,
          read: false,
          time: 'Just now'
        }));

      setNotifications([...lowStockAlerts, ...delayAlerts]);
      setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to sync admin data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // 4-second polling for real-time sync with Supabase
    const interval = setInterval(() => {
      fetchData();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Save audit log to Supabase
  const logActivity = async (action: string) => {
    try {
      const newLog = {
        id: `l_${Date.now()}`,
        user_role: role,
        action,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };
      await db.saveActivityLog(newLog);
      fetchData();
    } catch (e) {
      console.error('Error logging audit activity:', e);
    }
  };

  // Floor Tables initialization (if database is brand new and tables list is empty)
  const handleInitializeTables = async () => {
    setLoading(true);
    try {
      for (let i = 1; i <= 12; i++) {
        const qr_token = 'qr_' + Math.random().toString(36).substring(2, 15);
        await db.saveTable({
          id: i,
          name: `Table ${i}`,
          status: 'Available',
          capacity: i % 2 === 0 ? 4 : 2,
          qr_token
        });
      }
      await fetchData();
      logActivity('Initialized floor tables (1-12) with secure QR tokens');
    } catch (err) {
      alert('Failed to initialize tables.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTable = async () => {
    setLoading(true);
    try {
      const nextId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;
      const qr_token = 'qr_' + Math.random().toString(36).substring(2, 15);
      await db.saveTable({
        id: nextId,
        name: `Table ${nextId}`,
        status: 'Available',
        capacity: 4,
        qr_token
      });
      await fetchData();
      logActivity(`Added new Table #${nextId}`);
    } catch (err) {
      alert('Failed to add table.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTable = async (id: number) => {
    if (confirm(`Are you sure you want to remove Table #${id}?`)) {
      setLoading(true);
      try {
        await db.deleteTable(id);
        await fetchData();
        logActivity(`Removed Table #${id}`);
      } catch (err) {
        alert('Failed to remove table.');
      } finally {
        setLoading(false);
      }
    }
  };

  // ----------------------------------------------------
  // OPERATIONS ACTIONS WITH DELETION WARNINGS
  // ----------------------------------------------------
  
  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    await db.updateOrderStatus(orderId, status);
    fetchData();
    logActivity(`Updated Order #${orderId} status to ${status}`);
  };

  const handlePayOrder = async (orderId: string, method: string) => {
    await db.payOrder(orderId, method);
    fetchData();
    logActivity(`Processed payment for Order #${orderId} via ${method}`);
    
    const orderObj = orders.find(o => o.id === orderId);
    if (orderObj) {
      const tableObj = tables.find(t => t.id === parseInt(orderObj.tableId));
      if (tableObj) {
        await db.saveTable({
          ...tableObj,
          status: 'Available',
          customer_name: null
        });
      }
    }
  };

  const handleSplitBill = (order: Order, ways: number) => {
    const splitAmount = Math.round(order.total / ways);
    alert(`Split Invoice Generated: ${ways} parts of ₹${splitAmount} each.`);
    setSplitBillModal(null);
    logActivity(`Split bill of Order #${order.id} into ${ways} parts`);
  };

  // Kitchen Workload AI suggestions trigger
  const runAIKitchenAdvisor = async () => {
    alert('AI Advisor: Analyzing Chef workload & cooking speeds...');
    const newAlerts = [...notifications];
    newAlerts.unshift({
      id: `n_${Date.now()}`,
      type: 'delay',
      title: 'AI Chef Allocation',
      message: 'Kitchen Delay Detected: Assign another chef to reduce waiting time.',
      read: false,
      time: 'Just now'
    });
    setNotifications(newAlerts);
    logActivity('Executed AI Chef Workload optimization advisor');
  };

  // Menu Catalog Operations
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const newItem: MenuItem = {
        id: editingMenuItem ? editingMenuItem.id : `m_${Date.now()}`,
        name: menuFormState.name,
        price: menuFormState.price,
        category: menuFormState.category,
        image: menuFormState.image,
        rating: editingMenuItem ? editingMenuItem.rating : 5.0,
        reviewsCount: editingMenuItem ? editingMenuItem.reviewsCount : 0,
        isVeg: menuFormState.isVeg,
        isSpecial: menuFormState.isSpecial,
        calories: menuFormState.calories,
        prepTime: menuFormState.prepTime,
        description: menuFormState.description
      };
      
      await db.saveMenuItem(newItem);
      await fetchData();
      logActivity(editingMenuItem ? `Modified menu dish: ${newItem.name}` : `Added new menu dish: ${newItem.name}`);
      setNewMenuItemForm(false);
      setEditingMenuItem(null);
    } catch (err) {
      alert('Failed to save menu item.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenuItem = async (id: string, name: string) => {
    if (confirm(`WARNING: Are you sure you want to permanently delete "${name}" from the menu?`)) {
      await db.deleteMenuItem(id);
      await fetchData();
      logActivity(`Deleted Menu Item: ${name}`);
    }
  };

  // Stock updates
  const handleAddStockItem = () => {
    setNewStockModal(true);
  };

  const submitNewStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFormState.name) return;
    
    await db.saveInventoryItem({
      id: `i_${Date.now()}`,
      name: stockFormState.name,
      stock: stockFormState.stock,
      min_stock: stockFormState.minStock,
      unit: stockFormState.unit
    });
    
    fetchData();
    logActivity(`Registered new inventory item: ${stockFormState.name}`);
    
    setNewStockModal(false);
    setStockFormState({ name: '', stock: 0, minStock: 0, unit: 'Units' });
  };

  const handleUpdateStockLevel = async (id: string, name: string, delta: number) => {
    const target = inventory.find(i => i.id === id);
    if (target) {
      const updated = { ...target, stock: Math.max(0, target.stock + delta) };
      await db.saveInventoryItem(updated);
      fetchData();
      logActivity(`Adjusted stock of ${name} by ${delta > 0 ? '+' : ''}${delta}`);
    }
  };

  const handleDeleteInventoryItem = async (id: string, name: string) => {
    if (confirm(`WARNING: Are you sure you want to delete ${name} from inventory?`)) {
      await db.deleteInventoryItem(id);
      await fetchData();
      logActivity(`Deleted inventory item: ${name}`);
    }
  };

  const handleSaveLoyaltyRules = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.saveLoyaltyRules(loyaltyRules);
    setEditLoyaltyModal(false);
    logActivity('Updated Loyalty Conversion Rules');
  };

  // Staff Management (EmpID & Password checks)
  const handleSaveStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'Hotel Manager') {
      alert('Access Denied: Only Hotel Manager/Admin can add or update staff members.');
      return;
    }

    try {
      const newEmp = {
        id: editingStaff ? editingStaff.id : `s_${Date.now()}`,
        name: staffFormState.name,
        mobile: staffFormState.mobile,
        role: staffFormState.role,
        shift: staffFormState.shift,
        salary: staffFormState.salary,
        empid: staffFormState.empid,
        password: staffFormState.password,
        attendance: editingStaff ? editingStaff.attendance : 100,
        performance: editingStaff ? editingStaff.performance : { score: 90, ordersDelivered: 0, avgServingTime: 'N/A', ratings: 5.0, tips: 0 }
      };

      await db.saveStaffMember(newEmp);
      await fetchData();
      logActivity(editingStaff ? `Updated staff member: ${newEmp.name}` : `Added new staff member: ${newEmp.name}`);
      setNewStaffForm(false);
      setEditingStaff(null);
      setStaffFormState({ name: '', mobile: '', role: 'Waiter', shift: 'Morning', salary: 18000, empid: '', password: '' });
    } catch (e) {
      alert('Failed to register employee. Employee ID must be unique.');
    }
  };

  const handleDeleteStaffMember = async (id: string, name: string) => {
    if (role !== 'Hotel Manager') {
      alert('Access Denied: Only Hotel Manager/Admin can remove staff members.');
      return;
    }
    if (confirm(`WARNING: Are you sure you want to permanently delete employee "${name}"?`)) {
      await db.deleteStaffMember(id);
      await fetchData();
      logActivity(`Removed staff member: ${name}`);
    }
  };

  const handleVerifyOTP = () => {
    if (otpInput === '1234') {
      setOtpModal(false);
      setOtpInput('');
      if (pendingEditStaff) {
        setEditingStaff(pendingEditStaff);
        setStaffFormState({
          name: pendingEditStaff.name,
          mobile: pendingEditStaff.mobile || '',
          role: pendingEditStaff.role,
          shift: pendingEditStaff.shift,
          salary: pendingEditStaff.salary,
          empid: pendingEditStaff.empid,
          password: pendingEditStaff.password || ''
        });
        setNewStaffForm(true);
        setPendingEditStaff(null);
      }
    } else {
      alert('Invalid OTP. For demonstration, use 1234.');
    }
  };

  // Table status and Floor layouts
  const handleReserveTable = async (tableId: number, guestName: string) => {
    const tableObj = tables.find(t => t.id === tableId);
    if (tableObj) {
      await db.saveTable({
        ...tableObj,
        status: 'Reserved',
        customer_name: guestName || 'Guest Reservation'
      });
      fetchData();
      logActivity(`Reserved Table #${tableId} for ${guestName}`);
    }
  };

  const handleBlockTable = async (tableId: number) => {
    const tableObj = tables.find(t => t.id === tableId);
    if (tableObj) {
      const isBlocked = tableObj.status === 'Reserved' && tableObj.customer_name === 'MAINTENANCE BLOCK';
      await db.saveTable({
        ...tableObj,
        status: isBlocked ? 'Available' : 'Reserved',
        customer_name: isBlocked ? null : 'MAINTENANCE BLOCK'
      });
      fetchData();
      logActivity(`Toggled maintenance block status on Table #${tableId}`);
    }
  };

  // QR Code Replace & Download Logic
  const handleReplaceQrToken = async (tableId: number) => {
    const tableObj = tables.find(t => t.id === tableId);
    if (tableObj) {
      const newQrToken = 'qr_' + Math.random().toString(36).substring(2, 15);
      await db.saveTable({
        ...tableObj,
        qr_token: newQrToken
      });
      fetchData();
      logActivity(`Generated new secure QR session token for Table #${tableId}`);
    }
  };

  const handleDownloadQrImage = async (tableId: number, qrToken: string) => {
    if (!qrToken) {
      alert('No QR Session configured. Please click replace first.');
      return;
    }

    try {
      const qrDataUrl = `http://localhost:5173/table/${tableId}?token=${qrToken}`;
      const apiEndpoint = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrDataUrl)}`;
      
      const response = await fetch(apiEndpoint);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `table_${tableId}_qr.png`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      logActivity(`Downloaded QR Sticker for Table #${tableId}`);
    } catch (e) {
      alert('Failed to download QR code image.');
    }
  };

  // Coupon Campaigns
  const handleCreateCouponCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponFormState.code.trim()) return;

    try {
      await db.savePromotion({
        id: `cp_${Date.now()}`,
        code: couponFormState.code.toUpperCase(),
        discount: couponFormState.discount,
        type: 'Fixed',
        min_bill: couponFormState.minBill,
        active: true
      });
      await fetchData();
      logActivity(`Launched promotions campaign: ${couponFormState.code.toUpperCase()}`);
      setNewPromotionModal(false);
      setCouponFormState({ code: '', discount: 50, minBill: 200 });
    } catch (err) {
      alert('Failed to publish coupon.');
    }
  };

  const handleDeletePromotion = async (id: string, code: string) => {
    if (confirm(`WARNING: Are you sure you want to permanently delete campaign "${code}"?`)) {
      await db.deletePromotion(id);
      await fetchData();
      logActivity(`Deactivated promotions campaign: ${code}`);
    }
  };

  // Review reply updates
  const handleReplyReviewSubmit = async (id: string) => {
    const reviewObj = reviews.find(r => r.id === id);
    if (reviewObj) {
      const updated = { ...reviewObj, reply: replyText };
      await db.saveReview(updated);
      await fetchData();
      setReplyReviewId(null);
      setReplyText('');
      logActivity('Submitted manager reply comment to customer review');
    }
  };

  // ----------------------------------------------------
  // GROQ AI ANALYTICS TRIGGER CALLS
  // ----------------------------------------------------
  const fetchAISalesPredictions = async () => {
    setLoading(true);
    try {
      const res = await predictSales(orders);
      setAiSalesPred(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInventoryDepletions = async () => {
    setLoading(true);
    try {
      const res = await predictInventoryDepletion(inventory, orders);
      setAiInventoryPred(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAICustomerInsights = async () => {
    setLoading(true);
    try {
      const res = await getCustomerAIInsights(staff, reviews);
      setAiCustomerInsights(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIBusinessSuggestions = async () => {
    setLoading(true);
    try {
      const res = await getAIBusinessSuggestions(orders, menuItems);
      setAiBusinessSuggestions(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIPeakTimes = async () => {
    setLoading(true);
    try {
      const res = await getPeakTimePredictions(orders);
      setAiPeakTimePred(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeSentimentForReview = async (reviewId: string, comment: string) => {
    try {
      const res = await analyzeReviewSentiment(comment);
      setAiReviewSentiment(prev => ({
        ...prev,
        [reviewId]: res
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllGroqAI = async () => {
    setLoading(true);
    await Promise.all([
      fetchAISalesPredictions(),
      fetchAIInventoryDepletions(),
      fetchAICustomerInsights(),
      fetchAIBusinessSuggestions(),
      fetchAIPeakTimes()
    ]);
    setLoading(false);
  };

  // Helper Metrics Calculations
  const getTodayRevenue = () => orders.reduce((sum, o) => sum + o.total, 0);
  const getAverageOrderValue = () => orders.length ? Math.round(getTodayRevenue() / orders.length) : 0;
  const formatPrice = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  return (
    <div className={`flex h-screen overflow-hidden font-sans ${isDarkMode ? 'bg-gray-950 text-gray-100' : 'bg-orange-50/20 text-brand-text'}`}>
      
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className={`w-64 flex flex-col justify-between flex-shrink-0 z-20 border-r ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-brand-text text-white border-gray-200'}`}>
        <div>
          {/* Logo Header */}
          <div className={`p-5 border-b flex items-center gap-3 ${isDarkMode ? 'border-gray-800' : 'border-gray-800/80'}`}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/25">
              <ChefHat size={22} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight leading-none text-white">DineSmart</h2>
              <span className="text-[9px] text-gray-400 font-semibold tracking-wider uppercase mt-1 block">Manager Panel</span>
            </div>
          </div>

          {/* Navigation links */}
          <div className="p-4 space-y-4 overflow-y-auto no-scrollbar max-h-[calc(100vh-145px)]">
            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">Operations</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'overview' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <LayoutDashboard size={14} />
                  <span>Overview & Home</span>
                </button>
                <button
                  onClick={() => setActiveTab('kitchen')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'kitchen' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <ChefHat size={14} />
                  <span>Kitchen Monitoring</span>
                </button>
                <button
                  onClick={() => setActiveTab('billing')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'billing' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Billing & Payments</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">Menu & Tables</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'menu' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Utensils size={14} />
                  <span>Menu Management</span>
                </button>
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'tables' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Map size={14} />
                  <span>Table Layout</span>
                </button>
                <button
                  onClick={() => setActiveTab('qrcodes')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'qrcodes' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <QrCode size={14} />
                  <span>QR Code Manager</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">Logistics & Staff</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'inventory' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Layers size={14} />
                  <span>Inventory Control</span>
                </button>
                <button
                  onClick={() => setActiveTab('staff')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'staff' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <UserCheck size={14} />
                  <span>Staff Scorecard</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">Loyalty & Promos</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('loyalty')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'loyalty' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Award size={14} />
                  <span>Loyalty Programs</span>
                </button>
                <button
                  onClick={() => setActiveTab('promotions')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'promotions' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Megaphone size={14} />
                  <span>Promotions Builder</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">AI & Analytics</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => { setActiveTab('ai_analytics'); loadAllGroqAI(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'ai_analytics' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Sparkles size={14} className="text-secondary" />
                  <span className="font-extrabold text-white">Groq AI Dashboard</span>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'reports' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>Reports & Export</span>
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'reviews' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <MessageSquare size={14} />
                  <span>Reviews Sentiment</span>
                </button>
              </nav>
            </div>
            
            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">Control & Security</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'settings' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Settings size={14} />
                  <span>Settings & Themes</span>
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'security' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Shield size={14} />
                  <span>Security Audit Log</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Logout */}
        <div className={`p-4 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-800/80'}`}>
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] text-gray-400 font-bold">Role: {role}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold text-red-400 hover:text-white hover:bg-red-950/40 transition-all text-left"
          >
            <Shield size={14} />
            <span>Logout Panel</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className={`border-b p-5 flex justify-between items-center z-10 flex-shrink-0 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span>Admin Dashboard</span>
              {loading && <RefreshCw size={14} className="text-primary animate-spin" />}
            </h1>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              Sync: {syncTime || 'Just now'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Download Link for Waiter Mobile App */}
            <a 
              href="/waiter-app.apk" 
              download 
              className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-3.5 rounded-xl text-[10px] flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all active:scale-95"
            >
              <Download size={13} />
              <span>Download Waiter App (Android APK)</span>
            </a>

            {/* Dark Mode toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Notifications Alert Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-xl border relative transition-all ${
                  showNotifications 
                    ? 'bg-primary border-primary text-white' 
                    : (isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-600')
                }`}
              >
                <Bell size={15} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className={`absolute right-0 mt-3 w-80 rounded-2xl border shadow-2xl z-50 p-4 animate-fade-in ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <h3 className="text-xs font-black">System Alert Logs</h3>
                    <button onClick={() => setNotifications([])} className="text-[10px] text-primary font-bold">Clear All</button>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map((n, i) => (
                        <div key={i} className={`p-2.5 rounded-xl border text-[11px] flex gap-2.5 items-start ${isDarkMode ? 'bg-gray-800/40 border-gray-800' : 'bg-orange-50/20 border-orange-50'}`}>
                          <AlertTriangle size={14} className="text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{n.title}</p>
                            <p className="text-gray-400 mt-0.5 text-[10px] leading-relaxed">{n.message}</p>
                            <span className="text-[8px] text-gray-500 block mt-1">{n.time}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">No active system alerts.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logged in User Badge */}
            <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs">
                {role.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-extrabold leading-none">{role}</p>
                <span className="text-[9px] text-gray-400 mt-1 block">Active Workspace</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Panel Viewport */}
        <main className="flex-1 overflow-y-auto p-6 relative">

          {/* Global Tables Warning Removed */}

          {/* ----------------------------------------------------
              VIEW 1: OVERVIEW (HOME)
              ---------------------------------------------------- */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Today's Revenue</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getTodayRevenue())}</strong>
                  </div>
                  <div className="w-10 h-10 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center"><DollarSign size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Orders</span>
                    <strong className="text-xl font-black mt-1 block">{orders.length}</strong>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><ShoppingBag size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Kitchen Queue</span>
                    <strong className="text-xl font-black mt-1 block">{orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking').length}</strong>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><ChefHat size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Average Ticket</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getAverageOrderValue())}</strong>
                  </div>
                  <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center"><CreditCard size={18} /></div>
                </div>
              </div>

              {/* Table Floor Grid */}
              {tables.length > 0 ? (
                <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-brand-text">Live Restaurant Floor</h3>
                      <p className="text-[10px] text-gray-400">Click a table to configure status, view qr codes, or reserve.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {tables.map(t => {
                      const statusColorMap = {
                        Available: 'bg-green-500 text-white',
                        Ordered: 'bg-yellow-500 text-white',
                        Cooking: 'bg-orange-500 text-white',
                        Serving: 'bg-blue-500 text-white',
                        Billing: 'bg-purple-500 text-white',
                        Reserved: 'bg-red-500 text-white',
                        Cleaning: 'bg-indigo-500 text-white'
                      };
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            const action = window.prompt(`Table ${t.id} Status: ${t.status}\n\nActions:\n1. Reserve Table (Enter guest name)\n2. Toggle Floor Block\n3. Settle Table (Mark Available)\n4. Generate New QR Code`);
                            if (action === '2') {
                              handleBlockTable(t.id);
                            } else if (action === '3') {
                              db.saveTable({ ...t, status: 'Available', customer_name: null });
                              fetchData();
                            } else if (action === '4') {
                              handleReplaceQrToken(t.id);
                            } else if (action && action.trim().length > 0 && action !== '1') {
                              handleReserveTable(t.id, action);
                            }
                          }}
                          className={`p-3.5 rounded-2xl text-center cursor-pointer transition-all hover:scale-105 ${statusColorMap[t.status] || 'bg-gray-150 text-gray-500'}`}
                        >
                          <h4 className="font-extrabold text-xs">{t.name}</h4>
                          <p className="text-[8px] uppercase tracking-wider font-semibold opacity-90 mt-1">{t.status}</p>
                          {t.customer_name && (
                            <p className="text-[9px] truncate font-bold mt-1.5 opacity-95">
                              {t.customer_name}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-5 rounded-3xl border border-dashed border-primary bg-primary/5 flex justify-between items-center text-xs font-semibold">
                  <div className="space-y-1">
                    <p className="font-black text-brand-text">Floor Tables Uninitialized</p>
                    <p className="text-gray-400">Tables list is currently empty. Please navigate to the QR Code Manager to initialize or add tables.</p>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ----------------------------------------------------
              VIEW 3: KITCHEN MONITORING
              ---------------------------------------------------- */}
          {activeTab === 'kitchen' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Active Cooking Queue</h3>
                  <p className="text-[10px] text-gray-400">View live kitchen delay alerts and optimize chef workloads.</p>
                </div>
                <button
                  onClick={runAIKitchenAdvisor}
                  className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={14} className="text-secondary animate-pulse" />
                  <span>Run AI Workload Advisor</span>
                </button>
              </div>

              {/* Chef workloads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
                <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <h4 className="font-extrabold text-xs mb-3">Kitchen Staff Assignments</h4>
                  <div className="space-y-3">
                    {staff.filter(s => s.role === 'Chef').map(chef => (
                      <div key={chef.id} className="flex justify-between items-center border-b pb-2">
                        <div>
                          <p className="font-bold">{chef.name}</p>
                          <p className="text-[9px] text-gray-400">Prep Station • {chef.shift} Shift</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold text-[9px]">{chef.performance.ordersDelivered} Orders</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <h4 className="font-extrabold text-xs mb-3">Cooking Times Metrics</h4>
                  <div className="space-y-2.5">
                    <div className="flex justify-between">
                      <span>Avg prep time (today)</span>
                      <strong className="text-primary font-extrabold">14.2 Mins</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Ready dishes queue</span>
                      <strong>{orders.filter(o => o.status === 'Ready to Serve').length} dishes</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 4: MENU CATALOG
              ---------------------------------------------------- */}
          {activeTab === 'menu' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Dishes Menu Catalog</h3>
                  <p className="text-[10px] text-gray-400">Configure prices, categories, and availability.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingMenuItem(null);
                    setMenuFormState({
                      name: '',
                      price: 180,
                      category: 'Main Course',
                      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
                      description: '',
                      calories: 320,
                      prepTime: '15 mins',
                      isVeg: true,
                      isSpecial: false
                    });
                    setNewMenuItemForm(true);
                  }}
                  className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Menu Item</span>
                </button>
              </div>

              {/* Form Modal */}
              {newMenuItemForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h4 className="font-extrabold text-sm">{editingMenuItem ? 'Edit Menu Item' : 'Create Menu Item'}</h4>
                      <button onClick={() => setNewMenuItemForm(false)}><X size={18} /></button>
                    </div>
                    <form onSubmit={handleSaveMenuItem} className="space-y-4 text-xs font-semibold">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">Dish Name</label>
                          <input
                            type="text"
                            value={menuFormState.name}
                            onChange={(e) => setMenuFormState({...menuFormState, name: e.target.value})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Price (₹)</label>
                          <input
                            type="number"
                            value={menuFormState.price}
                            onChange={(e) => setMenuFormState({...menuFormState, price: parseInt(e.target.value)})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">Category</label>
                          <select
                            value={menuFormState.category}
                            onChange={(e) => setMenuFormState({...menuFormState, category: e.target.value as MenuItem['category']})}
                            className="w-full p-2.5 border rounded-xl"
                          >
                            <option>Breakfast</option>
                            <option>Main Course</option>
                            <option>Beverages</option>
                            <option>Desserts</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Description</label>
                          <textarea
                            value={menuFormState.description}
                            onChange={(e) => setMenuFormState({...menuFormState, description: e.target.value})}
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={menuFormState.isVeg} onChange={(e) => setMenuFormState({...menuFormState, isVeg: e.target.checked})} />
                          <span>Veg Dish</span>
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={menuFormState.isSpecial} onChange={(e) => setMenuFormState({...menuFormState, isSpecial: e.target.checked})} />
                          <span>Chef Special</span>
                        </label>
                      </div>
                      <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">Save Item</button>
                    </form>
                  </div>
                </div>
              )}

              {/* Menu Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {menuItems.map(item => (
                  <div 
                    key={item.id}
                    className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}
                  >
                    <div>
                      <img src={item.image} alt={item.name} className="w-full h-32 object-cover rounded-2xl mb-3 bg-gray-50" />
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-extrabold text-xs">{item.name}</h4>
                        <span className="font-extrabold text-primary">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                    <div className="border-t pt-3 mt-3 flex justify-between items-center text-[10px] font-bold">
                      <span className={item.isVeg ? 'text-green-500' : 'text-red-500'}>{item.isVeg ? 'Veg' : 'Non-Veg'}</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setEditingMenuItem(item);
                            setMenuFormState({
                              name: item.name,
                              price: item.price,
                              category: item.category,
                              image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
                              description: item.description || '',
                              calories: item.calories || 300,
                              prepTime: item.prepTime || '15 mins',
                              isVeg: item.isVeg,
                              isSpecial: item.isSpecial || false
                            });
                            setNewMenuItemForm(true);
                          }}
                          className="p-1.5 border rounded-lg text-gray-400 hover:bg-gray-50"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id, item.name)}
                          className="p-1.5 border rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 5: INVENTORY CONTROL
              ---------------------------------------------------- */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Inventory Management</h3>
                  <p className="text-[10px] text-gray-400">Track kitchen stocks, trigger purchases, and run AI forecasts.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddStockItem} className="bg-primary text-white font-bold py-2 px-3.5 rounded-xl text-xs cursor-pointer">Register Stock Item</button>
                  <button onClick={fetchAIInventoryDepletions} className="border border-gray-200 text-gray-500 font-bold py-2 px-3.5 rounded-xl text-xs bg-white cursor-pointer">Run AI Forecast</button>
                </div>
              </div>

              {/* Table stock listing */}
              <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className={`border-b font-extrabold text-[10px] uppercase text-gray-400 ${isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'}`}>
                      <th className="p-4">Ingredient</th>
                      <th className="p-4">Stock Level</th>
                      <th className="p-4">Threshold</th>
                      <th className="p-4">Adjust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map(item => (
                      <tr key={item.id} className="border-b font-semibold">
                        <td className="p-4 font-bold">{item.name}</td>
                        <td className="p-4">{item.stock} {item.unit}</td>
                        <td className="p-4 text-gray-400">{item.min_stock} {item.unit}</td>
                        <td className="p-4 flex gap-1.5 items-center">
                          <button onClick={() => handleUpdateStockLevel(item.id, item.name, 5)} className="bg-gray-150 px-2 py-1 rounded font-bold hover:bg-gray-200 transition-colors">+</button>
                          <button onClick={() => handleUpdateStockLevel(item.id, item.name, -5)} className="bg-gray-150 px-2 py-1 rounded font-bold hover:bg-gray-200 transition-colors">-</button>
                          <button onClick={() => handleDeleteInventoryItem(item.id, item.name)} className="bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100 transition-colors ml-2 cursor-pointer" title="Delete Item">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 6: STAFF SCORECARD
              ---------------------------------------------------- */}
          {activeTab === 'staff' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Staff Scorecard & Roster</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Manage employee accounts, Employee IDs, and passwords. Waiters can login to their mobile terminals using these details.</p>
                  
                  {/* Google Forms Integration Simulation */}
                  <div className="mt-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-blue-800">Waiter Application Link (Google Forms)</p>
                      <p className="text-[9px] text-blue-600">Share this link. Responses are automatically synced as "Pending Applicants".</p>
                    </div>
                    <button onClick={() => alert('Link Copied: https://forms.gle/dinesmart-waiter-apply')} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer">
                      Copy Link
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffFormState({
                      name: '',
                      mobile: '',
                      role: 'Waiter',
                      shift: 'Morning',
                      salary: 18000,
                      empid: '',
                      password: ''
                    });
                    setNewStaffForm(true);
                  }}
                  className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer mt-1"
                >
                  <Plus size={14} />
                  <span>Register Employee</span>
                </button>
              </div>

              {/* Staff Form Drawer */}
              {newStaffForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h4 className="font-extrabold text-sm">{editingStaff ? 'Edit Staff Member' : 'Register Staff Member'}</h4>
                      <button onClick={() => setNewStaffForm(false)}><X size={18} /></button>
                    </div>
                    <form onSubmit={handleSaveStaffMember} className="space-y-4 text-xs font-semibold text-black">
                      <div>
                        <label className="block text-gray-400 mb-1 text-[10px] uppercase">Full Name</label>
                        <input
                          type="text"
                          value={staffFormState.name}
                          onChange={(e) => setStaffFormState({...staffFormState, name: e.target.value})}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-gray-400 mb-1 text-[10px] uppercase">Employee ID (EmpID)</label>
                          <input
                            type="text"
                            value={staffFormState.empid}
                            onChange={(e) => setStaffFormState({...staffFormState, empid: e.target.value})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1 text-[10px] uppercase">Password</label>
                          <input
                            type="password"
                            value={staffFormState.password}
                            onChange={(e) => setStaffFormState({...staffFormState, password: e.target.value})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-gray-400 mb-1 text-[10px] uppercase">Role</label>
                          <select
                            value={staffFormState.role}
                            onChange={(e) => setStaffFormState({...staffFormState, role: e.target.value as Employee['role']})}
                            className="w-full p-2.5 border rounded-xl"
                          >
                            <option>Waiter</option>
                            <option>Chef</option>
                            <option>Manager</option>
                            <option>Cashier</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1 text-[10px] uppercase">Monthly Salary</label>
                          <input
                            type="number"
                            value={staffFormState.salary}
                            onChange={(e) => setStaffFormState({...staffFormState, salary: parseInt(e.target.value)})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">
                        {editingStaff ? 'Save Changes' : 'Register Account'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* OTP Modal */}
              {otpModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h4 className="font-extrabold text-sm">Security Verification</h4>
                      <button onClick={() => { setOtpModal(false); setPendingEditStaff(null); }}><X size={18} /></button>
                    </div>
                    <div className="space-y-4 text-xs font-semibold text-black">
                      <p className="text-[10px] text-gray-500">To edit staff credentials, please enter the Admin OTP.</p>
                      <div>
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="Enter OTP (e.g., 1234)"
                          required
                          className="w-full p-2.5 border rounded-xl text-center text-lg tracking-widest"
                        />
                      </div>
                      <button onClick={handleVerifyOTP} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl cursor-pointer">Verify & Edit</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Roster list: Pending vs Active */}
              <div className="space-y-6">
                {staff.filter(emp => !emp.password).length > 0 && (
                  <div>
                    <h4 className="font-bold text-xs mb-3 text-orange-600 flex items-center gap-1.5"><AlertTriangle size={14} /> Pending Applicants</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
                      {staff.filter(emp => !emp.password).map(emp => (
                        <div key={emp.id} className={`p-4 rounded-3xl border border-orange-200 shadow-sm bg-orange-50/30 flex flex-col justify-between`}>
                          <div>
                            <div className="flex justify-between border-b pb-2 mb-3">
                              <div>
                                <h4 className="font-extrabold text-sm">{emp.name}</h4>
                                <span className="text-[9px] text-gray-500 font-bold uppercase">{emp.role} (Applicant)</span>
                              </div>
                            </div>
                            <p className="text-gray-500">Contact: <strong className="text-brand-text">{emp.mobile || 'N/A'}</strong></p>
                          </div>
                          <div className="border-t pt-3 mt-3 flex justify-end">
                            <button
                              onClick={() => {
                                setEditingStaff(emp);
                                setStaffFormState({
                                  name: emp.name,
                                  mobile: emp.mobile || '',
                                  role: emp.role,
                                  shift: emp.shift,
                                  salary: emp.salary,
                                  empid: `EMP${Math.floor(Math.random()*9000)+1000}`,
                                  password: ''
                                });
                                setNewStaffForm(true);
                              }}
                              className="bg-primary text-white px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                            >
                              Create Credentials
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-bold text-xs mb-3 flex items-center gap-1.5"><UserCheck size={14} /> Active Staff</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
                    {staff.filter(emp => !!emp.password).map(emp => (
                      <div key={emp.id} className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                        <div>
                          <div className="flex justify-between border-b pb-2 mb-3">
                            <div>
                              <h4 className="font-extrabold text-sm">{emp.name}</h4>
                              <span className="text-[9px] text-gray-400 font-bold uppercase">{emp.role} • EmpID: {emp.empid}</span>
                            </div>
                            <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold">Shift: {emp.shift}</span>
                          </div>
                          <p className="text-gray-400">Salary: <strong className="text-brand-text">{formatPrice(emp.salary)}</strong></p>
                        </div>
                        <div className="border-t pt-3 mt-3 flex justify-between items-center text-[10px]">
                          <span>Ratings: ★ {emp.performance.ratings}</span>
                          {role === 'Hotel Manager' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setPendingEditStaff(emp);
                                  setOtpModal(true);
                                }}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStaffMember(emp.id, emp.name)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 7: TABLE LAYOUT
              ---------------------------------------------------- */}
          {activeTab === 'tables' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">Restaurant Floor Layout</h3>
                <p className="text-[10px] text-gray-400">Organize table capacities, change table statuses, or check layout blocks.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs font-semibold">
                {tables.map(t => (
                  <div 
                    key={t.id}
                    className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between min-h-[120px] ${
                      t.status === 'Available' ? 'border-green-100 bg-green-50/20' : 
                      t.status === 'Reserved' ? 'border-red-100 bg-red-50/20' : 'border-orange-100 bg-orange-50/20'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-extrabold">{t.name}</h4>
                        <span className="text-[9px] text-gray-400">Capacity: {t.capacity}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-primary">{t.status}</span>
                    </div>

                    <div className="flex gap-1.5 border-t pt-3 mt-3">
                      <button
                        onClick={() => {
                          const guest = prompt("Enter guest name for reservation:");
                          if (guest) handleReserveTable(t.id, guest);
                        }}
                        className="flex-grow bg-primary text-white py-1.5 rounded-xl text-[9px] font-bold cursor-pointer"
                      >
                        Reserve
                      </button>
                      <button
                        onClick={() => handleBlockTable(t.id)}
                        className="flex-grow border border-gray-200 text-gray-500 py-1.5 rounded-xl text-[9px] font-bold bg-white cursor-pointer"
                      >
                        Block
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 8: BILLING & PAYMENTS
              ---------------------------------------------------- */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">Settled Invoices & Billing Terminal</h3>
                <p className="text-[10px] text-gray-400">Generate GST Compliant invoices, PDF reports, and settle table payments.</p>
              </div>

              <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                <h4 className="font-extrabold text-xs mb-3">Pending Settlement Invoices</h4>
                <div className="space-y-3">
                  {orders.filter(o => o.paymentStatus === 'Pending').length > 0 ? (
                    orders.filter(o => o.paymentStatus === 'Pending').map(order => (
                      <div key={order.id} className="flex justify-between items-center border-b pb-2.5 text-xs font-semibold">
                        <div>
                          <p className="font-bold">Order #{order.id} (Table {order.tableId})</p>
                          <p className="text-[10px] text-gray-400">Amount: {formatPrice(order.total)} • Subtotal: {formatPrice(order.subtotal)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const method = window.prompt("Choose Payment Method: Cash, UPI, Card, Wallet");
                              if (method) handlePayOrder(order.id, method);
                            }}
                            className="bg-primary text-white font-bold py-1.5 px-3 rounded-xl text-[10px] cursor-pointer"
                          >
                            Settle Payment
                          </button>
                          <button
                            onClick={() => setActiveInvoice(order)}
                            className="border border-gray-200 text-gray-500 font-bold py-1.5 px-3 rounded-xl text-[10px] bg-white flex items-center gap-1 cursor-pointer"
                          >
                            <FileText size={10} />
                            <span>Preview Invoice</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">No pending settle queue.</p>
                  )}
                </div>
              </div>

              {/* Invoice PDF generator View Drawer modal */}
              {activeInvoice && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-white text-black rounded-3xl p-6 shadow-2xl relative">
                    <button onClick={() => setActiveInvoice(null)} className="absolute right-5 top-5"><X size={18} /></button>
                    
                    {/* Invoice visualizer */}
                    <div className="text-center pb-4 mb-4 border-b border-dashed border-gray-300">
                      <h4 className="font-black text-lg">DineSmart Hotel & Resto</h4>
                      <p className="text-[10px] text-gray-500">Gachibowli Road, Hyderabad • GSTIN: {alertSettings.gstNo}</p>
                      <p className="text-xs font-bold mt-2">GST TAX INVOICE</p>
                    </div>

                    <div className="space-y-1.5 text-xs mb-4">
                      <p className="flex justify-between"><span>Invoice No:</span> <strong className="font-extrabold">INV-{activeInvoice.id}</strong></p>
                      <p className="flex justify-between"><span>Table:</span> <strong>Table {activeInvoice.tableId}</strong></p>
                      <p className="flex justify-between"><span>Date:</span> <strong>{new Date(activeInvoice.createdAt).toLocaleDateString()}</strong></p>
                    </div>

                    <div className="border-b border-dashed border-gray-300 pb-3 mb-3 text-xs space-y-2">
                      {activeInvoice.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.quantity} × {item.name}</span>
                          <strong>{formatPrice(item.price * item.quantity)}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 text-xs border-b border-dashed border-gray-300 pb-3 mb-3">
                      <p className="flex justify-between"><span>Subtotal:</span> <span>{formatPrice(activeInvoice.subtotal)}</span></p>
                      <p className="flex justify-between"><span>GST ({alertSettings.tax}%):</span> <span>{formatPrice(activeInvoice.gst)}</span></p>
                      {activeInvoice.discount > 0 && (
                        <p className="flex justify-between text-green-600"><span>Discount:</span> <span>-{formatPrice(activeInvoice.discount)}</span></p>
                      )}
                      {activeInvoice.tip > 0 && (
                        <p className="flex justify-between"><span>Tip:</span> <span>{formatPrice(activeInvoice.tip)}</span></p>
                      )}
                      <p className="flex justify-between font-black text-sm border-t pt-1.5">
                        <span>Grand Total:</span>
                        <span>{formatPrice(activeInvoice.total)}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        alert('Invoice Downloaded.');
                        setActiveInvoice(null);
                      }}
                      className="w-full bg-brand-text hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download PDF Bill</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 9: LOYALTY PROGRAMS
              ---------------------------------------------------- */}
          {activeTab === 'loyalty' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Loyalty Rules & points</h3>
                  <p className="text-[10px] text-gray-400">Establish reward conversion rules and adjust loyalty points.</p>
                </div>
                <button
                  onClick={() => setEditLoyaltyModal(true)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Edit3 size={14} /> Edit Rules
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
                <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <h4 className="font-extrabold text-xs mb-3">Loyalty Conversion Rules</h4>
                  <div className="space-y-2">
                    <p className="flex justify-between"><span>Standard Rule:</span> <strong className="text-primary font-black">₹100 = {loyaltyRules.pointsPerHundred} Points</strong></p>
                    <p className="flex justify-between"><span>Silver Rewards:</span> <strong>{loyaltyRules.silverTierPoints} Points (Tier Upgrade)</strong></p>
                    <p className="flex justify-between"><span>Gold Rewards:</span> <strong>{loyaltyRules.goldTierPoints} Points ({loyaltyRules.goldDiscountPercent}% Discount)</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 10: PROMOTIONS BUILDER
              ---------------------------------------------------- */}
          {activeTab === 'promotions' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Active promotions & Coupons</h3>
                  <p className="text-[10px] text-gray-400">Create discount coupon codes for customer checkout overlays.</p>
                </div>
                <button
                  onClick={() => setNewPromotionModal(true)}
                  className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Create Campaign Coupon</span>
                </button>
              </div>

              {/* Modal form */}
              {newPromotionModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h4 className="font-extrabold text-sm">New Promotion Coupon</h4>
                      <button onClick={() => setNewPromotionModal(false)}><X size={18} /></button>
                    </div>
                    <form onSubmit={handleCreateCouponCode} className="space-y-4 text-xs font-semibold">
                      <div>
                        <label className="block text-gray-400 mb-1">Coupon Code (e.g. WELCOME20)</label>
                        <input
                          type="text"
                          value={couponFormState.code}
                          onChange={(e) => setCouponFormState({...couponFormState, code: e.target.value})}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1">Discount Amount (₹)</label>
                        <input
                          type="number"
                          value={couponFormState.discount}
                          onChange={(e) => setCouponFormState({...couponFormState, discount: parseInt(e.target.value)})}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1">Min Bill Target (₹)</label>
                        <input
                          type="number"
                          value={couponFormState.minBill}
                          onChange={(e) => setCouponFormState({...couponFormState, minBill: parseInt(e.target.value)})}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">Publish Coupon</button>
                    </form>
                  </div>
                </div>
              )}

              {/* Coupon list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {coupons.map(cp => (
                  <div 
                    key={cp.id}
                    className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}
                  >
                    <div>
                      <h4 className="font-black text-sm text-primary">{cp.code}</h4>
                      <p className="text-xs mt-1.5">Discount: <strong className="text-brand-text font-black">₹{cp.discount} Off</strong></p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Min Order value: ₹{cp.min_bill}</p>
                    </div>
                    <div className="border-t pt-3 mt-3 flex justify-between items-center text-[10px] font-bold">
                      <span className="text-green-500">● Active Campaign</span>
                      <button
                        onClick={() => handleDeletePromotion(cp.id, cp.code)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 12: GROQ AI ANALYTICS DASHBOARD
              ---------------------------------------------------- */}
          {activeTab === 'ai_analytics' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Groq AI Analytics Engine</h3>
                  <p className="text-[10px] text-gray-400">Leverages mixtral/llama models to compute sales growth, inventory depletion times, and optimal pricing.</p>
                </div>
                <button
                  onClick={loadAllGroqAI}
                  className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>Refresh AI Metrics</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. SALES INSIGHTS */}
                <div className={`p-5 rounded-3xl border shadow-sm relative overflow-hidden ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5 mb-3.5">
                    <Sparkles size={14} fill="currentColor" />
                    AI Sales Predictions
                  </h4>
                  {aiSalesPred ? (
                    <div className="space-y-3.5 text-xs font-semibold">
                      <p className="flex justify-between"><span>Projected Today's Revenue:</span> <strong className="text-brand-text font-black text-sm">{formatPrice(aiSalesPred.todayRevenuePred)}</strong></p>
                      <p className="flex justify-between"><span>Weekend Sales Projection:</span> <strong>{formatPrice(aiSalesPred.weekendSalesPred)}</strong></p>
                      <p className="flex justify-between"><span>Projected Monthly Growth:</span> <span className="text-green-500 font-black">+{aiSalesPred.monthlyGrowthPred}%</span></p>
                      <p className="text-[10px] text-gray-400 italic leading-relaxed border-t pt-2.5 font-medium">{aiSalesPred.explanation}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-6 text-center font-medium">Click Refresh to run Groq calculations.</p>
                  )}
                </div>

                {/* 2. BUSINESS STRATEGY */}
                <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5 mb-3.5">
                    <TrendingUp size={14} />
                    AI Pricing & Strategy Suggestions
                  </h4>
                  {aiBusinessSuggestions ? (
                    <div className="space-y-3">
                      {aiBusinessSuggestions.map((item, idx) => (
                        <div key={idx} className="border-b pb-2.5 last:border-0 last:pb-0 text-xs font-semibold">
                          <div className="flex justify-between items-center mb-1">
                            <h5 className="font-black">{item.title}</h5>
                            <span className="text-green-500 font-bold">{item.estimatedProfitIncrease}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 leading-relaxed font-medium">{item.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-6 text-center font-medium">Click Refresh to run Groq calculations.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 13: REPORTS & ANALYTICS
              ---------------------------------------------------- */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Reports & Export Terminal</h3>
                  <p className="text-[10px] text-gray-400">Generate sales CSV/Excel, cancel rate breakdowns, and review weekly reports.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => alert('Exporting orders database to Excel...')} className="border border-gray-200 text-gray-500 font-bold py-2 px-3.5 rounded-xl text-xs bg-white cursor-pointer">Excel</button>
                  <button onClick={() => alert('Exporting invoice report to PDF...')} className="border border-gray-200 text-gray-500 font-bold py-2 px-3.5 rounded-xl text-xs bg-white cursor-pointer">PDF</button>
                </div>
              </div>

              {/* Custom SVG Sales Chart */}
              <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                <h4 className="font-extrabold text-xs mb-4">Weekly Sales Volume Chart</h4>
                <div className="w-full h-48 bg-gray-50/50 rounded-2xl flex items-end justify-between p-4 relative">
                  <div className="absolute inset-x-0 top-1/4 border-b border-gray-200/50 pointer-events-none"></div>
                  <div className="absolute inset-x-0 top-2/4 border-b border-gray-200/50 pointer-events-none"></div>
                  <div className="absolute inset-x-0 top-3/4 border-b border-gray-200/50 pointer-events-none"></div>
                  <div className="flex flex-col items-center gap-2 z-10 w-1/7">
                    <span className="text-[9px] font-bold text-gray-400">₹8K</span>
                    <div className="w-6 bg-primary/20 rounded-t-lg h-24"></div>
                    <span className="text-[10px] font-bold text-gray-500">Mon</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 z-10 w-1/7">
                    <span className="text-[9px] font-bold text-gray-400">₹12K</span>
                    <div className="w-6 bg-primary/45 rounded-t-lg h-32"></div>
                    <span className="text-[10px] font-bold text-gray-500">Tue</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 z-10 w-1/7 flex-1 text-center">
                    <p className="text-[10px] text-gray-400 font-semibold italic mt-12">Interactive SVG Chart visualization</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 14: NOTIFICATION CENTER
              ---------------------------------------------------- */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">System Alert notifications Pane</h3>
                <p className="text-[10px] text-gray-400">Renders live stock warnings, delayed orders, and client service alarms.</p>
              </div>

              <div className="space-y-3">
                {notifications.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-3xl border flex gap-3.5 items-start ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                    <AlertTriangle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-xs">{item.title}</h4>
                      <p className="text-xs text-gray-400 mt-1">{item.message}</p>
                      <span className="text-[9px] text-gray-500 mt-1 block">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 15: RESTAURANT SETTINGS
              ---------------------------------------------------- */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">Restaurant Configurations</h3>
                <p className="text-[10px] text-gray-400">Modify operating hours, tax metrics, invoice GST numbers, and system theme.</p>
              </div>

              <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                <form className="space-y-4 text-xs font-semibold max-w-md">
                  <div>
                    <label className="block text-gray-400 mb-1">Restaurant Name</label>
                    <input type="text" defaultValue="DineSmart Hotel & Resto" className="w-full p-2.5 border rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Tax Percentage (%)</label>
                      <input
                        type="number"
                        value={alertSettings.tax}
                        onChange={(e) => setAlertSettings({...alertSettings, tax: parseInt(e.target.value)})}
                        className="w-full p-2.5 border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">GSTIN Number</label>
                      <input
                        type="text"
                        value={alertSettings.gstNo}
                        onChange={(e) => setAlertSettings({...alertSettings, gstNo: e.target.value})}
                        className="w-full p-2.5 border rounded-xl"
                      />
                    </div>
                  </div>
                  <button type="button" onClick={() => alert('Settings Saved.')} className="bg-primary text-white font-bold py-2.5 px-5 rounded-xl cursor-pointer">Save Changes</button>
                </form>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 16: SECURITY & AUDIT LOGS
              ---------------------------------------------------- */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">Security Audit Logs</h3>
                <p className="text-[10px] text-gray-400">Renders role-based access logs and database audit records.</p>
              </div>

              <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                <h4 className="font-extrabold text-xs mb-3">Roster Audit Activity Logs</h4>
                <div className="space-y-2.5">
                  {activityLogs.map(log => (
                    <div key={log.id} className="flex justify-between items-center text-xs font-semibold border-b pb-2">
                      <div>
                        <p className="text-gray-400">{log.timestamp} • <strong className="text-brand-text font-black">{log.user_role}</strong></p>
                        <p className="mt-0.5">{log.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 17: QR CODE MANAGER
              ---------------------------------------------------- */}
          {activeTab === 'qrcodes' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Table QR Code Generator & Manager</h3>
                  <p className="text-[10px] text-gray-400">Generate secure URL sessions, manage floor tables, and replace QR codes.</p>
                </div>
                <div className="flex gap-2">
                  {tables.length === 0 && (
                    <button 
                      onClick={handleInitializeTables}
                      disabled={loading}
                      className="bg-primary text-white font-bold py-2 px-3.5 rounded-xl cursor-pointer text-xs"
                    >
                      Initialize Tables 1-12
                    </button>
                  )}
                  <button 
                    onClick={handleAddTable}
                    disabled={loading}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-3.5 rounded-xl cursor-pointer text-xs flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Table
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs font-semibold">
                {tables.map(num => {
                  const secureUrl = num.qr_token 
                    ? `http://localhost:5173/table/${num.id}?token=${num.qr_token}` 
                    : `No Token Session Configured`;
                  return (
                    <div key={num.id} className={`p-4 rounded-3xl border text-center shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                      <h4 className="font-extrabold">Table #{num.id} QR</h4>
                      <div className="w-24 h-24 bg-gray-50 rounded-2xl mx-auto my-3 flex items-center justify-center border">
                        {num.qr_token ? (
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(secureUrl)}`} 
                            alt="Table QR" 
                            className="w-20 h-20"
                          />
                        ) : (
                          <QrCode size={40} className="text-gray-400" />
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 truncate px-1">Session Token: {num.qr_token || 'None'}</p>
                      <div className="flex gap-1.5 mt-3 border-t pt-2.5">
                        <button
                          onClick={() => handleDownloadQrImage(num.id, num.qr_token || '')}
                          className="flex-grow bg-primary text-white font-bold py-1.5 rounded-xl text-[9px] cursor-pointer"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleReplaceQrToken(num.id)}
                          className="flex-grow border border-gray-200 text-gray-500 font-bold py-1.5 rounded-xl text-[9px] bg-white cursor-pointer"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => handleRemoveTable(num.id)}
                          className="bg-red-50 text-red-500 font-bold px-2 rounded-xl text-[9px] hover:bg-red-100 cursor-pointer"
                          title="Remove Table"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 19: REVIEWS & SENTIMENT ANALYSIS
              ---------------------------------------------------- */}
          {activeTab === 'reviews' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">Customer Sentiment Reviews</h3>
                <p className="text-[10px] text-gray-400">Review feedback submissions graded by Groq LLM (😄/😐/😞).</p>
              </div>

              <div className="space-y-4">
                {reviews.map(item => {
                  const sentiment = aiReviewSentiment[item.id];
                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}
                    >
                      <div className="flex justify-between items-start mb-2 text-xs">
                        <div>
                          <h4 className="font-extrabold">{item.customer_name}</h4>
                          <span className="text-[9px] text-gray-400">Order: #{item.order_id} • {item.date}</span>
                        </div>
                        <button
                          onClick={() => analyzeSentimentForReview(item.id, item.comment)}
                          className="bg-primary/10 text-primary font-bold py-1 px-2.5 rounded-xl text-[9px] flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles size={10} fill="currentColor" />
                          <span>Analyze Sentiment</span>
                        </button>
                      </div>

                      <p className="text-xs italic text-gray-500 font-semibold mb-3">"{item.comment}"</p>

                      {sentiment && (
                        <div className="bg-gray-50/50 p-3 rounded-2xl border text-[11px] font-semibold mb-3 flex gap-2">
                          <span className="text-base">{sentiment.emoji}</span>
                          <div>
                            <p>Sentiment: <strong className="text-brand-text">{sentiment.sentiment}</strong></p>
                            <p className="text-gray-400 mt-0.5 text-[10px]">{sentiment.aiSummary}</p>
                          </div>
                        </div>
                      )}

                      {/* Reply drawer */}
                      {item.reply ? (
                        <div className="bg-orange-50/20 p-2.5 rounded-2xl border border-orange-100 text-[10px] font-semibold flex gap-2">
                          <CornerDownRight size={14} className="text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-primary font-black uppercase text-[9px]">Reply:</span>
                            <p className="mt-0.5 italic">"{item.reply}"</p>
                          </div>
                        </div>
                      ) : (
                        replyReviewId === item.id ? (
                          <div className="mt-2.5 flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="flex-grow text-xs border rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary bg-white text-black"
                              placeholder="Write reply comment..."
                            />
                            <button onClick={() => handleReplyReviewSubmit(item.id)} className="bg-primary text-white text-xs font-bold px-4 rounded-xl cursor-pointer">Send</button>
                            <button onClick={() => setReplyReviewId(null)} className="border text-gray-500 text-xs px-3 rounded-xl bg-white cursor-pointer">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyReviewId(item.id)}
                            className="text-[9px] text-primary font-black uppercase tracking-wider flex items-center gap-1.5"
                          >
                            <CornerDownRight size={11} />
                            <span>Reply to review</span>
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* SPLIT BILL DRAWER DIALOG OVERLAY */}
      {splitBillModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white text-brand-text rounded-3xl p-6 shadow-2xl text-center">
            <h4 className="font-extrabold text-sm mb-2">Split Bill: Order #{splitBillModal.id}</h4>
            <p className="text-xs text-gray-400 mb-4">Total Bill Amount: ₹{splitBillModal.total}</p>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map(ways => (
                <button
                  key={ways}
                  onClick={() => handleSplitBill(splitBillModal, ways)}
                  className="bg-primary/5 hover:bg-primary text-primary hover:text-white font-extrabold py-3 rounded-2xl text-xs transition-colors border border-primary/20"
                >
                  {ways} Parts
                </button>
              ))}
            </div>
            <button
              onClick={() => setSplitBillModal(null)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-2.5 rounded-xl text-xs mt-4 cursor-pointer"
            >
              Cancel Split
            </button>
          </div>
        </div>
      )}

      {/* NEW STOCK MODAL OVERLAY */}
      {newStockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h4 className="font-extrabold text-sm">Register New Stock</h4>
              <button onClick={() => setNewStockModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitNewStockItem} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-400 mb-1">Ingredient Name</label>
                <input
                  type="text"
                  value={stockFormState.name}
                  onChange={(e) => setStockFormState({...stockFormState, name: e.target.value})}
                  required
                  className="w-full p-2.5 border rounded-xl"
                  placeholder="e.g. Tomato, Rice"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    value={stockFormState.stock}
                    onChange={(e) => setStockFormState({...stockFormState, stock: parseFloat(e.target.value) || 0})}
                    required
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Low Alert At</label>
                  <input
                    type="number"
                    step="0.01"
                    value={stockFormState.minStock}
                    onChange={(e) => setStockFormState({...stockFormState, minStock: parseFloat(e.target.value) || 0})}
                    required
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Measurement Unit</label>
                <input
                  type="text"
                  value={stockFormState.unit}
                  onChange={(e) => setStockFormState({...stockFormState, unit: e.target.value})}
                  required
                  className="w-full p-2.5 border rounded-xl"
                  placeholder="e.g. Kg, Liters, Units"
                />
              </div>
              <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">Register Stock Item</button>
            </form>
          </div>
        </div>
      )}

      {editLoyaltyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl p-6 ${isDarkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-extrabold">Edit Loyalty Rules</h3>
              <button onClick={() => setEditLoyaltyModal(false)} className="text-gray-400 hover:text-red-500 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveLoyaltyRules} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 mb-1">Points per ₹100 spent</label>
                <input 
                  type="number" 
                  value={loyaltyRules.pointsPerHundred} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, pointsPerHundred: Number(e.target.value)})}
                  className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Silver Tier Threshold (Points)</label>
                <input 
                  type="number" 
                  value={loyaltyRules.silverTierPoints} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, silverTierPoints: Number(e.target.value)})}
                  className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Gold Tier Threshold (Points)</label>
                <input 
                  type="number" 
                  value={loyaltyRules.goldTierPoints} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, goldTierPoints: Number(e.target.value)})}
                  className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Gold Tier Discount (%)</label>
                <input 
                  type="number" 
                  value={loyaltyRules.goldDiscountPercent} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, goldDiscountPercent: Number(e.target.value)})}
                  className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                  required
                />
              </div>
              <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">Save Rules</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default AdminDashboard;
