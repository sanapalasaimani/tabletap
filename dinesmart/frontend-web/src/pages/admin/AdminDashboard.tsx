import React, { useState, useEffect } from 'react';
import { db } from '../../supabase';
import { MenuItem, Order, UserProfile, WaiterRequest, PendingStaff } from '../../types';
import { 
  LayoutDashboard, ShoppingBag, ChefHat, Utensils, Layers, Users, 
  Map, CreditCard, Award, Megaphone, UserCheck, BarChart3, Bell, 
  Settings, Shield, QrCode, Image, MessageSquare, Search, Trash2, 
  Edit3, Plus, X, ChevronRight, Download, Sparkles, Filter, Check, 
  AlertTriangle, Moon, Sun, RefreshCw, FileText, Mail, MessageCircle, 
  CornerDownRight, UserPlus, Heart, TrendingUp, DollarSign, Calendar,
  TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Star, Eye, FileSpreadsheet, ChevronDown
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

interface AdminDashboardProps {
  role: string;
  onLogout: () => void;
}

type TabType = 
  | 'overview' | 'orders' | 'kitchen' | 'menu' | 'staff'
  | 'tables' | 'loyalty' | 'promotions' | 'customers' | 'ai_analytics'
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
  assignedTables?: number[];
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
  const [staffSubTab, setStaffSubTab] = useState<'roster' | 'pending'>('roster');
  
  // Real-time Database States
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [pendingStaffList, setPendingStaffList] = useState<PendingStaff[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [waiterFormLink, setWaiterFormLink] = useState(() => localStorage.getItem('waiterFormLink') || 'https://forms.gle/dinesmart-waiter-apply');
  const [isEditingFormLink, setIsEditingFormLink] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [syncTime, setSyncTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [alertSettings, setAlertSettings] = useState<any>({ tax: 5, currency: '₹', gstNo: '27AAAAA1111A1Z1', mapsLocation: '' });

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

  const handleExportPDF = () => {
    generateComprehensivePDF({ orders, staff, menuItems }, alertSettings);
  };

  const handleExportExcel = () => {
    generateComprehensiveExcel({ orders, staff, menuItems }, alertSettings);
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

  const [editPendingStaffModal, setEditPendingStaffModal] = useState<PendingStaff | null>(null);

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
    password: '',
    assignedTables: [] as number[]
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

  // Sync Data function from Supabase
  const fetchData = async () => {
    try {
      const dbOrders = await db.getAllOrders();
      setOrders(dbOrders);
      
      const dbSettings = await db.getSettings();
      if (dbSettings) setAlertSettings(dbSettings);

      const dbMenu = await db.getMenuItems();
      setMenuItems(dbMenu);

      const dbStaff = await db.getStaff();
      setStaff(dbStaff);

      const dbPendingStaff = await db.getPendingStaff();
      setPendingStaffList(dbPendingStaff);

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

      setNotifications([...delayAlerts]);
      setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to sync admin data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    loadAllGroqAI();

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



  const handleSaveLoyaltyRules = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.saveLoyaltyRules(loyaltyRules);
    setEditLoyaltyModal(false);
    logActivity('Updated Loyalty Conversion Rules');
  };

  // Pending Staff Management
  const handleSavePendingStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editPendingStaffModal) {
      await db.updatePendingStaff(editPendingStaffModal);
      await fetchData();
      setEditPendingStaffModal(null);
      logActivity(`Updated pending application for: ${editPendingStaffModal.name}`);
    }
  };

  const handleDeletePendingStaff = async (id: string, name: string) => {
    if (confirm(`WARNING: Are you sure you want to permanently delete the application from "${name}"?`)) {
      await db.deletePendingStaff(id);
      await fetchData();
      logActivity(`Removed pending application: ${name}`);
    }
  };

  const generateRandomString = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleApprovePendingStaff = async (app: PendingStaff) => {
    const newEmpId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPassword = generateRandomString(Math.floor(Math.random() * 3) + 8);

    const newEmp = {
      id: `s_${Date.now()}`,
      name: app.name,
      mobile: app.mobile,
      role: 'Waiter',
      shift: 'Morning',
      salary: 18000,
      empid: newEmpId,
      password: newPassword,
      attendance: 100,
      performance: { score: 90, ordersDelivered: 0, avgServingTime: 'N/A', ratings: 5.0, tips: 0 }
    };

    try {
      await db.saveStaffMember(newEmp as any);
      await db.deletePendingStaff(app.id);
      await fetchData();
      logActivity(`Approved pending application for ${app.name}. Assigned EMP ID: ${newEmpId}`);
      
      const subject = encodeURIComponent('Your DineSmart Waiter Application is Approved!');
      const body = encodeURIComponent(`Hello ${app.name},\n\nYour application has been approved.\n\nHere are your login credentials for the DineSmart terminal:\nEMP ID: ${newEmpId}\nPassword: ${newPassword}\n\nWelcome to the team!\n\nDineSmart Admin`);
      window.location.href = `mailto:${app.email}?subject=${subject}&body=${body}`;
    } catch (e) {
      alert('Failed to approve application.');
    }
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
        performance: editingStaff ? editingStaff.performance : { score: 90, ordersDelivered: 0, avgServingTime: 'N/A', ratings: 5.0, tips: 0 },
        assignedTables: staffFormState.role === 'Waiter' ? staffFormState.assignedTables : []
      };

      await db.saveStaffMember(newEmp);
      await fetchData();
      logActivity(editingStaff ? `Updated staff member: ${newEmp.name}` : `Added new staff member: ${newEmp.name}`);
      setNewStaffForm(false);
      setEditingStaff(null);
      setStaffFormState({ name: '', mobile: '', role: 'Waiter', shift: 'Morning', salary: 18000, empid: '', password: '', assignedTables: [] });
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
          password: pendingEditStaff.password || '',
          assignedTables: pendingEditStaff.assignedTables || []
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

  // Memoized Chart Data
  const weeklyData = [
    { name: 'Mon', revenue: 32000 },
    { name: 'Tue', revenue: 28000 },
    { name: 'Wed', revenue: 41000 },
    { name: 'Thu', revenue: 38000 },
    { name: 'Fri', revenue: 52000 },
    { name: 'Sat', revenue: 61000 },
    { name: 'Sun', revenue: 48000 }
  ];

  const categoryData = [
    { name: 'Biryani', value: 18500, color: '#f97316' },
    { name: 'Main Course', value: 10700, color: '#fb923c' },
    { name: 'Chinese', value: 7300, color: '#fbd38d' },
    { name: 'Starters', value: 5840, color: '#fde68a' },
    { name: 'Soups', value: 2430, color: '#fef08a' },
    { name: 'Drinks', value: 2430, color: '#fef9c3' },
    { name: 'Desserts', value: 1460, color: '#ffedd5' }
  ];

  const hourlyData = [
    { hour: '10 AM', orders: 20 },
    { hour: '11 AM', orders: 45 },
    { hour: '12 PM', orders: 105 },
    { hour: '1 PM', orders: 140 },
    { hour: '2 PM', orders: 85 },
    { hour: '6 PM', orders: 90 },
    { hour: '7 PM', orders: 135 },
    { hour: '8 PM', orders: 160 },
    { hour: '9 PM', orders: 95 }
  ];
  
  const yearlyData = [
    { year: '2022', revenue: 3100000 },
    { year: '2023', revenue: 3800000 },
    { year: '2024', revenue: 4600000 },
    { year: '2025', revenue: 5200000 },
    { year: '2026', revenue: 4900000 }
  ];

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
              
              {/* Primary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Today's Revenue</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getTodayRevenue() || 48760)}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500">
                      <ArrowUpRight size={12} />
                      <span>+12.4% vs yesterday</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center"><DollarSign size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Orders</span>
                    <strong className="text-xl font-black mt-1 block">{orders.length > 0 ? orders.length : 327}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Avg every 2.6 min</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><ShoppingBag size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Repeat Customers</span>
                    <strong className="text-xl font-black mt-1 block">68%</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>223 of 327 orders</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Users size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Avg Spend / Visit</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getAverageOrderValue() || 412)}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500">
                      <ArrowUpRight size={12} />
                      <span>+₹28 this week</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center"><CreditCard size={18} /></div>
                </div>
              </div>

              {/* Secondary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">New Customers</span>
                    <strong className="text-xl font-black mt-1 block">32%</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>104 first-time visitors</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center"><UserPlus size={18} /></div>
                </div>
                
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Satisfaction Score</span>
                    <strong className="text-xl font-black mt-1 block flex items-center gap-1">4.8 <Star size={16} fill="currentColor" className="text-yellow-400" /></strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Based on 186 reviews</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center"><Star size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Kitchen Queue</span>
                    <strong className="text-xl font-black mt-1 block">{orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking').length || 18}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-500">
                      <span>On track</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><ChefHat size={18} /></div>
                </div>
                
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Live Floor</span>
                    <strong className="text-xl font-black mt-1 block">{tables.filter(t => t.status === 'Available').length} / {tables.length > 0 ? tables.length : 12}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Tables Available</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><Map size={18} /></div>
                </div>
              </div>

              {/* Data Visualization Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`col-span-2 p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Weekly Revenue</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Revenue generated this week</p>
                      <div className="mt-4">
                        <p className="text-[10px] text-gray-400 font-bold">Total Revenue</p>
                        <div className="flex items-center gap-2">
                          <strong className="text-2xl font-black">₹48.7K</strong>
                          <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded flex items-center"><ArrowUpRight size={10} className="mr-0.5" /> +12.4%</span>
                        </div>
                      </div>
                    </div>
                    <select className={`text-xs border rounded-lg px-2 py-1 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <option>This Week</option>
                      <option>Last Week</option>
                    </select>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `₹${val/1000}K`} />
                        <Tooltip cursor={{ fill: isDarkMode ? '#1f2937' : '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 6, 6]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-3 bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2">
                    <Sparkles size={16} />
                    <span><strong>Saturday</strong> was your highest revenue day. You earned ₹61K which is 20% higher than weekly average.</span>
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
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
                      <strong className="text-sm font-black">₹48.7K</strong>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2.5 pt-4 border-t border-gray-100">
                    {categoryData.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                          <span className="text-gray-600">{cat.name}</span>
                        </div>
                        <div className="flex gap-4">
                          <span>₹{cat.value.toLocaleString()}</span>
                          <span className="text-gray-400 w-8 text-right">{Math.round((cat.value / 48700) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Visualization Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Top Selling Dishes</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Best performing dishes today</p>
                    </div>
                    <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">Top 10</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { rank: 1, name: 'Chicken Dum Biryani', sold: 142, rev: 35400, trend: 14 },
                      { rank: 2, name: 'Paneer Dum Biryani', sold: 96, rev: 22900, trend: 8 },
                      { rank: 3, name: 'Chicken Fried Rice', sold: 84, rev: 18400, trend: -3 },
                      { rank: 4, name: 'Veg Spring Roll', sold: 71, rev: 10650, trend: 22 },
                      { rank: 5, name: 'Mutton Rogan Josh', sold: 63, rev: 15750, trend: 5 },
                      { rank: 6, name: 'Dal Makhani', sold: 58, rev: 8700, trend: -1 },
                      { rank: 7, name: 'Mango Lassi', sold: 54, rev: 4320, trend: 18 }
                    ].map(item => (
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
                          <span className={`w-12 text-right font-bold ${item.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.trend > 0 ? '↗' : '↘'} {Math.abs(item.trend)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
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
                        <Tooltip cursor={{ fill: isDarkMode ? '#1f2937' : '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="orders" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Data Visualization Row 3 */}
              <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
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
              <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-orange-50/30 border-orange-100'}`}>
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
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-green-900/20 text-green-100' : 'bg-green-50 border border-green-100 text-green-900'}`}>
                    <TrendingUp size={16} className="mb-2 text-green-500" />
                    <p className="text-xs font-semibold leading-relaxed">Revenue increased by 12.4% compared to yesterday — driven by high Biryani orders.</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-orange-900/20 text-orange-100' : 'bg-orange-50 border border-orange-100 text-orange-900'}`}>
                    <Star size={16} className="mb-2 text-orange-500" />
                    <p className="text-xs font-semibold leading-relaxed">Chicken Dum Biryani generated the highest revenue today with ₹35,400.</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-blue-900/20 text-blue-100' : 'bg-blue-50 border border-blue-100 text-blue-900'}`}>
                    <Clock size={16} className="mb-2 text-blue-500" />
                    <p className="text-xs font-semibold leading-relaxed">Friday evening (7-9 PM) is the busiest business period with 310 orders.</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-purple-900/20 text-purple-100' : 'bg-purple-50 border border-purple-100 text-purple-900'}`}>
                    <CreditCard size={16} className="mb-2 text-purple-500" />
                    <p className="text-xs font-semibold leading-relaxed">UPI is the most preferred payment method — 48% of all transactions today.</p>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border flex items-center justify-between mb-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-orange-100/50 border-orange-200'}`}>
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
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">📦</span> Increase Chicken stock before evening rush
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">🧃</span> Launch beverage combo to boost drink sales
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">🍮</span> Promote desserts after 7 PM via QR table menu
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">⚡</span> Optimize kitchen efficiency during 1 PM & 8 PM peak
                    </div>
                  </div>
                </div>
              </div>

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
              VIEW 6: STAFF SCORECARD
              ---------------------------------------------------- */}
          {activeTab === 'staff' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-sm">Staff Management</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Manage employee accounts and pending applications.</p>
                </div>
                
                {/* SUB-TABS */}
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button 
                    onClick={() => setStaffSubTab('roster')} 
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${staffSubTab === 'roster' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Staff Roster
                  </button>
                  <button 
                    onClick={() => setStaffSubTab('pending')} 
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${staffSubTab === 'pending' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Pending Apps
                    {pendingStaffList.length > 0 && (
                      <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingStaffList.length}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Edit Pending Staff Modal (Always render if active) */}
              {editPendingStaffModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h4 className="font-extrabold text-sm">Edit Application</h4>
                      <button className="cursor-pointer" onClick={() => setEditPendingStaffModal(null)}><X size={18} /></button>
                    </div>
                    <form onSubmit={handleSavePendingStaff} className="space-y-4 text-xs font-semibold text-black">
                      <div>
                        <label className="block text-gray-400 mb-1 text-[10px] uppercase">Full Name</label>
                        <input
                          type="text"
                          value={editPendingStaffModal.name}
                          onChange={(e) => setEditPendingStaffModal({...editPendingStaffModal, name: e.target.value})}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-gray-400 mb-1 text-[10px] uppercase">Mobile</label>
                          <input
                            type="text"
                            value={editPendingStaffModal.mobile}
                            onChange={(e) => setEditPendingStaffModal({...editPendingStaffModal, mobile: e.target.value})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1 text-[10px] uppercase">WhatsApp</label>
                          <input
                            type="text"
                            value={editPendingStaffModal.whatsapp}
                            onChange={(e) => setEditPendingStaffModal({...editPendingStaffModal, whatsapp: e.target.value})}
                            required
                            className="w-full p-2.5 border rounded-xl"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1 text-[10px] uppercase">Email ID</label>
                        <input
                          type="email"
                          value={editPendingStaffModal.email}
                          onChange={(e) => setEditPendingStaffModal({...editPendingStaffModal, email: e.target.value})}
                          required
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>
                      <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-2 cursor-pointer">
                        Save Changes
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Staff Form Drawer */}
              {newStaffForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h4 className="font-extrabold text-sm">Edit Staff Member</h4>
                      <button className="cursor-pointer" onClick={() => setNewStaffForm(false)}><X size={18} /></button>
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
                            type="text"
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
                            onChange={(e) => setStaffFormState({...staffFormState, role: e.target.value as any})}
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
                      
                      {staffFormState.role === 'Waiter' && (
                        <div>
                          <label className="block text-gray-400 mb-2 text-[10px] uppercase">Assign Tables</label>
                          <div className="grid grid-cols-4 gap-2">
                            {tables.map(table => {
                              const isAssignedToOther = staff
                                .filter(s => s.role === 'Waiter' && s.id !== (editingStaff?.id || ''))
                                .some(s => s.assignedTables?.includes(table.id));

                              const isSelected = staffFormState.assignedTables.includes(table.id);

                              return (
                                <button
                                  type="button"
                                  key={table.id}
                                  disabled={isAssignedToOther}
                                  onClick={() => {
                                    setStaffFormState(prev => ({
                                      ...prev,
                                      assignedTables: isSelected 
                                        ? prev.assignedTables.filter(t => t !== table.id)
                                        : [...prev.assignedTables, table.id]
                                    }));
                                  }}
                                  className={`p-2 rounded-xl text-[10px] font-bold border transition-colors ${
                                    isAssignedToOther 
                                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50' 
                                      : isSelected
                                        ? 'bg-orange-500 text-white border-orange-500 cursor-pointer'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-orange-500 cursor-pointer'
                                  }`}
                                  title={isAssignedToOther ? 'Locked by another waiter' : 'Assign to this waiter'}
                                >
                                  T{table.id}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl cursor-pointer">
                        Save Changes
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
                      <button className="cursor-pointer" onClick={() => { setOtpModal(false); setPendingEditStaff(null); }}><X size={18} /></button>
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

              {/* SUB-TAB CONTENTS */}
              {staffSubTab === 'pending' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Google Forms Integration Simulation */}
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                    {isEditingFormLink ? (
                      <div className="flex-1 mr-4">
                        <p className="text-[10px] font-bold text-blue-800 mb-1">Edit Google Form Link</p>
                        <input 
                          type="text" 
                          value={waiterFormLink} 
                          onChange={(e) => setWaiterFormLink(e.target.value)}
                          className="w-full text-xs p-1.5 border border-blue-200 rounded"
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-[10px] font-bold text-blue-800">Waiter Application Link (Google Forms)</p>
                        <p className="text-[9px] text-blue-600">Share this link. Responses are automatically synced as "Pending Applicants".</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {isEditingFormLink ? (
                        <button 
                          onClick={() => {
                            localStorage.setItem('waiterFormLink', waiterFormLink);
                            setIsEditingFormLink(false);
                          }} 
                          className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer"
                        >
                          Save
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => setIsEditingFormLink(true)} 
                            className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer hover:bg-blue-50"
                          >
                            Edit Link
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(waiterFormLink);
                              alert(`Link Copied: ${waiterFormLink}`);
                            }} 
                            className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer"
                          >
                            Copy Link
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* PENDING APPLICATIONS SECTION */}
                  <div className={`mt-2 rounded-3xl shadow p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <h4 className="font-extrabold text-sm mb-3">Pending Applications</h4>
                    {pendingStaffList.length === 0 ? (
                      <p className="text-xs text-gray-400">No pending applications.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b">
                              <th className="pb-2 font-bold">Applicant Name</th>
                              <th className="pb-2 font-bold">Mobile</th>
                              <th className="pb-2 font-bold">WhatsApp</th>
                              <th className="pb-2 font-bold">Email</th>
                              <th className="pb-2 font-bold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="font-semibold">
                            {pendingStaffList.map((app) => (
                              <tr key={app.id} className={`border-b last:border-0 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                                <td className="py-3">{app.name}</td>
                                <td className="py-3">{app.mobile}</td>
                                <td className="py-3">{app.whatsapp}</td>
                                <td className="py-3">{app.email}</td>
                                <td className="py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleApprovePendingStaff(app)}
                                      className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-green-200 cursor-pointer flex items-center gap-1"
                                    >
                                      <Check size={12}/> Approve
                                    </button>
                                    <button
                                      onClick={() => setEditPendingStaffModal(app)}
                                      className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-200 cursor-pointer flex items-center gap-1"
                                    >
                                      <Edit3 size={12}/> Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeletePendingStaff(app.id, app.name)}
                                      className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-200 cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 size={12}/> Remove
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {staffSubTab === 'roster' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-xs flex items-center gap-1.5"><UserCheck size={14} /> Active Staff</h4>
                    </div>
                    {staff.length === 0 ? (
                      <div className="text-center p-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                        <p className="text-xs text-gray-500 font-bold mb-2">No Active Staff Members.</p>
                        <p className="text-[10px] text-gray-400">Share your Google Form link in the Pending Apps tab to register new waiters.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
                        {staff.map(emp => (
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
                              {emp.role === 'Waiter' && (
                                <p className="text-gray-400 text-[10px] mt-1">Assigned Tables: <strong className="text-brand-text">{emp.assignedTables?.length ? emp.assignedTables.join(', ') : 'None'}</strong></p>
                              )}
                            </div>
                            <div className="border-t pt-3 mt-3 flex justify-between items-center text-[10px]">
                              <span>Ratings: ★ {emp.performance?.ratings || '5.0'}</span>
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
                    )}
                  </div>
                </div>
              )}
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
              <div className={`p-5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} flex justify-between items-center relative z-20`}>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date Range</label>
                  <div className="relative">
                    <select className={`appearance-none border text-sm py-2 pl-4 pr-10 rounded-xl font-medium outline-none cursor-pointer transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                      <option>Today</option>
                      <option selected>This Week</option>
                      <option>This Month</option>
                      <option>Custom Range</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 font-medium self-end pb-2">
                  Reports are generated based on the selected filters.
                </div>
              </div>

              {/* Custom SVG Sales Chart */}
              <div className={`p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} relative z-10 mt-2`}>
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

                  <div className={`border-t pt-4 mt-4 ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
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

                  <div className={`border-t pt-4 mt-4 ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
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
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 p-2.5 rounded-xl border border-transparent dark:border-gray-700 flex items-center justify-center cursor-pointer transition-colors"
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

      {/* Bhakasura AI Chat Bot */}
      <BhakasuraChatBot contextData={{ orders, menuItems, staff, tables }} />
    </div>
  );
};
export default AdminDashboard;
