import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../supabase';
import { Order, WaiterRequest } from '../../types';
import { 
  ArrowLeft, User, Lock, Eye, EyeOff, 
  CheckCircle, Wallet, Sparkles, AlertTriangle, AlertCircle,
  Clock, ShieldCheck, Upload, Edit3, X, Check,
  Smartphone, Download, LogOut
} from 'lucide-react';
import { formatPhotoUrl, getInitials, compressImageFile } from '../../utils/photoHelper';

export const ClocheIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 4a2 2 0 0 1 2 2c0 .24-.04.47-.12.68A8.003 8.003 0 0 1 21 14v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a8.003 8.003 0 0 1 7.12-7.32A2.001 2.001 0 0 1 12 4zm9 13a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h18z"/>
  </svg>
);

type WaiterView = 'login' | 'tasks' | 'profile' | 'employee_details' | 'tip_earnings';
type TaskTab = 'all' | 'pending' | 'accepted';

export interface TipRecord {
  id: string;
  orderId: string;
  tableId: string;
  amount: number;
  dateStr: string;
  timeStr: string;
  displayDate: string;
  timestamp: number;
}

interface StaffProfile {
  empid: string;
  name: string;
  mobile: string;
  role: string;
  assignedTables: number[];
  initials: string;
  photo?: string;
}

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export const WaiterModule: React.FC = () => {
  const [activeView, setActiveView] = useState<WaiterView>('login');

  // Staff Credentials Form
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  // Active Waiter Profile (loaded dynamically from authenticated session)
  const [staffInfo, setStaffInfo] = useState<StaffProfile>(() => {
    const saved = localStorage.getItem('tabletap_waiter_staff');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          initials: getInitials(parsed.name)
        };
      } catch (e) { /* ignore */ }
    }
    return {
      empid: '',
      name: '',
      mobile: '',
      role: 'Waiter',
      assignedTables: [],
      initials: ''
    };
  });

  // Tasks State
  const [activeTab, setActiveTab] = useState<TaskTab>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [acceptedTaskIds, setAcceptedTaskIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('tabletap_waiter_accepted_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(30);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    mobile: '',
    photo: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updatedProfile: StaffProfile = {
        ...staffInfo,
        mobile: editProfileForm.mobile,
        photo: editProfileForm.photo
      };
      setStaffInfo(updatedProfile);
      localStorage.setItem('tabletap_waiter_staff', JSON.stringify(updatedProfile));

      // Also persist to Supabase / Mock database if possible
      const allStaff = await db.getStaff();
      const existing = allStaff.find((s: any) => 
        (s.empid && s.empid.trim().toUpperCase() === (staffInfo.empid || '').trim().toUpperCase()) || 
        (s.id && s.id === staffInfo.empid) ||
        s.name === staffInfo.name
      );
      if (existing) {
        await db.saveStaffMember({
          ...existing,
          mobile: editProfileForm.mobile,
          photo: editProfileForm.photo
        });
      }

      setIsEditingProfile(false);
      setFeedbackMessage('Profile photo & details updated and synced successfully!');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save waiter profile:', err);
      alert('Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Tip Records State
  const [tipRecords, setTipRecords] = useState<TipRecord[]>(() => {
    const saved = localStorage.getItem('tabletap_waiter_tip_records');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });

  const lastActivityRef = useRef<number>(Date.now());

  // Record active user touch/interaction
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem('tabletap_waiter_last_active', String(now));
  }, []);

  // Logout handler
  const handleLogout = useCallback((reason?: string) => {
    localStorage.removeItem('tabletap_waiter_logged_in');
    localStorage.removeItem('tabletap_waiter_staff');
    localStorage.removeItem('tabletap_waiter_last_active');
    setActiveView('login');
    if (reason) setSessionExpiredNotice(reason);
  }, []);

  // Check initial authentication and session validity
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('tabletap_waiter_logged_in') === 'true';
    const savedStaffStr = localStorage.getItem('tabletap_waiter_staff');
    const lastActiveStr = localStorage.getItem('tabletap_waiter_last_active');

    if (isLoggedIn && savedStaffStr) {
      try {
        const parsed = JSON.parse(savedStaffStr);
        setStaffInfo(parsed);

        const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
        const diff = Date.now() - lastActive;

        if (diff > INACTIVITY_TIMEOUT_MS) {
          handleLogout('Session timed out. Please log in.');
        } else {
          lastActivityRef.current = Date.now();
          setActiveView('tasks');
        }
      } catch (e) {
        handleLogout();
      }
    }
  }, [handleLogout]);

  // 30-Minute Inactivity Interval Watcher
  useEffect(() => {
    if (activeView === 'login') return;

    const activityEvents = ['touchstart', 'click', 'keydown', 'scroll', 'mousemove'];
    const handleAction = () => recordActivity();

    activityEvents.forEach(evt => window.addEventListener(evt, handleAction, { passive: true }));

    const timer = setInterval(() => {
      const now = Date.now();
      const diff = now - lastActivityRef.current;
      const left = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - diff) / 60000));
      setRemainingMinutes(left);

      if (diff >= INACTIVITY_TIMEOUT_MS) {
        handleLogout('Session timed out. Please log in.');
      }
    }, 5000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleAction));
      clearInterval(timer);
    };
  }, [activeView, handleLogout, recordActivity]);

  // Save accepted tasks
  useEffect(() => {
    localStorage.setItem('tabletap_waiter_accepted_tasks', JSON.stringify(acceptedTaskIds));
  }, [acceptedTaskIds]);

  // Synchronize Orders, Service Requests, and Staff Details
  const fetchTasks = async () => {
    try {
      const [allOrders, allReqs, staffList] = await Promise.all([
        db.getAllOrders(),
        db.getWaiterRequests(),
        db.getStaff()
      ]);
      setOrders(allOrders);
      setWaiterRequests(allReqs);

      // Real-time synchronization of logged-in staff profile
      if (staffInfo.empid) {
        const currentStaff = staffList.find((s: any) => 
          (s.empid && s.empid.trim().toUpperCase() === staffInfo.empid.trim().toUpperCase()) || 
          (s.id && s.id === staffInfo.empid)
        );

        if (currentStaff) {
          const freshName = currentStaff.name || staffInfo.name;
          const freshEmpid = currentStaff.empid || currentStaff.id;
          const freshMobile = currentStaff.mobile || '';
          const freshPhoto = currentStaff.photo || '';
          const freshTables = Array.isArray(currentStaff.assignedTables) ? currentStaff.assignedTables : [];

          if (
            freshName !== staffInfo.name ||
            freshEmpid !== staffInfo.empid ||
            freshPhoto !== staffInfo.photo ||
            freshMobile !== staffInfo.mobile ||
            JSON.stringify(freshTables) !== JSON.stringify(staffInfo.assignedTables)
          ) {
            const updatedProfile: StaffProfile = {
              empid: freshEmpid,
              name: freshName,
              mobile: freshMobile,
              role: currentStaff.role || 'Waiter',
              assignedTables: freshTables,
              initials: getInitials(freshName),
              photo: freshPhoto
            };
            setStaffInfo(updatedProfile);
            localStorage.setItem('tabletap_waiter_staff', JSON.stringify(updatedProfile));
          }
        }
      }
    } catch (err) {
      console.warn('WaiterModule: sync error:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);

    // Instant local event listener when admin updates staff in Waiter Management
    const handleStaffUpdated = (e: any) => {
      const updated = e?.detail;
      if (!updated) return;
      if (
        (staffInfo.empid && (updated.empid === staffInfo.empid || updated.id === staffInfo.empid)) ||
        (staffInfo.name && updated.name === staffInfo.name)
      ) {
        const refreshed: StaffProfile = {
          empid: updated.empid || updated.id,
          name: updated.name,
          mobile: updated.mobile || '',
          role: updated.role || 'Waiter',
          assignedTables: Array.isArray(updated.assignedTables) ? updated.assignedTables : [],
          initials: getInitials(updated.name),
          photo: updated.photo || ''
        };
        setStaffInfo(refreshed);
        localStorage.setItem('tabletap_waiter_staff', JSON.stringify(refreshed));
      }
    };

    window.addEventListener('staff_updated', handleStaffUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('staff_updated', handleStaffUpdated);
    };
  }, [staffInfo.empid, staffInfo.name]);

  // Synchronize historical tips from delivered orders
  useEffect(() => {
    if (orders.length === 0) return;
    const deliveredWithTip = orders.filter(o => 
      o.status === 'Delivered' && 
      o.tip && o.tip > 0 && 
      isTableAssigned(o.tableId)
    );

    if (deliveredWithTip.length > 0) {
      setTipRecords(prev => {
        let updated = false;
        const currentList = [...prev];

        deliveredWithTip.forEach(o => {
          if (!currentList.some(r => r.orderId === o.id)) {
            const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();
            currentList.push({
              id: `tip_${o.id}`,
              orderId: o.id,
              tableId: o.tableId,
              amount: o.tip,
              dateStr: orderDate.toISOString().split('T')[0],
              timeStr: orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              displayDate: orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              timestamp: orderDate.getTime()
            });
            updated = true;
          }
        });

        if (updated) {
          currentList.sort((a, b) => b.timestamp - a.timestamp);
          localStorage.setItem('tabletap_waiter_tip_records', JSON.stringify(currentList));
          return currentList;
        }
        return prev;
      });
    }
  }, [orders, staffInfo.assignedTables]);

  // Handle Staff Login strictly verifying registered Waiter Management accounts
  const handleLogin = async () => {
    setAuthError(null);
    setSessionExpiredNotice(null);

    const enteredId = employeeId.trim().toUpperCase();
    const enteredPassword = password.trim();

    if (!enteredId || !enteredPassword) {
      setAuthError('Invalid Waiter ID or password. Please try again.');
      return;
    }

    try {
      const staffList = await db.getStaff();

      // Find staff in database matching empid or id
      const foundStaff = staffList.find((s: any) => 
        (s.empid && s.empid.trim().toUpperCase() === enteredId) || 
        (s.id && s.id.trim().toUpperCase() === enteredId)
      );

      // Security requirement: Never specify whether ID or password was wrong to prevent enumeration attacks
      if (!foundStaff) {
        setAuthError('Invalid Waiter ID or password. Please try again.');
        return;
      }

      // Strict Password Verification
      if ((foundStaff.password || '').trim() !== enteredPassword) {
        setAuthError('Invalid Waiter ID or password. Please try again.');
        return;
      }

      if (foundStaff.role && foundStaff.role !== 'Waiter' && foundStaff.role !== 'Manager' && foundStaff.role !== 'Hotel Manager') {
        setAuthError('Invalid Waiter ID or password. Please try again.');
        return;
      }

      const profile: StaffProfile = {
        empid: foundStaff.empid || foundStaff.id,
        name: foundStaff.name,
        mobile: foundStaff.mobile || '',
        role: foundStaff.role || 'Waiter',
        assignedTables: Array.isArray(foundStaff.assignedTables) ? foundStaff.assignedTables : [],
        initials: getInitials(foundStaff.name),
        photo: foundStaff.photo
      };

      setStaffInfo(profile);
      localStorage.setItem('tabletap_waiter_staff', JSON.stringify(profile));
      localStorage.setItem('tabletap_waiter_logged_in', 'true');
      localStorage.setItem('tabletap_waiter_last_active', String(Date.now()));
      recordActivity();
      setActiveView('tasks');
    } catch (e: any) {
      setAuthError(e?.message || 'Authentication error connecting to database.');
    }
  };

  // Actions on Tasks
  const handleAcceptTask = (id: string) => {
    if (!acceptedTaskIds.includes(id)) {
      setAcceptedTaskIds(prev => [...prev, id]);
    }
  };

  const handleServeOrder = async (order: Order) => {
    await db.updateOrderStatus(order.id, 'Delivered');
    setAcceptedTaskIds(prev => prev.filter(id => id !== order.id));

    // Record detailed tip history
    if (order.tip && order.tip > 0) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const displayDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const newRecord: TipRecord = {
        id: `tip_${order.id}_${Date.now()}`,
        orderId: order.id,
        tableId: order.tableId,
        amount: order.tip,
        dateStr,
        timeStr,
        displayDate,
        timestamp: now.getTime()
      };

      setTipRecords(prev => {
        if (prev.some(r => r.orderId === order.id)) return prev;
        const next = [newRecord, ...prev];
        localStorage.setItem('tabletap_waiter_tip_records', JSON.stringify(next));
        return next;
      });
    }

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Delivered' } : o));
    setFeedbackMessage(`Order #${order.id} delivered to Table ${order.tableId}${order.tip ? ` (Tip: +₹${order.tip})` : ''}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleCompleteRequest = async (req: WaiterRequest) => {
    await db.updateWaiterRequestStatus(req.id, 'Completed');
    setAcceptedTaskIds(prev => prev.filter(id => id !== req.id));
    setWaiterRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'Completed' } : r));
    setFeedbackMessage(`Service completed for Table ${req.tableId}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // ORDER ROUTING BASED ON ASSIGNED TABLES
  // If assignedTables is empty or contains all, waiter sees ALL tables.
  // If assignedTables has specific numbers (e.g. [1, 2, 4]), waiter ONLY sees those tables.
  const assigned = staffInfo.assignedTables || [];
  const isAllTables = assigned.length === 0;

  const isTableAssigned = (tblId: string | number) => {
    if (isAllTables) return true;
    const num = parseInt(String(tblId), 10);
    return assigned.includes(num);
  };

  // Filter Tasks by table assignment routing
  const readyOrders = orders.filter(o => o.status === 'Ready to Serve' && isTableAssigned(o.tableId));
  const pendingRequests = waiterRequests.filter(r => r.status === 'Pending' && isTableAssigned(r.tableId));

  interface UnifiedTask {
    id: string;
    type: 'food_ready' | 'service_call';
    tableId: string;
    title: string;
    subtitle: string;
    details: string[];
    tip?: number;
    rawOrder?: Order;
    rawReq?: WaiterRequest;
    isAccepted: boolean;
  }

  const allTasksList: UnifiedTask[] = [
    ...readyOrders.map(o => ({
      id: o.id,
      type: 'food_ready' as const,
      tableId: o.tableId,
      title: `Food Ready to Serve`,
      subtitle: `Order #${o.id} • ${o.items.reduce((s, i) => s + i.quantity, 0)} Items`,
      details: o.items.map(i => `${i.quantity}x ${i.name}${i.instructions && i.instructions.length > 0 ? ` (${i.instructions.join(', ')})` : ''}`),
      tip: o.tip,
      rawOrder: o,
      isAccepted: acceptedTaskIds.includes(o.id)
    })),
    ...pendingRequests.map(r => ({
      id: r.id,
      type: 'service_call' as const,
      tableId: r.tableId,
      title: `Customer Service Request`,
      subtitle: `Table ${r.tableId} requested ${r.requestType}`,
      details: [`Request: ${r.requestType}`, `Table ${r.tableId} assistance required`],
      rawReq: r,
      isAccepted: acceptedTaskIds.includes(r.id)
    }))
  ];

  // Note 21: FIFO sorting in Waiter Dashboard - Oldest first, newest last
  allTasksList.sort((a, b) => {
    const timeA = new Date(a.rawOrder?.createdAt || a.rawReq?.createdAt || 0).getTime();
    const timeB = new Date(b.rawOrder?.createdAt || b.rawReq?.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const pendingTasks = allTasksList.filter(t => !t.isAccepted);
  const acceptedTasks = allTasksList.filter(t => t.isAccepted);

  const displayedTasks = 
    activeTab === 'all' ? allTasksList :
    activeTab === 'pending' ? pendingTasks : acceptedTasks;

  // Tip Calculations & Daily Grouping
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Cumulative Total Tips (All-Time)
  const cumulativeTips = tipRecords.reduce((sum, r) => sum + r.amount, 0);

  // Today's Tips
  const todayTipsTotal = tipRecords
    .filter(r => r.dateStr === todayStr)
    .reduce((sum, r) => sum + r.amount, 0);

  // This Month's Tips
  const monthTipsTotal = tipRecords
    .filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + r.amount, 0);

  // Group tips by date for detailed day-by-day view
  const tipsByDay = tipRecords.reduce<Record<string, { displayDate: string; records: TipRecord[]; total: number }>>((acc, r) => {
    if (!acc[r.dateStr]) {
      acc[r.dateStr] = {
        displayDate: r.displayDate,
        records: [],
        total: 0
      };
    }
    acc[r.dateStr].records.push(r);
    acc[r.dateStr].total += r.amount;
    return acc;
  }, {});

  const sortedDays = Object.keys(tipsByDay).sort((a, b) => b.localeCompare(a));

  return (
    <div className={`min-h-screen flex justify-center items-start text-slate-800 font-sans selection:bg-orange-500 selection:text-white ${activeView === 'login' ? 'bg-[#FFF6EF]' : 'bg-[#FCFAF7]'}`}>
      {/* Mobile Frame Container */}
      <div className={`w-full max-w-md min-h-screen flex flex-col relative shadow-2xl border-x border-orange-100/60 overflow-hidden ${activeView === 'login' ? 'bg-[#FFF6EF] pb-0' : 'bg-[#FCFAF7] pb-8'}`}>

        {/* Feedback Toast */}
        {feedbackMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
            <CheckCircle size={15} className="text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* ====================================================
            VIEW 1: WAITER AUTHENTICATION (EXACT MOCKUP)
            ==================================================== */}
        {activeView === 'login' && (
          <div className="flex-1 px-8 pt-10 pb-6 flex flex-col justify-between relative bg-[#FFF6EF] min-h-screen animate-fade-in font-sans select-none overflow-hidden">
            {/* Background Decorative Watermarks */}
            <div className="absolute -top-8 -right-8 w-44 h-44 rounded-bl-full bg-[#FFE7D4]/60 pointer-events-none" />
            
            {/* Top-left dot matrix */}
            <div className="absolute top-28 left-4 grid grid-cols-6 gap-2.5 opacity-35 pointer-events-none">
              {Array.from({ length: 36 }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#E5A882]" />
              ))}
            </div>

            {/* Bottom-left dotted circle & crosses */}
            <div className="absolute bottom-16 left-3 opacity-30 pointer-events-none">
              <svg width="65" height="65" viewBox="0 0 65 65" fill="none">
                <circle cx="28" cy="38" r="22" stroke="#E5A882" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M16 38 H40 M28 26 V50" stroke="#E5A882" strokeWidth="1.5" />
                <path d="M46 12 H54 M50 8 V16" stroke="#E5A882" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Bottom-right corner blob & wavy lines */}
            <div className="absolute -bottom-10 -right-10 w-52 h-52 rounded-tl-full bg-[#FFE7D4]/60 pointer-events-none" />
            <div className="absolute bottom-20 right-4 opacity-35 pointer-events-none">
              <svg width="75" height="36" viewBox="0 0 75 36" fill="none">
                <path d="M0 8 Q10 0 20 8 T40 8 T60 8 T80 8" stroke="#E5A882" strokeWidth="1.8" fill="none" />
                <path d="M0 18 Q10 10 20 18 T40 18 T60 18 T80 18" stroke="#E5A882" strokeWidth="1.8" fill="none" />
                <path d="M0 28 Q10 20 20 28 T40 28 T60 28 T80 28" stroke="#E5A882" strokeWidth="1.8" fill="none" />
              </svg>
            </div>

            {/* Content Container */}
            <div className="relative z-10 flex flex-col flex-1">
              {/* Brand Logo & Header */}
              <div className="flex flex-col items-center pt-2">
                <div className="flex items-center gap-2.5">
                  {/* TableTap Serving Cloche with Tapping Finger */}
                  <svg width="52" height="46" viewBox="0 0 100 85" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                    {/* Tray Base Bar */}
                    <path d="M12 60 H88" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
                    {/* Cloche Dome */}
                    <path d="M18 57 C20 33 38 21 50 21 C62 21 80 33 82 57 Z" fill="#FF5E00" />
                    {/* Handle Ring Cutout */}
                    <circle cx="50" cy="56" r="10" stroke="#FFF6EF" strokeWidth="5" fill="none" />
                    {/* Hand with Pointing Finger tapping handle */}
                    <path 
                      d="M48 48 C46 48 45 50 45 52 V64 L41 68 C39 70 40 73 43 75 L48 78 C51 79 55 79 58 77 L62 74 C65 72 65 69 64 66 L62 58 C62 55 59 53 56 53 V52 C56 50 55 48 53 48 C51 48 50 48 48 48 Z" 
                      fill="#FF5E00" 
                    />
                    <rect x="47" y="44" width="6" height="12" rx="3" fill="#FF5E00" stroke="#FFF6EF" strokeWidth="1.5" />
                  </svg>
                  {/* Brand Typography */}
                  <div className="text-[34px] font-black tracking-tight leading-none font-sans">
                    <span className="text-[#1E293B]">Table</span>
                    <span className="text-[#FF5E00]">Tap</span>
                  </div>
                </div>
                <p className="text-[15px] font-semibold text-slate-800 mt-2 tracking-wide">
                  Waiter App
                </p>
              </div>

              {/* Title Section */}
              <div className="text-center mt-12 mb-6">
                <h1 className="text-[28px] font-black text-[#1E293B] tracking-tight">
                  Welcome back!
                </h1>
                <p className="text-[17px] text-slate-700 font-normal mt-1">
                  Sign In
                </p>
              </div>

              {/* Error or Session Timeout Banner */}
              {(authError || sessionExpiredNotice) && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#FEEBED] border border-[#FCA5A5] text-[12.5px] text-[#B91C1C] flex items-center gap-2 shadow-xs animate-fade-in font-sans">
                  <AlertCircle size={16} className="text-[#DC2626] shrink-0" />
                  <span className="font-medium">
                    {authError || sessionExpiredNotice}
                  </span>
                </div>
              )}

              {/* Credentials Form */}
              <div className="space-y-4">
                {/* Waiter ID Field */}
                <div 
                  className={`bg-white rounded-2xl h-14 px-4 flex items-center gap-3 border transition-all shadow-xs ${
                    (authError || sessionExpiredNotice) 
                      ? 'border-[#E57373]' 
                      : 'border-[#F4A771]/70 focus-within:border-[#FF5E00] focus-within:ring-2 focus-within:ring-orange-200/50'
                  }`}
                >
                  <User size={20} className="text-[#94A3B8] shrink-0" />
                  <input
                    type="text"
                    placeholder="Waiter ID"
                    value={employeeId}
                    onChange={(e) => {
                      setEmployeeId(e.target.value);
                      if (authError) setAuthError(null);
                      if (sessionExpiredNotice) setSessionExpiredNotice(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full bg-transparent text-[16px] text-slate-800 font-medium outline-none placeholder:text-[#94A3B8]"
                  />
                </div>

                {/* Password Field */}
                <div 
                  className={`bg-white rounded-2xl h-14 px-4 flex items-center gap-3 border transition-all shadow-xs ${
                    (authError || sessionExpiredNotice) 
                      ? 'border-[#E57373]' 
                      : 'border-[#F4A771]/70 focus-within:border-[#FF5E00] focus-within:ring-2 focus-within:ring-orange-200/50'
                  }`}
                >
                  <Lock size={20} className="text-[#94A3B8] shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authError) setAuthError(null);
                      if (sessionExpiredNotice) setSessionExpiredNotice(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full bg-transparent text-[16px] text-slate-800 font-medium outline-none placeholder:text-[#94A3B8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#94A3B8] hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* LOG IN Button */}
                <button
                  type="button"
                  onClick={handleLogin}
                  className="w-full h-14 mt-6 rounded-[22px] bg-gradient-to-r from-[#FF5500] to-[#FF6B00] hover:from-[#E64D00] hover:to-[#FA5F00] active:scale-[0.99] text-white font-extrabold text-[16px] tracking-wider uppercase shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all cursor-pointer"
                >
                  LOG IN
                </button>
              </div>

              {/* App Version Footer */}
              <div className="mt-auto pt-14 pb-4 text-center">
                <span className="text-xs text-slate-700 font-medium tracking-wide">
                  App Version 2.4.1
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            VIEW 2: ACTIVE TASKS (SERVICE BOARD WITH ROUTING)
            ==================================================== */}
        {activeView === 'tasks' && (
          <div className="flex-1 p-5 flex flex-col animate-fade-in">
            {/* Top Navigation Bar */}
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                  <ClocheIcon size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-tight">
                    {staffInfo.name ? staffInfo.name : 'Waiter Terminal'}
                  </h2>
                  <span className="text-[10px] font-semibold text-slate-400 font-mono block mt-0.5">
                    {staffInfo.empid ? `ID: ${staffInfo.empid} • ${staffInfo.role}` : 'Floor Staff'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Logout Button */}
                <button
                  onClick={() => handleLogout()}
                  title="Logout"
                  className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>

                {/* Profile Circle */}
                <button
                  onClick={() => setActiveView('profile')}
                  title="View Waiter Profile"
                  className="w-9 h-9 rounded-full bg-[#FF6B00] overflow-hidden hover:bg-orange-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer border-2 border-orange-200 shrink-0"
                >
                  {staffInfo.photo ? (
                    <img
                      src={formatPhotoUrl(staffInfo.photo)}
                      alt={staffInfo.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    getInitials(staffInfo.name)
                  )}
                </button>
              </div>
            </div>

            {/* Table Routing Indicator Banner */}
            <div className="mt-4 p-3 bg-white rounded-2xl border border-orange-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black">Order Routing</p>
                  <strong className="text-xs font-black text-slate-800">
                    {isAllTables 
                      ? '⚡ Serving: All Tables (Full Floor)' 
                      : `📍 Serving Tables: ${assigned.map(t => `#${t}`).join(', ')}`}
                  </strong>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                ⏱️ {remainingMinutes}m left
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#FF6B00] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Tasks ({allTasksList.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-[#FF6B00] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Pending ({pendingTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('accepted')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'accepted'
                    ? 'bg-[#FF6B00] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                In Service ({acceptedTasks.length})
              </button>
            </div>

            {/* Tasks List */}
            <div className="mt-4 flex-1 flex flex-col">
              {displayedTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-10">
                  <div className="w-full border-2 border-dashed border-slate-200/90 rounded-3xl p-8 bg-white/70 text-center">
                    <div className="text-3xl mb-2">🍽️</div>
                    <h3 className="text-base font-black text-slate-900">All caught up!</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed max-w-xs mx-auto">
                      {isAllTables 
                        ? 'No active kitchen orders or service calls on the floor.' 
                        : `No pending tasks for your assigned tables (${assigned.map(t => `#${t}`).join(', ')}).`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedTasks.map((task) => (
                    <div 
                      key={task.id}
                      className={`bg-white rounded-3xl p-5 border transition-all shadow-xs ${
                        task.isAccepted ? 'border-orange-500/40 bg-orange-50/20' : 'border-orange-100/70'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                            Table #{task.tableId}
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-1">{task.title}</h4>
                          <p className="text-xs text-slate-500">{task.subtitle}</p>
                        </div>
                        {task.tip && task.tip > 0 && (
                          <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                            <Sparkles size={11} /> +₹{task.tip} Tip
                          </span>
                        )}
                      </div>

                      <div className="my-3 py-2 border-y border-slate-100 space-y-1">
                        {task.details.map((d, i) => (
                          <p key={i} className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                            <span>{d}</span>
                          </p>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        {!task.isAccepted ? (
                          <button
                            onClick={() => handleAcceptTask(task.id)}
                            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            Accept Task
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (task.type === 'food_ready' && task.rawOrder) {
                                handleServeOrder(task.rawOrder);
                              } else if (task.type === 'service_call' && task.rawReq) {
                                handleCompleteRequest(task.rawReq);
                              }
                            }}
                            className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                          >
                            Mark Completed & Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================
            VIEW 3: WAITER PROFILE & SETTINGS
            ==================================================== */}
        {activeView === 'profile' && (
          <div className="flex-1 p-5 flex flex-col justify-between animate-fade-in">
            <div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveView('tasks')}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-lg font-black text-slate-900">Staff Profile</h1>
              </div>

              {/* Profile Card */}
              <div className="mt-6 bg-white rounded-3xl p-6 border border-orange-100 shadow-sm text-center">
                <div className="w-20 h-20 rounded-full bg-[#FF6B00] overflow-hidden text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-orange-500/25 border-4 border-orange-100">
                  {staffInfo.photo ? (
                    <img
                      src={formatPhotoUrl(staffInfo.photo)}
                      alt={staffInfo.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    getInitials(staffInfo.name)
                  )}
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-3">{staffInfo.name}</h2>
                <p className="text-xs text-slate-400 font-bold">{staffInfo.empid} &bull; {staffInfo.role}</p>

                <button
                  onClick={() => {
                    setEditProfileForm({
                      mobile: staffInfo.mobile || '',
                      photo: staffInfo.photo || ''
                    });
                    setIsEditingProfile(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100 text-[#FF6B00] text-xs font-bold border border-orange-200 transition-all cursor-pointer"
                >
                  <Edit3 size={13} /> Edit Profile & Photo
                </button>

                <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone / Mobile:</span>
                    <strong className="text-slate-800">{staffInfo.mobile || 'Not configured'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Routing:</span>
                    <strong className="text-slate-800">
                      {isAllTables ? 'All Tables' : assigned.map(t => `#${t}`).join(', ')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Session Status:</span>
                    <strong className="text-emerald-600 font-bold">Active ({remainingMinutes}m left)</strong>
                  </div>
                </div>
              </div>

              {/* Edit Profile Modal */}
              {isEditingProfile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl bg-white text-slate-900 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <div>
                        <h4 className="font-extrabold text-sm">Edit Profile & Photo</h4>
                        <p className="text-[10px] text-gray-400">Update your photo and contact info</p>
                      </div>
                      <button className="cursor-pointer text-gray-400 hover:text-gray-700" onClick={() => setIsEditingProfile(false)}>
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-semibold">
                      {/* Photo Section */}
                      <div className="p-3 bg-orange-50/60 rounded-2xl border border-orange-100 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#FF6B00] overflow-hidden text-white flex items-center justify-center font-black text-xl mx-auto mb-2 border-2 border-orange-200">
                          {editProfileForm.photo ? (
                            <img
                              src={formatPhotoUrl(editProfileForm.photo)}
                              alt="Staff"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            getInitials(staffInfo.name)
                          )}
                        </div>

                        <div className="space-y-2 text-left">
                          <label className="block text-gray-500 text-[10px] uppercase font-bold">Photo URL / Google Drive link</label>
                          <input
                            type="text"
                            value={editProfileForm.photo}
                            onChange={(e) => setEditProfileForm({...editProfileForm, photo: e.target.value})}
                            placeholder="https://drive.google.com/... or image link"
                            className="w-full p-2 border border-orange-200 rounded-xl text-xs bg-white"
                          />

                          <div className="flex gap-2 items-center flex-wrap pt-0.5">
                            <label className="cursor-pointer bg-white border border-orange-200 hover:bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all">
                              <Upload size={11} /> Choose Device Photo
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const compressed = await compressImageFile(file, 360, 0.85);
                                    if (compressed) {
                                      setEditProfileForm(prev => ({ ...prev, photo: compressed }));
                                    }
                                  }
                                }}
                              />
                            </label>
                            {editProfileForm.photo && (
                              <button
                                type="button"
                                onClick={() => setEditProfileForm({...editProfileForm, photo: ''})}
                                className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-500 mb-1 text-[10px] uppercase font-bold">Phone / WhatsApp</label>
                        <input
                          type="text"
                          value={editProfileForm.mobile}
                          onChange={(e) => setEditProfileForm({...editProfileForm, mobile: e.target.value})}
                          placeholder="+91 98765 43210"
                          className="w-full p-2.5 border rounded-xl"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="w-2/3 bg-[#FF6B00] hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Check size={14} /> {isSavingProfile ? 'Saving...' : 'Save Profile'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Quick Options */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setActiveView('tip_earnings')}
                  className="w-full bg-white p-4 rounded-2xl border border-orange-100 text-left flex items-center justify-between text-xs font-bold text-slate-800 hover:border-orange-500 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <Wallet size={18} className="text-emerald-500" />
                    <div>
                      <span className="block text-slate-900 font-bold">Tip Earnings & History</span>
                      <span className="text-[10px] text-slate-400 font-normal">View cumulative & in-detail daily earnings</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-black">₹{cumulativeTips}</span>
                    <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg font-bold">View</span>
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleLogout()}
              className="w-full py-3.5 rounded-2xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-all cursor-pointer mt-6 flex items-center justify-center gap-2"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* ====================================================
            VIEW 5: TIP EARNINGS & IN-DETAIL DAY-BY-DAY BREAKDOWN
            ==================================================== */}
        {activeView === 'tip_earnings' && (
          <div className="flex-1 p-5 flex flex-col justify-between animate-fade-in">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveView('profile')}
                    className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h1 className="text-lg font-black text-slate-900 leading-tight">Tip Earnings</h1>
                    <p className="text-[10px] text-slate-400 font-bold">{staffInfo.name || 'Staff'} &bull; {staffInfo.empid}</p>
                  </div>
                </div>

                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {tipRecords.length} Tips Recorded
                </span>
              </div>

              {/* Cumulative & Sub KPI Cards */}
              <div className="mt-5 space-y-3">
                {/* Cumulative All-Time Total Card */}
                <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-emerald-100 text-[10px] font-black uppercase tracking-wider block">
                        Cumulative Total Tips
                      </span>
                      <h2 className="text-3xl font-black mt-1">₹{cumulativeTips}</h2>
                      <p className="text-[11px] text-emerald-100/90 mt-1">
                        All-time cumulative tips credited to your account
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                      <Wallet size={24} />
                    </div>
                  </div>
                </div>

                {/* Sub KPI Row: Today vs This Month */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-xs">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Today's Tips</span>
                    <strong className="text-xl font-black text-emerald-600 mt-1 block">₹{todayTipsTotal}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {tipRecords.filter(r => r.dateStr === todayStr).length} orders today
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-xs">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">This Month</span>
                    <strong className="text-xl font-black text-slate-900 mt-1 block">₹{monthTipsTotal}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* In-Detail Day-by-Day Earnings List */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Day-by-Day Tip History
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {sortedDays.length} {sortedDays.length === 1 ? 'Day' : 'Days'} with earnings
                  </span>
                </div>

                {sortedDays.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-orange-200">
                    <Wallet size={32} className="text-slate-300 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-700">No Tips Recorded Yet</h4>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Tips added by customers during checkout will appear here in detail with date, order ID, and table number once served.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[44vh] overflow-y-auto pr-1 no-scrollbar">
                    {sortedDays.map(dateKey => {
                      const dayGroup = tipsByDay[dateKey];
                      const isToday = dateKey === todayStr;

                      return (
                        <div key={dateKey} className="bg-white rounded-2xl border border-orange-100 shadow-xs overflow-hidden">
                          {/* Day Header */}
                          <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-800">
                                {isToday ? 'Today' : dayGroup.displayDate}
                              </span>
                              {isToday && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                                  Live
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-black text-emerald-600">
                              Day Total: ₹{dayGroup.total}
                            </span>
                          </div>

                          {/* List of tip orders on this day */}
                          <div className="divide-y divide-slate-100">
                            {dayGroup.records.map((rec) => (
                              <div key={rec.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-orange-50/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[11px]">
                                    ₹
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">Order #{rec.orderId}</span>
                                      <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-bold text-[10px]">
                                        Table #{rec.tableId}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">{rec.timeStr}</span>
                                  </div>
                                </div>
                                <span className="font-black text-sm text-emerald-600">
                                  +₹{rec.amount}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setActiveView('profile')}
              className="w-full mt-4 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
            >
              Back to Profile
            </button>
          </div>
        )}

      </div>

      
    </div>
  );
};

export default WaiterModule;
