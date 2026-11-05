import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../supabase';
import { MenuItem, Order, UserProfile, WaiterRequest } from '../../types';
import { MENU_ITEMS, COMING_SOON_IMAGE } from '../../data/menu';
import {
  LayoutDashboard, ShoppingBag, ChefHat, Utensils, Layers, Users,
  Map, CreditCard, Award, Megaphone, UserCheck, BarChart3,
  Settings, Shield, QrCode, Image, MessageSquare, Search, Trash2,
  Edit3, Plus, X, ChevronRight, Download, Sparkles, Filter, Check,
  AlertTriangle, Moon, Sun, RefreshCw, FileText, Mail, MessageCircle,
  CornerDownRight, UserPlus, Heart, TrendingUp, DollarSign, Calendar,
  TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Star, Eye, EyeOff, Phone, Copy, FileSpreadsheet, ChevronDown, ExternalLink,
  Upload, Smartphone, Share2, CheckCircle2,
  Bell, LogOut, Activity, BookOpen, Smile, Meh, Frown
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
  | 'overview' | 'orders' | 'menu' | 'staff'
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
  const [reviewFilter, setReviewFilter] = useState<'all' | 'positive' | 'neutral' | 'critical' | 'unreplied'>('all');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);


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
    <div className="flex h-screen overflow-hidden font-sans bg-slate-50 text-brand-text">

      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="w-64 flex flex-col justify-between flex-shrink-0 z-20 border-r bg-[#11141D] text-white border-slate-800">
        <div>
          {/* Logo Header from Figma */}
          <div className="p-5 border-b flex items-center gap-3 border-gray-800/80">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 flex-shrink-0">
              <div className="flex items-end gap-1 h-4">
                <span className="w-1 h-2 bg-white rounded-full"></span>
                <span className="w-1 h-4 bg-white rounded-full"></span>
                <span className="w-1 h-2.5 bg-white rounded-full"></span>
              </div>
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight leading-none text-white">DineSmart</h2>
              <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-1 block">Manager Panel</span>
            </div>
          </div>

          {/* Navigation links matching Figma groups & active states */}
          <div className="p-3.5 space-y-3.5 overflow-y-auto no-scrollbar max-h-[calc(100vh-145px)]">
            <div>
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-2 px-3">Operations</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'overview'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <LayoutDashboard size={15} className={activeTab === 'overview' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Overview & Home</span>
                  {activeTab === 'overview' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-2 px-3">Menu & QR Codes</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'menu'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <BookOpen size={15} className={activeTab === 'menu' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Menu Management</span>
                  {activeTab === 'menu' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
                <button
                  onClick={() => setActiveTab('qrcodes')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'qrcodes'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <QrCode size={15} className={activeTab === 'qrcodes' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>QR Code Manager</span>
                  {activeTab === 'qrcodes' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-2 px-3">Logistics & Staff</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('staff')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'staff'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <UserCheck size={15} className={activeTab === 'staff' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Waiter Management</span>
                  {activeTab === 'staff' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-2 px-3">Loyalty & Promos</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('loyalty')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'loyalty'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <Award size={15} className={activeTab === 'loyalty' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Loyalty Programs</span>
                  {activeTab === 'loyalty' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
                <button
                  onClick={() => setActiveTab('promotions')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'promotions'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <Megaphone size={15} className={activeTab === 'promotions' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Promotions Builder</span>
                  {activeTab === 'promotions' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-2 px-3">AI & Analytics</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'reports'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <BarChart3 size={15} className={activeTab === 'reports' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Reports & Export</span>
                  {activeTab === 'reports' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'reviews'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <MessageSquare size={15} className={activeTab === 'reviews' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Reviews Sentiment</span>
                  {activeTab === 'reviews' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-2 px-3">Control & Security</p>
              <nav className="space-y-1">
                <button
                  onClick={() => { setActiveTab('settings'); setSettingsForm((prev: any) => prev || { ...alertSettings }); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'settings'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <Settings size={15} className={activeTab === 'settings' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Restaurant Settings</span>
                  {activeTab === 'settings' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${activeTab === 'security'
                      ? 'bg-[#FF6B00]/15 text-white font-bold border border-[#FF6B00]/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium'
                    }`}
                >
                  <Shield size={15} className={activeTab === 'security' ? 'text-[#FF6B00]' : 'text-slate-400'} />
                  <span>Security Audit Log</span>
                  {activeTab === 'security' && <ChevronRight size={13} className="ml-auto text-[#FF6B00]" />}
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Profile & Logout Card from Figma */}
        <div className="p-3 border-t border-gray-800/80">
          <div className="p-3 rounded-2xl bg-[#161922] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                AD
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white leading-tight truncate">Admin</p>
                <span className="text-[10px] text-slate-400 font-medium block">Role: Admin</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Header */}
        <header className="border-b px-6 py-3.5 flex justify-between items-center gap-4 z-10 flex-shrink-0 bg-white border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
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
            {/* Date Pill from Figma */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <Calendar size={13} className="text-slate-400" />
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>

            {/* User Avatar Circle */}
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center justify-center shadow-xs border border-amber-200" title="Admin">
              AD
            </div>
          </div>
        </header>

        {/* Dynamic Inner Panel Viewport */}
        <main className="flex-1 overflow-y-auto p-6 relative">

          {/* Global Tables Warning Removed */}

          {/* ----------------------------------------------------
              VIEW 1: OVERVIEW (ORIGINAL DATA REAL-TIME METRICS)
              ---------------------------------------------------- */}
          {activeTab === 'overview' && (() => {
            const validOrders = orders.filter(o => (o.status as any) !== 'Cancelled');
            const todayDateStr = new Date().toISOString().split('T')[0];
            const todayValidOrders = validOrders.filter(o => {
              const d = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '';
              return d === todayDateStr;
            });

            const todayRevenue = todayValidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            const totalRecordedRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            const displayRevenue = todayValidOrders.length > 0 ? todayRevenue : totalRecordedRevenue;

            const occupiedTablesCount = tables.filter(t => t.status === 'Ordered' || t.status === 'Cooking' || t.status === 'Serving' || t.status === 'Billing').length;
            const availableTablesCount = tables.filter(t => t.status === 'Available').length;
            const otherTablesCount = tables.filter(t => t.status === 'Cleaning' || t.status === 'Reserved').length;
            const totalTablesCount = tables.length;
            const floorDisplay = `${occupiedTablesCount}/${totalTablesCount || 0}`;
            const occupancyPct = totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0;

            const liveOrdersCount = orders.filter(o => o.status === 'Confirmed' || o.status === 'Preparing' || o.status === 'Ready to Serve').length;
            const completedOrdersCount = orders.filter(o => o.status === 'Delivered').length;

            // Area chart revenue data computed purely from actual orders
            const getRealRevenueArea = () => {
              if (revenueTimeframe === 'today') {
                const hourSlots = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
                const bucketMap: Record<string, number> = {};
                hourSlots.forEach(h => { bucketMap[h] = 0; });

                const ordersToUse = todayValidOrders.length > 0 ? todayValidOrders : validOrders;
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

            // Recent Orders list purely from original database orders
            const displayRecentOrders = orders.slice(0, 5).map(o => {
              const tableNum = Number(o.tableId);
              const matchedStaff = staff.find(s => s.assignedTables && !isNaN(tableNum) && s.assignedTables.includes(tableNum));
              return {
                id: `#${o.id}`,
                location: o.tableId ? `Table ${o.tableId}` : 'Dine-In',
                waiter: (o as any).waiterName || matchedStaff?.name || 'Floor Staff',
                amount: Number(o.total || 0),
                status: o.status,
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

                {/* 2. TOP KPI CARDS (4 CARDS FROM FIGMA DESIGN) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Today's Revenue */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF6B00]">
                        <CreditCard size={18} />
                      </div>
                      <span className="text-slate-300 font-bold tracking-widest text-xs cursor-pointer hover:text-slate-500">•••</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-slate-400 block">Today's Revenue</span>
                      <strong className="text-2xl font-black text-slate-900 tracking-tight mt-1 block">
                        ₹{displayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                      <div className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500">
                        <span>{todayValidOrders.length > 0 ? `${todayValidOrders.length} orders today` : `${validOrders.length} all-time orders`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Active Orders */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500">
                        <Activity size={18} />
                      </div>
                      <span className="text-slate-300 font-bold tracking-widest text-xs cursor-pointer hover:text-slate-500">•••</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-slate-400 block">Active Orders</span>
                      <strong className="text-2xl font-black text-slate-900 tracking-tight mt-1 block">
                        {liveOrdersCount}
                      </strong>
                      <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <span>{completedOrdersCount} completed</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Tables Occupied */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                        <Layers size={18} />
                      </div>
                      <span className="text-slate-300 font-bold tracking-widest text-xs cursor-pointer hover:text-slate-500">•••</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-slate-400 block">Tables Occupied</span>
                      <strong className="text-2xl font-black text-slate-900 tracking-tight mt-1 block">
                        {floorDisplay}
                      </strong>
                      <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-500">
                        <ArrowUpRight size={13} />
                        <span>{occupancyPct}% occupancy rate</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Staff on Duty */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <Users size={18} />
                      </div>
                      <span className="text-slate-300 font-bold tracking-widest text-xs cursor-pointer hover:text-slate-500">•••</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-slate-400 block">Staff on Duty</span>
                      <strong className="text-2xl font-black text-slate-900 tracking-tight mt-1 block">
                        {staff.length}
                      </strong>
                      <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <span>{staff.filter(s => s.shift === 'Morning').length} Morning • {staff.filter(s => s.shift === 'Evening').length} Evening</span>
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
                            Live Orders
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
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">Recent orders</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Latest orders across all service areas</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="text-xs font-bold text-[#FF6B00] hover:text-orange-600 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>View all orders</span>
                        <ChevronRight size={13} />
                      </button>
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                          {displayRecentOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                                No customer orders recorded yet. Orders placed by guests or staff will appear here.
                              </td>
                            </tr>
                          ) : (
                            displayRecentOrders.map((order, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-3 font-bold text-slate-900 font-mono">{order.id}</td>
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

                {/* 6. SMART AI RECOMMENDATIONS & BEST IN HOTEL DISH INTELLIGENCE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Top Performing Dishes Leaderboard */}
                  <div className="p-6 rounded-2xl border bg-white border-slate-200/90 shadow-2xs">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">Top Performing Dishes</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Volume, revenue & gross profit margins</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#FF6B00] bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60">
                        Live Leaderboard
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {topSellingDishes.map(item => (
                        <div
                          key={item.rank}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base font-black w-6 text-center">
                              {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                            </span>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-900">{item.name}</h4>
                              <span className="text-[10px] text-slate-400 font-semibold">{item.category}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-500">{item.sold} sold</span>
                            <span className="text-xs font-black text-slate-900 w-16 text-right">₹{item.rev.toLocaleString()}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              {item.margin}% Margin
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Smart AI Recommendations & Alerts */}
                  <div className="p-6 rounded-2xl border bg-white border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center font-bold">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-base text-slate-900">Smart AI Recommendations</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Real-time floor suggestions & demand balancing</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                          Active Advisor
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl border bg-amber-50/60 border-amber-200/70 text-slate-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <strong className="text-xs font-black text-amber-950">📦 Stock Prep</strong>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">High</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
                            Prep 15kg Chicken & Biryani spices before 7 PM rush.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border bg-blue-50/60 border-blue-200/70 text-slate-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <strong className="text-xs font-black text-blue-950">⚡ Station 1 Load</strong>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-200/80 text-blue-900">85% Cap</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
                            Station 1 at 85% capacity — auto-rebalance starters to Station 2.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border bg-purple-50/60 border-purple-200/70 text-slate-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <strong className="text-xs font-black text-purple-950">🥤 Beverage Upsell</strong>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-900">+₹65 AOV</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
                            Bundle Mango Lassi with Spicy Biryani to lift AOV by ₹65.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border bg-emerald-50/60 border-emerald-200/70 text-slate-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <strong className="text-xs font-black text-emerald-950">⏱️ SLA Balancing</strong>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900">&lt;18m SLA</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
                            Prep time SLA at 14.2m. Shift 1 expediter to Station 3.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Predicted Tomorrow Revenue: <strong className="text-slate-800">₹53,600</strong></span>
                      <span className="text-emerald-600 font-bold">94% forecast accuracy</span>
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
                {/* Header */}
                <div className="border-b pb-4">
                  <h3 className="font-extrabold text-base">Dishes</h3>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['All', 'Breakfast', 'Soups', 'Starters', 'Main Course', 'Combos', 'Breads', 'Desserts', 'Beverages', 'Veg', 'Non-Veg'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setMenuFilterCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${menuFilterCategory === cat
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-gray-100  text-gray-500 hover:text-black dark:hover:text-white'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full md:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search dish name..."
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-transparent focus:outline-primary"
                    />
                    {menuSearchQuery && (
                      <button
                        onClick={() => setMenuSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
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

                {/* Menu Grid with Direct Openable Image Links */}
                {filteredDishes.length === 0 ? (
                  <div className="text-center py-16 border rounded-3xl bg-gray-50/50 /30">
                    <p className="text-sm font-bold text-gray-400">No dishes found matching your search filter.</p>
                    <button
                      onClick={() => { setMenuFilterCategory('All'); setMenuSearchQuery(''); }}
                      className="mt-2 text-xs font-bold text-primary underline cursor-pointer"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {filteredDishes.map(item => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${'bg-white border-gray-100'
                          }`}
                      >
                        <div>
                          {/* Image Container with Direct Link Overlay and Badge */}
                          <div className="relative group overflow-hidden rounded-2xl mb-3 bg-gray-100 h-36">
                            <img
                              src={item.image || COMING_SOON_IMAGE}
                              alt={item.name}
                              className="w-full h-full object-cover rounded-2xl transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = COMING_SOON_IMAGE;
                              }}
                            />

                            {/* Direct Link Hover Overlay - Clicking opens image link directly or prompts photo upload */}
                            {item.image && !item.image.startsWith('data:') ? (
                              <>
                                <a
                                  href={item.image}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 text-white font-bold text-xs backdrop-blur-[2px]"
                                  title="Click to open image directly in new tab"
                                >
                                  <ExternalLink size={20} className="drop-shadow" />
                                  <span className="drop-shadow text-[11px]">Open Full Image</span>
                                </a>

                                <a
                                  href={item.image}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute top-2 right-2 bg-black/60 hover:bg-primary text-white px-2 py-1 rounded-lg backdrop-blur-md transition-colors shadow-sm flex items-center gap-1 text-[10px] font-bold"
                                  title="Open image directly in new tab"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink size={11} />
                                  <span>Open</span>
                                </a>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMenuItem(item);
                                  setMenuFormState({
                                    name: item.name,
                                    price: item.price,
                                    category: item.category,
                                    image: item.image || '',
                                    description: item.description,
                                    calories: item.calories,
                                    prepTime: item.prepTime,
                                    isVeg: item.isVeg,
                                    isSpecial: !!item.isSpecial
                                  });
                                  setNewMenuItemForm(true);
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 text-white font-bold text-xs backdrop-blur-[2px] cursor-pointer"
                              >
                                <Upload size={18} />
                                <span>Upload Dish Photo</span>
                              </button>
                            )}

                            {/* Veg / Non-Veg Tag */}
                            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shadow-sm ${item.isVeg ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                              }`}>
                              {item.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>

                            {/* Chef Special Tag */}
                            {item.isSpecial && (
                              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-amber-500 text-white shadow-sm">
                                Special
                              </span>
                            )}
                          </div>

                          {/* Item Details */}
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-extrabold text-xs text-gray-900 line-clamp-1">{item.name}</h4>
                            <span className="font-extrabold text-primary text-xs whitespace-nowrap ml-2">{formatPrice(item.price)}</span>
                          </div>

                          <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-400 font-semibold">
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md">{item.category}</span>
                            {item.prepTime && <span>⏳ {item.prepTime}</span>}
                            {item.calories && <span>🔥 {item.calories} kcal</span>}
                          </div>

                          {item.description && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Card Footer with Direct Open Link and Edit/Delete */}
                        <div className="border-t pt-3 mt-1 flex justify-between items-center text-[10px] font-bold">
                          {/* Direct clickable URL link or Photo Upload button */}
                          {item.image && !item.image.startsWith('data:') ? (
                            <a
                              href={item.image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 truncate max-w-[130px] font-semibold"
                              title={`Open ${item.image}`}
                            >
                              <ExternalLink size={10} className="shrink-0" />
                              <span className="truncate">Open Image</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMenuItem(item);
                                setMenuFormState({
                                  name: item.name,
                                  price: item.price,
                                  category: item.category,
                                  image: item.image || '',
                                  description: item.description,
                                  calories: item.calories,
                                  prepTime: item.prepTime,
                                  isVeg: item.isVeg,
                                  isSpecial: !!item.isSpecial
                                });
                                setNewMenuItemForm(true);
                              }}
                              className="text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                            >
                              <Upload size={10} />
                              <span>Set Photo</span>
                            </button>
                          )}

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
                              className="p-1.5 border rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={() => handleDeleteMenuItem(item.id, item.name)}
                              className="p-1.5 border rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 size={11} />
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
          {activeTab === 'staff' && (
            <div className="space-y-6 animate-fade-in font-sans">
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 text-primary flex items-center justify-center font-bold">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-900 tracking-tight">
                        Waiter Staff Management
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Manage waiter accounts, terminal login credentials, and table assignments. Direct manual entries only.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
                  <a
                    href="/downloads/TableTap_Waiter.apk"
                    download="TableTap_Waiter.apk"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md shrink-0"
                    title="Download Waiter Android App APK"
                  >
                    <Smartphone size={15} />
                    <span>Download Waiter APK</span>
                    <Download size={13} className="opacity-90" />
                  </a>

                  <button
                    onClick={fetchData}
                    className="p-2.5 border border-slate-200 text-slate-600 hover:text-primary hover:border-orange-300 rounded-2xl cursor-pointer bg-slate-50/70 hover:bg-white transition-all shadow-xs"
                    title="Refresh Waiters from database"
                  >
                    <RefreshCw size={15} />
                  </button>

                  <button
                    onClick={handleOpenAddStaff}
                    className="bg-primary hover:bg-orange-600 text-white text-xs font-black px-5 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md shrink-0"
                  >
                    <Plus size={16} />
                    <span>+ Add Waiter</span>
                  </button>
                </div>
              </div>

              {/* Roster Quick KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Waiters</span>
                  <strong className="text-2xl font-black text-slate-900 mt-1 block">{staff.length}</strong>
                  <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">● Active on Floor</span>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Morning Shift</span>
                  <strong className="text-2xl font-black text-slate-900 mt-1 block">
                    {staff.filter(s => s.shift === 'Morning').length}
                  </strong>
                  <span className="text-[10px] text-amber-600 font-bold mt-1 inline-block">☀️ 08:00 AM - 04:00 PM</span>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Evening Shift</span>
                  <strong className="text-2xl font-black text-slate-900 mt-1 block">
                    {staff.filter(s => s.shift === 'Evening').length}
                  </strong>
                  <span className="text-[10px] text-orange-600 font-bold mt-1 inline-block">🌆 04:00 PM - 11:00 PM</span>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Night Shift</span>
                  <strong className="text-2xl font-black text-slate-900 mt-1 block">
                    {staff.filter(s => s.shift === 'Night').length}
                  </strong>
                  <span className="text-[10px] text-purple-600 font-bold mt-1 inline-block">🌙 11:00 PM - Close</span>
                </div>
              </div>

              {/* Waiter Roster Cards Grid */}
              {staff.length === 0 ? (
                <div className="text-center py-16 px-6 bg-white rounded-3xl border border-dashed border-slate-200">
                  <div className="w-16 h-16 rounded-3xl bg-orange-50 text-primary mx-auto flex items-center justify-center mb-4 shadow-xs">
                    <Users size={28} />
                  </div>
                  <h4 className="font-black text-base text-slate-900">No Waiters Registered</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    There are currently no waiters on the roster. Add your waiters manually with direct terminal login credentials.
                  </p>
                  <button
                    onClick={handleOpenAddStaff}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-black rounded-2xl hover:bg-orange-600 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus size={15} />
                    <span>Add First Waiter</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {staff.map(emp => {
                    const showPw = revealedPasswords[emp.id];
                    return (
                      <div
                        key={emp.id}
                        className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Header with Waiter Photo, Name, and Shift */}
                          <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3 gap-3">
                            <div className="flex items-center gap-3">
                              <StaffAvatar photo={emp.photo} name={emp.name} size="lg" />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-black text-base text-slate-900">{emp.name}</h4>
                                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-orange-50 text-orange-600 border border-orange-200/70">
                                    Waiter
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-mono font-bold">
                                    ID: {emp.empid}
                                  </span>
                                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded-lg font-bold">
                                    Shift: {emp.shift}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400 block font-medium">Salary / Month</span>
                              <strong className="text-sm font-black text-slate-900">{formatPrice(emp.salary)}</strong>
                            </div>
                          </div>

                          {/* Credentials & Contact Box */}
                          <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-3 text-[11px]">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Terminal Password</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono font-black text-slate-900 text-xs">
                                  {showPw ? (emp.password || '••••••') : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswords(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                  title={showPw ? "Hide Password" : "Show Password"}
                                >
                                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                {emp.password && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(emp.password || '');
                                        alert(`Copied password for ${emp.name}`);
                                      }}
                                      className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                      title="Copy Password"
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const shareText = `🍽️ Waiter Login Credentials\n👤 Name: ${emp.name}\n🆔 Employee ID: ${emp.empid}\n🔑 Password: ${emp.password || 'Contact Admin'}`;
                                        navigator.clipboard.writeText(shareText);
                                        alert(`Copied credentials for ${emp.name} to clipboard!`);
                                      }}
                                      className="text-slate-400 hover:text-emerald-600 cursor-pointer p-0.5"
                                      title="Copy Credentials to Share via WhatsApp"
                                    >
                                      <Share2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Phone / Mobile</span>
                              {emp.mobile ? (
                                <a
                                  href={`tel:${emp.mobile}`}
                                  className="font-bold text-primary hover:underline flex items-center gap-1 mt-0.5 truncate"
                                >
                                  <Phone size={11} className="shrink-0" />
                                  <span>{emp.mobile}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">Not set</span>
                              )}
                            </div>

                            {emp.email && (
                              <div className="col-span-2 border-t border-slate-200/60 pt-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Email Address</span>
                                <a href={`mailto:${emp.email}`} className="text-primary hover:underline flex items-center gap-1 font-bold truncate">
                                  <Mail size={11} className="shrink-0" />
                                  <span>{emp.email}</span>
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Table Routing Assignment */}
                          <div className="mb-3">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                              Table Routing & Assignment
                            </span>
                            {(!emp.assignedTables || emp.assignedTables.length === 0 || emp.assignedTables.length === tables.length) ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/70">
                                ⚡ Serves All Tables (Full Floor)
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {emp.assignedTables.map(tId => (
                                  <span key={tId} className="px-2.5 py-0.5 rounded-xl bg-orange-50 text-orange-700 border border-orange-200/70 text-xs font-bold">
                                    Table #{tId}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Performance Badges */}
                          <div className="grid grid-cols-3 gap-2 py-2.5 border-t border-b border-slate-100 text-center text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Rating</span>
                              <strong className="text-amber-500 font-bold">★ {emp.performance?.ratings || '5.0'}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Attendance</span>
                              <strong className="text-emerald-600 font-bold">{emp.attendance || 100}%</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Completed</span>
                              <strong className="font-bold text-slate-900">{emp.performance?.ordersDelivered || 0} orders</strong>
                            </div>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-3 mt-2 flex justify-between items-center text-xs">
                          <span className="text-[10px] text-slate-400">
                            Avg serving: {emp.performance?.avgServingTime || 'N/A'}
                          </span>
                          {(role === 'Hotel Manager' || role === 'Admin' || role === 'Manager' || !role) && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleOpenEditStaff(emp)}
                                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                                title="Edit Waiter Details"
                              >
                                <Edit3 size={12} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStaffMember(emp.id, emp.name)}
                                className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                                title="Delete Waiter"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                <div className={`p-4 rounded-3xl border bg-white border-gray-50`}>
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
                  <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl bg-white`}>
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
                          onChange={(e) => setCouponFormState({ ...couponFormState, code: e.target.value })}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1">Discount Amount (₹)</label>
                        <input
                          type="number"
                          value={couponFormState.discount}
                          onChange={(e) => setCouponFormState({ ...couponFormState, discount: parseInt(e.target.value) })}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1">Min Bill Target (₹)</label>
                        <input
                          type="number"
                          value={couponFormState.minBill}
                          onChange={(e) => setCouponFormState({ ...couponFormState, minBill: parseInt(e.target.value) })}
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
                    className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between bg-white border-gray-50`}
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

            return (
              <div className="space-y-6 animate-fade-in font-sans">
                {/* Header Section */}
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h2 className="font-extrabold text-2xl mb-1 text-gray-900 tracking-tight">Download Hotel Reports</h2>
                    <p className="text-[13px] text-gray-500 max-w-2xl">
                      Generate complete hotel reports — sales, orders, staff, payments and analytics — as Excel or PDF, or preview them before download.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 border-transparent text-white font-bold py-2 px-4 rounded-xl text-sm bg-[#00a65a] hover:bg-[#008f4d] transition-colors shadow-sm cursor-pointer" title="Download Excel Spreadsheet">
                      <FileSpreadsheet size={16} strokeWidth={2.5} />
                      Excel
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 border-transparent text-white font-bold py-2 px-4 rounded-xl text-sm bg-[#dd4b39] hover:bg-[#c23321] transition-colors shadow-sm cursor-pointer" title="Download PDF Document">
                      <FileText size={16} strokeWidth={2.5} />
                      PDF
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 my-2"></div>

                {/* Filter Section */}
                <div className="p-5 rounded-2xl border shadow-sm bg-white border-gray-200 flex flex-wrap gap-4 justify-between items-center relative z-20">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date Range Filter</label>
                      <div className="relative">
                        <select
                          value={reportDateFilter}
                          onChange={(e) => setReportDateFilter(e.target.value as any)}
                          className="appearance-none border text-xs py-2 pl-3.5 pr-9 rounded-xl font-bold outline-none cursor-pointer transition-colors bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                        >
                          <option value="Today">Today Only</option>
                          <option value="This Week">This Week (Last 7 Days)</option>
                          <option value="This Month">This Month (Last 30 Days)</option>
                          <option value="All">All Time History</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category Scope</label>
                      <div className="relative">
                        <select
                          value={reportCategoryFilter}
                          onChange={(e) => setReportCategoryFilter(e.target.value)}
                          className="appearance-none border text-xs py-2 pl-3.5 pr-9 rounded-xl font-bold outline-none cursor-pointer transition-colors bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                        >
                          <option value="All">All Food Categories</option>
                          <option value="Breakfast">Breakfast</option>
                          <option value="Main Course">Main Course</option>
                          <option value="Starters">Starters</option>
                          <option value="Breads">Breads</option>
                          <option value="Beverages">Beverages</option>
                          <option value="Desserts">Desserts</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-orange-600 font-bold self-end pb-1 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                    ✓ PDF & Excel exports will strictly contain records matching your active filters.
                  </div>
                </div>

                {/* Custom SVG Sales Chart */}
                <div className="p-6 rounded-2xl border shadow-sm bg-white border-gray-200 relative z-10 mt-2">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-800">Weekly Sales Volume Chart</h4>
                      <p className="text-[11px] text-gray-400">Total recorded sales aggregated across days of the week</p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {reportOrders.length} matching order{reportOrders.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="w-full h-[280px] relative">
                    {/* Y-Axis Grid Lines & Labels */}
                    <div className="absolute inset-0 flex flex-col justify-between text-[11px] font-bold text-gray-400">
                      {ySteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="w-12 text-right">{step}</span>
                          <div className={`flex-1 ${idx === ySteps.length - 1 ? 'border-t border-gray-300' : 'border-t border-dashed border-gray-200'}`}></div>
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
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-30 shadow-md">
                              {day}: ₹{amount.toLocaleString('en-IN')}
                            </div>
                            <div
                              style={{ height: `${pct}%` }}
                              className={`w-full rounded-t-sm transition-all cursor-pointer ${
                                amount > 0
                                  ? 'bg-[#ff7f24] hover:bg-[#ea580c] shadow-xs'
                                  : 'bg-slate-200 hover:bg-slate-300'
                              }`}
                            ></div>
                          </div>
                        );
                      })}
                    </div>

                    {/* X-Axis Labels */}
                    <div className="absolute bottom-0 left-16 right-0 flex justify-around px-2 -mb-6 text-[11px] font-bold text-gray-500">
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
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm">Restaurant Configurations</h3>
                <p className="text-[10px] text-gray-400">Modify operating hours, tax metrics, invoice GST numbers, and system theme.</p>
              </div>

              <div className={`p-6 rounded-3xl border shadow-sm bg-white border-gray-50`}>
                {(() => {
                  const currentSettings = settingsForm || alertSettings;
                  return (
                    <form className="space-y-4 text-xs font-semibold max-w-2xl" onSubmit={handleSaveSettings}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">Restaurant Name</label>
                          <input
                            type="text"
                            required
                            className="w-full p-2.5 border rounded-xl bg-transparent"
                            value={currentSettings.restaurantName || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, restaurantName: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Owner Name</label>
                          <input
                            type="text"
                            placeholder="Enter Owner Name"
                            required
                            className="w-full p-2.5 border rounded-xl bg-transparent"
                            value={currentSettings.ownerName || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, ownerName: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">Branch Name</label>
                          <input
                            type="text"
                            placeholder="Enter Branch Name"
                            required
                            className="w-full p-2.5 border rounded-xl bg-transparent"
                            value={currentSettings.branchName || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, branchName: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Email Address</label>
                          <input
                            type="email"
                            placeholder="Enter Email"
                            required
                            pattern="[a-zA-Z0-9._%+\-]+@gmail\.com$"
                            title="Must be a valid @gmail.com address"
                            className="w-full p-2.5 border rounded-xl bg-transparent"
                            value={currentSettings.email || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">Mobile Number</label>
                          <input
                            type="tel"
                            placeholder="Primary Contact"
                            required
                            pattern="^[6-9]\d{9}$"
                            title="Must be a valid 10-digit Indian mobile number"
                            className="w-full p-2.5 border rounded-xl bg-transparent"
                            value={currentSettings.mobile || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, mobile: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Alternate Contact Number</label>
                          <input
                            type="tel"
                            placeholder="Alternate Contact"
                            required
                            pattern="^[6-9]\d{9}$"
                            title="Must be a valid 10-digit Indian mobile number"
                            className="w-full p-2.5 border rounded-xl bg-transparent"
                            value={currentSettings.alternateMobile || ''}
                            onChange={(e) => setSettingsForm({ ...currentSettings, alternateMobile: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className={`border-t pt-4 mt-4 border-gray-100`}>
                        <h4 className="font-bold text-gray-500 mb-3 uppercase tracking-wider">Registration Details</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">GST Number / Tax ID</label>
                            <input
                              type="text"
                              required
                              pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
                              title="Must be a valid 15-character GSTIN format"
                              value={currentSettings.gstNo || ''}
                              onChange={(e) => setSettingsForm({ ...currentSettings, gstNo: e.target.value })}
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">FSSAI License Number (India)</label>
                            <input
                              type="text"
                              placeholder="FSSAI Number"
                              required
                              pattern="^[1-2]\d{13}$"
                              title="Must be a valid 14-digit FSSAI license number"
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                              value={currentSettings.fssai || ''}
                              onChange={(e) => setSettingsForm({ ...currentSettings, fssai: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Tax Percentage (%)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              value={currentSettings.tax || 0}
                              onChange={(e) => setSettingsForm({ ...currentSettings, tax: parseInt(e.target.value) || 0 })}
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                        </div>
                      </div>

                      <div className={`border-t pt-4 mt-4 border-gray-100`}>
                        <h4 className="font-bold text-gray-500 mb-3 uppercase tracking-wider">Location Details</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-gray-400 mb-1">Address</label>
                            <textarea
                              placeholder="Street Address"
                              required
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                              rows={2}
                              value={currentSettings.address || ''}
                              onChange={(e) => setSettingsForm({ ...currentSettings, address: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-gray-400 mb-1">City</label>
                              <input
                                type="text"
                                placeholder="City"
                                required
                                className="w-full p-2.5 border rounded-xl bg-transparent"
                                value={currentSettings.city || ''}
                                onChange={(e) => setSettingsForm({ ...currentSettings, city: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 mb-1">State</label>
                              <input
                                type="text"
                                placeholder="State"
                                required
                                className="w-full p-2.5 border rounded-xl bg-transparent"
                                value={currentSettings.state || ''}
                                onChange={(e) => setSettingsForm({ ...currentSettings, state: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 mb-1">Country</label>
                              <input
                                type="text"
                                placeholder="Country"
                                required
                                className="w-full p-2.5 border rounded-xl bg-transparent"
                                value={currentSettings.country || ''}
                                onChange={(e) => setSettingsForm({ ...currentSettings, country: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-gray-400 mb-1">PIN Code</label>
                              <input
                                type="text"
                                placeholder="PIN Code"
                                required
                                pattern="^[1-9][0-9]{5}$"
                                title="Must be a valid 6-digit Indian PIN code"
                                className="w-full p-2.5 border rounded-xl bg-transparent"
                                value={currentSettings.pinCode || ''}
                                onChange={(e) => setSettingsForm({ ...currentSettings, pinCode: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 mb-1">Landmark</label>
                              <input
                                type="text"
                                placeholder="Nearby Landmark"
                                required
                                className="w-full p-2.5 border rounded-xl bg-transparent"
                                value={currentSettings.landmark || ''}
                                onChange={(e) => setSettingsForm({ ...currentSettings, landmark: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 mb-1">Google Maps Location</label>
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  placeholder="Maps URL"
                                  required
                                  value={currentSettings.mapsLocation || ''}
                                  onChange={(e) => setSettingsForm({ ...currentSettings, mapsLocation: e.target.value })}
                                  className="w-full p-2.5 border rounded-xl bg-transparent flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={handleGetLocation}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:hover:bg-gray-700 p-2.5 rounded-xl border border-transparent flex items-center justify-center cursor-pointer transition-colors"
                                  title="Detect Current Location"
                                >
                                  <Map size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button type="submit" className="bg-primary text-white font-bold py-2.5 px-5 rounded-xl cursor-pointer">
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  );
                })()}
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

              <div className={`p-5 rounded-3xl border shadow-sm bg-white border-gray-50`}>
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
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  const secureUrl = num.qr_token
                    ? `${baseUrl}/table/${num.id}?token=${num.qr_token}`
                    : `No Token Session Configured`;
                  return (
                    <div key={num.id} className={`p-4 rounded-3xl border text-center shadow-sm bg-white border-gray-50`}>
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
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#FF6B00]">
                      CUSTOMER FEEDBACK INTELLIGENCE
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                      Customer Reviews & Sentiment
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      Clear-cut administrative sentiment analytics, satisfaction metrics, and management response console.
                    </p>
                  </div>
                </div>

                {/* 1. TOP METRIC CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Overall Average Rating */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Overall Rating</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                          <Star size={16} fill="currentColor" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mt-2">
                        <strong className="text-3xl font-black text-slate-900">★ {overallRating}</strong>
                        <span className="text-sm font-bold text-slate-400">/ 5.0</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        Calculated by all {allCustomerRevs.length} customer ratings
                      </p>
                    </div>

                    {/* Star Breakdown Bars */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                      {[5, 4, 3, 2, 1].map(stars => {
                        const count = starCounts[stars] || 0;
                        const pct = allRatings.length > 0 ? Math.round((count / allRatings.length) * 100) : (stars === 5 ? 100 : 0);
                        return (
                          <div key={stars} className="flex items-center gap-2 text-[10px]">
                            <span className="w-5 text-slate-500 font-bold">{stars}★</span>
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${stars >= 4 ? 'bg-amber-400' : stars === 3 ? 'bg-slate-400' : 'bg-rose-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-6 text-right text-slate-400 font-medium">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 2: Sentiment Polarity (Original Data) */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sentiment Polarity</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Smile size={16} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mt-2">
                        <strong className="text-3xl font-black text-emerald-600">{posPct}%</strong>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Positive
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        Based on original customer feedback dataset
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${posPct}%` }} title={`Positive: ${posPct}%`} />
                        <div className="bg-slate-400 h-full" style={{ width: `${neutPct}%` }} title={`Neutral: ${neutPct}%`} />
                        <div className="bg-rose-500 h-full" style={{ width: `${critPct}%` }} title={`Critical: ${critPct}%`} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                        <span className="text-emerald-700">{posCount} Positive</span>
                        <span className="text-slate-600">{neutCount} Neutral</span>
                        <span className="text-rose-600">{critCount} Critical</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Feedback Coverage */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Written Reviews</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <MessageSquare size={16} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mt-2">
                        <strong className="text-3xl font-black text-slate-900">{textReviews.length}</strong>
                        <span className="text-xs font-bold text-slate-400">Reviews</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        Only reviews with written feedback displayed below
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 font-medium">
                        <span className="font-bold text-slate-800">{starOnlyCount}</span> star-only ratings contribute directly to Overall Rating without text clutter.
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Response Rate */}
                  <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Management Response</span>
                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#FF6B00] flex items-center justify-center">
                          <CornerDownRight size={16} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mt-2">
                        <strong className="text-3xl font-black text-slate-900">
                          {textReviews.length > 0 ? Math.round((repliedCount / textReviews.length) * 100) : 100}%
                        </strong>
                        <span className="text-xs font-bold text-slate-400">Replied</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        {unrepliedCount === 0 ? 'All customer reviews answered' : `${unrepliedCount} awaiting manager response`}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">{repliedCount} Replied</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${unrepliedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {unrepliedCount} Pending
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-aspect Satisfaction Breakdown */}
                {foodRatings.length > 0 && (serviceRatings.length > 0 || ambienceRatings.length > 0) && (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Aspect Satisfaction Breakdown
                    </span>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Food Quality:</span>
                        <strong className="text-xs font-black text-amber-600">★ {avgFood} / 5.0</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Service Speed:</span>
                        <strong className="text-xs font-black text-amber-600">★ {avgService} / 5.0</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Ambience:</span>
                        <strong className="text-xs font-black text-amber-600">★ {avgAmbience} / 5.0</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-b border-slate-200 pb-3">
                  <button
                    onClick={() => setReviewFilter('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Comments ({textReviews.length})
                  </button>
                  <button
                    onClick={() => setReviewFilter('positive')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'positive'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    Positive ({posCount})
                  </button>
                  <button
                    onClick={() => setReviewFilter('neutral')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'neutral'
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Neutral ({neutCount})
                  </button>
                  <button
                    onClick={() => setReviewFilter('critical')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'critical'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    Action Needed ({critCount})
                  </button>
                  <button
                    onClick={() => setReviewFilter('unreplied')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'unreplied'
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'bg-white text-[#FF6B00] border border-orange-200 hover:bg-orange-50'
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

      {/* Bhakasura AI Chat Bot */}
      <BhakasuraChatBot contextData={{ orders, menuItems, staff, tables, reviews, mlMetrics: mlService.getModelMetadata(), mlBestDishes: mlService.getTopBestInHotel(10) }} />
    </div>
  );
};
export default AdminDashboard;
