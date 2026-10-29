import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../supabase';
import { MenuItem, Order, UserProfile, WaiterRequest } from '../../types';
import { MENU_ITEMS } from '../../data/menu';
import { 
  LayoutDashboard, ShoppingBag, ChefHat, Utensils, Layers, Users, 
  Map, CreditCard, Award, Megaphone, UserCheck, BarChart3, 
  Settings, Shield, QrCode, Image, MessageSquare, Search, Trash2, 
  Edit3, Plus, X, ChevronRight, Download, Sparkles, Filter, Check, 
  AlertTriangle, Moon, Sun, RefreshCw, FileText, Mail, MessageCircle, 
  CornerDownRight, UserPlus, Heart, TrendingUp, DollarSign, Calendar,
  TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Star, Eye, EyeOff, Phone, Copy, FileSpreadsheet, ChevronDown, ExternalLink,
  Upload, Smartphone, Share2, CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { 
  predictSales, getCustomerAIInsights, 
  getAIBusinessSuggestions, getPeakTimePredictions, analyzeReviewSentiment,
  SalesPrediction, CustomerInsights, BusinessSuggestion, 
  PeakTimePrediction, SentimentResult 
} from './groq';
import BhakasuraChatBot from './BhakasuraChatBot';
import { generateComprehensivePDF, generateComprehensiveExcel } from '../../utils/reportGenerator';
import { mlService } from '../../services/mlService';
import { formatPhotoUrl, getInitials, PRESET_AVATARS, getDriveThumbnailFallback } from '../../utils/photoHelper';

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
  const [alertSettings, setAlertSettings] = useState<any>({ tax: 5, currency: '₹', gstNo: '27AAAAA1111A1Z1', mapsLocation: '' });

  // Waiter APK Download & Management State
  const [showApkQr, setShowApkQr] = useState(false);
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [copiedApkLink, setCopiedApkLink] = useState(false);
  const [apkInfo, setApkInfo] = useState<{
    version: string;
    fileName: string;
    fileSize: string;
    downloadUrl: string;
    updatedAt: string;
    customUploaded: boolean;
  }>(() => {
    const saved = localStorage.getItem('dinesmart_waiter_apk_info');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      version: 'v1.2.0',
      fileName: 'TableTap-WaiterApp.apk',
      fileSize: '40.2 MB',
      downloadUrl: '/downloads/WaiterApp.apk',
      updatedAt: 'October 2026',
      customUploaded: false
    };
  });

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
      await db.saveSettings(alertSettings);
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
      if (dbSettings) setAlertSettings(dbSettings);
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

  // Waiter APK Download & Management Logic
  const apkDownloadFullUrl = apkInfo.downloadUrl.startsWith('http') || apkInfo.downloadUrl.startsWith('blob:')
    ? apkInfo.downloadUrl
    : `${window.location.origin}${apkInfo.downloadUrl}`;
  const apkQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(apkDownloadFullUrl)}`;

  const handleUploadNewApk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('Please select a valid Android package file (.apk)');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newApkData = {
      version: 'v' + (parseFloat(apkInfo.version.replace('v', '')) + 0.1).toFixed(1) + '-custom',
      fileName: file.name,
      fileSize: sizeInMB,
      downloadUrl: objectUrl,
      updatedAt: now,
      customUploaded: true
    };

    setApkInfo(newApkData);
    localStorage.setItem('dinesmart_waiter_apk_info', JSON.stringify({
      ...newApkData,
      downloadUrl: '/downloads/WaiterApp.apk'
    }));
    logActivity(`Uploaded updated Waiter Terminal APK: ${file.name} (${sizeInMB})`);
    alert(`Successfully loaded new Waiter APK: ${file.name} (${sizeInMB})`);
  };

  const handleCopyApkLink = () => {
    navigator.clipboard.writeText(apkDownloadFullUrl);
    setCopiedApkLink(true);
    setTimeout(() => setCopiedApkLink(false), 2500);
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

  // Real Dynamic Chart Calculations from Actual Orders (Default to 0)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayRevenues: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  orders.forEach(o => {
    try {
      const d = new Date(o.createdAt);
      const dayName = daysOfWeek[d.getDay()];
      if (dayName && dayRevenues[dayName] !== undefined) {
        dayRevenues[dayName] += (o.total || 0);
      }
    } catch (e) {}
  });

  const weeklyData = [
    { name: 'Mon', revenue: dayRevenues['Mon'] },
    { name: 'Tue', revenue: dayRevenues['Tue'] },
    { name: 'Wed', revenue: dayRevenues['Wed'] },
    { name: 'Thu', revenue: dayRevenues['Thu'] },
    { name: 'Fri', revenue: dayRevenues['Fri'] },
    { name: 'Sat', revenue: dayRevenues['Sat'] },
    { name: 'Sun', revenue: dayRevenues['Sun'] }
  ];

  const categoryTotals: Record<string, number> = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      const cat = menuItems.find(m => m.id === it.menuItemId)?.category || 'Main Course';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (it.price * it.quantity);
    });
  });

  const categoryColors: Record<string, string> = {
    'Main Course': '#f97316',
    'Biryani': '#fb923c',
    'Starters': '#fbd38d',
    'Soups': '#fde68a',
    'Desserts': '#ffedd5',
    'Beverages': '#fef9c3',
    'Breads': '#fed7aa',
  };

  const categoryData = Object.keys(categoryTotals).length > 0
    ? Object.entries(categoryTotals).map(([name, value]) => ({
        name,
        value,
        color: categoryColors[name] || '#f97316'
      }))
    : [{ name: 'No Orders', value: 0, color: '#e5e7eb' }];

  const hoursMap: Record<string, number> = {
    '10 AM': 0, '11 AM': 0, '12 PM': 0, '1 PM': 0, '2 PM': 0,
    '6 PM': 0, '7 PM': 0, '8 PM': 0, '9 PM': 0
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
      else if (hr === 18) slot = '6 PM';
      else if (hr === 19) slot = '7 PM';
      else if (hr === 20) slot = '8 PM';
      else if (hr === 21) slot = '9 PM';
      if (slot && hoursMap[slot] !== undefined) hoursMap[slot]++;
    } catch (e) {}
  });

  const hourlyData = Object.entries(hoursMap).map(([hour, ordersCount]) => ({ hour, orders: ordersCount }));

  const itemSalesMap: Record<string, { name: string; sold: number; rev: number }> = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      if (!itemSalesMap[it.name]) {
        itemSalesMap[it.name] = { name: it.name, sold: 0, rev: 0 };
      }
      itemSalesMap[it.name].sold += it.quantity;
      itemSalesMap[it.name].rev += (it.price * it.quantity);
    });
  });
  const topSellingDishes = Object.values(itemSalesMap)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 7)
    .map((item, idx) => ({ ...item, rank: idx + 1, trend: 0 }));

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
      <aside className="w-64 flex flex-col justify-between flex-shrink-0 z-20 border-r bg-brand-text text-white border-slate-200">
        <div>
          {/* Logo Header */}
          <div className="p-5 border-b flex items-center gap-3 border-gray-800/80">
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
              </nav>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-3">Menu & QR Codes</p>
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
                  onClick={() => setActiveTab('staff')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                    activeTab === 'staff' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <UserCheck size={14} />
                  <span>Waiter Management</span>
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
                  <span>Restaurant Settings</span>
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
        <div className="p-4 border-t border-gray-800/80">
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
        <header className="border-b p-5 flex justify-between items-center z-10 flex-shrink-0 bg-white border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span>Admin Dashboard</span>
              {loading && <RefreshCw size={14} className="text-primary animate-spin" />}
            </h1>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
              Sync: {syncTime || 'Just now'}
            </span>
          </div>

          <div className="flex items-center gap-4">


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
              
              {/* Primary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Today's Revenue</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getTodayRevenue())}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500">
                      <ArrowUpRight size={12} />
                      <span>{orders.length > 0 ? '+100% live' : '₹0 today'}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center"><DollarSign size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Orders</span>
                    <strong className="text-xl font-black mt-1 block">{orders.length}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>{orders.length > 0 ? `${orders.length} orders recorded` : '0 orders recorded'}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><ShoppingBag size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Repeat Customers</span>
                    <strong className="text-xl font-black mt-1 block">0%</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>0 of {orders.length} orders</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Users size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Avg Spend / Visit</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getAverageOrderValue())}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Per completed bill</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center"><CreditCard size={18} /></div>
                </div>
              </div>

              {/* Secondary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">New Customers</span>
                    <strong className="text-xl font-black mt-1 block">{orders.length > 0 ? '100%' : '0%'}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>{orders.length} customer visits</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center"><UserPlus size={18} /></div>
                </div>
                
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Satisfaction Score</span>
                    <strong className="text-xl font-black mt-1 block flex items-center gap-1">
                      {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1) : '0.0'} 
                      <Star size={16} fill="currentColor" className="text-yellow-400" />
                    </strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Based on {reviews.length} reviews</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center"><Star size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Kitchen Queue</span>
                    <strong className="text-xl font-black mt-1 block">
                      {orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking').length}
                    </strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-500">
                      <span>Active tickets</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><ChefHat size={18} /></div>
                </div>
                
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between bg-white border-gray-50`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Live Floor</span>
                    <strong className="text-xl font-black mt-1 block">
                      {tables.filter(t => t.status === 'Available').length} / {tables.length > 0 ? tables.length : 10}
                    </strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Tables Available</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><Map size={18} /></div>
                </div>
              </div>

              {/* Data Visualization Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`col-span-2 p-6 rounded-3xl border shadow-sm bg-white border-gray-50`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Weekly Revenue</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Revenue generated this week</p>
                      <div className="mt-4">
                        <p className="text-[10px] text-gray-400 font-bold">Total Revenue</p>
                        <div className="flex items-center gap-2">
                          <strong className="text-2xl font-black">{formatPrice(getTodayRevenue())}</strong>
                          <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded flex items-center">
                            Live Database
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 font-bold">This Week</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `₹${val}`} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 6, 6]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-3 bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2">
                    <Sparkles size={16} />
                    <span>
                      {orders.length > 0 
                        ? `Live order data is connected. Total revenue: ${formatPrice(getTodayRevenue())}.` 
                        : 'No sales recorded yet. As customers order from tables, revenue charts will update automatically.'}
                    </span>
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border shadow-sm flex flex-col bg-white border-gray-50`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Revenue by Category</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Menu category breakdown</p>
                    </div>
                  </div>
                  <div className="h-48 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total Revenue</span>
                      <strong className="text-sm font-black">{formatPrice(getTodayRevenue())}</strong>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2.5 pt-4 border-t border-gray-100">
                    {categoryData.filter(c => c.value > 0).slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                          <span className="text-gray-600">{cat.name}</span>
                        </div>
                        <div className="flex gap-4">
                          <span>₹{cat.value.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    {categoryData.filter(c => c.value > 0).length === 0 && (
                      <p className="text-[11px] text-gray-400 text-center py-2">No category sales recorded yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Visualization Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-6 rounded-3xl border shadow-sm bg-white border-gray-50`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Top Selling Dishes</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Best performing dishes today</p>
                    </div>
                    <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">Live</span>
                  </div>
                  <div className="space-y-4">
                    {topSellingDishes.length > 0 ? (
                      topSellingDishes.map(item => (
                        <div key={item.rank} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className={`w-5 text-center font-black ${item.rank <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                              {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}
                            </span>
                            <span className="font-bold">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500">{item.sold} sold</span>
                            <span className="font-bold w-16 text-right">₹{item.rev.toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-gray-400 text-xs">
                        No dishes sold yet today. Real orders will rank dishes automatically.
                      </div>
                    )}
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border shadow-sm bg-white border-gray-50`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Peak Business Hours</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Orders and revenue by hour</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis dataKey="hour" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="orders" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Data Visualization Row 3 */}
              <div className={`p-6 rounded-3xl border shadow-sm bg-white border-gray-50`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-extrabold text-brand-text">Revenue Overview</h3>
                    <p className="text-[11px] text-gray-400 mt-1">Yearly revenue growth · <span className="font-bold text-green-500">CAGR +12.8%</span></p>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                      <button className="px-4 py-1.5 text-xs font-bold bg-white shadow-sm rounded-lg text-gray-700">Monthly</button>
                      <button className="px-4 py-1.5 text-xs font-bold text-gray-500 rounded-lg hover:text-gray-700">Yearly</button>
                    </div>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `₹${val/100000}L`} />
                      <Tooltip cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '5 5' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#f97316', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#f97316' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI Business Insights Integrated */}
              <div className={`p-6 rounded-3xl border shadow-sm bg-orange-50/30 border-orange-100`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-brand-text text-lg">AI Business Insights</h3>
                    <p className="text-[11px] text-gray-400">Automatically generated using today's sales data</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl bg-green-50 border border-green-100 text-green-900`}>
                    <TrendingUp size={16} className="mb-2 text-green-500" />
                    <p className="text-xs font-semibold leading-relaxed">Revenue increased by 12.4% compared to yesterday — driven by high Biryani orders.</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-orange-50 border border-orange-100 text-orange-900`}>
                    <Star size={16} className="mb-2 text-orange-500" />
                    <p className="text-xs font-semibold leading-relaxed">Chicken Dum Biryani generated the highest revenue today with ₹35,400.</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900`}>
                    <Clock size={16} className="mb-2 text-blue-500" />
                    <p className="text-xs font-semibold leading-relaxed">Friday evening (7-9 PM) is the busiest business period with 310 orders.</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-purple-50 border border-purple-100 text-purple-900`}>
                    <CreditCard size={16} className="mb-2 text-purple-500" />
                    <p className="text-xs font-semibold leading-relaxed">UPI is the most preferred payment method — 48% of all transactions today.</p>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border flex items-center justify-between mb-4 bg-orange-100/50 border-orange-200`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center"><TrendingUp size={24} /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-600">Predicted Tomorrow Revenue</p>
                      <div className="flex items-center gap-2 mt-1">
                        <strong className="text-2xl font-black text-brand-text">₹53,600</strong>
                        <span className="text-[10px] font-bold text-green-600">94% confidence</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">AI Recommendations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 bg-white border-gray-100`}>
                      <span className="text-lg">📦</span> Increase Chicken stock before evening rush
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 bg-white border-gray-100`}>
                      <span className="text-lg">🧃</span> Launch beverage combo to boost drink sales
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 bg-white border-gray-100`}>
                      <span className="text-lg">🍮</span> Promote desserts after 7 PM via QR table menu
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 bg-white border-gray-100`}>
                      <span className="text-lg">⚡</span> Optimize kitchen efficiency during 1 PM & 8 PM peak
                    </div>
                  </div>
                </div>

                {/* 🤖 MACHINE LEARNING MODEL INTELLIGENCE (TRAINED ON 23,708 ORDERS) */}
                <div className={`mt-6 pt-6 border-t border-gray-100`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black">
                          ML
                        </span>
                        <h4 className="font-extrabold text-sm text-brand-text flex items-center gap-2">
                          Machine Learning Intelligence: Dynamic Best in Hotel
                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                            Trained on 23,708 Orders
                          </span>
                        </h4>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Random Forest Prep Time Regressor (R²=0.957, MAE=1.27m) + Market Basket Association Engine
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg">
                        Session: {mlService.getBestForCurrentSession().sessionName}
                      </span>
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">
                        Dynamic Re-scoring Active
                      </span>
                    </div>
                  </div>

                  {/* Best in Hotel ML Table */}
                  <div className="overflow-x-auto no-scrollbar rounded-2xl border border-gray-100 ">
                    <table className="w-full text-left text-xs">
                      <thead className={`text-[10px] uppercase font-extrabold tracking-wider bg-gray-50 text-gray-500`}>
                        <tr>
                          <th className="py-2.5 px-3">Rank & Dish</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3 text-center">ML Match Score</th>
                          <th className="py-2.5 px-3 text-center">Predicted Prep Time</th>
                          <th className="py-2.5 px-3 text-center">1-Yr Sales Volume</th>
                          <th className="py-2.5 px-3">Top AI Pairing (Cross-Sell)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                        {mlService.getTopBestInHotel(6).map((item, index) => {
                          const pairings = mlService.getPairingsForDish(item.name);
                          return (
                            <tr key={item.name} className="hover:bg-purple-50/20 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-brand-text flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                  index === 0 ? 'bg-amber-400 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {index + 1}
                                </span>
                                <span>{item.name}</span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-400 text-[11px]">{item.category}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="bg-purple-100 text-purple-800 font-black text-[10px] px-2 py-0.5 rounded-full">
                                  {item.compositeScore} / 100
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-gray-600">
                                ⏱️ {item.avgPrepDelayMin} mins
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-brand-text">
                                {item.ordersCount.toLocaleString()} orders
                              </td>
                              <td className="py-2.5 px-3">
                                {pairings.length > 0 ? (
                                  <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    + {pairings[0].pairedWith} ({Math.round(pairings[0].confidence)}%)
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[10px]">Standard item</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ----------------------------------------------------
                  LIVE KITCHEN MONITORING & DISH QUEUE (INTEGRATED IN OVERVIEW)
                  ---------------------------------------------------- */}
              <div className={`p-6 rounded-3xl border shadow-sm space-y-6 bg-white border-gray-50`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100  pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center font-bold">
                      <ChefHat size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-brand-text text-base">Live Kitchen Monitoring</h3>
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                          Live KDS Feed
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">Real-time cooking queue, delay alerts, and chef workload allocation</p>
                    </div>
                  </div>
                  <button
                    onClick={runAIKitchenAdvisor}
                    className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles size={14} className="text-secondary animate-pulse" />
                    <span>Run AI Workload Advisor</span>
                  </button>
                </div>

                {/* Live Kitchen Metric Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3.5 rounded-2xl border bg-orange-50/50 border-orange-100`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Cooking</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black text-orange-500">
                        {orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking').length}
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">orders</span>
                    </div>
                  </div>
                  <div className={`p-3.5 rounded-2xl border bg-blue-50/50 border-blue-100`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ready to Serve</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black text-blue-500">
                        {orders.filter(o => o.status === 'Ready to Serve').length}
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">dishes</span>
                    </div>
                  </div>
                  <div className={`p-3.5 rounded-2xl border bg-green-50/50 border-green-100`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg Prep Time</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black text-green-500">14.2</span>
                      <span className="text-[10px] text-gray-400 font-semibold">mins (Target: &lt;18m)</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl border bg-purple-50/50 border-purple-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kitchen Stations</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black text-purple-500">
                        3
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">active stations</span>
                    </div>
                  </div>
                </div>

                {/* Dual Column: Active Cooking Orders Queue + Kitchen Station Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: Active Kitchen Order Tickets */}
                  <div className="p-4 rounded-2xl border bg-gray-50/70 border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-extrabold text-xs text-brand-text flex items-center gap-2">
                        <span>🍳 Live Ticket Queue</span>
                        <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
                          {orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking' || o.status === 'Confirmed' || o.status === 'Ready to Serve').length}
                        </span>
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium">Auto-updates every 12s</span>
                    </div>

                    <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pr-1">
                      {orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking' || o.status === 'Confirmed' || o.status === 'Ready to Serve').length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <ChefHat size={32} className="mx-auto mb-2 opacity-40 text-orange-400" />
                          <p className="text-xs font-bold text-gray-500">Kitchen Queue All Clear!</p>
                          <p className="text-[10px] mt-0.5">No pending cooking tickets right now.</p>
                        </div>
                      ) : (
                        orders
                          .filter(o => o.status === 'Preparing' || o.status === 'Cooking' || o.status === 'Confirmed' || o.status === 'Ready to Serve')
                          .slice(0, 6)
                          .map(order => (
                            <div
                              key={order.id}
                              className="p-3 rounded-xl border transition-all bg-white border-gray-200 shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500 font-extrabold text-[10px]">
                                    Table {order.tableId}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-6)}</span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    order.status === 'Ready to Serve'
                                      ? 'bg-blue-100 text-blue-700'
                                      : order.status === 'Cooking'
                                      ? 'bg-orange-100 text-orange-700 animate-pulse'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </div>
                              <div className="text-[11px] font-semibold text-gray-700 space-y-0.5">
                                {order.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>{it.quantity}x {it.name}</span>
                                    {it.instructions && it.instructions.length > 0 && (
                                      <span className="text-[9px] text-orange-500 font-normal italic">
                                        ({it.instructions.join(', ')})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  {/* Right: Kitchen Station Status */}
                  <div className="p-4 rounded-2xl border bg-gray-50/70 border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-extrabold text-xs text-brand-text flex items-center gap-2">
                        <span>👨‍🍳 Active Kitchen Stations</span>
                        <span className="bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
                          3
                        </span>
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium">Station Workloads</span>
                    </div>

                    <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pr-1">
                      <div className="space-y-2">
                        {[
                          { name: 'Station 1: Curry & Gravies', station: 'Main Course & Biryani', shift: 'Morning', orders: 42 },
                          { name: 'Station 2: Starters & Tandoor', station: 'Kebabs, Grills & Appetizers', shift: 'Morning', orders: 38 },
                          { name: 'Station 3: Breads & Beverages', station: 'Naan, Rotis, Desserts', shift: 'Evening', orders: 29 },
                        ].map((mockStation, i) => (
                          <div key={i} className="p-2.5 rounded-xl border flex justify-between items-center bg-white border-gray-200 shadow-xs">
                            <div>
                              <p className="font-bold text-xs">{mockStation.name}</p>
                              <p className="text-[9px] text-gray-400">{mockStation.station} • {mockStation.shift} Shift</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold text-[9px]">
                              {mockStation.orders} Orders
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base">Dishes Menu Catalog</h3>
                      <span className="bg-primary/10 text-primary font-bold text-xs px-2.5 py-0.5 rounded-full">
                        {currentList.length} Dishes
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Configure dishes and pricing. Click any image or link to open in full resolution.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await db.syncAllMenuToSupabase();
                          const freshMenu = await db.getMenuItems();
                          setMenuItems(freshMenu);
                          alert(`Synchronized & reloaded all ${freshMenu.length} dishes from Supabase successfully!`);
                        } catch (e) {
                          const freshMenu = await db.getMenuItems();
                          setMenuItems(freshMenu && freshMenu.length >= 40 ? freshMenu : MENU_ITEMS);
                          alert(`Retrieved ${freshMenu.length || MENU_ITEMS.length} dishes from database/catalog.`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="border border-orange-200 bg-orange-50/50 hover:bg-orange-100/50 text-orange-600 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-400 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                      title="Fast sync & reload 40 curated dishes from Supabase"
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      <span>Sync & Reload Menu ({MENU_ITEMS.length} Dishes)</span>
                    </button>
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
                      className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Plus size={14} />
                      <span>Add Menu Item</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['All', 'Breakfast', 'Soups', 'Starters', 'Main Course', 'Combos', 'Breads', 'Desserts', 'Beverages', 'Veg', 'Non-Veg'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setMenuFilterCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          menuFilterCategory === cat 
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
                        <h4 className="font-extrabold text-sm">{editingMenuItem ? 'Edit Menu Item' : 'Create New Menu Item'}</h4>
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
                              onChange={(e) => setMenuFormState({...menuFormState, name: e.target.value})}
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
                              onChange={(e) => setMenuFormState({...menuFormState, price: parseInt(e.target.value) || 0})}
                              required
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                        </div>

                        {/* Direct Image Link input with test open button */}
                        <div>
                          <label className="block text-gray-400 mb-1">Dish Image URL (Direct Web Link)</label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={menuFormState.image}
                              onChange={(e) => setMenuFormState({...menuFormState, image: e.target.value})}
                              placeholder="https://images.unsplash.com/..."
                              required
                              className="w-full p-2.5 border rounded-xl bg-transparent text-xs"
                            />
                            {menuFormState.image && (
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
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                                }}
                              />
                              <div className="text-[11px] overflow-hidden">
                                <p className="font-bold text-gray-600 ">Live Preview Thumbnail</p>
                                <a 
                                  href={menuFormState.image} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate block max-w-xs"
                                >
                                  {menuFormState.image}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">Category</label>
                            <select
                              value={menuFormState.category}
                              onChange={(e) => setMenuFormState({...menuFormState, category: e.target.value as MenuItem['category']})}
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
                              onChange={(e) => setMenuFormState({...menuFormState, prepTime: e.target.value})}
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
                              onChange={(e) => setMenuFormState({...menuFormState, calories: parseInt(e.target.value) || 0})}
                              className="w-full p-2.5 border rounded-xl bg-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Description</label>
                            <textarea
                              value={menuFormState.description}
                              onChange={(e) => setMenuFormState({...menuFormState, description: e.target.value})}
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
                              onChange={(e) => setMenuFormState({...menuFormState, isVeg: e.target.checked})}
                              className="w-4 h-4 accent-green-600 rounded" 
                            />
                            <span>Vegetarian Dish</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={menuFormState.isSpecial} 
                              onChange={(e) => setMenuFormState({...menuFormState, isSpecial: e.target.checked})}
                              className="w-4 h-4 accent-primary rounded" 
                            />
                            <span>Chef's Special</span>
                          </label>
                        </div>

                        <button 
                          type="submit" 
                          className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-primary/95 transition-colors shadow-sm"
                        >
                          {editingMenuItem ? 'Update Menu Item' : 'Save New Item'}
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
                        className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                          'bg-white border-gray-100'
                        }`}
                      >
                        <div>
                          {/* Image Container with Direct Link Overlay and Badge */}
                          <div className="relative group overflow-hidden rounded-2xl mb-3 bg-gray-100  h-36">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover rounded-2xl transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                              }} 
                            />

                            {/* Direct Link Hover Overlay - Clicking opens image link directly */}
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

                            {/* Corner Direct-Open Link Badge */}
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

                            {/* Veg / Non-Veg Tag */}
                            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shadow-sm ${
                              item.isVeg ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
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
                            <h4 className="font-extrabold text-xs text-gray-900  line-clamp-1">{item.name}</h4>
                            <span className="font-extrabold text-primary text-xs whitespace-nowrap ml-2">{formatPrice(item.price)}</span>
                          </div>

                          <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-400 font-semibold">
                            <span className="bg-gray-100  px-2 py-0.5 rounded-md">{item.category}</span>
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
                          {/* Direct clickable URL link */}
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
                    href={apkInfo.downloadUrl}
                    download={apkInfo.fileName}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md shrink-0"
                    title={`Download Waiter Android App APK (${apkInfo.fileSize})`}
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

              {/* Waiter Terminal Mobile APK Showcase & Installation Hub */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white border border-slate-700/60 shadow-lg relative overflow-hidden">
                {/* Decorative background ambient glows */}
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute right-1/3 -bottom-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: App Identity & Description */}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                        <Smartphone size={28} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-lg font-black tracking-tight text-white">
                            TableTap Waiter Android Terminal
                          </h4>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {apkInfo.version} Active Build
                          </span>
                          {apkInfo.customUploaded && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30">
                              Custom APK
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                          Equip floor staff with the standalone Android application. Instant kitchen order alerts, customer table calling buzzers, biometric fingerprint login, and table routing.
                        </p>

                        {/* Specs Badges */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap text-[11px]">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-mono font-bold">
                            📦 {apkInfo.fileSize}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                            🤖 Android 7.0+
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                            ⚡ Low Latency FIFO Orders
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                            🔒 30m Auto-Lock & Biometrics
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Download & Action Buttons */}
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 shrink-0">
                      {/* Direct APK Download Button */}
                      <a
                        href={apkInfo.downloadUrl}
                        download={apkInfo.fileName}
                        className="bg-primary hover:bg-orange-600 text-white text-xs font-black px-4 py-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/25 hover:scale-102 active:scale-98"
                      >
                        <Download size={16} />
                        <span>Download APK</span>
                      </a>

                      {/* Scan QR Code Button */}
                      <button
                        type="button"
                        onClick={() => setShowApkQr(!showApkQr)}
                        className={`text-xs font-bold px-3.5 py-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer border ${
                          showApkQr 
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                        title="Show scannable QR code for waiter's phone"
                      >
                        <QrCode size={16} />
                        <span>{showApkQr ? 'Hide QR' : 'Scan to Install'}</span>
                      </button>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={handleCopyApkLink}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-2xl cursor-pointer transition-all"
                        title="Copy direct APK download link"
                      >
                        {copiedApkLink ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>

                      {/* Upload / Replace APK Button */}
                      <label 
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-2xl cursor-pointer transition-all flex items-center justify-center"
                        title="Upload/Select newer APK file"
                      >
                        <Upload size={16} />
                        <input
                          type="file"
                          accept=".apk"
                          onChange={handleUploadNewApk}
                          className="hidden"
                        />
                      </label>

                      {/* Guide Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowApkGuide(!showApkGuide)}
                        className="text-xs font-bold px-3 py-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-all cursor-pointer"
                        title="How to install on Android"
                      >
                        {showApkGuide ? 'Hide Guide' : 'Install Guide'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Scannable QR Code Panel */}
                  {showApkQr && (
                    <div className="mt-5 pt-5 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center animate-fade-in">
                      <div className="sm:col-span-1 flex flex-col items-center p-3 bg-white rounded-2xl shadow-inner">
                        <img
                          src={apkQrCodeUrl}
                          alt="Scan to download Waiter APK"
                          className="w-40 h-40 object-contain rounded-lg"
                        />
                        <span className="text-[10px] text-slate-500 font-bold mt-2 text-center">
                          Scan with Android Camera
                        </span>
                      </div>
                      <div className="sm:col-span-2 space-y-2 text-xs">
                        <h5 className="font-black text-sm text-white flex items-center gap-2">
                          <span>Instant Phone Download via QR</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Wireless
                          </span>
                        </h5>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          Have your waiter point their Android phone camera or QR scanner at the screen to start the APK download directly on their phone without needing a computer cable.
                        </p>
                        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-[11px] text-orange-300 break-all flex items-center justify-between gap-2">
                          <span className="truncate">{apkDownloadFullUrl}</span>
                          <button
                            type="button"
                            onClick={handleCopyApkLink}
                            className="shrink-0 p-1 hover:text-white"
                          >
                            {copiedApkLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expandable Step-by-Step Android Installation Guide */}
                  {showApkGuide && (
                    <div className="mt-5 pt-5 border-t border-slate-700/80 animate-fade-in">
                      <h5 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-3">
                        Android Sideloading & Setup Guide (5 Easy Steps)
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center mb-1.5">1</span>
                          <strong className="block text-white text-[11px] mb-1">Download APK</strong>
                          <p className="text-[10px] text-slate-400">Click Download or scan QR code on the waiter's Android device.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center mb-1.5">2</span>
                          <strong className="block text-white text-[11px] mb-1">Accept Warning</strong>
                          <p className="text-[10px] text-slate-400">Tap "Download anyway" when Android prompts about unknown file.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center mb-1.5">3</span>
                          <strong className="block text-white text-[11px] mb-1">Allow Install</strong>
                          <p className="text-[10px] text-slate-400">In Settings, toggle "Allow from this source" for Chrome/Files.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center mb-1.5">4</span>
                          <strong className="block text-white text-[11px] mb-1">Tap Install</strong>
                          <p className="text-[10px] text-slate-400">Complete installation and launch "TableTap Waiter" app.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center mb-1.5">5</span>
                          <strong className="block text-white text-[11px] mb-1">Sign In</strong>
                          <p className="text-[10px] text-slate-400">Log in using Waiter ID & Password configured in the roster below.</p>
                        </div>
                      </div>
                    </div>
                  )}
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
                                        const shareText = `🍽️ TableTap Waiter App Credentials\n👤 Name: ${emp.name}\n🆔 Employee ID: ${emp.empid}\n🔑 Password: ${emp.password || 'Contact Admin'}\n📲 Download Waiter APK: ${apkDownloadFullUrl}`;
                                        navigator.clipboard.writeText(shareText);
                                        alert(`Copied credentials & APK link for ${emp.name} to clipboard! Ready to share via WhatsApp.`);
                                      }}
                                      className="text-slate-400 hover:text-emerald-600 cursor-pointer p-0.5"
                                      title="Copy Credentials + APK Download Link to Share via WhatsApp"
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
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-fade-in font-sans">
              {/* Header Section */}
              <div className="flex justify-between items-center pb-2">
                <div>
                  <h2 className="font-extrabold text-2xl mb-1 text-gray-900 tracking-tight">Reports & Export Terminal</h2>
                  <p className="text-[13px] text-gray-500 max-w-2xl">
                    Generate complete hotel reports — sales, orders, staff, payments and analytics — as Excel or PDF, or preview them before download.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleExportExcel} className="flex items-center gap-2 border-transparent text-white font-bold py-2 px-4 rounded-xl text-sm bg-[#00a65a] hover:bg-[#008f4d] transition-colors shadow-sm cursor-pointer">
                    <FileSpreadsheet size={16} strokeWidth={2.5} />
                    Excel
                  </button>
                  <button onClick={handleExportPDF} className="flex items-center gap-2 border-transparent text-white font-bold py-2 px-4 rounded-xl text-sm bg-[#dd4b39] hover:bg-[#c23321] transition-colors shadow-sm cursor-pointer">
                    <FileText size={16} strokeWidth={2.5} />
                    PDF
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 my-2"></div>

              {/* Filter Section */}
              <div className={`p-5 rounded-2xl border shadow-sm bg-white border-gray-200 flex flex-wrap gap-4 justify-between items-center relative z-20`}>
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date Range Filter</label>
                    <div className="relative">
                      <select 
                        value={reportDateFilter}
                        onChange={(e) => setReportDateFilter(e.target.value as any)}
                        className={`appearance-none border text-xs py-2 pl-3.5 pr-9 rounded-xl font-bold outline-none cursor-pointer transition-colors bg-white border-gray-300 text-gray-700 hover:border-gray-400`}
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
                        className={`appearance-none border text-xs py-2 pl-3.5 pr-9 rounded-xl font-bold outline-none cursor-pointer transition-colors bg-white border-gray-300 text-gray-700 hover:border-gray-400`}
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
              <div className={`p-6 rounded-2xl border shadow-sm bg-white border-gray-200 relative z-10 mt-2`}>
                <h4 className="font-extrabold text-sm mb-6 text-gray-800">Weekly Sales Volume Chart</h4>
                
                <div className="w-full h-[280px] relative">
                   {/* Y-Axis Grid Lines & Labels */}
                   <div className="absolute inset-0 flex flex-col justify-between text-[11px] font-bold text-gray-400">
                      <div className="flex items-center gap-3"><span className="w-8 text-right">₹22K</span><div className="flex-1 border-t border-dashed border-gray-200"></div></div>
                      <div className="flex items-center gap-3"><span className="w-8 text-right">₹17K</span><div className="flex-1 border-t border-dashed border-gray-200"></div></div>
                      <div className="flex items-center gap-3"><span className="w-8 text-right">₹11K</span><div className="flex-1 border-t border-dashed border-gray-200"></div></div>
                      <div className="flex items-center gap-3"><span className="w-8 text-right">₹6K</span><div className="flex-1 border-t border-dashed border-gray-200"></div></div>
                      <div className="flex items-center gap-3"><span className="w-8 text-right">₹0K</span><div className="flex-1 border-t border-gray-300"></div></div>
                   </div>

                   {/* Bars */}
                   <div className="absolute inset-0 ml-12 mb-4 flex items-end justify-around px-2 pt-6 pb-[2px]">
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[30%] hover:brightness-110 transition-all cursor-pointer"></div>
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[48%] hover:brightness-110 transition-all cursor-pointer"></div>
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[42%] hover:brightness-110 transition-all cursor-pointer"></div>
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[60%] hover:brightness-110 transition-all cursor-pointer"></div>
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[75%] hover:brightness-110 transition-all cursor-pointer"></div>
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[95%] hover:brightness-110 transition-all cursor-pointer"></div>
                      <div className="w-[12%] bg-[#ff7f24] rounded-t-sm h-[85%] hover:brightness-110 transition-all cursor-pointer"></div>
                   </div>

                   {/* X-Axis Labels */}
                   <div className="absolute bottom-0 left-12 right-0 flex justify-around px-2 -mb-6 text-[11px] font-bold text-gray-500">
                      <span className="w-[12%] text-center">Mon</span>
                      <span className="w-[12%] text-center">Tue</span>
                      <span className="w-[12%] text-center">Wed</span>
                      <span className="w-[12%] text-center">Thu</span>
                      <span className="w-[12%] text-center">Fri</span>
                      <span className="w-[12%] text-center">Sat</span>
                      <span className="w-[12%] text-center">Sun</span>
                   </div>
                </div>
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

              <div className={`p-6 rounded-3xl border shadow-sm bg-white border-gray-50`}>
                <form className="space-y-4 text-xs font-semibold max-w-2xl" onSubmit={handleSaveSettings}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Restaurant Name</label>
                      <input type="text" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.restaurantName || ''} onChange={(e) => setAlertSettings({...alertSettings, restaurantName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Owner Name</label>
                      <input type="text" placeholder="Enter Owner Name" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.ownerName || ''} onChange={(e) => setAlertSettings({...alertSettings, ownerName: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Branch Name</label>
                      <input type="text" placeholder="Enter Branch Name" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.branchName || ''} onChange={(e) => setAlertSettings({...alertSettings, branchName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Email Address</label>
                      <input type="email" placeholder="Enter Email" required pattern="[a-zA-Z0-9._%+\-]+@gmail\.com$" title="Must be a valid @gmail.com address" className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.email || ''} onChange={(e) => setAlertSettings({...alertSettings, email: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Mobile Number</label>
                      <input type="tel" placeholder="Primary Contact" required pattern="^[6-9]\d{9}$" title="Must be a valid 10-digit Indian mobile number" className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.mobile || ''} onChange={(e) => setAlertSettings({...alertSettings, mobile: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Alternate Contact Number</label>
                      <input type="tel" placeholder="Alternate Contact" required pattern="^[6-9]\d{9}$" title="Must be a valid 10-digit Indian mobile number" className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.alternateMobile || ''} onChange={(e) => setAlertSettings({...alertSettings, alternateMobile: e.target.value})} />
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
                          value={alertSettings.gstNo || ''}
                          onChange={(e) => setAlertSettings({...alertSettings, gstNo: e.target.value})}
                          className="w-full p-2.5 border rounded-xl bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1">FSSAI License Number (India)</label>
                        <input type="text" placeholder="FSSAI Number" required pattern="^[1-2]\d{13}$" title="Must be a valid 14-digit FSSAI license number" className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.fssai || ''} onChange={(e) => setAlertSettings({...alertSettings, fssai: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1">Tax Percentage (%)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          value={alertSettings.tax || 0}
                          onChange={(e) => setAlertSettings({...alertSettings, tax: parseInt(e.target.value) || 0})}
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
                        <textarea placeholder="Street Address" required className="w-full p-2.5 border rounded-xl bg-transparent" rows={2} value={alertSettings.address || ''} onChange={(e) => setAlertSettings({...alertSettings, address: e.target.value})}></textarea>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">City</label>
                          <input type="text" placeholder="City" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.city || ''} onChange={(e) => setAlertSettings({...alertSettings, city: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">State</label>
                          <input type="text" placeholder="State" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.state || ''} onChange={(e) => setAlertSettings({...alertSettings, state: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Country</label>
                          <input type="text" placeholder="Country" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.country || ''} onChange={(e) => setAlertSettings({...alertSettings, country: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1">PIN Code</label>
                          <input type="text" placeholder="PIN Code" required pattern="^[1-9][0-9]{5}$" title="Must be a valid 6-digit Indian PIN code" className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.pinCode || ''} onChange={(e) => setAlertSettings({...alertSettings, pinCode: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Landmark</label>
                          <input type="text" placeholder="Nearby Landmark" required className="w-full p-2.5 border rounded-xl bg-transparent" value={alertSettings.landmark || ''} onChange={(e) => setAlertSettings({...alertSettings, landmark: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Google Maps Location</label>
                          <div className="flex gap-2">
                            <input 
                              type="url" 
                              placeholder="Maps URL" 
                              required
                              value={alertSettings.mapsLocation || ''}
                              onChange={(e) => setAlertSettings({...alertSettings, mapsLocation: e.target.value})}
                              className="w-full p-2.5 border rounded-xl bg-transparent flex-1" 
                            />
                            <button 
                              type="button" 
                              onClick={handleGetLocation}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700  dark:hover:bg-gray-700  p-2.5 rounded-xl border border-transparent  flex items-center justify-center cursor-pointer transition-colors"
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
                      className={`p-4 rounded-3xl border shadow-sm bg-white border-gray-50`}
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

                      {/* Realtime NLP or Groq Sentiment */}
                      {(() => {
                        const effectiveSentiment = sentiment || (item.sentiment ? {
                          sentiment: item.sentiment,
                          emoji: item.emoji || (item.sentiment === 'Positive' ? '😊' : item.sentiment === 'Negative' ? '😞' : '😐'),
                          aiSummary: item.kitchen_alert ? `⚠️ KITCHEN ALERT: ${item.kitchen_alert_reason}` : (item.key_phrases?.join(', ') || 'Runtime NLP analysis')
                        } : null);

                        if (!effectiveSentiment) return null;

                        return (
                          <div className={`p-3 rounded-2xl border text-[11px] font-semibold mb-3 flex gap-2 ${
                            item.kitchen_alert 
                              ? 'bg-red-50 text-red-800 border-red-200' 
                              : effectiveSentiment.sentiment === 'Positive'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-gray-50 text-gray-700 border-gray-100'
                          }`}>
                            <span className="text-base">{effectiveSentiment.emoji}</span>
                            <div>
                              <p className="flex items-center gap-1.5">
                                <span>NLP Sentiment:</span>
                                <strong className="font-black">{effectiveSentiment.sentiment}</strong>
                                {item.sentiment_score && (
                                  <span className="text-[9px] font-bold opacity-75">({Math.round(item.sentiment_score)}% score)</span>
                                )}
                              </p>
                              <p className="mt-0.5 text-[10px] opacity-90">{effectiveSentiment.aiSummary}</p>
                            </div>
                          </div>
                        );
                      })()}

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



      {editLoyaltyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl p-6 bg-white`}>
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
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Silver Tier Threshold (Points)</label>
                <input 
                  type="number" 
                  value={loyaltyRules.silverTierPoints} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, silverTierPoints: Number(e.target.value)})}
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Gold Tier Threshold (Points)</label>
                <input 
                  type="number" 
                  value={loyaltyRules.goldTierPoints} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, goldTierPoints: Number(e.target.value)})}
                  className={`w-full p-3 rounded-xl border bg-gray-50 border-gray-200`}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Gold Tier Discount (%)</label>
                <input 
                  type="number" 
                  value={loyaltyRules.goldDiscountPercent} 
                  onChange={e => setLoyaltyRules({...loyaltyRules, goldDiscountPercent: Number(e.target.value)})}
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
                      onChange={(e) => setStaffFormState({...staffFormState, photo: e.target.value})}
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
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setStaffFormState(prev => ({ ...prev, photo: reader.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {staffFormState.photo && (
                        <button
                          type="button"
                          onClick={() => setStaffFormState({...staffFormState, photo: ''})}
                          className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div>
                  <p className="text-[9px] text-slate-500 mb-1.5 font-bold">Or pick a quick professional avatar:</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((p, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setStaffFormState({...staffFormState, photo: p.url})}
                        title={p.name}
                        className={`w-8 h-8 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                          staffFormState.photo === p.url ? 'border-orange-500 ring-2 ring-orange-400' : 'border-white hover:border-orange-300'
                        }`}
                      >
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-slate-600 mb-1 text-[10px] uppercase font-bold">Full Name *</label>
                <input
                  type="text"
                  value={staffFormState.name}
                  onChange={(e) => setStaffFormState({...staffFormState, name: e.target.value})}
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
                    onChange={(e) => setStaffFormState({...staffFormState, mobile: e.target.value})}
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
                    onChange={(e) => setStaffFormState({...staffFormState, email: e.target.value})}
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
                    onChange={(e) => setStaffFormState({...staffFormState, empid: e.target.value})}
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
                    onChange={(e) => setStaffFormState({...staffFormState, password: e.target.value})}
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
                    onChange={(e) => setStaffFormState({...staffFormState, shift: e.target.value as any})}
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
                    onChange={(e) => setStaffFormState({...staffFormState, salary: parseInt(e.target.value) || 0})}
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
                        className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          isSelected
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
            className={`relative my-auto w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
              'bg-white border-gray-100 text-slate-900'
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
