import React, { useState, useEffect } from 'react';
import { db } from '../../supabase';
import { Order, WaiterRequest } from '../../types';
import { 
  ArrowLeft, ChevronRight, User, Lock, Eye, EyeOff, 
  Fingerprint, CheckCircle, Utensils,
  Wallet, Sparkles, AlertTriangle, Check
} from 'lucide-react';

export const ClocheIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 4a2 2 0 0 1 2 2c0 .24-.04.47-.12.68A8.003 8.003 0 0 1 21 14v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a8.003 8.003 0 0 1 7.12-7.32A2.001 2.001 0 0 1 12 4zm9 13a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h18z"/>
  </svg>
);

type WaiterView = 'login' | 'tasks' | 'profile' | 'employee_details' | 'tip_earnings';
type TaskTab = 'all' | 'pending' | 'accepted';

interface StaffProfile {
  empid: string;
  name: string;
  mobile: string;
  role: string;
  assignedTables: number[];
  initials: string;
}

export const WaiterModule: React.FC = () => {
  const [activeView, setActiveView] = useState<WaiterView>(() => {
    return localStorage.getItem('tabletap_waiter_logged_in') === 'true' ? 'tasks' : 'login';
  });

  // Staff Credentials
  const [employeeId, setEmployeeId] = useState('EMP001');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);

  // Active Waiter Profile
  const [staffInfo, setStaffInfo] = useState<StaffProfile>({
    empid: 'EMP001',
    name: 'Staff Member (EMP001)',
    mobile: '+91 98765 43210',
    role: 'Waiter',
    assignedTables: [1, 2, 3, 4],
    initials: 'SM('
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

  // Tips State
  const [todayTips, setTodayTips] = useState<number>(() => {
    const saved = localStorage.getItem('tabletap_waiter_today_tips');
    return saved ? Number(saved) : 0;
  });
  const [monthTips, setMonthTips] = useState<number>(() => {
    const saved = localStorage.getItem('tabletap_waiter_month_tips');
    return saved ? Number(saved) : 0;
  });

  // Save accepted tasks
  useEffect(() => {
    localStorage.setItem('tabletap_waiter_accepted_tasks', JSON.stringify(acceptedTaskIds));
  }, [acceptedTaskIds]);

  // Synchronize Orders and Service Requests from Supabase / DB
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
    const interval = setInterval(fetchTasks, 2500);
    return () => clearInterval(interval);
  }, []);

  const [authError, setAuthError] = useState<string | null>(null);

  // Handle Staff Login with Authentication & Authorization
  const handleLogin = async (isFingerprint = false) => {
    setAuthError(null);
    try {
      const staffList = await db.getStaff();
      const enteredId = employeeId.trim().toUpperCase();

      // Check if employee exists in DB or is demo staff
      const foundStaff = staffList.find((s: any) => 
        (s.empid && s.empid.toUpperCase() === enteredId) || 
        (s.id && s.id.toUpperCase() === enteredId)
      );

      // Default authorized waitstaff credentials
      const defaultStaffIds = ['EMP001', 'EMP002', 'EMP-101', 'EMP-102', 'EMP-103', 'EMP-104'];

      if (!isFingerprint && !foundStaff && !defaultStaffIds.includes(enteredId)) {
        setAuthError("Access Denied: Staff ID not found. Only authorized hotel staff can access.");
        return;
      }

      // Check role authorization (must be Waiter or Staff)
      if (foundStaff && foundStaff.role && foundStaff.role !== 'Waiter' && foundStaff.role !== 'Staff') {
        setAuthError(`Access Denied: Role "${foundStaff.role}" cannot access Waiter console.`);
        return;
      }

      // Set logged-in staff info
      if (foundStaff) {
        setStaffInfo({
          empid: foundStaff.empid || foundStaff.id,
          name: foundStaff.name,
          mobile: foundStaff.mobile || '+91 98765 43210',
          role: foundStaff.role || 'Waiter',
          assignedTables: foundStaff.assignedTables || [1, 2, 3, 4],
          initials: (foundStaff.name.split(' ').map((n: string) => n[0]).join('') + '(').substring(0, 3)
        });
      }

      localStorage.setItem('tabletap_waiter_logged_in', 'true');
      setActiveView('tasks');
    } catch (e) {
      // Offline fallback for EMP001
      localStorage.setItem('tabletap_waiter_logged_in', 'true');
      setActiveView('tasks');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tabletap_waiter_logged_in');
    setActiveView('login');
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

  // Filter Tasks: Orders Ready to Serve + Pending Customer Service Requests
  const readyOrders = orders.filter(o => o.status === 'Ready to Serve');
  const pendingRequests = waiterRequests.filter(r => r.status === 'Pending');

  // Unified task items
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

        {/* Inline Feedback Banner */}
        {feedbackMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
            <CheckCircle size={15} className="text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* ====================================================
            VIEW 1: WELCOME BACK (LOGIN)
            ==================================================== */}
        {activeView === 'login' && (
          <div className="flex-1 p-6 flex flex-col justify-between animate-fade-in">
            <div>
              {/* Header: TableTap Logo & Waiter Lite */}
              <div className="flex items-center gap-3 pt-4">
                <div className="w-12 h-12 rounded-full bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-orange-500/25">
                  <ClocheIcon size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-none">TableTap</h2>
                  <span className="text-[11px] font-semibold text-slate-400">Waiter Lite</span>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="mt-8">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Welcome Back</span>
                  <span className="text-xl">👋</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Login to manage your assigned tables and active dining tasks.
                </p>
              </div>

              {/* Form Card */}
              <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm border border-orange-100/60">
                {/* Employee ID */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    EMPLOYEE ID
                  </label>
                  <div className="flex items-center gap-3 bg-[#FFF9F5] border border-orange-100/70 rounded-2xl px-4 py-3.5 focus-within:border-orange-500 transition-all">
                    <User size={18} className="text-[#FF6B00]" />
                    <input 
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="EMP001"
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
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* OR Divider */}
                <div className="flex items-center my-6">
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="px-3 text-[10px] font-bold text-slate-400">OR</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                {/* Auth Error Banner */}
                {authError && (
                  <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Login with Fingerprint Button */}
                <button
                  type="button"
                  onClick={() => handleLogin(true)}
                  className="w-full py-3.5 rounded-2xl border-[1.5px] border-[#F59E0B] text-[#D97706] font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-50/50 active:scale-98 transition-all cursor-pointer"
                >
                  <Fingerprint size={18} className="text-[#F59E0B]" />
                  <span>Login with Fingerprint</span>
                </button>

                {/* Continue Button */}
                <button
                  type="button"
                  onClick={() => handleLogin(false)}
                  className="w-full mt-3 py-3.5 rounded-2xl bg-[#FF6B00] hover:bg-orange-600 active:scale-98 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all text-center cursor-pointer"
                >
                  Continue
                </button>
              </div>

              {/* Tip Hint */}
              <p className="text-[11px] text-amber-700/80 font-medium text-center mt-6 flex items-center justify-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                <span>Tip: Press Fingerprint or Continue to auto-login.</span>
              </p>
            </div>
          </div>
        )}

        {/* ====================================================
            VIEW 2: ACTIVE TASKS (SERVICE BOARD)
            ==================================================== */}
        {activeView === 'tasks' && (
          <div className="flex-1 p-5 flex flex-col animate-fade-in">
            {/* Top Navigation Bar */}
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                  <ClocheIcon size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-none">TableTap</h2>
                  <span className="text-[10px] font-semibold text-slate-400">Waiter Lite</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Waiter Initials Circle (Clicks to Profile) */}
                <button
                  onClick={() => setActiveView('profile')}
                  title="View Waiter Profile"
                  className="w-9 h-9 rounded-full bg-[#FF6B00] hover:bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  {staffInfo.initials}
                </button>
              </div>
            </div>

            {/* Tasks Subtitle */}
            <div className="mt-6">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Tasks</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                FIRST COME, FIRST SERVED
              </p>
            </div>

            {/* Filter Tabs Pills */}
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

            {/* Content Area: Cards List or Empty State */}
            <div className="mt-5 flex-1 flex flex-col">
              {displayedTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-10">
                  <div className="w-full border-2 border-dashed border-slate-200/90 rounded-3xl p-8 bg-white/70 text-center">
                    <div className="text-3xl mb-2">🍽️</div>
                    <h3 className="text-base font-black text-slate-900">All caught up!</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed max-w-xs mx-auto">
                      No active tasks in this category. New kitchen orders and table requests will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="bg-white rounded-3xl p-5 border border-orange-100 shadow-sm relative overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Top Bar of Task Card */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-black px-2.5 py-1 rounded-xl">
                            Table {task.tableId}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.isAccepted ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.isAccepted ? 'In Service' : 'Ready'}
                          </span>
                        </div>
                        {task.tip && task.tip > 0 ? (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            +₹{task.tip} Tip
                          </span>
                        ) : null}
                      </div>

                      {/* Title & Subtitle */}
                      <div className="mt-3">
                        <h4 className="text-sm font-black text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">{task.subtitle}</p>
                      </div>

                      {/* Items / Details List */}
                      <div className="mt-3 bg-[#FCFAF7] rounded-2xl p-3 border border-orange-50/70 space-y-1">
                        {task.details.map((detail, idx) => (
                          <p key={idx} className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]"></span>
                            <span>{detail}</span>
                          </p>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-2 border-t border-slate-100 flex gap-2">
                        {!task.isAccepted ? (
                          <button
                            onClick={() => handleAcceptTask(task.id)}
                            className="w-full py-2.5 rounded-xl bg-[#FF6B00] hover:bg-orange-600 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all text-center cursor-pointer"
                          >
                            Accept Task
                          </button>
                        ) : (
                          <>
                            {task.type === 'food_ready' && task.rawOrder && (
                              <button
                                onClick={() => handleServeOrder(task.rawOrder!)}
                                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Check size={14} className="stroke-[3]" />
                                <span>Mark as Served to Table {task.tableId}</span>
                              </button>
                            )}
                            {task.type === 'service_call' && task.rawReq && (
                              <button
                                onClick={() => handleCompleteRequest(task.rawReq!)}
                                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Check size={14} className="stroke-[3]" />
                                <span>Complete Request</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Tip Hint */}
            <p className="text-[11px] text-amber-700/80 font-medium text-center mt-6 flex items-center justify-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" />
              <span>Click initials "{staffInfo.initials}" to view staff profile.</span>
            </p>
          </div>
        )}

        {/* ====================================================
            VIEW 3: MY PROFILE
            ==================================================== */}
        {activeView === 'profile' && (
          <div className="flex-1 p-5 flex flex-col justify-between animate-fade-in">
            <div>
              {/* Top Header with Back Arrow */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveView('tasks')}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-lg font-black text-slate-900">My Profile</h1>
              </div>

              {/* Profile Card */}
              <div className="mt-6 bg-white rounded-3xl p-6 border border-orange-100/70 shadow-sm text-center">
                {/* Large Avatar */}
                <div className="w-20 h-20 rounded-full bg-[#FF6B00] text-white font-black text-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/25">
                  {staffInfo.initials}
                </div>
                <h2 className="text-base font-black text-slate-900 mt-3">{staffInfo.name}</h2>
                <span className="text-xs text-slate-400 font-bold mt-0.5 block">{staffInfo.empid}</span>

                {/* On Duty Badge */}
                <div className="mt-3 inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-[#FF6B00] text-[11px] font-bold px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse"></span>
                  <span>On Duty</span>
                </div>
              </div>

              {/* Option 1: Employee Details */}
              <button
                onClick={() => setActiveView('employee_details')}
                className="w-full mt-4 bg-white rounded-2xl p-4 border border-orange-100/70 shadow-sm flex items-center justify-between hover:bg-orange-50/20 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Employee Details</h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Personal info & assigned tables</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>

              {/* Option 2: Tip Earnings */}
              <button
                onClick={() => setActiveView('tip_earnings')}
                className="w-full mt-3 bg-white rounded-2xl p-4 border border-orange-100/70 shadow-sm flex items-center justify-between hover:bg-orange-50/20 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Tip Earnings</h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Today & monthly summary</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>

              {/* Logout Option */}
              <button
                onClick={handleLogout}
                className="w-full mt-4 py-3 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Logout Session</span>
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            VIEW 4: EMPLOYEE DETAILS
            ==================================================== */}
        {activeView === 'employee_details' && (
          <div className="flex-1 p-5 flex flex-col justify-between animate-fade-in">
            <div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveView('profile')}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-lg font-black text-slate-900">Employee Details</h1>
              </div>

              <div className="mt-6 bg-white rounded-3xl p-6 border border-orange-100 shadow-sm space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Staff Member</span>
                  <p className="text-slate-900 font-black text-sm mt-0.5">{staffInfo.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Employee ID</span>
                    <p className="text-slate-800 font-extrabold mt-0.5">{staffInfo.empid}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Assigned Role</span>
                    <p className="text-slate-800 font-extrabold mt-0.5">{staffInfo.role}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Registered Mobile</span>
                  <p className="text-slate-800 font-extrabold mt-0.5">{staffInfo.mobile}</p>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Designated Section Tables</span>
                  <div className="flex gap-2 mt-2">
                    {staffInfo.assignedTables.map(num => (
                      <span key={num} className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6B00] font-black flex items-center justify-center text-xs">
                        {num}
                      </span>
                    ))}
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
