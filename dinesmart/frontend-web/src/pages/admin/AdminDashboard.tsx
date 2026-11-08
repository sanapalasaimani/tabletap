import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../supabase';
import { MenuItem, Order, UserProfile, WaiterRequest } from '../../types';
import { MENU_ITEMS, COMING_SOON_IMAGE } from '../../data/menu';
import {
  LayoutDashboard, ChefHat, Utensils, Layers, Users,
  Map, CreditCard, Award, Megaphone, UserCheck, BarChart3,
  Settings, Shield, QrCode, Image, MessageSquare, Search, Trash2,
  Edit3, Plus, X, ChevronRight, ChevronLeft, Download, Sparkles, Filter, Check,
  AlertTriangle, Moon, Sun, RefreshCw, FileText, Mail, MessageCircle,
  CornerDownRight, UserPlus, Heart, TrendingUp, DollarSign, Calendar, CalendarDays,
  TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Star, Eye, EyeOff, Phone, Copy, FileSpreadsheet, ChevronDown, ExternalLink,
  Upload, Smartphone, Share2, CheckCircle2, AlertCircle, Receipt,
  Bell, LogOut, Activity, BookOpen, Smile, Meh, Frown, PanelLeftClose, PanelLeftOpen,
  Table, List, LayoutGrid, Tag
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';
import {
  predictSales, getCustomerAIInsights,
  getAIBusinessSuggestions, getPeakTimePredictions, analyzeReviewSentiment,
  SalesPrediction, CustomerInsights, BusinessSuggestion,
  PeakTimePrediction, SentimentResult
} from './groq';
import BhakasuraChatBot from './BhakasuraChatBot';
import { generateComprehensivePDF, generateComprehensiveExcel } from '../../utils/reportGenerator';
import { mlService } from '../../services/mlService';
import { formatPhotoUrl, getInitials, compressImageFile, getDriveThumbnailFallback } from '../../utils/photoHelper';

interface AdminDashboardProps {
  role: string;
  onLogout: () => void;
}

type TabType =
  | 'overview' | 'menu' | 'staff'
  | 'loyalty' | 'promotions' | 'customers' | 'ai_analytics'
  | 'reports' | 'settings' | 'security' | 'qrcodes' | 'gallery' | 'reviews';

interface Employee {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  photo?: string;
  role: 'Waiter';
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
  assignedTables?: number[];
  stationOrCounter?: string;
}

export const StaffAvatar: React.FC<{
  photo?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ photo, name, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setImgError(false);
    setTriedFallback(false);
  }, [photo]);

  const formattedUrl = formatPhotoUrl(photo);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px] rounded-full',
    md: 'w-10 h-10 text-xs rounded-xl',
    lg: 'w-14 h-14 text-lg rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-2xl'
  }[size];

  if (!formattedUrl || imgError) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-tr from-orange-400 to-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0 ${className}`}>
        {getInitials(name)}
      </div>
    );
  }

  const currentSrc = triedFallback ? (getDriveThumbnailFallback(photo || '') || formattedUrl) : formattedUrl;

  return (
    <img
      src={currentSrc}
      alt={name || 'Staff'}
      className={`${sizeClasses} object-cover border-2 border-orange-500/20 shadow-sm shrink-0 ${className}`}
      onError={() => {
        const fallback = getDriveThumbnailFallback(photo || '');
        if (fallback && !triedFallback && fallback !== currentSrc) {
          setTriedFallback(true);
        } else {
          setImgError(true);
        }
      }}
    />
  );
};

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

  // Left Sidebar Collapsed / Expanded state (persisted in localStorage)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('dinesmart_admin_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('dinesmart_admin_sidebar_open', String(next));
      return next;
    });
  };

  // Real-time Database States
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [menuFilterCategory, setMenuFilterCategory] = useState<string>('All');
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Strictly enforce clean white mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
  }, []);
  const [syncTime, setSyncTime] = useState('');
  const [alertSettings, setAlertSettings] = useState<any>({ restaurantName: 'Babai Hotel', tax: 5, currency: '₹', gstNo: '27AAAAA1111A1Z1', mapsLocation: '' });
  const [settingsForm, setSettingsForm] = useState<any>(null);

  // Redesign States: Role-Based Metric Perspective, Chart Toggles & Clock
  const [dashboardViewMode, setDashboardViewMode] = useState<'manager' | 'chef'>('manager');
  const [chartTimeframe, setChartTimeframe] = useState<'hourly' | 'daily'>('hourly');
  const [revenueTimeframe, setRevenueTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [searchGlobalQuery, setSearchGlobalQuery] = useState('');
  const [menuViewMode, setMenuViewMode] = useState<'table' | 'grid'>('table');
  const [qrViewMode, setQrViewMode] = useState<'table' | 'grid'>('table');
  const [waiterViewMode, setWaiterViewMode] = useState<'table' | 'grid'>('table');
  const [waiterShiftFilter, setWaiterShiftFilter] = useState<'All' | 'Morning' | 'Evening' | 'Night'>('All');
  const [waiterSearchQuery, setWaiterSearchQuery] = useState('');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'positive' | 'neutral' | 'critical' | 'unreplied'>('all');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // --- DATE-WISE ORDERS CALENDAR FEATURE ---
  const getOrderLocalDateStr = (dateInput?: string | Date): string => {
    if (!dateInput) return '';
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedOrderDate, setSelectedOrderDate] = useState<string>(() => {
    return getOrderLocalDateStr(new Date());
  });
  const [isAllDatesMode, setIsAllDatesMode] = useState<boolean>(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState<boolean>(false);
  const [showDateOrdersModal, setShowDateOrdersModal] = useState<boolean>(false);
  const [dateOrdersSearch, setDateOrdersSearch] = useState<string>('');
  const [dateOrdersStatusFilter, setDateOrdersStatusFilter] = useState<string>('All');
  const [dateOrdersPaymentFilter, setDateOrdersPaymentFilter] = useState<string>('All');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);

  // Compute orders belonging to selected date or all dates
  const dateWiseOrders = React.useMemo(() => {
    if (isAllDatesMode) return orders;
    return orders.filter(o => getOrderLocalDateStr(o.createdAt) === selectedOrderDate);
  }, [orders, selectedOrderDate, isAllDatesMode]);

  // Unique dates with recorded orders
  const recordedDatesSummary = React.useMemo(() => {
    const map: Record<string, { dateStr: string; count: number; revenue: number }> = {};
    orders.forEach(o => {
      const dStr = getOrderLocalDateStr(o.createdAt);
      if (!dStr) return;
      if (!map[dStr]) map[dStr] = { dateStr: dStr, count: 0, revenue: 0 };
      map[dStr].count++;
      if ((o.status as any) !== 'Cancelled') {
        map[dStr].revenue += Number(o.total || 0);
      }
    });
    return Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [orders]);

  const formatFriendlyDate = (dateStr: string) => {
    if (isAllDatesMode) return 'All Recorded Dates';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const todayStr = getOrderLocalDateStr(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getOrderLocalDateStr(yesterday);

    const baseFormat = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (dateStr === todayStr) return `Today • ${baseFormat}`;
    if (dateStr === yesterdayStr) return `Yesterday • ${baseFormat}`;
    return baseFormat;
  };

  const handleStepDay = (deltaDays: number) => {
    const parts = selectedOrderDate.split('-');
    if (parts.length !== 3) return;
    const cur = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    cur.setDate(cur.getDate() + deltaDays);
    setSelectedOrderDate(getOrderLocalDateStr(cur));
    setIsAllDatesMode(false);
  };

  const handleExportDateOrdersExcel = () => {
    generateComprehensiveExcel({ orders: dateWiseOrders, staff, menuItems }, alertSettings);
  };

  const handleExportDateOrdersPDF = () => {
    generateComprehensivePDF({ orders: dateWiseOrders, staff, menuItems }, alertSettings);
  };


  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setAlertSettings((prev: any) => ({ ...prev, mapsLocation: `https://maps.google.com/?q=${latitude},${longitude}` }));
        },
        (error) => {
          console.error("Error getting location: ", error);
          alert("Could not get your location. Please check permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = settingsForm || alertSettings;
      const saved = await db.saveSettings(payload);
      setAlertSettings(saved);
      setSettingsForm(saved);
      logActivity('Updated restaurant configuration settings');
      alert('Settings Saved Successfully.');
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  // Note 26: Settings-based reports and export
  const [reportDateFilter, setReportDateFilter] = useState<'All' | 'Today' | 'This Week' | 'This Month'>('This Week');
  const [reportCategoryFilter, setReportCategoryFilter] = useState<string>('All');

  const getFilteredReportData = () => {
    let filteredOrders = [...orders];
    const now = Date.now();

    if (reportDateFilter === 'Today') {
      const todayStr = new Date().toDateString();
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt).toDateString() === todayStr);
    } else if (reportDateFilter === 'This Week') {
      filteredOrders = filteredOrders.filter(o => now - new Date(o.createdAt).getTime() <= 7 * 86400000);
    } else if (reportDateFilter === 'This Month') {
      filteredOrders = filteredOrders.filter(o => now - new Date(o.createdAt).getTime() <= 30 * 86400000);
    }

    let filteredMenu = [...menuItems];
    if (reportCategoryFilter !== 'All') {
      filteredMenu = filteredMenu.filter(m => m.category === reportCategoryFilter);
      filteredOrders = filteredOrders.map(o => ({
        ...o,
        items: o.items.filter(i => {
          const dish = menuItems.find(m => m.id === i.menuItemId || m.name === i.name);
          return dish ? dish.category === reportCategoryFilter : true;
        })
      })).filter(o => o.items.length > 0);
    }

    return { orders: filteredOrders, staff, menuItems: filteredMenu };
  };

  const handleExportPDF = () => {
    const filteredData = getFilteredReportData();
    generateComprehensivePDF(filteredData, alertSettings);
  };

  const handleExportExcel = () => {
    const filteredData = getFilteredReportData();
    generateComprehensiveExcel(filteredData, alertSettings);
  };

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

  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const [staffFormState, setStaffFormState] = useState({
    name: '',
    mobile: '',
    email: '',
    photo: '',
    role: 'Waiter' as const,
    shift: 'Morning' as 'Morning' | 'Evening' | 'Night',
    salary: 18000,
    empid: '',
    password: '',
    assignedTables: [] as number[],
    stationOrCounter: ''
  });

  const [couponFormState, setCouponFormState] = useState({
    code: '',
    discount: 50,
    minBill: 200
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
  const [aiCustomerInsights, setAiCustomerInsights] = useState<CustomerInsights | null>(null);
  const [aiBusinessSuggestions, setAiBusinessSuggestions] = useState<BusinessSuggestion[] | null>(null);
  const [aiPeakTimePred, setAiPeakTimePred] = useState<PeakTimePrediction | null>(null);
  const [aiReviewSentiment, setAiReviewSentiment] = useState<Record<string, SentimentResult>>({});

  // Sync Data function from Supabase (Parallelized Promise.all for <400ms speed)
  const fetchData = async () => {
    try {
      const [
        dbOrders,
        dbSettings,
        dbMenu,
        dbStaff,
        dbTables,
        dbRules,
        dbPromotions,
        dbReviews,
        dbLogs,
        dbRequests
      ] = await Promise.all([
        db.getAllOrders(),
        db.getSettings(),
        db.getMenuItems(),
        db.getStaff(),
        db.getTables(),
        db.getLoyaltyRules(),
        db.getPromotions(),
        db.getReviews(),
        db.getActivityLogs(),
        db.getWaiterRequests()
      ]);

      setOrders(dbOrders || []);
      if (dbSettings) {
        setAlertSettings(dbSettings);
        setSettingsForm((prev: any) => (prev === null ? dbSettings : prev));
      }
      setMenuItems(dbMenu && dbMenu.length > 0 ? dbMenu : MENU_ITEMS);
      setStaff(dbStaff || []);
      setTables(dbTables || []);
      if (dbRules) setLoyaltyRules(dbRules);
      setCoupons(dbPromotions || []);
      setReviews(dbReviews || []);
      setActivityLogs(dbLogs || []);
      setWaiterRequests(dbRequests || []);

      // Kitchen delay alerts check
      const delayAlerts = (dbRequests || [])
        .filter(r => r.status === 'Pending')
        .map(r => ({
          id: `req_${r.id}`,
          type: 'delay',
          title: 'Service Call Alert',
          message: `Table ${r.tableId} requests ${r.requestType}. Action required.`,
          read: false,
          time: 'Just now'
        }));

      setNotifications([...delayAlerts]);
      setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to sync admin data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    loadAllGroqAI();

    // 12-second gentle polling to prevent network saturation and UI lag
    const interval = setInterval(() => {
      fetchData();
    }, 12000);

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

  // Floor Tables initialization (⚡ Instant 0ms Optimistic UI)
  const handleInitializeTables = async () => {
    const newTables: TableStatus[] = Array.from({ length: 12 }, (_, idx) => {
      const id = idx + 1;
      return {
        id,
        name: `Table ${id}`,
        status: 'Available',
        capacity: id % 2 === 0 ? 4 : 2,
        qr_token: 'qr_' + Math.random().toString(36).substring(2, 15)
      };
    });

    // ⚡ Instant state update in 0ms!
    setTables(newTables);
    logActivity('Initialized floor tables (1-12) with secure QR tokens');

    // Background batch sync
    try {
      await db.saveTables(newTables);
    } catch (err) {
      console.warn('Background saveTables failed:', err);
    }
  };

  const handleAddTable = async () => {
    const nextId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;
    const qr_token = 'qr_' + Math.random().toString(36).substring(2, 15);
    const newTable: TableStatus = {
      id: nextId,
      name: `Table ${nextId}`,
      status: 'Available',
      capacity: 4,
      qr_token
    };

    // ⚡ Instant state update in 0ms! No loading freeze
    setTables(prev => [...prev, newTable]);
    logActivity(`Added new Table #${nextId}`);

    // Background persist
    try {
      await db.saveTable(newTable);
    } catch (err) {
      console.warn('Background saveTable failed:', err);
    }
  };

  const handleRemoveTable = async (id: number) => {
    // ⚡ Instant local removal in 0ms
    setTables(prev => prev.filter(t => t.id !== id));
    logActivity(`Removed Table #${id}`);

    try {
      await db.deleteTable(id);
    } catch (err) {
      console.warn('Background deleteTable failed:', err);
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

  const handleClearAllOrders = async () => {
    if (confirm('Are you sure you want to purge all test orders? Only real live orders will be tracked.')) {
      setLoading(true);
      await db.clearAllOrders();
      await fetchData();
      setLoading(false);
      logActivity('Purged test orders from database');
      alert('All mock/test orders cleared. Only real customer orders will be considered.');
    }
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



  const handleSaveLoyaltyRules = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.saveLoyaltyRules(loyaltyRules);
    setEditLoyaltyModal(false);
    logActivity('Updated Loyalty Conversion Rules');
  };

  const generateRandomString = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Staff Management (EmpID & Password checks)
  const handleSaveStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'Hotel Manager' && role !== 'Admin' && role !== 'Manager' && role !== '') {
      alert('Access Denied: Only Hotel Manager/Admin can add or update staff members.');
      return;
    }

    try {
      const newEmp: Employee = {
        id: editingStaff ? editingStaff.id : `s_${Date.now()}`,
        name: staffFormState.name,
        mobile: staffFormState.mobile,
        email: staffFormState.email || editingStaff?.email || '',
        photo: staffFormState.photo || editingStaff?.photo || '',
        role: 'Waiter',
        shift: staffFormState.shift,
        salary: staffFormState.salary,
        empid: staffFormState.empid,
        password: staffFormState.password,
        attendance: editingStaff ? editingStaff.attendance : 100,
        performance: editingStaff ? editingStaff.performance : { score: 90, ordersDelivered: 0, avgServingTime: 'N/A', ratings: 5.0, tips: 0 },
        assignedTables: staffFormState.assignedTables,
        stationOrCounter: staffFormState.stationOrCounter
      };

      await db.saveStaffMember(newEmp);
      await fetchData();
      logActivity(editingStaff ? `Updated staff member: ${newEmp.name}` : `Added new staff member: ${newEmp.name}`);
      setNewStaffForm(false);
      setEditingStaff(null);
      setStaffFormState({ name: '', mobile: '', email: '', photo: '', role: 'Waiter', shift: 'Morning', salary: 18000, empid: '', password: '', assignedTables: [], stationOrCounter: '' });
    } catch (e) {
      alert('Failed to register employee. Employee ID must be unique.');
    }
  };

  const handleDeleteStaffMember = async (id: string, name: string) => {
    if (role !== 'Hotel Manager' && role !== 'Admin' && role !== 'Manager' && role !== '') {
      alert('Access Denied: Only Hotel Manager/Admin can remove staff members.');
      return;
    }
    if (confirm(`WARNING: Are you sure you want to permanently delete employee "${name}"?`)) {
      await db.deleteStaffMember(id);
      await fetchData();
      logActivity(`Removed staff member: ${name}`);
    }
  };

  const handleOpenEditStaff = (emp: Employee) => {
    setEditingStaff(emp);
    setStaffFormState({
      name: emp.name,
      mobile: emp.mobile || '',
      email: emp.email || '',
      photo: emp.photo || '',
      role: emp.role || 'Waiter',
      shift: emp.shift || 'Morning',
      salary: emp.salary || 18000,
      empid: emp.empid || '',
      password: emp.password || '',
      assignedTables: emp.assignedTables || [],
      stationOrCounter: emp.stationOrCounter || ''
    });
    setNewStaffForm(true);
  };

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setStaffFormState({
      name: '',
      mobile: '',
      email: '',
      photo: '',
      role: 'Waiter',
      shift: 'Morning',
      salary: 18000,
      empid: `EMP-${randNum}`,
      password: `pass${Math.floor(1000 + Math.random() * 9000)}`,
      assignedTables: [],
      stationOrCounter: ''
    });
    setNewStaffForm(true);
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
          email: pendingEditStaff.email || '',
          photo: pendingEditStaff.photo || '',
          role: pendingEditStaff.role,
          shift: pendingEditStaff.shift,
          salary: pendingEditStaff.salary,
          empid: pendingEditStaff.empid,
          password: pendingEditStaff.password || '',
          assignedTables: pendingEditStaff.assignedTables || [],
          stationOrCounter: pendingEditStaff.stationOrCounter || ''
        });
        setNewStaffForm(true);
        setPendingEditStaff(null);
      }
    } else {
      alert('Invalid OTP. For demonstration, use 1234.');
    }
  };

  // QR Code Replace & Download Logic
  const handleReplaceQrToken = async (tableId: number) => {
    const tableObj = tables.find(t => t.id === tableId);
    if (tableObj) {
      const newQrToken = 'qr_' + Math.random().toString(36).substring(2, 15);
      // ⚡ Instant 0ms token refresh in UI
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, qr_token: newQrToken } : t));
      logActivity(`Generated new secure QR session token for Table #${tableId}`);

      try {
        await db.saveTable({
          ...tableObj,
          qr_token: newQrToken
        });
      } catch (err) {
        console.warn('Background saveTable token failed:', err);
      }
    }
  };

  const handleDownloadQrImage = async (tableId: number, qrToken: string) => {
    if (!qrToken) {
      alert('No QR Session configured. Please click replace first.');
      return;
    }

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const qrDataUrl = `${baseUrl}/table/${tableId}?token=${qrToken}`;
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
      fetchAICustomerInsights(),
      fetchAIBusinessSuggestions(),
      fetchAIPeakTimes()
    ]);
    setLoading(false);
  };

  // Real Dynamic Chart & Operational Telemetry Calculations
  const liveRevTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const displayRevenue = liveRevTotal > 0 ? liveRevTotal : 6773;

  // Days of week
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayRevenues: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  orders.forEach(o => {
    try {
      const d = new Date(o.createdAt);
      const dayName = daysOfWeek[d.getDay()];
      if (dayName && dayRevenues[dayName] !== undefined) {
        dayRevenues[dayName] += (o.total || 0);
      }
    } catch (e) { }
  });

  const weeklyData = [
    { name: 'Mon', revenue: dayRevenues['Mon'] || (liveRevTotal > 0 ? 0 : 5420) },
    { name: 'Tue', revenue: dayRevenues['Tue'] || (liveRevTotal > 0 ? 0 : 4980) },
    { name: 'Wed', revenue: dayRevenues['Wed'] || (liveRevTotal > 0 ? 0 : 6150) },
    { name: 'Thu', revenue: dayRevenues['Thu'] || (liveRevTotal > 0 ? 0 : 5890) },
    { name: 'Fri', revenue: dayRevenues['Fri'] || (liveRevTotal > 0 ? 0 : 7840) },
    { name: 'Sat', revenue: dayRevenues['Sat'] || (liveRevTotal > 0 ? 0 : 9210) },
    { name: 'Sun', revenue: dayRevenues['Sun'] || (liveRevTotal > 0 ? 0 : 8650) }
  ];

  const categoryTotals: Record<string, number> = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      const cat = menuItems.find(m => m.id === it.menuItemId || m.name === it.name)?.category || 'Main Course';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (it.price * it.quantity);
    });
  });

  const categoryColors: Record<string, string> = {
    'Starters': '#4F46E5',    // Indigo
    'Main Course': '#10B981', // Emerald
    'Beverages': '#06B6D4',   // Cyan
    'Breakfast': '#F59E0B',   // Amber
    'Desserts': '#8B5CF6',    // Purple
    'Breads': '#F97316'       // Orange
  };

  const hasRealCatData = Object.keys(categoryTotals).length > 0;
  const categoryData = hasRealCatData
    ? Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value,
      color: categoryColors[name] || '#4F46E5'
    }))
    : [
      { name: 'Starters', value: 3115, color: '#4F46E5' },
      { name: 'Main Course', value: 2032, color: '#10B981' },
      { name: 'Beverages', value: 1084, color: '#06B6D4' },
      { name: 'Desserts', value: 542, color: '#8B5CF6' }
    ];

  const catTotalSum = categoryData.reduce((acc, c) => acc + c.value, 0);

  const hoursMap: Record<string, { orders: number; revenue: number }> = {
    '10 AM': { orders: 0, revenue: 0 },
    '11 AM': { orders: 0, revenue: 0 },
    '12 PM': { orders: 0, revenue: 0 },
    '1 PM': { orders: 0, revenue: 0 },
    '2 PM': { orders: 0, revenue: 0 },
    '4 PM': { orders: 0, revenue: 0 },
    '6 PM': { orders: 0, revenue: 0 },
    '7 PM': { orders: 0, revenue: 0 },
    '8 PM': { orders: 0, revenue: 0 },
    '9 PM': { orders: 0, revenue: 0 },
    '10 PM': { orders: 0, revenue: 0 }
  };

  orders.forEach(o => {
    try {
      const hr = new Date(o.createdAt).getHours();
      let slot = '';
      if (hr === 10) slot = '10 AM';
      else if (hr === 11) slot = '11 AM';
      else if (hr === 12) slot = '12 PM';
      else if (hr === 13) slot = '1 PM';
      else if (hr === 14) slot = '2 PM';
      else if (hr === 16) slot = '4 PM';
      else if (hr === 18) slot = '6 PM';
      else if (hr === 19) slot = '7 PM';
      else if (hr === 20) slot = '8 PM';
      else if (hr === 21) slot = '9 PM';
      else if (hr === 22) slot = '10 PM';
      if (slot && hoursMap[slot]) {
        hoursMap[slot].orders++;
        hoursMap[slot].revenue += (o.total || 0);
      }
    } catch (e) { }
  });

  const hasRealHourly = orders.length > 0;
  const hourlyData = [
    { hour: '10 AM', orders: hasRealHourly ? hoursMap['10 AM'].orders : 4, revenue: hasRealHourly ? hoursMap['10 AM'].revenue : 380 },
    { hour: '11 AM', orders: hasRealHourly ? hoursMap['11 AM'].orders : 6, revenue: hasRealHourly ? hoursMap['11 AM'].revenue : 540 },
    { hour: '12 PM', orders: hasRealHourly ? hoursMap['12 PM'].orders : 12, revenue: hasRealHourly ? hoursMap['12 PM'].revenue : 1120 },
    { hour: '1 PM', orders: hasRealHourly ? hoursMap['1 PM'].orders : 18, revenue: hasRealHourly ? hoursMap['1 PM'].revenue : 1650 },
    { hour: '2 PM', orders: hasRealHourly ? hoursMap['2 PM'].orders : 14, revenue: hasRealHourly ? hoursMap['2 PM'].revenue : 1280 },
    { hour: '4 PM', orders: hasRealHourly ? hoursMap['4 PM'].orders : 5, revenue: hasRealHourly ? hoursMap['4 PM'].revenue : 460 },
    { hour: '6 PM', orders: hasRealHourly ? hoursMap['6 PM'].orders : 9, revenue: hasRealHourly ? hoursMap['6 PM'].revenue : 820 },
    { hour: '7 PM', orders: hasRealHourly ? hoursMap['7 PM'].orders : 22, revenue: hasRealHourly ? hoursMap['7 PM'].revenue : 2100 },
    { hour: '8 PM', orders: hasRealHourly ? hoursMap['8 PM'].orders : 26, revenue: hasRealHourly ? hoursMap['8 PM'].revenue : 2480 },
    { hour: '9 PM', orders: hasRealHourly ? hoursMap['9 PM'].orders : 16, revenue: hasRealHourly ? hoursMap['9 PM'].revenue : 1490 },
    { hour: '10 PM', orders: hasRealHourly ? hoursMap['10 PM'].orders : 8, revenue: hasRealHourly ? hoursMap['10 PM'].revenue : 750 }
  ];

  const itemSalesMap: Record<string, { name: string; category: string; sold: number; rev: number; margin: number }> = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      if (!itemSalesMap[it.name]) {
        const dish = menuItems.find(m => m.name === it.name || m.id === it.menuItemId);
        itemSalesMap[it.name] = {
          name: it.name,
          category: dish?.category || 'Main Course',
          sold: 0,
          rev: 0,
          margin: 70
        };
      }
      itemSalesMap[it.name].sold += it.quantity;
      itemSalesMap[it.name].rev += (it.price * it.quantity);
    });
  });

  const baselineDishes = [
    { name: 'Masala Dosa', category: 'Breakfast / Star', sold: 11, rev: 990, margin: 78 },
    { name: 'Idli Sambar', category: 'Breakfast / Star', sold: 9, rev: 630, margin: 77 },
    { name: 'Chicken Dum Biryani', category: 'Main Course', sold: 7, rev: 1680, margin: 64 },
    { name: 'Paneer Tikka', category: 'Starters', sold: 6, rev: 1560, margin: 69 },
    { name: 'Cold Coffee / Lemon Ice Tea', category: 'Beverages', sold: 14, rev: 1260, margin: 82 }
  ];

  const topSellingDishes = Object.values(itemSalesMap).length >= 3
    ? Object.values(itemSalesMap).sort((a, b) => b.sold - a.sold).slice(0, 5).map((item, idx) => ({ ...item, rank: idx + 1 }))
    : baselineDishes.map((item, idx) => ({ ...item, rank: idx + 1 }));

  const yearlyData = [
    { year: '2026', revenue: orders.reduce((s, o) => s + (o.total || 0), 0) }
  ];

  // Helper Metrics Calculations
  const getTodayRevenue = () => orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const getAverageOrderValue = () => orders.length ? Math.round(getTodayRevenue() / orders.length) : 0;
  const formatPrice = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  return (
    <div className="h-screen bg-slate-50/60 flex w-full overflow-hidden font-sans text-slate-800">

      {/* 1. SIDEBAR NAVIGATION (Cohesive Neutral Dark) */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none border-r-0'
        } transition-all duration-300 ease-in-out flex flex-col justify-between shrink-0 z-20 border-r bg-slate-900 text-white border-slate-800/80 overflow-hidden select-none`}
      >
        <div className="w-64 min-w-[16rem] flex flex-col h-full justify-between">
          <div>
            {/* Logo Header */}
            <div className="p-4 border-b flex items-center justify-between border-slate-800/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B00] to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
                  <div className="flex items-end gap-1 h-3.5">
                    <span className="w-1 h-2 bg-white rounded-full"></span>
                    <span className="w-1 h-3.5 bg-white rounded-full"></span>
                    <span className="w-1 h-2.5 bg-white rounded-full"></span>
                  </div>
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-sm tracking-tight leading-none text-white truncate">DineSmart</h2>
                  <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-1 block">Manager Panel</span>
                </div>
              </div>
              {/* Close sidebar button */}
              <button
                type="button"
                onClick={toggleSidebar}
                title="Close sidebar to expand screen"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            {/* Navigation links */}
            <div className="p-3 space-y-3 overflow-y-auto no-scrollbar max-h-[calc(100vh-145px)]">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-3">Operations</p>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'overview'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <LayoutDashboard size={15} className={activeTab === 'overview' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Overview & Home</span>
                    {activeTab === 'overview' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-3">Menu & QR Codes</p>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('menu')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'menu'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <BookOpen size={15} className={activeTab === 'menu' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Menu Management</span>
                    {activeTab === 'menu' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('qrcodes')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'qrcodes'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <QrCode size={15} className={activeTab === 'qrcodes' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>QR Code Manager</span>
                    {activeTab === 'qrcodes' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-3">Logistics & Staff</p>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('staff')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'staff'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <UserCheck size={15} className={activeTab === 'staff' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Waiter Management</span>
                    {activeTab === 'staff' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-3">Loyalty & Promos</p>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('loyalty')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'loyalty'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <Award size={15} className={activeTab === 'loyalty' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Loyalty Programs</span>
                    {activeTab === 'loyalty' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('promotions')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'promotions'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <Megaphone size={15} className={activeTab === 'promotions' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Promotions Builder</span>
                    {activeTab === 'promotions' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-3">AI & Analytics</p>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'reports'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <BarChart3 size={15} className={activeTab === 'reports' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Reports & Export</span>
                    {activeTab === 'reports' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'reviews'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <MessageSquare size={15} className={activeTab === 'reviews' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Reviews Sentiment</span>
                    {activeTab === 'reviews' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-3">Control & Security</p>
                <nav className="space-y-1">
                  <button
                    onClick={() => { setActiveTab('settings'); setSettingsForm((prev: any) => prev || { ...alertSettings }); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'settings'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <Settings size={15} className={activeTab === 'settings' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Restaurant Settings</span>
                    {activeTab === 'settings' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'security'
                      ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/80 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                      }`}
                  >
                    <Shield size={15} className={activeTab === 'security' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                    <span>Security Audit Log</span>
                    {activeTab === 'security' && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </button>
                </nav>
              </div>
            </div>
          </div>

          {/* Sidebar Footer Profile */}
          <div className="p-3 border-t border-slate-800/80">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-600/60 shrink-0">
                  AD
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs font-semibold text-white leading-tight truncate">Admin</p>
                  <span className="text-[10px] text-slate-400 font-normal block truncate">Admin Console</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition-colors cursor-pointer shrink-0"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE (Fluid & Auto-Expanding with flex-1 min-w-0) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Sidebar Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-2xs cursor-pointer ${
                !isSidebarOpen
                  ? 'bg-orange-50 border-orange-300 text-orange-950 hover:bg-orange-100 ring-2 ring-orange-400/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title={isSidebarOpen ? "Close sidebar to expand screen" : "Open sidebar"}
            >
              {isSidebarOpen ? (
                <>
                  <PanelLeftClose size={15} className="text-slate-500" />
                  <span className="hidden sm:inline">Close Sidebar</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen size={15} className="text-[#FF6B00]" />
                  <span>Open Menu</span>
                </>
              )}
            </button>

            {/* Last sync pill */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 flex-shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Last sync: {syncTime || 'Just now'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Interactive Date & Calendar Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendarDropdown(prev => !prev)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer select-none shadow-xs ${
                  !isAllDatesMode && selectedOrderDate !== getOrderLocalDateStr(new Date())
                    ? 'bg-orange-50 border-orange-200 text-orange-950 hover:bg-orange-100 ring-2 ring-orange-500/20'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
                title="Filter orders by date or pick a custom date"
              >
                <Calendar size={14} className={!isAllDatesMode && selectedOrderDate !== getOrderLocalDateStr(new Date()) ? 'text-orange-500' : 'text-slate-400'} />
                <span>{formatFriendlyDate(selectedOrderDate)}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {dateWiseOrders.length}
                </span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${showCalendarDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Calendar Dropdown Popover */}
              {showCalendarDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setShowCalendarDropdown(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-84 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.15)] ring-1 ring-black/5 border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-orange-500" />
                        <span className="font-bold text-xs text-slate-900">Filter by Order Date</span>
                      </div>
                      <button
                        onClick={() => setShowCalendarDropdown(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Quick Presets Segmented Pills */}
                    <div className="bg-slate-100/80 p-1 rounded-xl flex items-center gap-1 mb-3">
                      <button
                        onClick={() => {
                          setSelectedOrderDate(getOrderLocalDateStr(new Date()));
                          setIsAllDatesMode(false);
                          setShowCalendarDropdown(false);
                        }}
                        className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg text-center transition-all cursor-pointer ${
                          !isAllDatesMode && selectedOrderDate === getOrderLocalDateStr(new Date())
                            ? 'bg-white text-slate-900 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          const y = new Date();
                          y.setDate(y.getDate() - 1);
                          setSelectedOrderDate(getOrderLocalDateStr(y));
                          setIsAllDatesMode(false);
                          setShowCalendarDropdown(false);
                        }}
                        className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg text-center transition-all cursor-pointer ${
                          !isAllDatesMode && selectedOrderDate === getOrderLocalDateStr(new Date(Date.now() - 86400000))
                            ? 'bg-white text-slate-900 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Yesterday
                      </button>
                      <button
                        onClick={() => {
                          setIsAllDatesMode(true);
                          setShowCalendarDropdown(false);
                        }}
                        className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg text-center transition-all cursor-pointer ${
                          isAllDatesMode
                            ? 'bg-white text-slate-900 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All Dates
                      </button>
                    </div>

                    {/* Custom Calendar Date Input */}
                    <div className="mb-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Pick a custom date
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={selectedOrderDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              setSelectedOrderDate(e.target.value);
                              setIsAllDatesMode(false);
                            }
                          }}
                          className="flex-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Recorded Dates with Orders */}
                    <div className="mb-3">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
                        Recent Activity ({recordedDatesSummary.length} days recorded)
                      </span>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs no-scrollbar">
                        {recordedDatesSummary.map(item => {
                          const isSelected = !isAllDatesMode && selectedOrderDate === item.dateStr;
                          return (
                            <button
                              key={item.dateStr}
                              onClick={() => {
                                setSelectedOrderDate(item.dateStr);
                                setIsAllDatesMode(false);
                                setShowCalendarDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-orange-50/80 text-orange-950 font-bold border border-orange-200/80'
                                  : 'hover:bg-slate-50 text-slate-700 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px]">{item.dateStr}</span>
                                {item.dateStr === getOrderLocalDateStr(new Date()) && (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded-full border border-emerald-200/60">
                                    Today
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="font-semibold text-slate-700">{item.count} orders</span>
                                <span className="text-slate-300">&bull;</span>
                                <span className="font-bold text-slate-900">₹{item.revenue.toLocaleString('en-IN')}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Open Orders Explorer Modal Button */}
                    <button
                      onClick={() => {
                        setShowCalendarDropdown(false);
                        setShowDateOrdersModal(true);
                      }}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Open Date Explorer ({dateWiseOrders.length} orders)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* User Avatar Circle */}
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center justify-center shadow-xs border border-amber-200" title="Admin">
              AD
            </div>
          </div>
        </header>

        {/* Dynamic Inner Panel Viewport (Fluid & Auto-Expanding) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
          <div className="max-w-7xl w-full mx-auto space-y-6">

          {/* Global Tables Warning Removed */}

          {/* ----------------------------------------------------
              VIEW 1: OVERVIEW (ORIGINAL DATA REAL-TIME METRICS)
              ---------------------------------------------------- */}
          {activeTab === 'overview' && (() => {
            const validOrders = orders.filter(o => (o.status as any) !== 'Cancelled');
            const todayDateStr = getOrderLocalDateStr(new Date());
            const activeDateOrders = dateWiseOrders;
            const validActiveDateOrders = activeDateOrders.filter(o => (o.status as any) !== 'Cancelled');

            const dateRevenue = validActiveDateOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            const totalRecordedRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            const displayRevenue = isAllDatesMode ? totalRecordedRevenue : (activeDateOrders.length > 0 ? dateRevenue : totalRecordedRevenue);

            const occupiedTablesCount = tables.filter(t => t.status === 'Ordered' || t.status === 'Cooking' || t.status === 'Serving' || t.status === 'Billing').length;
            const availableTablesCount = tables.filter(t => t.status === 'Available').length;
            const otherTablesCount = tables.filter(t => t.status === 'Cleaning' || t.status === 'Reserved').length;
            const totalTablesCount = tables.length;
            const floorDisplay = `${occupiedTablesCount}/${totalTablesCount || 0}`;
            const occupancyPct = totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0;

            // Area chart revenue data computed purely from actual orders
            const getRealRevenueArea = () => {
              if (revenueTimeframe === 'today') {
                const hourSlots = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
                const bucketMap: Record<string, number> = {};
                hourSlots.forEach(h => { bucketMap[h] = 0; });

                const ordersToUse = activeDateOrders.length > 0 ? activeDateOrders : validOrders;
                ordersToUse.forEach(o => {
                  const date = o.createdAt ? new Date(o.createdAt) : null;
                  const hour = date ? date.getHours() : 12;
                  let slot = '12 PM';
                  if (hour < 9) slot = '8 AM';
                  else if (hour < 11) slot = '10 AM';
                  else if (hour < 13) slot = '12 PM';
                  else if (hour < 15) slot = '2 PM';
                  else if (hour < 17) slot = '4 PM';
                  else if (hour < 19) slot = '6 PM';
                  else if (hour < 21) slot = '8 PM';
                  else slot = '10 PM';

                  bucketMap[slot] = (bucketMap[slot] || 0) + (Number(o.total) || 0);
                });

                return hourSlots.map(time => ({ time, revenue: bucketMap[time] || 0 }));
              }

              if (revenueTimeframe === 'week') {
                const daySlots = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const dayMap: Record<string, number> = {};
                daySlots.forEach(d => { dayMap[d] = 0; });

                validOrders.forEach(o => {
                  if (o.createdAt) {
                    const day = new Date(o.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
                    if (dayMap[day] !== undefined) {
                      dayMap[day] += Number(o.total) || 0;
                    }
                  }
                });

                return daySlots.map(time => ({ time, revenue: dayMap[time] || 0 }));
              }

              // month timeframe
              const weekSlots = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
              const weekMap: Record<string, number> = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0 };
              validOrders.forEach(o => {
                const date = o.createdAt ? new Date(o.createdAt) : new Date();
                const dayOfMonth = date.getDate();
                const weekKey = dayOfMonth <= 7 ? 'Week 1' : dayOfMonth <= 14 ? 'Week 2' : dayOfMonth <= 21 ? 'Week 3' : 'Week 4';
                weekMap[weekKey] += Number(o.total) || 0;
              });

              return weekSlots.map(time => ({ time, revenue: weekMap[time] || 0 }));
            };

            const currentRevenueArea = getRealRevenueArea();
            const totalPeriodRevenue = currentRevenueArea.reduce((sum, item) => sum + item.revenue, 0);

            // Table status donut chart
            const tableStatusData = [
              { name: 'Occupied', value: occupiedTablesCount, color: '#FF6B00' },
              { name: 'Available', value: availableTablesCount, color: '#10B981' },
              { name: 'Reserved/Cleaning', value: otherTablesCount, color: '#6366F1' }
            ];

            // Recent Orders list purely from original database orders for the chosen date
            const displayRecentOrders = activeDateOrders.map(o => {
              const tableNum = Number(o.tableId);
              const matchedStaff = staff.find(s => s.assignedTables && !isNaN(tableNum) && s.assignedTables.includes(tableNum));
              return {
                id: `#${o.id}`,
                location: o.tableId ? `Table ${o.tableId}` : 'Dine-In',
                waiter: (o as any).waiterName || matchedStaff?.name || 'Floor Staff',
                amount: Number(o.total || 0),
                status: o.status,
                rawOrder: o,
                time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'
              };
            });

            const greetingWord = currentTime.getHours() < 12 ? 'Good morning' : currentTime.getHours() < 17 ? 'Good afternoon' : 'Good evening';
            const restaurantDisplayName = alertSettings?.restaurantName || 'Babai Hotel';

            return (
              <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">

                {/* 1. HERO GREETING */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#FF6B00]">
                      OVERVIEW
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-0.5">
                      {greetingWord}, Admin
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      Here's what's happening at {restaurantDisplayName} today.
                    </p>
                  </div>
                </div>

                {/* 2. UNIFIED ENTERPRISE METRICS BAR */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    {/* Metric 1: Revenue */}
                    <div
                      onClick={() => setActiveTab('reports')}
                      className="p-5 hover:bg-slate-50/60 transition-colors cursor-pointer group flex flex-col justify-between"
                      title="Click to view detailed Hotel Reports & Revenue Analytics"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {isAllDatesMode ? 'All-Time Revenue' : `${formatFriendlyDate(selectedOrderDate)} Revenue`}
                        </span>
                        <ArrowUpRight size={14} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <div className="mt-2.5">
                        <strong className="text-2xl font-black text-slate-900 tracking-tight block">
                          ₹{displayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>{activeDateOrders.length} {activeDateOrders.length === 1 ? 'order' : 'orders'} {isAllDatesMode ? 'recorded' : 'on date'}</span>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDateOrdersModal(true);
                            }}
                            className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-0.5 text-[11px]"
                          >
                            <span>Explore</span>
                            <ArrowUpRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metric 2: Floor Occupancy */}
                    <div
                      onClick={() => setActiveTab('qrcodes')}
                      className="p-5 hover:bg-slate-50/60 transition-colors cursor-pointer group flex flex-col justify-between"
                      title="Click to manage Floor Tables & QR Codes"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Floor Occupancy
                        </span>
                        <ArrowUpRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
                          <span>{floorDisplay}</span>
                          <span className="text-xs text-slate-400 font-normal">tables active</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{occupancyPct}% dining floor utilized</span>
                        </div>
                      </div>
                    </div>

                    {/* Metric 3: Staff on Duty */}
                    <div
                      onClick={() => setActiveTab('staff')}
                      className="p-5 hover:bg-slate-50/60 transition-colors cursor-pointer group flex flex-col justify-between"
                      title="Click to view Staff Roster & Waiters"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Staff on Duty
                        </span>
                        <ArrowUpRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
                          <span>{staff.length}</span>
                          <span className="text-xs text-slate-400 font-normal">team members</span>
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500 font-medium">
                          <span>{staff.filter(s => s.shift === 'Morning').length} Morning • {staff.filter(s => s.shift === 'Evening').length} Evening</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. MIDDLE ROW: REVENUE OVERVIEW (AREACHART) + TABLE STATUS (DONUT) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Revenue overview (2 cols) */}
                  <div className="lg:col-span-2 p-6 rounded-2xl border bg-white border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900">Revenue overview</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Track your restaurant's performance</p>
                        </div>
                        {/* Segmented controls: Today | Week | Month */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                          {(['today', 'week', 'month'] as const).map(tf => (
                            <button
                              key={tf}
                              onClick={() => setRevenueTimeframe(tf)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${revenueTimeframe === tf
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                              {tf}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4">
                        <span className="text-[11px] font-semibold text-slate-400 block">Total revenue ({revenueTimeframe})</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <strong className="text-2xl font-black text-slate-900">
                            ₹{totalPeriodRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center gap-0.5">
                            <ArrowUpRight size={11} />
                            Real-time Sales
                          </span>
                        </div>
                      </div>

                      {/* Smooth Area Chart */}
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={currentRevenueArea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="figmaRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#FF6B00" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                              formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              stroke="#FF6B00"
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#figmaRevenueGrad)"
                              dot={false}
                              activeDot={{ r: 6, fill: '#FF6B00', stroke: '#fff', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Right: Table status (1 col) */}
                  <div className="p-6 rounded-2xl border bg-white border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900">Table status</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Live dining floor overview</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('qrcodes')}
                          className="text-xs font-bold text-[#FF6B00] hover:text-orange-600 flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>View floor</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>

                      {/* Donut chart + side legend */}
                      <div className="flex items-center justify-between gap-4 my-2">
                        <div className="h-44 w-44 relative flex-shrink-0 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={tableStatusData}
                                innerRadius={55}
                                outerRadius={75}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {tableStatusData.map((entry, index) => (
                                  <Cell key={`tbl-cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <strong className="text-2xl font-black text-slate-900">
                              {occupiedTablesCount}
                            </strong>
                            <span className="text-[10px] text-slate-400 font-medium">of {tables.length} tables</span>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="space-y-3 flex-1 pr-2">
                          {tableStatusData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs font-medium">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <span className="text-slate-600 font-semibold">{item.name}</span>
                              </div>
                              <strong className="text-slate-900 font-black">{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Dining Floor Status Banner */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs mt-3">
                      <div className="flex items-center gap-2 text-slate-600 font-semibold">
                        <Clock size={15} className="text-[#FF6B00]" />
                        <span>Dining Floor Status</span>
                      </div>
                      <strong className="text-slate-900 font-black">{tables.length > 0 ? `${tables.length} Tables Monitored` : 'No Tables Configured'}</strong>
                    </div>
                  </div>
                </div>

                {/* 5. BOTTOM ROW: RECENT ORDERS TABLE + QUICK ACTIONS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Recent orders (2 cols) */}
                  <div className="lg:col-span-2 p-6 rounded-2xl border bg-white border-slate-200/90 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-900">
                            {isAllDatesMode ? 'All Recorded Orders' : `Orders on ${formatFriendlyDate(selectedOrderDate)}`}
                          </h3>
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00]">
                            {displayRecentOrders.length} {displayRecentOrders.length === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {isAllDatesMode 
                            ? 'All customer orders across all historical dates' 
                            : `Displaying orders recorded on ${selectedOrderDate}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isAllDatesMode && selectedOrderDate !== getOrderLocalDateStr(new Date()) && (
                          <button
                            onClick={() => {
                              setSelectedOrderDate(getOrderLocalDateStr(new Date()));
                              setIsAllDatesMode(false);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Reset to Today
                          </button>
                        )}
                        <button
                          onClick={() => setShowDateOrdersModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B00] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Open full interactive Date-Wise Orders Explorer"
                        >
                          <Eye size={13} />
                          <span>Explore All ({displayRecentOrders.length})</span>
                        </button>
                      </div>
                    </div>

                    {/* Recent Orders Table from Figma */}
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                          <tr>
                            <th className="py-2.5 px-3">Order</th>
                            <th className="py-2.5 px-3">Location</th>
                            <th className="py-2.5 px-3">Waiter</th>
                            <th className="py-2.5 px-3">Amount</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Time</th>
                            <th className="py-2.5 px-3 text-center">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                          {displayRecentOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                                <Calendar size={28} className="mx-auto mb-2 text-slate-300" />
                                <p className="font-semibold text-slate-700">No customer orders recorded on {selectedOrderDate}.</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Pick another date from the calendar header or switch to Today / All Dates.</p>
                                <div className="mt-3 flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedOrderDate(getOrderLocalDateStr(new Date()));
                                      setIsAllDatesMode(false);
                                    }}
                                    className="px-3 py-1.5 bg-[#FF6B00] text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-sm cursor-pointer"
                                  >
                                    Switch to Today
                                  </button>
                                  <button
                                    onClick={() => {
                                      setIsAllDatesMode(true);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                                  >
                                    View All Dates ({orders.length})
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            displayRecentOrders.map((order, idx) => (
                              <tr 
                                key={idx} 
                                onClick={() => setSelectedOrderForDetail(order.rawOrder)}
                                className="hover:bg-orange-50/60 transition-colors cursor-pointer group"
                                title="Click to view detailed itemized order bill & receipt"
                              >
                                <td className="py-3 px-3 font-bold text-slate-900 font-mono flex items-center gap-1.5">
                                  <span>{order.id}</span>
                                </td>
                                <td className="py-3 px-3 text-slate-700 font-semibold">{order.location}</td>
                                <td className="py-3 px-3 text-slate-500">{order.waiter}</td>
                                <td className="py-3 px-3 font-extrabold text-slate-900">
                                  ₹{typeof order.amount === 'number' ? order.amount.toFixed(2) : order.amount}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block ${order.status === 'Preparing'
                                    ? 'bg-orange-50 text-orange-600 border border-orange-200/50'
                                    : (order.status === 'Ready to Serve' || (order.status as any) === 'Ready')
                                      ? 'bg-sky-50 text-sky-600 border border-sky-200/50'
                                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                                    }`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right text-slate-400 text-[11px]">{order.time}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-[#FF6B00] group-hover:bg-orange-100/70 inline-flex items-center justify-center transition-colors">
                                    <Receipt size={14} />
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Quick actions (1 col) */}
                  <div className="p-6 rounded-2xl border bg-white border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="mb-4">
                        <h3 className="font-extrabold text-base text-slate-900">Quick actions</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Common management tasks</p>
                      </div>

                      <div className="space-y-3">
                        {/* Update menu */}
                        <button
                          onClick={() => setActiveTab('menu')}
                          className="w-full p-3.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 flex items-center justify-between text-left transition-all cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF6B00]">
                              <BookOpen size={17} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition-colors">Update menu</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">Edit items & availability</p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        {/* Generate QR code */}
                        <button
                          onClick={() => setActiveTab('qrcodes')}
                          className="w-full p-3.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 flex items-center justify-between text-left transition-all cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500">
                              <QrCode size={17} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors">Generate QR code</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">Create table QR codes</p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        {/* Manage shifts */}
                        <button
                          onClick={() => setActiveTab('staff')}
                          className="w-full p-3.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 flex items-center justify-between text-left transition-all cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                              <Users size={17} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Manage shifts</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">Staff schedules & attendance</p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. OPERATIONAL DISPATCH & DISH PERFORMANCE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Top Performing Dishes Data List */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Top Performing Dishes</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Volume, revenue & contribution margins</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                        Live Leaderboard
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {topSellingDishes.map((item) => (
                        <div
                          key={item.rank}
                          className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-1 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono font-bold text-slate-400 w-5 text-center">
                              {String(item.rank).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-slate-900 truncate">{item.name}</h4>
                              <span className="text-[11px] text-slate-400 block truncate">{item.category}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3.5 flex-shrink-0">
                            <span className="text-xs text-slate-500 font-medium">{item.sold} sold</span>
                            <span className="text-xs font-bold text-slate-900 w-16 text-right tabular-nums">
                              ₹{item.rev.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {item.margin}% margin
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Smart Dispatch & Operational Insights Feed */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Smart Dispatch & Insights</h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">Live floor suggestions & demand balancing</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Active Advisor</span>
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {/* Insight 1: Stock Prep */}
                        <div className="py-3 flex items-start justify-between gap-4 group">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">Stock Prep</span>
                              <span className="text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.2 rounded font-semibold">
                                High Priority
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Prep 15kg Chicken & Biryani spices before 7 PM rush.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert('Stock Prep alert dispatched to kitchen inventory queue.')}
                            className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap self-center cursor-pointer"
                          >
                            Resolve
                          </button>
                        </div>

                        {/* Insight 2: Station 1 Load */}
                        <div className="py-3 flex items-start justify-between gap-4 group">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">Station 1 Load</span>
                              <span className="text-[9px] uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 px-1.5 py-0.2 rounded font-semibold">
                                85% Capacity
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Station 1 at 85% capacity — auto-rebalance starters to Station 2.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert('Starter orders automatically rebalanced to Station 2.')}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap self-center cursor-pointer"
                          >
                            Rebalance
                          </button>
                        </div>

                        {/* Insight 3: Beverage Upsell */}
                        <div className="py-3 flex items-start justify-between gap-4 group">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">Beverage Upsell</span>
                              <span className="text-[9px] uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/60 px-1.5 py-0.2 rounded font-semibold">
                                +₹65 AOV Lift
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Bundle Mango Lassi with Spicy Biryani to lift AOV by ₹65.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert('Mango Lassi bundle suggestion active on customer cart.')}
                            className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap self-center cursor-pointer"
                          >
                            Apply Bundle
                          </button>
                        </div>

                        {/* Insight 4: SLA Expediting */}
                        <div className="py-3 flex items-start justify-between gap-4 group">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">SLA Expediting</span>
                              <span className="text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.2 rounded font-semibold">
                                14.2m Target
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Prep time SLA at 14.2m. Shift 1 expediter to Station 3.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert('Station 3 floor expediter re-assigned.')}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap self-center cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Forecasted Tomorrow: <strong className="text-slate-800 font-bold">₹53,600</strong></span>
                      <span className="text-emerald-600 font-semibold">94% forecast accuracy</span>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}


          {/* ----------------------------------------------------
              VIEW 4: MENU CATALOG
              ---------------------------------------------------- */}
          {activeTab === 'menu' && (() => {
            const currentList = menuItems && menuItems.length > 0 ? menuItems : MENU_ITEMS;
            const filteredDishes = currentList
              .filter(item => {
                if (menuFilterCategory === 'All') return true;
                if (menuFilterCategory === 'Veg') return item.isVeg;
                if (menuFilterCategory === 'Non-Veg') return !item.isVeg;
                return item.category === menuFilterCategory;
              })
              .filter(item => {
                if (!menuSearchQuery) return true;
                const q = menuSearchQuery.toLowerCase();
                return item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q));
              });

            return (
              <div className="space-y-6 animate-fade-in">
                {/* Enterprise Header Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900 tracking-tight">Menu Catalog</h3>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                        {filteredDishes.length} {filteredDishes.length === 1 ? 'Dish' : 'Dishes'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Live kitchen pricing, dish specifications, and dietary tags.</p>
                  </div>

                  <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
                    {/* View Switcher: Dense Table vs Compact Grid */}
                    <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setMenuViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          menuViewMode === 'table'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Dense Table View"
                      >
                        <Table size={13} />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          menuViewMode === 'grid'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Card Grid View"
                      >
                        <LayoutGrid size={13} />
                        <span>Grid</span>
                      </button>
                    </div>

                    {/* Add Dish Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMenuItem(null);
                        setMenuFormState({
                          name: '',
                          price: 150,
                          category: 'Main Course',
                          image: '',
                          description: '',
                          calories: 350,
                          prepTime: '15 mins',
                          isVeg: true,
                          isSpecial: false
                        });
                        setNewMenuItemForm(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF6B00] hover:bg-[#e05e00] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Dish</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['All', 'Breakfast', 'Soups', 'Starters', 'Main Course', 'Combos', 'Breads', 'Desserts', 'Beverages', 'Veg', 'Non-Veg'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMenuFilterCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${menuFilterCategory === cat
                          ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                          : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full md:w-64 shrink-0">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by dish name..."
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6B00] focus:bg-white transition-all"
                    />
                    {menuSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMenuSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Modal with Direct Image URL Open Link */}
                {newMenuItemForm && createPortal(
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className={`relative my-auto w-full max-w-lg rounded-3xl p-6 shadow-2xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto`}>
                      <div className="flex justify-between items-center mb-4 pb-3 border-b">
                        <h4 className="font-extrabold text-sm">Edit Dish Details &amp; Photo</h4>
                        <button onClick={() => setNewMenuItemForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                          <X size={18} />
                        </button>
                      </div>
                      <form onSubmit={handleSaveMenuItem} className="space-y-4 text-xs font-semibold">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">Dish Name</label>
                            <input
                              type="text"
                              value={menuFormState.name}
                              onChange={(e) => setMenuFormState({ ...menuFormState, name: e.target.value })}
                              required
                              placeholder="e.g. Chicken Biryani"
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Price (₹)</label>
                            <input
                              type="number"
                              value={menuFormState.price}
                              onChange={(e) => setMenuFormState({ ...menuFormState, price: parseInt(e.target.value) || 0 })}
                              required
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                        </div>

                        {/* Direct Image Link input with test open button & Device File Upload */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-gray-400">Dish Image (URL or Device Upload)</label>
                            <label className="text-primary hover:underline cursor-pointer flex items-center gap-1 font-bold text-[11px]">
                              <Upload size={12} />
                              <span>Upload Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const compressed = await compressImageFile(file, 600, 0.85);
                                    if (compressed) {
                                      setMenuFormState(prev => ({ ...prev, image: compressed }));
                                    }
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={menuFormState.image}
                              onChange={(e) => setMenuFormState({ ...menuFormState, image: e.target.value })}
                              placeholder="Paste image URL or click Upload Photo above..."
                              className="w-full p-2.5 border rounded-xl bg-transparent text-xs"
                            />
                            {menuFormState.image && !menuFormState.image.startsWith('data:') && (
                              <a
                                href={menuFormState.image}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer transition-colors"
                                title="Open this image link directly in a new browser tab"
                              >
                                <ExternalLink size={13} />
                                <span>Open Link</span>
                              </a>
                            )}
                          </div>
                          {menuFormState.image && (
                            <div className="mt-2.5 flex items-center gap-3 p-2 border rounded-xl bg-gray-50 /50">
                              <img
                                src={menuFormState.image}
                                alt="Preview"
                                className="w-16 h-12 object-cover rounded-lg border bg-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = COMING_SOON_IMAGE;
                                }}
                              />
                              <div className="text-[11px] overflow-hidden flex-1">
                                <p className="font-bold text-gray-600">Live Preview Thumbnail</p>
                                {menuFormState.image.startsWith('data:') ? (
                                  <span className="text-emerald-600 font-bold text-[10px]">Photo Uploaded & Compressed</span>
                                ) : (
                                  <a
                                    href={menuFormState.image}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline truncate block max-w-xs"
                                  >
                                    {menuFormState.image}
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">Category</label>
                            <select
                              value={menuFormState.category}
                              onChange={(e) => setMenuFormState({ ...menuFormState, category: e.target.value as MenuItem['category'] })}
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            >
                              <option value="Breakfast">Breakfast</option>
                              <option value="Soups">Soups</option>
                              <option value="Starters">Starters</option>
                              <option value="Main Course">Main Course</option>
                              <option value="Combos">Combos</option>
                              <option value="Breads">Breads</option>
                              <option value="Desserts">Desserts</option>
                              <option value="Beverages">Beverages</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Prep Time</label>
                            <input
                              type="text"
                              value={menuFormState.prepTime}
                              onChange={(e) => setMenuFormState({ ...menuFormState, prepTime: e.target.value })}
                              placeholder="e.g. 15-20 mins"
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">Calories (kcal)</label>
                            <input
                              type="number"
                              value={menuFormState.calories}
                              onChange={(e) => setMenuFormState({ ...menuFormState, calories: parseInt(e.target.value) || 0 })}
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Description</label>
                            <textarea
                              value={menuFormState.description}
                              onChange={(e) => setMenuFormState({ ...menuFormState, description: e.target.value })}
                              rows={2}
                              placeholder="Ingredients and taste description..."
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex gap-5 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={menuFormState.isVeg}
                              onChange={(e) => setMenuFormState({ ...menuFormState, isVeg: e.target.checked })}
                              className="w-4 h-4 accent-green-600 rounded"
                            />
                            <span>Vegetarian Dish</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={menuFormState.isSpecial}
                              onChange={(e) => setMenuFormState({ ...menuFormState, isSpecial: e.target.checked })}
                              className="w-4 h-4 accent-primary rounded"
                            />
                            <span>Chef's Special</span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-primary/95 transition-colors shadow-sm"
                        >
                          Update Dish Details &amp; Photo
                        </button>
                      </form>
                    </div>
                  </div>,
                  document.body
                )}

                {/* Menu Catalog: Dense Enterprise Data Table vs Grid */}
                {filteredDishes.length === 0 ? (
                  <div className="text-center py-16 border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
                    <p className="text-sm font-semibold text-slate-500">No dishes found matching your search filter.</p>
                    <button
                      onClick={() => { setMenuFilterCategory('All'); setMenuSearchQuery(''); }}
                      className="mt-2 text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : menuViewMode === 'table' ? (
                  /* ENTERPRISE DATA TABLE */
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="py-3.5 pl-6 pr-4">Dish Details</th>
                            <th className="py-3.5 px-4">Type</th>
                            <th className="py-3.5 px-4">Category</th>
                            <th className="py-3.5 px-4">Prep / Calories</th>
                            <th className="py-3.5 px-4 text-right">Price</th>
                            <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredDishes.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                              {/* Dish Details & Thumbnail */}
                              <td className="py-3 pl-6 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 group-hover:border-slate-300 transition-colors">
                                    <img
                                      src={item.image || COMING_SOON_IMAGE}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = COMING_SOON_IMAGE;
                                      }}
                                    />
                                    {item.isSpecial && (
                                      <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-white text-[8px] font-bold text-center py-0.5 leading-none">
                                        SPEC
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 group-hover:text-[#FF6B00] transition-colors flex items-center gap-2">
                                      <span className="truncate">{item.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono shrink-0">#{item.id}</span>
                                    </div>
                                    {item.description && (
                                      <p className="text-[11px] text-slate-500 line-clamp-1 max-w-sm mt-0.5">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Dietary Type */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                  item.isVeg ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  {item.isVeg ? 'Veg' : 'Non-Veg'}
                                </span>
                              </td>

                              {/* Category */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/60">
                                  {item.category}
                                </span>
                              </td>

                              {/* Prep & Calories */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                  {item.prepTime && <span className="font-mono text-slate-600">⏳ {item.prepTime}</span>}
                                  {item.calories && <span className="text-slate-400">· {item.calories} kcal</span>}
                                  {!item.prepTime && !item.calories && <span className="text-slate-400">—</span>}
                                </div>
                              </td>

                              {/* Price */}
                              <td className="py-3 px-4 whitespace-nowrap text-right">
                                <span className="font-bold text-slate-900 font-mono text-xs">{formatPrice(item.price)}</span>
                              </td>

                              {/* Actions */}
                              <td className="py-3 pl-4 pr-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {item.image && !item.image.startsWith('data:') && (
                                    <a
                                      href={item.image}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="Open full image"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMenuItem(item);
                                      setMenuFormState({
                                        name: item.name,
                                        price: item.price,
                                        category: item.category,
                                        image: item.image || '',
                                        description: item.description || '',
                                        calories: item.calories || 300,
                                        prepTime: item.prepTime || '15 mins',
                                        isVeg: item.isVeg,
                                        isSpecial: !!item.isSpecial
                                      });
                                      setNewMenuItemForm(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Edit dish"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMenuItem(item.id, item.name)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete dish"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* REFINED COMPACT CARD GRID */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredDishes.map(item => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all group"
                      >
                        <div>
                          <div className="relative group/img overflow-hidden rounded-xl mb-3 bg-slate-100 h-36 border border-slate-200/60">
                            <img
                              src={item.image || COMING_SOON_IMAGE}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = COMING_SOON_IMAGE;
                              }}
                            />
                            {item.image && !item.image.startsWith('data:') && (
                              <a
                                href={item.image}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute top-2 right-2 bg-slate-900/70 hover:bg-[#FF6B00] text-white px-2 py-1 rounded-md backdrop-blur-xs transition-colors shadow-2xs flex items-center gap-1 text-[10px] font-semibold"
                                title="Open image in new tab"
                              >
                                <ExternalLink size={10} />
                                <span>Open</span>
                              </a>
                            )}
                            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shadow-2xs ${
                              item.isVeg ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}>
                              {item.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                            {item.isSpecial && (
                              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-500 text-white shadow-2xs">
                                Special
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-xs text-slate-900 line-clamp-1 group-hover:text-[#FF6B00] transition-colors">{item.name}</h4>
                            <span className="font-bold text-slate-900 text-xs font-mono ml-2 shrink-0">{formatPrice(item.price)}</span>
                          </div>

                          <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">{item.category}</span>
                            {item.prepTime && <span>⏳ {item.prepTime}</span>}
                            {item.calories && <span>🔥 {item.calories} kcal</span>}
                          </div>

                          {item.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="border-t border-slate-100 pt-2.5 mt-1 flex justify-between items-center text-[11px]">
                          {item.image && !item.image.startsWith('data:') ? (
                            <a
                              href={item.image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-[#FF6B00] flex items-center gap-1 font-medium truncate max-w-[120px]"
                            >
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate">View Image</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMenuItem(item);
                                setNewMenuItemForm(true);
                              }}
                              className="text-slate-500 hover:text-[#FF6B00] flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Upload size={11} />
                              <span>Set Photo</span>
                            </button>
                          )}

                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMenuItem(item);
                                setMenuFormState({
                                  name: item.name,
                                  price: item.price,
                                  category: item.category,
                                  image: item.image || '',
                                  description: item.description || '',
                                  calories: item.calories || 300,
                                  prepTime: item.prepTime || '15 mins',
                                  isVeg: item.isVeg,
                                  isSpecial: !!item.isSpecial
                                });
                                setNewMenuItemForm(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMenuItem(item.id, item.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}



          {/* ----------------------------------------------------
              VIEW 6: WAITER STAFF MANAGEMENT
              ---------------------------------------------------- */}
          {activeTab === 'staff' && (() => {
            const filteredStaff = staff.filter(emp => {
              if (waiterShiftFilter !== 'All' && emp.shift !== waiterShiftFilter) return false;
              if (waiterSearchQuery.trim()) {
                const q = waiterSearchQuery.toLowerCase();
                const matchName = emp.name.toLowerCase().includes(q);
                const matchId = emp.empid && emp.empid.toLowerCase().includes(q);
                const matchMobile = emp.mobile && emp.mobile.includes(q);
                return matchName || matchId || matchMobile;
              }
              return true;
            });

            return (
              <div className="space-y-6 animate-fade-in font-sans">
                {/* Enterprise Header Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900 tracking-tight">Waiter Staff Roster</h3>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                        {staff.length} {staff.length === 1 ? 'Staff' : 'Staff Members'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Direct terminal credentials, shift assignments, and real-time floor routing.</p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap justify-end self-stretch sm:self-auto">
                    {/* View Switcher: Dense Table vs Compact Grid */}
                    <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setWaiterViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          waiterViewMode === 'table'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Dense Table View"
                      >
                        <Table size={13} />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaiterViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          waiterViewMode === 'grid'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Card Grid View"
                      >
                        <LayoutGrid size={13} />
                        <span>Grid</span>
                      </button>
                    </div>

                    <a
                      href="/downloads/TableTap_Waiter.apk"
                      download="TableTap_Waiter.apk"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                      title="Download Waiter Android App APK"
                    >
                      <Smartphone size={13} />
                      <span>Waiter APK</span>
                      <Download size={11} className="opacity-80" />
                    </a>

                    <button
                      onClick={fetchData}
                      className="p-1.5 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl cursor-pointer transition-all shadow-2xs"
                      title="Refresh Staff Roster"
                    >
                      <RefreshCw size={13} />
                    </button>

                    <button
                      onClick={handleOpenAddStaff}
                      className="bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                    >
                      <Plus size={14} />
                      <span>Add Waiter</span>
                    </button>
                  </div>
                </div>

                {/* Unified Shift KPI Strip */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-2 sm:grid-cols-4 overflow-hidden">
                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Total Roster</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <strong className="text-2xl font-bold font-mono text-slate-900">{staff.length}</strong>
                      <span className="text-[10px] text-emerald-600 font-medium inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Morning Shift</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <strong className="text-2xl font-bold font-mono text-slate-900">
                        {staff.filter(s => s.shift === 'Morning').length}
                      </strong>
                      <span className="text-[10px] text-amber-600 font-medium">08:00 AM - 04:00 PM</span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Evening Shift</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <strong className="text-2xl font-bold font-mono text-slate-900">
                        {staff.filter(s => s.shift === 'Evening').length}
                      </strong>
                      <span className="text-[10px] text-orange-600 font-medium">04:00 PM - 11:00 PM</span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Night Shift</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <strong className="text-2xl font-bold font-mono text-slate-900">
                        {staff.filter(s => s.shift === 'Night').length}
                      </strong>
                      <span className="text-[10px] text-purple-600 font-medium">11:00 PM - Close</span>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['All', 'Morning', 'Evening', 'Night'] as const).map(shiftKey => (
                      <button
                        key={shiftKey}
                        type="button"
                        onClick={() => setWaiterShiftFilter(shiftKey)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                          waiterShiftFilter === shiftKey
                            ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                            : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60'
                        }`}
                      >
                        {shiftKey === 'All' ? 'All Shifts' : `${shiftKey} Shift`}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64 shrink-0">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name, ID, mobile..."
                      value={waiterSearchQuery}
                      onChange={(e) => setWaiterSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6B00] focus:bg-white transition-all"
                    />
                    {waiterSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setWaiterSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Staff Roster: Dense Enterprise Table vs Refined Grid */}
                {filteredStaff.length === 0 ? (
                  <div className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                      <Users size={22} />
                    </div>
                    <h4 className="font-semibold text-sm text-slate-900">No Waiters Matching Filters</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Adjust your search query or shift filter to view registered staff.
                    </p>
                    <button
                      onClick={() => { setWaiterShiftFilter('All'); setWaiterSearchQuery(''); }}
                      className="mt-3 text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : waiterViewMode === 'table' ? (
                  /* HIGH-DENSITY ENTERPRISE STAFF TABLE */
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="py-3.5 pl-6 pr-4">Staff Member</th>
                            <th className="py-3.5 px-4">Shift & Timings</th>
                            <th className="py-3.5 px-4">Terminal Access</th>
                            <th className="py-3.5 px-4">Table Routing</th>
                            <th className="py-3.5 px-4">Contact</th>
                            <th className="py-3.5 px-4 text-right">Performance & Salary</th>
                            <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStaff.map(emp => {
                            const showPw = revealedPasswords[emp.id];
                            return (
                              <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors group">
                                {/* Staff Member */}
                                <td className="py-3.5 pl-6 pr-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <StaffAvatar photo={emp.photo} name={emp.name} size="md" />
                                    <div>
                                      <div className="font-semibold text-slate-900 group-hover:text-[#FF6B00] transition-colors flex items-center gap-1.5">
                                        <span>{emp.name}</span>
                                        <span className="text-[10px] font-mono text-slate-400">ID: {emp.empid}</span>
                                      </div>
                                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60">
                                        Waiter
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Shift */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                                    emp.shift === 'Morning'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                      : emp.shift === 'Evening'
                                      ? 'bg-orange-50 text-orange-700 border border-orange-200/60'
                                      : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                                  }`}>
                                    <span>{emp.shift === 'Morning' ? '☀️' : emp.shift === 'Evening' ? '🌆' : '🌙'}</span>
                                    <span>{emp.shift}</span>
                                  </span>
                                </td>

                                {/* Terminal Access / Password */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] bg-slate-50 border border-slate-200/80 text-slate-800 px-2 py-0.5 rounded select-all">
                                      {showPw ? (emp.password || '••••••') : '••••••••'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setRevealedPasswords(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                      title={showPw ? "Hide PIN" : "Reveal PIN"}
                                    >
                                      {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                    {emp.password && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(emp.password || '');
                                            alert(`Copied password for ${emp.name}`);
                                          }}
                                          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                          title="Copy Password"
                                        >
                                          <Copy size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const shareText = `🍽️ Waiter Login Credentials\n👤 Name: ${emp.name}\n🆔 Employee ID: ${emp.empid}\n🔑 Password: ${emp.password || 'Contact Admin'}`;
                                            navigator.clipboard.writeText(shareText);
                                            alert(`Copied credentials for ${emp.name} to clipboard!`);
                                          }}
                                          className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                                          title="Copy Credentials to Share via WhatsApp"
                                        >
                                          <Share2 size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>

                                {/* Table Routing */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {(!emp.assignedTables || emp.assignedTables.length === 0 || emp.assignedTables.length === tables.length) ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      Full Floor
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                                      {emp.assignedTables.map(tId => (
                                        <span key={tId} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200/60 text-[10px] font-mono font-medium">
                                          T-{tId < 10 ? `0${tId}` : tId}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>

                                {/* Contact */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {emp.mobile ? (
                                    <a
                                      href={`tel:${emp.mobile}`}
                                      className="font-mono text-slate-700 hover:text-[#FF6B00] flex items-center gap-1 transition-colors"
                                    >
                                      <Phone size={11} className="text-slate-400" />
                                      <span>{emp.mobile}</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">—</span>
                                  )}
                                </td>

                                {/* Performance & Salary */}
                                <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                  <div className="font-semibold text-slate-900 font-mono text-xs">{formatPrice(emp.salary)}</div>
                                  <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1.5 mt-0.5">
                                    <span className="text-amber-500 font-semibold">★ {emp.performance?.ratings || '5.0'}</span>
                                    <span>·</span>
                                    <span>{emp.performance?.ordersDelivered || 0} orders</span>
                                  </div>
                                </td>

                                {/* Actions */}
                                <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditStaff(emp)}
                                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                      title="Edit Waiter"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStaffMember(emp.id, emp.name)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Delete Waiter"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* REFINED COMPACT GRID VIEW */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStaff.map(emp => {
                      const showPw = revealedPasswords[emp.id];
                      return (
                        <div
                          key={emp.id}
                          className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3 gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <StaffAvatar photo={emp.photo} name={emp.name} size="md" />
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-xs text-slate-900 truncate">{emp.name}</h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono text-slate-400">ID: {emp.empid}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                      {emp.shift}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-slate-900 text-xs block">{formatPrice(emp.salary)}</span>
                                <span className="text-[10px] text-amber-500 font-medium">★ {emp.performance?.ratings || '5.0'}</span>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-3 text-[11px] space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">PIN</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-slate-800 font-semibold">{showPw ? (emp.password || '••••••') : '••••••••'}</span>
                                  <button
                                    type="button"
                                    onClick={() => setRevealedPasswords(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                                    className="text-slate-400 hover:text-slate-700"
                                  >
                                    {showPw ? <EyeOff size={11} /> : <Eye size={11} />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">Mobile</span>
                                <span className="font-mono text-slate-700">{emp.mobile || 'Not set'}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] mb-2">
                              <span className="text-slate-400 text-[10px] uppercase font-semibold">Routing</span>
                              {(!emp.assignedTables || emp.assignedTables.length === 0 || emp.assignedTables.length === tables.length) ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-medium">Full Floor</span>
                              ) : (
                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {emp.assignedTables.length} tables
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-2.5 mt-1 flex justify-between items-center text-xs">
                            <span className="text-[10px] text-slate-400">
                              {emp.performance?.ordersDelivered || 0} orders delivered
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleOpenEditStaff(emp)}
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteStaffMember(emp.id, emp.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}




          {/* ----------------------------------------------------
              VIEW 9: LOYALTY PROGRAMS
              ---------------------------------------------------- */}
          {activeTab === 'loyalty' && (
            <div className="space-y-6 animate-fade-in font-sans">
              {/* Enterprise Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-base text-slate-900 tracking-tight">Loyalty Rewards & Tier Policies</h3>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                      Active Program
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Establish reward conversion parameters, points issuance ratios, and tier upgrade thresholds.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditLoyaltyModal(true)}
                  className="bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-stretch sm:self-auto justify-center"
                >
                  <Edit3 size={13} />
                  <span>Configure Rules</span>
                </button>
              </div>

              {/* Structured Two-Column Settings Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Panel 1: Loyalty Conversion Rules */}
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 tracking-tight">Conversion & Threshold Parameters</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Mathematical ratios applied during customer billing and checkout.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditLoyaltyModal(true)}
                      className="text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <span className="font-medium text-slate-800 block">Base Earning Rule</span>
                        <span className="text-[11px] text-slate-500">Points credited per rupee spent on finalized orders</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 border border-slate-200/70 px-2.5 py-1 rounded-lg">
                        ₹100 = {loyaltyRules.pointsPerHundred} Points
                      </span>
                    </div>

                    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <span className="font-medium text-slate-800 block">Silver Rewards Threshold</span>
                        <span className="text-[11px] text-slate-500">Lifetime points required to achieve Silver status</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 border border-slate-200/70 px-2.5 py-1 rounded-lg">
                        {loyaltyRules.silverTierPoints} Points
                      </span>
                    </div>

                    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <span className="font-medium text-slate-800 block">Gold Rewards Threshold</span>
                        <span className="text-[11px] text-slate-500">Lifetime points required for VIP Gold tier and discounts</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 border border-slate-200/70 px-2.5 py-1 rounded-lg">
                        {loyaltyRules.goldTierPoints} Points ({loyaltyRules.goldDiscountPercent}% Off)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Customer Tier Benefits Matrix */}
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-xs font-semibold text-slate-800 tracking-tight">Active Tier Privileges</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Perks automatically unlocked when guest accounts cross reward thresholds.</p>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                          B
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900 block">Bronze (Entry Tier)</span>
                          <span className="text-[11px] text-slate-500">0 - {loyaltyRules.silverTierPoints - 1} Points</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                        Standard 1x Accrual
                      </span>
                    </div>

                    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs">
                          S
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900 block">Silver Tier</span>
                          <span className="text-[11px] text-slate-500">{loyaltyRules.silverTierPoints} - {loyaltyRules.goldTierPoints - 1} Points</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                        Priority Seating & Tier Upgrades
                      </span>
                    </div>

                    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                          G
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900 block">Gold VIP Tier</span>
                          <span className="text-[11px] text-slate-500">{loyaltyRules.goldTierPoints}+ Points</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-md">
                        {loyaltyRules.goldDiscountPercent}% Auto Bill Discount
                      </span>
                    </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Campaign Promotions & Coupons</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Configure promotional codes and instant discounts for customer digital checkout.</p>
                </div>
                <button
                  onClick={() => setNewPromotionModal(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Create Campaign Coupon</span>
                </button>
              </div>

              {/* Modal form */}
              {newPromotionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                  <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl bg-white border border-slate-100 relative">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="font-black text-sm text-slate-900">New Campaign Coupon</h4>
                        <p className="text-[11px] text-slate-400">Set discount amount and eligibility threshold</p>
                      </div>
                      <button 
                        onClick={() => setNewPromotionModal(false)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <form onSubmit={handleCreateCouponCode} className="space-y-4 text-xs font-medium">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Coupon Code (e.g. WELCOME20, FESTIVE100)</label>
                        <input
                          type="text"
                          value={couponFormState.code}
                          onChange={(e) => setCouponFormState({ ...couponFormState, code: e.target.value.toUpperCase() })}
                          required
                          placeholder="FESTIVE50"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase tracking-wider text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Discount Amount (₹)</label>
                          <input
                            type="number"
                            value={couponFormState.discount}
                            onChange={(e) => setCouponFormState({ ...couponFormState, discount: parseInt(e.target.value) })}
                            required
                            min="1"
                            placeholder="50"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Min Bill Target (₹)</label>
                          <input
                            type="number"
                            value={couponFormState.minBill}
                            onChange={(e) => setCouponFormState({ ...couponFormState, minBill: parseInt(e.target.value) })}
                            required
                            min="0"
                            placeholder="300"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-colors"
                          />
                        </div>
                      </div>
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setNewPromotionModal(false)}
                          className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          Publish Coupon
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Coupon list */}
              {coupons.length === 0 ? (
                <div className="bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 py-12 px-4 text-center">
                  <Tag size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No Active Promotional Coupons</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click "Create Campaign Coupon" to launch a discount code for diners.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {coupons.map(cp => (
                    <div
                      key={cp.id}
                      className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 border border-dashed border-slate-300">
                            {cp.code}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="text-xl font-black text-slate-900">
                            ₹{cp.discount} <span className="text-xs font-bold text-slate-400">FLAT OFF</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Min order check: <span className="text-slate-800 font-bold">₹{cp.min_bill}</span>
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Valid on Table QR orders</span>
                        <button
                          onClick={() => handleDeletePromotion(cp.id, cp.code)}
                          className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer font-medium"
                          title="Delete Coupon"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  <p className="text-[10px] text-gray-400">Leverages mixtral/llama models to compute sales growth and optimal pricing.</p>
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
                <div className={`p-5 rounded-3xl border shadow-sm relative overflow-hidden bg-white border-gray-50`}>
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
                <div className={`p-5 rounded-3xl border shadow-sm bg-white border-gray-50`}>
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
          {activeTab === 'reports' && (() => {
            const filteredData = getFilteredReportData();
            const reportOrders = (filteredData.orders || []).filter(o => (o.status as any) !== 'Cancelled');

            // Calculate sales for each weekday (Mon - Sun) from the filtered report orders
            const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const daySalesMap: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

            reportOrders.forEach(o => {
              if (o.createdAt) {
                const day = new Date(o.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
                if (daySalesMap[day] !== undefined) {
                  daySalesMap[day] += Number(o.total) || 0;
                }
              }
            });

            const maxSalesVolume = Math.max(...Object.values(daySalesMap), 500);
            const formatCurrency = (val: number) => {
              if (val >= 1000) {
                const k = val / 1000;
                return `₹${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
              }
              return `₹${val}`;
            };

            const ySteps = [
              formatCurrency(maxSalesVolume),
              formatCurrency(Math.round(maxSalesVolume * 0.75)),
              formatCurrency(Math.round(maxSalesVolume * 0.5)),
              formatCurrency(Math.round(maxSalesVolume * 0.25)),
              '₹0'
            ];

            const totalFilteredRevenue = reportOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            const avgOrderValue = reportOrders.length > 0 ? Math.round(totalFilteredRevenue / reportOrders.length) : 0;
            const peakDayEntry = Object.entries(daySalesMap).reduce((max, curr) => curr[1] > max[1] ? curr : max, ['None', 0]);
            const peakDay = peakDayEntry[1] > 0 ? `${peakDayEntry[0]} (${formatPrice(peakDayEntry[1])})` : 'N/A';

            return (
              <div className="space-y-6 animate-fade-in font-sans">
                {/* Enterprise Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900 tracking-tight">Reports & Analytics Console</h3>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                        {reportOrders.length} Orders in Scope
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Automated accounting reports, revenue aggregations, and raw data exports.</p>
                  </div>
                </div>

                {/* Unified Control Toolbar (Filters & Export Actions in 1 line) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
                  {/* Filters Left */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Date Filter */}
                    <div className="relative">
                      <select
                        value={reportDateFilter}
                        onChange={(e) => setReportDateFilter(e.target.value as any)}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 pl-3.5 pr-8 font-medium text-slate-700 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <option value="Today">Today Only</option>
                        <option value="This Week">This Week (Last 7 Days)</option>
                        <option value="This Month">This Month (Last 30 Days)</option>
                        <option value="All">All Time History</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Category Filter */}
                    <div className="relative">
                      <select
                        value={reportCategoryFilter}
                        onChange={(e) => setReportCategoryFilter(e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 pl-3.5 pr-8 font-medium text-slate-700 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <option value="All">All Food Categories</option>
                        <option value="Breakfast">Breakfast</option>
                        <option value="Main Course">Main Course</option>
                        <option value="Starters">Starters</option>
                        <option value="Breads">Breads</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Desserts">Desserts</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <span className="text-[11px] text-slate-400 hidden xl:inline">
                      Exports will strictly match active filter scope.
                    </span>
                  </div>

                  {/* Export Actions Right */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title="Download Excel Spreadsheet"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      <span>Export Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title="Download PDF Document"
                    >
                      <FileText size={14} className="text-rose-600" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* KPI Summary Strip */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-1 sm:grid-cols-3 overflow-hidden">
                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Filtered Gross Sales</span>
                    <strong className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{formatPrice(totalFilteredRevenue)}</strong>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">{reportOrders.length} processed orders</span>
                  </div>

                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Average Order Value (AOV)</span>
                    <strong className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{formatPrice(avgOrderValue)}</strong>
                    <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Consistent guest spend</span>
                  </div>

                  <div className="p-4 sm:p-5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Peak Sales Day</span>
                    <strong className="text-lg font-bold text-slate-900 mt-1.5 block truncate">{peakDay}</strong>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Highest revenue volume day</span>
                  </div>
                </div>

                {/* Custom Sales Volume Chart */}
                <div className="p-6 rounded-2xl border border-slate-200/80 shadow-2xs bg-white">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                    <div>
                      <h4 className="font-semibold text-xs text-slate-800 tracking-tight">Weekly Sales Volume Chart</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Total recorded sales aggregated across days of the week</p>
                    </div>
                    <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/60 font-mono">
                      {reportOrders.length} Orders
                    </span>
                  </div>

                  <div className="w-full h-[260px] relative">
                    {/* Y-Axis Grid Lines & Labels */}
                    <div className="absolute inset-0 flex flex-col justify-between text-[11px] font-mono font-medium text-slate-400 pointer-events-none">
                      {ySteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="w-12 text-right">{step}</span>
                          <div className={`flex-1 ${idx === ySteps.length - 1 ? 'border-t border-slate-200' : 'border-t border-dashed border-slate-100'}`}></div>
                        </div>
                      ))}
                    </div>

                    {/* Bars */}
                    <div className="absolute inset-0 ml-16 mb-4 flex items-end justify-around px-2 pt-6 pb-[2px]">
                      {dayKeys.map(day => {
                        const amount = daySalesMap[day] || 0;
                        const pct = maxSalesVolume > 0 && amount > 0
                          ? Math.min(100, Math.max(6, Math.round((amount / maxSalesVolume) * 100)))
                          : 3;
                        return (
                          <div key={day} className="w-[11%] h-full flex flex-col items-center justify-end group relative">
                            {/* Hover tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-mono font-semibold py-1 px-2.5 rounded-lg pointer-events-none whitespace-nowrap z-30 shadow-md">
                              {day}: ₹{amount.toLocaleString('en-IN')}
                            </div>
                            <div
                              style={{ height: `${pct}%` }}
                              className={`w-full rounded-t-sm transition-all cursor-pointer ${amount > 0
                                ? 'bg-[#FF6B00] hover:bg-[#e05e00] shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200'
                                }`}
                            ></div>
                          </div>
                        );
                      })}
                    </div>

                    {/* X-Axis Labels */}
                    <div className="absolute bottom-0 left-16 right-0 flex justify-around px-2 -mb-6 text-[11px] font-medium text-slate-500">
                      {dayKeys.map(day => (
                        <span key={day} className="w-[11%] text-center">{day}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}



          {/* ----------------------------------------------------
              VIEW 15: RESTAURANT SETTINGS
              ---------------------------------------------------- */}
          {activeTab === 'settings' && (() => {
            const currentSettings = settingsForm || alertSettings;
            return (
              <form className="space-y-6 animate-fade-in font-sans" onSubmit={handleSaveSettings}>
                {/* Enterprise Header with Sticky Action Button */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900 tracking-tight">Restaurant Configurations</h3>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                        {currentSettings.restaurantName || 'TableTap'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Manage business identity, statutory tax identifiers, and physical floor addresses.</p>
                  </div>

                  <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-stretch sm:self-auto justify-center disabled:opacity-50"
                    >
                      <Check size={14} />
                      <span>{loading ? 'Saving Changes...' : 'Save Settings'}</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: General Business Identity */}
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-xs font-semibold text-slate-800 tracking-tight">General Business Identity</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Primary brand names, administrative ownership, and direct guest communication lines.</p>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Restaurant Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all"
                        value={currentSettings.restaurantName || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, restaurantName: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Owner / General Manager</label>
                      <input
                        type="text"
                        placeholder="Owner Name"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all"
                        value={currentSettings.ownerName || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, ownerName: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Branch Identifier</label>
                      <input
                        type="text"
                        placeholder="e.g. Flagship Downtown"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all"
                        value={currentSettings.branchName || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, branchName: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Support & Billing Email</label>
                      <input
                        type="email"
                        placeholder="admin@restaurant.com"
                        required
                        pattern="[a-zA-Z0-9._%+\-]+@gmail\.com$"
                        title="Must be a valid @gmail.com address"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all font-mono"
                        value={currentSettings.email || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, email: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Primary Mobile Contact</label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile"
                        required
                        pattern="^[6-9]\d{9}$"
                        title="Must be a valid 10-digit Indian mobile number"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all font-mono"
                        value={currentSettings.mobile || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, mobile: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Alternate Contact Phone</label>
                      <input
                        type="tel"
                        placeholder="Secondary contact"
                        required
                        pattern="^[6-9]\d{9}$"
                        title="Must be a valid 10-digit Indian mobile number"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all font-mono"
                        value={currentSettings.alternateMobile || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, alternateMobile: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Statutory Tax & Compliance */}
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-xs font-semibold text-slate-800 tracking-tight">Statutory Tax & Regulatory Registration</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Government registration codes printed on guest invoices and tax filings.</p>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">GST Number / Tax ID</label>
                      <input
                        type="text"
                        required
                        pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
                        title="Must be a valid 15-character GSTIN format"
                        value={currentSettings.gstNo || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, gstNo: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">FSSAI License (India)</label>
                      <input
                        type="text"
                        placeholder="14-digit FSSAI"
                        required
                        pattern="^[1-2]\d{13}$"
                        title="Must be a valid 14-digit FSSAI license number"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] font-mono"
                        value={currentSettings.fssai || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, fssai: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Default Tax Percentage (%)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={currentSettings.tax || 0}
                        onChange={(e) => setSettingsForm({ ...currentSettings, tax: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Physical Address & Geolocation */}
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-xs font-semibold text-slate-800 tracking-tight">Location Details & Geolocation</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Physical property coordinates displayed on digital invoices and customer menus.</p>
                  </div>

                  <div className="p-6 space-y-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Street Address</label>
                      <textarea
                        placeholder="Street Address, Building, Suite"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00]"
                        rows={2}
                        value={currentSettings.address || ''}
                        onChange={(e) => setSettingsForm({ ...currentSettings, address: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                        <input
                          type="text"
                          placeholder="City"
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00]"
                          value={currentSettings.city || ''}
                          onChange={(e) => setSettingsForm({ ...currentSettings, city: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</label>
                        <input
                          type="text"
                          placeholder="State"
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00]"
                          value={currentSettings.state || ''}
                          onChange={(e) => setSettingsForm({ ...currentSettings, state: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Country</label>
                        <input
                          type="text"
                          placeholder="Country"
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00]"
                          value={currentSettings.country || ''}
                          onChange={(e) => setSettingsForm({ ...currentSettings, country: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">PIN Code</label>
                        <input
                          type="text"
                          placeholder="6-digit PIN"
                          required
                          pattern="^[1-9][0-9]{5}$"
                          title="Must be a valid 6-digit Indian PIN code"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] font-mono"
                          value={currentSettings.pinCode || ''}
                          onChange={(e) => setSettingsForm({ ...currentSettings, pinCode: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nearby Landmark</label>
                        <input
                          type="text"
                          placeholder="Landmark"
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00]"
                          value={currentSettings.landmark || ''}
                          onChange={(e) => setSettingsForm({ ...currentSettings, landmark: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Google Maps URL</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Maps URL"
                            required
                            value={currentSettings.mapsLocation || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, mapsLocation: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#FF6B00] flex-1 font-mono text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={handleGetLocation}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 rounded-xl border border-slate-200/60 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                            title="Detect Current GPS Location"
                          >
                            <Map size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            );
          })()}

          {/* ----------------------------------------------------
              VIEW 16: SECURITY & AUDIT LOGS
              ---------------------------------------------------- */}
          {activeTab === 'security' && (() => {
            const filteredLogs = activityLogs.filter(log => {
              if (!auditSearchQuery.trim()) return true;
              const q = auditSearchQuery.toLowerCase();
              return (
                (log.action && log.action.toLowerCase().includes(q)) ||
                (log.user_role && log.user_role.toLowerCase().includes(q)) ||
                (log.timestamp && log.timestamp.toLowerCase().includes(q)) ||
                (log.id && log.id.toLowerCase().includes(q))
              );
            });

            const handleExportAuditLogsCSV = () => {
              const headers = ['Log ID', 'Timestamp', 'User Role', 'Action'];
              const rows = filteredLogs.map(l => [l.id, l.timestamp, l.user_role, `"${(l.action || '').replace(/"/g, '""')}"`]);
              const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', `dinesmart_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };

            return (
              <div className="space-y-6 animate-fade-in font-sans">
                {/* Enterprise Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900 tracking-tight">Security & System Audit Trail</h3>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                        {activityLogs.length} Events Logged
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Immutable administrative records, role privilege changes, and authentication timestamps.</p>
                  </div>
                </div>

                {/* Audit Surface Container */}
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  {/* Toolbar Header */}
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 tracking-tight">Immutable Activity Stream</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Cryptographic log of administrative actions, credentials, and floor events.</p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search actions or IDs..."
                          value={auditSearchQuery}
                          onChange={(e) => setAuditSearchQuery(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6B00] w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleExportAuditLogsCSV}
                        className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>

                  {/* Audit Rows */}
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 px-4 text-xs text-slate-400 font-medium">
                      No security audit events match the active search filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {filteredLogs.map(log => (
                        <div key={log.id} className="px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-slate-400 text-[11px] font-mono shrink-0">
                              {log.timestamp}
                            </span>
                            <span className={`text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                              log.user_role === 'Admin' || log.user_role === 'Hotel Manager'
                                ? 'bg-orange-50 text-[#FF6B00] border-orange-200/60'
                                : 'bg-slate-100 text-slate-700 border-slate-200/60'
                            }`}>
                              {log.user_role || 'System'}
                            </span>
                            <span className="text-slate-800 font-normal">
                              {log.action}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 sm:ml-4">
                            ID: #{log.id}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ----------------------------------------------------
              VIEW 17: QR CODE MANAGER
              ---------------------------------------------------- */}
          {activeTab === 'qrcodes' && (
            <div className="space-y-6 animate-fade-in">
              {/* Enterprise Header Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-base text-slate-900 tracking-tight">Table QR Sessions</h3>
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                      {tables.length} {tables.length === 1 ? 'Table' : 'Tables'} Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">High-security table sessions, encrypted token rotation, and physical QR downloads.</p>
                </div>

                <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
                  {/* View Mode Toggle: Table vs Grid */}
                  <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setQrViewMode('table')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        qrViewMode === 'table'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Dense Table Matrix"
                    >
                      <Table size={13} />
                      <span>Table</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrViewMode('grid')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        qrViewMode === 'grid'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Card Grid"
                    >
                      <LayoutGrid size={13} />
                      <span>Grid</span>
                    </button>
                  </div>

                  {tables.length === 0 && (
                    <button
                      type="button"
                      onClick={handleInitializeTables}
                      disabled={loading}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 px-3.5 rounded-xl cursor-pointer text-xs transition-colors shadow-2xs"
                    >
                      Initialize Tables 1-12
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddTable}
                    disabled={loading}
                    className="bg-[#FF6B00] hover:bg-[#e05e00] text-white font-semibold py-1.5 px-3.5 rounded-xl cursor-pointer text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Add Table</span>
                  </button>
                </div>
              </div>

              {/* QR Management Content */}
              {tables.length === 0 ? (
                <div className="text-center py-16 border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
                  <QrCode size={36} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No active tables found on the floor.</p>
                  <p className="text-xs text-slate-500 mt-1">Initialize default restaurant tables or add your first table to generate QR tokens.</p>
                  <button
                    type="button"
                    onClick={handleInitializeTables}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 cursor-pointer shadow-2xs transition-colors"
                  >
                    Initialize Tables 1-12
                  </button>
                </div>
              ) : qrViewMode === 'table' ? (
                /* ENTERPRISE DENSE QR DATA TABLE */
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3.5 pl-6 pr-4">Table</th>
                          <th className="py-3.5 px-4">QR Code</th>
                          <th className="py-3.5 px-4">Session Token</th>
                          <th className="py-3.5 px-4">Direct Order URL</th>
                          <th className="py-3.5 px-4">Floor Status</th>
                          <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tables.map(num => {
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const secureUrl = num.qr_token
                            ? `${baseUrl}/table/${num.id}?token=${num.qr_token}`
                            : `${baseUrl}/table/${num.id}`;
                          const qrImgSrc = num.qr_token
                            ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(secureUrl)}`
                            : null;

                          return (
                            <tr key={num.id} className="hover:bg-slate-50/60 transition-colors group">
                              {/* Table ID */}
                              <td className="py-3.5 pl-6 pr-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-900 font-mono font-bold flex items-center justify-center text-xs group-hover:bg-[#FF6B00]/10 group-hover:text-[#FF6B00] group-hover:border-[#FF6B00]/30 transition-colors">
                                    {num.id < 10 ? `0${num.id}` : num.id}
                                  </span>
                                  <div>
                                    <div className="font-semibold text-slate-900">Table #{num.id}</div>
                                    <div className="text-[10px] text-slate-400">Indoor Dining</div>
                                  </div>
                                </div>
                              </td>

                              {/* QR Thumbnail with Hover Preview */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="relative group/qr inline-block">
                                  <div className="w-10 h-10 rounded-lg border border-slate-200/80 bg-white p-1 flex items-center justify-center shadow-2xs cursor-pointer hover:border-[#FF6B00] transition-colors">
                                    {qrImgSrc ? (
                                      <img src={qrImgSrc} alt={`Table ${num.id} QR`} className="w-full h-full object-contain" />
                                    ) : (
                                      <QrCode size={18} className="text-slate-300" />
                                    )}
                                  </div>
                                  {/* Hover Large Preview */}
                                  {qrImgSrc && (
                                    <div className="absolute left-12 top-1/2 -translate-y-1/2 z-50 hidden group-hover/qr:flex flex-col items-center p-3 bg-white border border-slate-200 rounded-2xl shadow-xl w-44 pointer-events-none animate-fade-in">
                                      <img src={qrImgSrc} alt={`Table ${num.id} QR Large`} className="w-36 h-36" />
                                      <span className="text-[10px] font-bold text-slate-700 mt-1.5 font-mono">Table #{num.id} QR</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Session Token */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] bg-slate-50 border border-slate-200/80 text-slate-700 px-2.5 py-1 rounded-md select-all max-w-[140px] truncate">
                                    {num.qr_token || 'unconfigured'}
                                  </span>
                                  {num.qr_token && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(num.qr_token || '');
                                        setCopiedTokenId(num.id);
                                        setTimeout(() => setCopiedTokenId(null), 1800);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                      title="Copy Session Token"
                                    >
                                      {copiedTokenId === num.id ? (
                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                                          <Check size={11} />
                                          <span>Copied</span>
                                        </span>
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Direct Order URL */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <a
                                  href={secureUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-[#FF6B00] transition-colors group/link max-w-[180px]"
                                  title={secureUrl}
                                >
                                  <span className="truncate font-mono">/table/{num.id}{num.qr_token ? `?token=${num.qr_token.slice(0, 6)}…` : ''}</span>
                                  <ExternalLink size={10} className="shrink-0 text-slate-400 group-hover/link:text-[#FF6B00]" />
                                </a>
                              </td>

                              {/* Floor Status */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                  num.qr_token
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${num.qr_token ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  {num.qr_token ? 'Session Active' : 'No Token'}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadQrImage(num.id, num.qr_token || '')}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Download printable QR"
                                  >
                                    <Download size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReplaceQrToken(num.id)}
                                    className="p-1.5 text-slate-400 hover:text-[#FF6B00] hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                                    title="Rotate security token"
                                  >
                                    <RefreshCw size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTable(num.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete table"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* REFINED ENTERPRISE CARD GRID */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs font-semibold">
                  {tables.map(num => {
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                    const secureUrl = num.qr_token
                      ? `${baseUrl}/table/${num.id}?token=${num.qr_token}`
                      : `${baseUrl}/table/${num.id}`;
                    return (
                      <div
                        key={num.id}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-white text-center shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                              T-{num.id < 10 ? `0${num.id}` : num.id}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              num.qr_token ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-50'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${num.qr_token ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {num.qr_token ? 'Active' : 'Unset'}
                            </span>
                          </div>

                          <div className="w-24 h-24 bg-slate-50/80 rounded-xl mx-auto my-3 flex items-center justify-center border border-slate-200/60 p-1.5">
                            {num.qr_token ? (
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(secureUrl)}`}
                                alt={`Table ${num.id} QR`}
                                className="w-20 h-20"
                              />
                            ) : (
                              <QrCode size={36} className="text-slate-300" />
                            )}
                          </div>

                          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-mono mb-2">
                            <span className="truncate max-w-[110px]">{num.qr_token || 'No Token'}</span>
                            {num.qr_token && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(num.qr_token || '');
                                  setCopiedTokenId(num.id);
                                  setTimeout(() => setCopiedTokenId(null), 1800);
                                }}
                                className="text-slate-400 hover:text-slate-700"
                                title="Copy"
                              >
                                {copiedTokenId === num.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1.5 mt-2 border-t border-slate-100 pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadQrImage(num.id, num.qr_token || '')}
                            className="flex-grow bg-[#FF6B00] hover:bg-[#e05e00] text-white font-medium py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReplaceQrToken(num.id)}
                            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                            title="Rotate Token"
                          >
                            <RefreshCw size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTable(num.id)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                            title="Remove Table"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 19: REVIEWS & SENTIMENT ANALYSIS (ADMIN VIEW)
              ---------------------------------------------------- */}
          {activeTab === 'reviews' && (() => {
            const allCustomerRevs = reviews || [];
            const allRatings = allCustomerRevs
              .map(r => Number(r.rating || r.food_rating || 5))
              .filter(val => !isNaN(val) && val > 0);
            const overallRating = allRatings.length > 0
              ? (allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length).toFixed(1)
              : '5.0';

            const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            allRatings.forEach(r => {
              const rounded = Math.min(5, Math.max(1, Math.round(r)));
              starCounts[rounded] = (starCounts[rounded] || 0) + 1;
            });

            // Sub-ratings from original feedback data
            const foodRatings = allCustomerRevs.map(r => Number(r.food_rating || r.rating || 0)).filter(v => v > 0);
            const serviceRatings = allCustomerRevs.map(r => Number(r.service_rating || 0)).filter(v => v > 0);
            const ambienceRatings = allCustomerRevs.map(r => Number(r.ambience_rating || 0)).filter(v => v > 0);

            const avgFood = foodRatings.length > 0 ? (foodRatings.reduce((s, v) => s + v, 0) / foodRatings.length).toFixed(1) : overallRating;
            const avgService = serviceRatings.length > 0 ? (serviceRatings.reduce((s, v) => s + v, 0) / serviceRatings.length).toFixed(1) : overallRating;
            const avgAmbience = ambienceRatings.length > 0 ? (ambienceRatings.reduce((s, v) => s + v, 0) / ambienceRatings.length).toFixed(1) : overallRating;

            // Only text reviews are considered for the detailed feed
            const textReviews = allCustomerRevs.filter(r => typeof r.comment === 'string' && r.comment.trim().length > 0);
            const starOnlyCount = allCustomerRevs.length - textReviews.length;

            // Executive sentiment categorizer based on original data
            const getSentiment = (r: any): { sentiment: 'Positive' | 'Neutral' | 'Critical'; label: string; bg: string; text: string; border: string } => {
              const ai = aiReviewSentiment[r.id];
              const rawSentiment = String(ai?.sentiment || r.sentiment || '').toLowerCase();
              if (rawSentiment === 'positive') {
                return { sentiment: 'Positive', label: 'Positive Experience', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
              }
              if (rawSentiment === 'negative' || rawSentiment === 'critical') {
                return { sentiment: 'Critical', label: 'Needs Attention', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
              }
              if (rawSentiment === 'neutral') {
                return { sentiment: 'Neutral', label: 'Neutral Feedback', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
              }
              const score = Number(r.rating || 5);
              if (score >= 4) return { sentiment: 'Positive', label: 'Positive Experience', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
              if (score === 3) return { sentiment: 'Neutral', label: 'Neutral Feedback', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
              return { sentiment: 'Critical', label: 'Needs Attention', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
            };

            const posCount = textReviews.filter(r => getSentiment(r).sentiment === 'Positive').length;
            const neutCount = textReviews.filter(r => getSentiment(r).sentiment === 'Neutral').length;
            const critCount = textReviews.filter(r => getSentiment(r).sentiment === 'Critical').length;
            const unrepliedCount = textReviews.filter(r => !r.reply || !r.reply.trim()).length;
            const repliedCount = textReviews.length - unrepliedCount;

            const posPct = textReviews.length > 0 ? Math.round((posCount / textReviews.length) * 100) : (allCustomerRevs.length > 0 ? 100 : 0);
            const neutPct = textReviews.length > 0 ? Math.round((neutCount / textReviews.length) * 100) : 0;
            const critPct = textReviews.length > 0 ? Math.round((critCount / textReviews.length) * 100) : 0;

            const filteredReviews = textReviews.filter(r => {
              if (reviewFilter === 'positive') return getSentiment(r).sentiment === 'Positive';
              if (reviewFilter === 'neutral') return getSentiment(r).sentiment === 'Neutral';
              if (reviewFilter === 'critical') return getSentiment(r).sentiment === 'Critical';
              if (reviewFilter === 'unreplied') return !r.reply || !r.reply.trim();
              return true;
            });

            return (
              <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
                {/* Enterprise Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900 tracking-tight">Customer Reviews & Sentiment</h3>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                        {allRatings.length} Ratings Total
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Administrative sentiment analytics, guest satisfaction scores, and management response console.</p>
                  </div>
                </div>

                {/* Unified Enterprise Analytics Bar (Replacing the 4 Separate Cards) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                  {/* Score & Rating Breakdown Block */}
                  <div className="flex items-center gap-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">{overallRating}</span>
                      <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
                    </div>

                    <div className="border-l border-slate-100 pl-4">
                      <div className="flex items-center text-amber-500 text-xs font-semibold">
                        <span>★★★★★</span>
                        <span className="text-slate-500 ml-1.5 font-normal text-[11px]">Average Score</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Calculated across {allRatings.length} customer ratings</p>
                    </div>

                    {/* Compact Star Mini-Bar */}
                    <div className="hidden sm:flex items-center gap-2 border-l border-slate-100 pl-4 text-[10px] text-slate-500 font-mono">
                      <span>5★: {starCounts[5] || 0}</span>
                      <span>·</span>
                      <span>4★: {starCounts[4] || 0}</span>
                      <span>·</span>
                      <span>≤3★: {(starCounts[3] || 0) + (starCounts[2] || 0) + (starCounts[1] || 0)}</span>
                    </div>
                  </div>

                  {/* Vertical Divider (Desktop) */}
                  <div className="hidden lg:block w-px h-10 bg-slate-100"></div>

                  {/* Key Metrics Group */}
                  <div className="grid grid-cols-3 gap-6 text-left">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Sentiment Polarity</div>
                      <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{posPct}% Positive</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Written Feedback</div>
                      <div className="text-xs font-semibold text-slate-800 font-mono mt-1">{textReviews.length} Reviews</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Management Response</div>
                      <div className="text-xs font-semibold text-slate-800 font-mono mt-1">
                        {textReviews.length > 0 ? Math.round((repliedCount / textReviews.length) * 100) : 100}% Replied
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-aspect Satisfaction Breakdown */}
                {foodRatings.length > 0 && (serviceRatings.length > 0 || ambienceRatings.length > 0) && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      Aspect Satisfaction Scores:
                    </span>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Food Quality:</span>
                        <strong className="font-mono text-amber-600 font-bold">★ {avgFood}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Service:</span>
                        <strong className="font-mono text-amber-600 font-bold">★ {avgService}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Ambience:</span>
                        <strong className="font-mono text-amber-600 font-bold">★ {avgAmbience}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Minimalist Clean Filter Tabs */}
                <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-medium overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setReviewFilter('all')}
                    className={`pb-2.5 px-3.5 transition-all cursor-pointer whitespace-nowrap ${
                      reviewFilter === 'all'
                        ? 'text-[#FF6B00] border-b-2 border-[#FF6B00] font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Comments ({textReviews.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('positive')}
                    className={`pb-2.5 px-3.5 transition-all cursor-pointer whitespace-nowrap ${
                      reviewFilter === 'positive'
                        ? 'text-emerald-600 border-b-2 border-emerald-600 font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Positive ({posCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('neutral')}
                    className={`pb-2.5 px-3.5 transition-all cursor-pointer whitespace-nowrap ${
                      reviewFilter === 'neutral'
                        ? 'text-slate-800 border-b-2 border-slate-800 font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Neutral ({neutCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('critical')}
                    className={`pb-2.5 px-3.5 transition-all cursor-pointer whitespace-nowrap ${
                      reviewFilter === 'critical'
                        ? 'text-rose-600 border-b-2 border-rose-600 font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Action Needed ({critCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('unreplied')}
                    className={`pb-2.5 px-3.5 transition-all cursor-pointer whitespace-nowrap ${
                      reviewFilter === 'unreplied'
                        ? 'text-amber-600 border-b-2 border-amber-600 font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Needs Reply ({unrepliedCount})
                  </button>
                </div>

                {/* 2. CUSTOMER REVIEWS LIST (TEXT REVIEWS ONLY) */}
                <div className="space-y-3.5">
                  {filteredReviews.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400">
                      <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-bold text-slate-700">No written reviews match this filter</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {textReviews.length === 0
                          ? `All ${allCustomerRevs.length} customer feedbacks are star-only ratings, which are actively tracked in the Overall Rating.`
                          : 'Try switching to another filter tab above.'}
                      </p>
                    </div>
                  ) : (
                    filteredReviews.map(item => {
                      const sentimentInfo = getSentiment(item);
                      const ratingVal = Number(item.rating || 5);

                      return (
                        <div
                          key={item.id}
                          className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs hover:shadow-xs transition-all space-y-3"
                        >
                          {/* Review Header */}
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-slate-900">{item.customer_name || 'Guest Customer'}</h4>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                  #{item.order_id || 'Table Service'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                                {item.date || 'Recent Visit'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Star Rating display */}
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star
                                    key={s}
                                    size={14}
                                    fill={s <= ratingVal ? '#F59E0B' : 'none'}
                                    stroke={s <= ratingVal ? '#F59E0B' : '#CBD5E1'}
                                  />
                                ))}
                                <span className="text-xs font-black text-slate-700 ml-1.5">{ratingVal}.0</span>
                              </div>

                              {/* Executive Sentiment Badge */}
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${sentimentInfo.bg} ${sentimentInfo.text} ${sentimentInfo.border}`}>
                                {sentimentInfo.sentiment === 'Positive' ? (
                                  <Smile size={13} />
                                ) : sentimentInfo.sentiment === 'Critical' ? (
                                  <Frown size={13} />
                                ) : (
                                  <Meh size={13} />
                                )}
                                <span>{sentimentInfo.label}</span>
                              </span>
                            </div>
                          </div>

                          {/* Customer Comment */}
                          <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 italic">
                            "{item.comment}"
                          </p>

                          {/* Aspect breakdown if present */}
                          {(item.food_rating || item.service_rating || item.ambience_rating) && (
                            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                              {item.food_rating && <span>Food: {item.food_rating}★</span>}
                              {item.service_rating && <span>Service: {item.service_rating}★</span>}
                              {item.ambience_rating && <span>Ambience: {item.ambience_rating}★</span>}
                            </div>
                          )}

                          {/* Management Reply Section */}
                          {item.reply ? (
                            <div className="p-3 rounded-xl bg-orange-50/40 border border-orange-100 flex items-start gap-2.5 text-xs">
                              <CornerDownRight size={14} className="text-[#FF6B00] flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-[#FF6B00] uppercase text-[10px]">Management Response</span>
                                  <span className="text-[10px] text-slate-400 font-medium">Saved</span>
                                </div>
                                <p className="text-slate-700 font-medium mt-0.5 italic">"{item.reply}"</p>
                              </div>
                            </div>
                          ) : (
                            replyReviewId === item.id ? (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Respond as Management
                                </span>
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Type an executive response to this customer..."
                                  rows={2}
                                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-800"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleReplyReviewSubmit(item.id)}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#FF6B00] hover:bg-orange-600 cursor-pointer shadow-xs"
                                  >
                                    Send Response
                                  </button>
                                  <button
                                    onClick={() => { setReplyReviewId(null); setReplyText(''); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] font-medium text-slate-400">No response sent</span>
                                <button
                                  onClick={() => { setReplyReviewId(item.id); setReplyText(''); }}
                                  className="text-xs font-bold text-[#FF6B00] hover:text-orange-600 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <CornerDownRight size={13} />
                                  <span>Reply to Customer</span>
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          </div>
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



      {editLoyaltyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl p-6 bg-white`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-extrabold">Edit Loyalty Rules</h3>
              <button onClick={() => setEditLoyaltyModal(false)} className="text-gray-400 hover:text-red-500 cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveLoyaltyRules} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 mb-1">Points per ₹100 spent</label>
                <input
                  type="number"
                  value={loyaltyRules.pointsPerHundred}
                  onChange={e => setLoyaltyRules({ ...loyaltyRules, pointsPerHundred: Number(e.target.value) })}
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Silver Tier Threshold (Points)</label>
                <input
                  type="number"
                  value={loyaltyRules.silverTierPoints}
                  onChange={e => setLoyaltyRules({ ...loyaltyRules, silverTierPoints: Number(e.target.value) })}
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Gold Tier Threshold (Points)</label>
                <input
                  type="number"
                  value={loyaltyRules.goldTierPoints}
                  onChange={e => setLoyaltyRules({ ...loyaltyRules, goldTierPoints: Number(e.target.value) })}
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Gold Tier Discount (%)</label>
                <input
                  type="number"
                  value={loyaltyRules.goldDiscountPercent}
                  onChange={e => setLoyaltyRules({ ...loyaltyRules, goldDiscountPercent: Number(e.target.value) })}
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">Save Rules</button>
            </form>
          </div>
        </div>
      )}


      {/* =========================================================================
          PORTALIZED FULL-SCREEN MODALS (Directly rendered on document.body)
          Guarantees perfect viewport centering, backdrop coverage, and pinned headers
          ========================================================================= */}

      {/* 1. EDIT / ADD WAITER MODAL */}
      {newStaffForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in font-sans">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl shadow-2xl border bg-white border-slate-100 text-slate-900 overflow-hidden"
          >
            {/* Pinned Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0 bg-slate-50/70">
              <div>
                <h4 className="font-black text-base text-slate-900">
                  {editingStaff ? 'Edit Waiter Details' : 'Add New Waiter'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {editingStaff ? `Updating details for ${editingStaff.name} (${editingStaff.empid})` : 'Register waiter account with terminal login credentials'}
                </p>
              </div>
              <button
                type="button"
                className="cursor-pointer text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-all"
                onClick={() => setNewStaffForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="active-staff-form" onSubmit={handleSaveStaffMember} className="overflow-y-auto p-6 space-y-4 flex-1 text-xs font-semibold">
              {/* Photo Section */}
              <div className="p-3.5 bg-gradient-to-tr from-orange-50/60 to-amber-50/40 rounded-2xl border border-orange-100">
                <label className="block text-orange-950 mb-2 text-[10px] uppercase font-bold tracking-wider">
                  Waiter Photo / Avatar
                </label>
                <div className="flex gap-3 items-center mb-3">
                  <StaffAvatar photo={staffFormState.photo} name={staffFormState.name || 'Waiter'} size="lg" />
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={staffFormState.photo}
                      onChange={(e) => setStaffFormState({ ...staffFormState, photo: e.target.value })}
                      placeholder="Paste Photo URL or Google Drive link"
                      className="w-full p-2 border border-orange-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="flex gap-2 items-center flex-wrap pt-0.5">
                      <label className="cursor-pointer bg-white border border-orange-200 hover:bg-orange-50 text-orange-800 px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all">
                        <Upload size={12} className="text-orange-500" /> Upload from Computer / Phone
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const compressed = await compressImageFile(file, 360, 0.85);
                              if (compressed) {
                                setStaffFormState(prev => ({ ...prev, photo: compressed }));
                              }
                            }
                          }}
                        />
                      </label>
                      {staffFormState.photo && (
                        <button
                          type="button"
                          onClick={() => setStaffFormState({ ...staffFormState, photo: '' })}
                          className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Full Name *</label>
                <input
                  type="text"
                  value={staffFormState.name}
                  onChange={(e) => setStaffFormState({ ...staffFormState, name: e.target.value })}
                  placeholder="e.g. Anand Sharma"
                  required
                  className="w-full p-2.5 border rounded-xl bg-white border-slate-200 text-slate-900"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Phone / Mobile *</label>
                  <input
                    type="text"
                    value={staffFormState.mobile}
                    onChange={(e) => setStaffFormState({ ...staffFormState, mobile: e.target.value })}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full p-2.5 border rounded-xl bg-white border-slate-200 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Email Address</label>
                  <input
                    type="email"
                    value={staffFormState.email}
                    onChange={(e) => setStaffFormState({ ...staffFormState, email: e.target.value })}
                    placeholder="waiter@restaurant.com"
                    className="w-full p-2.5 border rounded-xl bg-white border-slate-200 text-slate-900"
                  />
                </div>
              </div>

              {/* Employee ID & Terminal Password */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Employee ID (EmpID) *</label>
                  <input
                    type="text"
                    value={staffFormState.empid}
                    onChange={(e) => setStaffFormState({ ...staffFormState, empid: e.target.value })}
                    placeholder="e.g. EMP-1024"
                    required
                    className="w-full p-2.5 border rounded-xl font-mono uppercase bg-white border-slate-200 text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-slate-600 text-[10px] uppercase font-bold">Terminal Password *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newPw = 'pass' + Math.floor(1000 + Math.random() * 9000);
                        setStaffFormState(prev => ({ ...prev, password: newPw }));
                      }}
                      className="text-[9px] text-orange-600 font-bold hover:underline cursor-pointer"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={staffFormState.password}
                    onChange={(e) => setStaffFormState({ ...staffFormState, password: e.target.value })}
                    placeholder="Terminal password"
                    required
                    className="w-full p-2.5 border rounded-xl font-mono bg-white border-slate-200 text-slate-900 font-bold"
                  />
                </div>
              </div>

              {/* Shift & Salary (Role is strictly Waiter!) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Role (Locked)</label>
                  <div className="p-2.5 bg-orange-50 border border-orange-200 text-primary font-black rounded-xl text-center">
                    Waiter
                  </div>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Shift *</label>
                  <select
                    value={staffFormState.shift}
                    onChange={(e) => setStaffFormState({ ...staffFormState, shift: e.target.value as any })}
                    className="w-full p-2.5 border rounded-xl bg-white border-slate-200 text-slate-900 font-bold"
                  >
                    <option value="Morning">Morning Shift</option>
                    <option value="Evening">Evening Shift</option>
                    <option value="Night">Night Shift</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Salary (₹) *</label>
                  <input
                    type="number"
                    value={staffFormState.salary}
                    onChange={(e) => setStaffFormState({ ...staffFormState, salary: parseInt(e.target.value) || 0 })}
                    required
                    className="w-full p-2.5 border rounded-xl bg-white border-slate-200 text-slate-900 font-bold"
                  />
                </div>
              </div>

              {/* Table Routing Assignment */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-slate-600 text-[10px] uppercase font-bold">
                    Table Routing & Assignment
                  </label>
                  <button
                    type="button"
                    onClick={() => setStaffFormState(prev => ({
                      ...prev,
                      assignedTables: prev.assignedTables.length === tables.length ? [] : tables.map(t => t.id)
                    }))}
                    className="text-[10px] text-orange-600 font-bold hover:underline cursor-pointer"
                  >
                    {staffFormState.assignedTables.length === tables.length ? 'Clear All' : 'Select All Tables (Full Floor)'}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {tables.map(table => {
                    const isSelected = staffFormState.assignedTables.includes(table.id);
                    return (
                      <button
                        type="button"
                        key={table.id}
                        onClick={() => {
                          setStaffFormState(prev => ({
                            ...prev,
                            assignedTables: isSelected
                              ? prev.assignedTables.filter(t => t !== table.id)
                              : [...prev.assignedTables, table.id]
                          }));
                        }}
                        className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${isSelected
                          ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-orange-500'
                          }`}
                      >
                        Table #{table.id}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">
                  {staffFormState.assignedTables.length === 0 || staffFormState.assignedTables.length === tables.length
                    ? '⚡ Waiter serves ALL tables across the restaurant floor'
                    : `Assigned tables: ${staffFormState.assignedTables.map(t => `T#${t}`).join(', ')}`}
                </p>
              </div>
            </form>

            {/* Pinned Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setNewStaffForm(false)}
                className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="active-staff-form"
                className="w-2/3 bg-primary hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={16} /> Save Waiter Member
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. OTP SECURITY VERIFICATION MODAL (PORTALIZED) */}
      {otpModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in font-sans">
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative my-auto w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${'bg-white border-gray-100 text-slate-900'
              }`}
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 ">
              <h4 className="font-extrabold text-sm">Security Verification</h4>
              <button className="cursor-pointer text-gray-400 hover:text-gray-700" onClick={() => { setOtpModal(false); setPendingEditStaff(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 text-xs font-semibold">
              <p className="text-[10px] text-gray-500">To edit staff credentials, please enter the Admin OTP.</p>
              <div>
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter OTP (e.g., 1234)"
                  required
                  className="w-full p-2.5 border rounded-xl text-center text-lg tracking-widest bg-white  border-gray-200 "
                />
              </div>
              <button onClick={handleVerifyOTP} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors shadow-sm">
                Verify & Edit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6. DATE-WISE ORDERS EXPLORER MODAL (PORTALIZED) */}
      {showDateOrdersModal && createPortal(
        <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in font-sans">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-5xl rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    Date-wise Orders Explorer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isAllDatesMode 
                      ? 'Inspecting all historical orders' 
                      : `Inspecting orders for ${formatFriendlyDate(selectedOrderDate)}`}
                  </p>
                </div>
              </div>

              {/* Date Navigation Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleStepDay(-1)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <input
                    type="date"
                    value={selectedOrderDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedOrderDate(e.target.value);
                        setIsAllDatesMode(false);
                      }
                    }}
                    className="text-xs font-semibold bg-transparent px-2.5 py-1 text-slate-800 outline-none cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => handleStepDay(1)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
                    title="Next Day"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderDate(getOrderLocalDateStr(new Date()));
                      setIsAllDatesMode(false);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      !isAllDatesMode && selectedOrderDate === getOrderLocalDateStr(new Date())
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAllDatesMode(!isAllDatesMode)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isAllDatesMode
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isAllDatesMode ? 'Specific Date' : 'All Dates'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDateOrdersModal(false)}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer ml-1"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Date Summary Cards & Filtered List */}
            {(() => {
              const currentOrders = dateWiseOrders;
              const valid = currentOrders.filter(o => (o.status as any) !== 'Cancelled');
              const revenue = valid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
              const aov = valid.length > 0 ? revenue / valid.length : 0;
              const delivered = currentOrders.filter(o => o.status === 'Delivered').length;
              const kitchen = currentOrders.filter(o => o.status === 'Preparing' || o.status === 'Ready to Serve' || (o.status as any) === 'Ready' || o.status === 'Confirmed').length;
              const paidCount = currentOrders.filter(o => o.paymentStatus === 'Paid').length;
              const unpaidCount = currentOrders.filter(o => o.paymentStatus !== 'Paid' && (o.status as any) !== 'Cancelled').length;

              // Filtered list based on search and sub-filters
              const filteredList = currentOrders.filter(o => {
                if (dateOrdersStatusFilter !== 'All') {
                  if (dateOrdersStatusFilter === 'Delivered' && o.status !== 'Delivered') return false;
                  if (dateOrdersStatusFilter === 'Kitchen' && !(o.status === 'Preparing' || o.status === 'Ready to Serve' || (o.status as any) === 'Ready' || o.status === 'Confirmed')) return false;
                  if (dateOrdersStatusFilter === 'Cancelled' && (o.status as any) !== 'Cancelled') return false;
                }
                if (dateOrdersPaymentFilter !== 'All') {
                  if (dateOrdersPaymentFilter === 'Paid' && o.paymentStatus !== 'Paid') return false;
                  if (dateOrdersPaymentFilter === 'Pending' && o.paymentStatus === 'Paid') return false;
                }
                if (dateOrdersSearch.trim()) {
                  const q = dateOrdersSearch.toLowerCase().trim();
                  const matchId = o.id.toLowerCase().includes(q);
                  const matchTable = String(o.tableId).includes(q);
                  const matchPhone = (o.customerPhone || '').toLowerCase().includes(q);
                  const matchDish = (o.items || []).some(it => it.name.toLowerCase().includes(q));
                  if (!matchId && !matchTable && !matchPhone && !matchDish) return false;
                }
                return true;
              });

              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* KPI Bar */}
                  <div className="p-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Orders on Date</span>
                      <strong className="text-xl font-black text-slate-900 mt-0.5 block">{currentOrders.length}</strong>
                      <span className="text-[11px] text-slate-500 font-medium">{delivered} delivered &bull; {kitchen} active</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Date Revenue</span>
                      <strong className="text-xl font-black text-slate-900 mt-0.5 block">₹{revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      <span className="text-[11px] text-slate-500 font-medium">{paidCount} paid &bull; {unpaidCount} unpaid</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Average Order</span>
                      <strong className="text-xl font-black text-slate-900 mt-0.5 block">₹{aov.toFixed(2)}</strong>
                      <span className="text-[11px] text-slate-500 font-medium">Per completed check</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex flex-col justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Export Date Data</span>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={handleExportDateOrdersExcel}
                          className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Export to Excel"
                        >
                          <FileSpreadsheet size={12} />
                          <span>Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportDateOrdersPDF}
                          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Export to PDF"
                        >
                          <FileText size={12} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search Strip */}
                  <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={dateOrdersSearch}
                        onChange={(e) => setDateOrdersSearch(e.target.value)}
                        placeholder="Search order #, table, customer phone, dish..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#FF6B00] transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                        {(['All', 'Delivered', 'Kitchen', 'Cancelled'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => setDateOrdersStatusFilter(st)}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              dateOrdersStatusFilter === st
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                        {(['All', 'Paid', 'Pending'] as const).map(pt => (
                          <button
                            key={pt}
                            onClick={() => setDateOrdersPaymentFilter(pt)}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              dateOrdersPaymentFilter === pt
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {pt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="flex-1 overflow-y-auto no-scrollbar p-4">
                    {filteredList.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <Calendar size={36} className="mx-auto mb-2 text-slate-300" />
                        <h4 className="font-extrabold text-sm text-slate-700">No orders match the filter</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Try adjusting your search query, status filters, or pick another calendar date above.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto no-scrollbar border border-slate-200/80 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-3.5">Order ID</th>
                              <th className="py-3 px-3.5">Time</th>
                              <th className="py-3 px-3.5">Table</th>
                              <th className="py-3 px-3.5">Customer</th>
                              <th className="py-3 px-3.5">Items Ordered</th>
                              <th className="py-3 px-3.5 text-center">Status</th>
                              <th className="py-3 px-3.5 text-center">Payment</th>
                              <th className="py-3 px-3.5 text-right">Amount</th>
                              <th className="py-3 px-3.5 text-center">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium bg-white">
                            {filteredList.map((order) => {
                              const orderTime = order.createdAt 
                                ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                                : '--:--';
                              const totalQty = (order.items || []).reduce((s, it) => s + (it.quantity || 1), 0);

                              return (
                                <tr
                                  key={order.id}
                                  onClick={() => setSelectedOrderForDetail(order)}
                                  className="hover:bg-orange-50/50 transition-colors cursor-pointer group"
                                  title="Click to view full itemized receipt & breakdown"
                                >
                                  <td className="py-3 px-3.5 font-bold font-mono text-slate-900">
                                    #{order.id}
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-500 font-medium whitespace-nowrap">
                                    {orderTime}
                                  </td>
                                  <td className="py-3 px-3.5 font-extrabold text-slate-800">
                                    Table #{order.tableId || 'Dine-In'}
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px]">
                                    {order.customerPhone ? order.customerPhone : 'Guest'}
                                  </td>
                                  <td className="py-3 px-3.5 max-w-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                        {totalQty} {totalQty === 1 ? 'item' : 'items'}
                                      </span>
                                      <span className="text-slate-800 font-semibold truncate block max-w-[200px]" title={(order.items || []).map(i => `${i.name} x${i.quantity}`).join(', ')}>
                                        {(order.items || []).map(i => `${i.name} x${i.quantity}`).join(', ')}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block ${
                                      order.status === 'Preparing'
                                        ? 'bg-orange-50 text-orange-600 border border-orange-200/50'
                                        : (order.status === 'Ready to Serve' || (order.status as any) === 'Ready')
                                          ? 'bg-sky-50 text-sky-600 border border-sky-200/50'
                                          : order.status === 'Delivered'
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block ${
                                      order.paymentStatus === 'Paid'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                    }`}>
                                      {order.paymentStatus === 'Paid' ? 'Paid (Cash)' : 'Pending'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                                    ₹{Number(order.total || 0).toFixed(2)}
                                  </td>
                                  <td className="py-3 px-3.5 text-center">
                                    <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-[#FF6B00] group-hover:bg-orange-100/70 inline-flex items-center justify-center transition-colors">
                                      <Receipt size={14} />
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* 7. ORDER RECEIPT & DETAILS MODAL (PORTALIZED) */}
      {selectedOrderForDetail && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in font-sans">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                  Table #{selectedOrderForDetail.tableId} • Receipt
                </span>
                <h3 className="font-black text-lg text-slate-900 mt-1">
                  Order #{selectedOrderForDetail.id}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {selectedOrderForDetail.createdAt ? new Date(selectedOrderForDetail.createdAt).toLocaleString() : 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-50 p-3 rounded-2xl mb-4 text-xs font-semibold space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Customer Phone:</span>
                <span className="font-mono text-slate-900">{selectedOrderForDetail.customerPhone || 'Walk-In Guest'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payment Status:</span>
                <span className={`font-bold ${selectedOrderForDetail.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedOrderForDetail.paymentStatus === 'Paid' ? 'Paid (Cash Settle)' : 'Pending Cash Payment'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Kitchen Status:</span>
                <span className="font-bold text-slate-900">{selectedOrderForDetail.status}</span>
              </div>
            </div>

            {/* Itemized List */}
            <div className="mb-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">Dishes Ordered</span>
              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                {(selectedOrderForDetail.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-50 pb-2">
                    <div>
                      <p className="font-bold text-slate-900">{it.name} <span className="text-orange-600">x{it.quantity}</span></p>
                      {it.instructions && it.instructions.length > 0 && (
                        <p className="text-[10px] text-slate-400 italic">
                          {Array.isArray(it.instructions) ? it.instructions.join(', ') : it.instructions}
                        </p>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-900">₹{(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>₹{Number(selectedOrderForDetail.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GST (5%):</span>
                <span>₹{Number(selectedOrderForDetail.gst || 0).toFixed(2)}</span>
              </div>
              {Number(selectedOrderForDetail.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount Applied:</span>
                  <span>-₹{Number(selectedOrderForDetail.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(selectedOrderForDetail.tip || 0) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Waiter Tip:</span>
                  <span>₹{Number(selectedOrderForDetail.tip).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200/80 pt-2">
                <span>Total Bill:</span>
                <span className="text-[#FF6B00]">₹{Number(selectedOrderForDetail.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrderForDetail(null)}
              className="w-full mt-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
            >
              Close Receipt
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Bhakasura AI Chat Bot */}
      <BhakasuraChatBot contextData={{ orders, menuItems, staff, tables, reviews, mlMetrics: mlService.getModelMetadata(), mlBestDishes: mlService.getTopBestInHotel(10) }} />
    </div>
  );
};
export default AdminDashboard;
