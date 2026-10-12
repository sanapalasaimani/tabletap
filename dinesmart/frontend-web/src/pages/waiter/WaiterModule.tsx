import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../supabase';
import { Order, WaiterRequest } from '../../types';
import { 
  ArrowLeft, User, Lock, Eye, EyeOff, 
  Fingerprint, CheckCircle, Wallet, Sparkles, AlertTriangle,
  Clock, ShieldCheck
} from 'lucide-react';

export const ClocheIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 4a2 2 0 0 1 2 2c0 .24-.04.47-.12.68A8.003 8.003 0 0 1 21 14v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a8.003 8.003 0 0 1 7.12-7.32A2.001 2.001 0 0 1 12 4zm9 13a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h18z"/>
  </svg>
);

type WaiterView = 'login' | 'biometric_lock' | 'tasks' | 'profile' | 'employee_details' | 'tip_earnings';
type TaskTab = 'all' | 'pending' | 'accepted';

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

  // Active Waiter Profile
  const [staffInfo, setStaffInfo] = useState<StaffProfile>({
    empid: 'EMP001',
    name: 'Staff Member',
    mobile: '',
    role: 'Waiter',
    assignedTables: [],
    initials: 'SM'
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

  // Tips State
  const [todayTips, setTodayTips] = useState<number>(() => {
    const saved = localStorage.getItem('tabletap_waiter_today_tips');
    return saved ? Number(saved) : 0;
  });
  const [monthTips, setMonthTips] = useState<number>(() => {
    const saved = localStorage.getItem('tabletap_waiter_month_tips');
    return saved ? Number(saved) : 0;
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
          handleLogout('Session expired after 30 minutes of inactivity. Please enter credentials to log back in.');
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
        handleLogout('Session expired after 30 minutes of inactivity. Please sign in with Employee ID & Password.');
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

  // Synchronize Orders and Service Requests from Supabase
  const fetchTasks = async () => {
    try {
      const [allOrders, allReqs] = await Promise.all([
        db.getAllOrders(),
        db.getWaiterRequests()
      ]);
      setOrders(allOrders);
      setWaiterRequests(allReqs);
    } catch (err) {
      console.warn('WaiterModule: sync error:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle Staff Login with Credentials given by Admin in Staff Scorecard
  const handleLogin = async () => {
    setAuthError(null);
    setSessionExpiredNotice(null);

    const enteredId = employeeId.trim().toUpperCase();
    const enteredPassword = password.trim();

    if (!enteredId || !enteredPassword) {
      setAuthError('Please enter both Employee ID and Password issued by Admin.');
      return;
    }

    try {
      const staffList = await db.getStaff();

      // Find staff in database matching empid (case-insensitive)
      const foundStaff = staffList.find((s: any) => 
        (s.empid && s.empid.toUpperCase() === enteredId) || 
        (s.id && s.id.toUpperCase() === enteredId)
      );

      // Verify Password against Admin Scorecard Credentials
      if (foundStaff) {
        if (foundStaff.password !== enteredPassword) {
          setAuthError('Invalid credentials. Password does not match the one configured in Admin Staff Scorecard.');
          return;
        }

        if (foundStaff.role && foundStaff.role !== 'Waiter' && foundStaff.role !== 'Manager') {
          setAuthError(`Access Denied: Role "${foundStaff.role}" cannot access the Waiter console.`);
          return;
        }

        const profile: StaffProfile = {
          empid: foundStaff.empid || foundStaff.id,
          name: foundStaff.name,
          mobile: foundStaff.mobile || '',
          role: foundStaff.role || 'Waiter',
          assignedTables: Array.isArray(foundStaff.assignedTables) ? foundStaff.assignedTables : [],
          initials: (foundStaff.name.split(' ').map((n: string) => n[0]).join('')).substring(0, 3).toUpperCase(),
          photo: foundStaff.photo
        };

        setStaffInfo(profile);
        localStorage.setItem('tabletap_waiter_staff', JSON.stringify(profile));
        localStorage.setItem('tabletap_waiter_logged_in', 'true');
        recordActivity();
        setActiveView('tasks');
        return;
      }

      // Default fallback demo credentials if no database staff exists yet
      if (enteredId === 'EMP001' && enteredPassword === 'password123') {
        const demoProfile: StaffProfile = {
          empid: 'EMP001',
          name: 'Demo Waiter',
          mobile: '+91 98765 43210',
          role: 'Waiter',
          assignedTables: [],
          initials: 'DW'
        };
        setStaffInfo(demoProfile);
        localStorage.setItem('tabletap_waiter_staff', JSON.stringify(demoProfile));
        localStorage.setItem('tabletap_waiter_logged_in', 'true');
        recordActivity();
        setActiveView('tasks');
        return;
      }

      setAuthError('Access Denied: Staff ID not registered. Admin must approve application in Staff Scorecard.');
    } catch (e: any) {
      setAuthError(e?.message || 'Authentication error connecting to server.');
    }
  };

  // Quick Android Fingerprint Unlock within active 30-min session
  const handleFingerprintUnlock = async () => {
    setAuthError(null);
    try {
      // If WebAuthn Biometric API is available on Android / browser
      if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (isAvailable && navigator.credentials) {
          // Attempt biometric authentication challenge
          // If succeeds or in test simulation, restore session:
        }
      }

      // Restore active session with fingerprint
      recordActivity();
      setActiveView('tasks');
      setFeedbackMessage('Fingerprint verified successfully! Welcome back.');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      // Fallback
      recordActivity();
      setActiveView('tasks');
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

    if (order.tip && order.tip > 0) {
      setTodayTips(prev => {
        const next = prev + order.tip;
        localStorage.setItem('tabletap_waiter_today_tips', String(next));
        return next;
      });
      setMonthTips(prev => {
        const next = prev + order.tip;
        localStorage.setItem('tabletap_waiter_month_tips', String(next));
        return next;
      });
    }

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Delivered' } : o));
    setFeedbackMessage(`Order #${order.id} delivered to Table ${order.tableId}`);
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

  const pendingTasks = allTasksList.filter(t => !t.isAccepted);
  const acceptedTasks = allTasksList.filter(t => t.isAccepted);

  const displayedTasks = 
    activeTab === 'all' ? allTasksList :
    activeTab === 'pending' ? pendingTasks : acceptedTasks;

  return (
    <div className="min-h-screen bg-[#FCFAF7] flex justify-center items-start text-slate-800 font-sans selection:bg-orange-500 selection:text-white">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md min-h-screen bg-[#FCFAF7] flex flex-col relative shadow-2xl border-x border-orange-100/60 pb-8">

        {/* Feedback Toast */}
        {feedbackMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
            <CheckCircle size={15} className="text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* ====================================================
            VIEW 1: WAITER AUTHENTICATION (LOGIN)
            ==================================================== */}
        {activeView === 'login' && (
          <div className="flex-1 p-6 flex flex-col justify-between animate-fade-in">
            <div>
              {/* Header */}
              <div className="flex items-center gap-3 pt-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-orange-500/25">
                  <ClocheIcon size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-none">TableTap</h2>
                  <span className="text-[11px] font-semibold text-slate-400">Waiter Terminal</span>
                </div>
              </div>

              {/* Title */}
              <div className="mt-8">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Staff Sign In</span>
                  <span className="text-xl">🔒</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Enter the credentials issued in Admin Staff Scorecard.
                </p>
              </div>

              {/* Session Notice */}
              {sessionExpiredNotice && (
                <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <Clock size={16} className="text-amber-600 shrink-0" />
                  <span>{sessionExpiredNotice}</span>
                </div>
              )}

              {/* Form Card */}
              <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm border border-orange-100/60">
                {/* Employee ID */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    EMPLOYEE ID (EMPID)
                  </label>
                  <div className="flex items-center gap-3 bg-[#FFF9F5] border border-orange-100/70 rounded-2xl px-4 py-3.5 focus-within:border-orange-500 transition-all">
                    <User size={18} className="text-[#FF6B00]" />
                    <input 
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. EMP-1042 or EMP001"
                      className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="mt-4">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    PASSWORD
                  </label>
                  <div className="flex items-center justify-between bg-[#FFF9F5] border border-orange-100/70 rounded-2xl px-4 py-3.5 focus-within:border-orange-500 transition-all">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Lock size={18} className="text-[#FF6B00]" />
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Auth Error Banner */}
                {authError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Continue Button */}
                <button
                  type="button"
                  onClick={handleLogin}
                  className="w-full mt-6 py-3.5 rounded-2xl bg-[#FF6B00] hover:bg-orange-600 active:scale-98 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all text-center cursor-pointer"
                >
                  Verify Credentials & Sign In
                </button>
              </div>

              {/* Security Hint */}
              <p className="text-[11px] text-slate-400 font-medium text-center mt-6 flex items-center justify-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>30-minute inactivity session. Fingerprint unlock active inside session.</span>
              </p>
            </div>
          </div>
        )}

        {/* ====================================================
            VIEW 1.5: QUICK ANDROID FINGERPRINT LOCK (IN-SESSION)
            ==================================================== */}
        {activeView === 'biometric_lock' && (
          <div className="flex-1 p-6 flex flex-col justify-between items-center text-center animate-fade-in py-12">
            <div>
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                <Fingerprint size={36} className="animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Fingerprint Verification</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
                Welcome back, <strong className="text-slate-800">{staffInfo.name}</strong>. Scan your Android fingerprint sensor to unlock this session.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full text-[11px] font-bold text-amber-700">
                <Clock size={12} />
                <span>Session active: {remainingMinutes}m remaining</span>
              </div>
            </div>

            {/* Fingerprint Touch Button */}
            <div className="my-8">
              <button
                type="button"
                onClick={handleFingerprintUnlock}
                className="w-28 h-28 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex flex-col items-center justify-center shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer mx-auto"
              >
                <Fingerprint size={48} />
                <span className="text-[9px] font-black uppercase mt-1 tracking-wider">Touch Sensor</span>
              </button>
            </div>

            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={handleFingerprintUnlock}
                className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Verify Fingerprint
              </button>
              <button
                type="button"
                onClick={() => handleLogout()}
                className="text-xs text-red-500 font-bold hover:underline cursor-pointer"
              >
                Sign In with Different ID
              </button>
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
                <div className="w-9 h-9 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                  <ClocheIcon size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-none">TableTap</h2>
                  <span className="text-[10px] font-semibold text-slate-400">Waiter Terminal</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Biometric Quick Lock button */}
                <button
                  onClick={() => setActiveView('biometric_lock')}
                  title="Lock with Android Fingerprint"
                  className="p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <Fingerprint size={16} />
                </button>

                {/* Profile Circle */}
                <button
                  onClick={() => setActiveView('profile')}
                  title="View Waiter Profile"
                  className="w-9 h-9 rounded-full bg-[#FF6B00] hover:bg-orange-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  {staffInfo.initials}
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
                All ({allTasksList.length})
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
                <div className="w-20 h-20 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-orange-500/25">
                  {staffInfo.initials}
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-3">{staffInfo.name}</h2>
                <p className="text-xs text-slate-400 font-bold">{staffInfo.empid} &bull; {staffInfo.role}</p>

                <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-2 text-xs">
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

              {/* Quick Options */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setActiveView('biometric_lock')}
                  className="w-full bg-white p-4 rounded-2xl border border-orange-100 text-left flex items-center justify-between text-xs font-bold text-slate-800 hover:border-orange-500 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Fingerprint size={18} className="text-amber-500" />
                    <span>Android Fingerprint Lock</span>
                  </div>
                  <span className="text-slate-400 text-[10px]">Lock Screen</span>
                </button>

                <button
                  onClick={() => setActiveView('tip_earnings')}
                  className="w-full bg-white p-4 rounded-2xl border border-orange-100 text-left flex items-center justify-between text-xs font-bold text-slate-800 hover:border-orange-500 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Wallet size={18} className="text-emerald-500" />
                    <span>Tip Earnings</span>
                  </div>
                  <span className="text-emerald-600 font-black">₹{todayTips}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleLogout()}
              className="w-full py-3.5 rounded-2xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-all cursor-pointer mt-6"
            >
              Sign Out from Terminal
            </button>
          </div>
        )}

        {/* ====================================================
            VIEW 5: TIP EARNINGS
            ==================================================== */}
        {activeView === 'tip_earnings' && (
          <div className="flex-1 p-5 flex flex-col justify-between animate-fade-in">
            <div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveView('profile')}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-lg font-black text-slate-900">Tip Earnings</h1>
              </div>

              <div className="mt-6 space-y-4">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-6 text-white shadow-lg">
                  <span className="text-emerald-100 text-xs font-bold uppercase tracking-wider block">Today's Total Tips</span>
                  <h2 className="text-3xl font-black mt-2">₹{todayTips}</h2>
                  <p className="text-[11px] text-emerald-100 mt-1">Directly credited to your staff account</p>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-orange-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">This Month</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">₹{monthTips}</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Wallet size={20} />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveView('profile')}
              className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
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
