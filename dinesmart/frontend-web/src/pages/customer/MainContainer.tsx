import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { MenuItem } from '../../types';
import { db } from '../../supabase';
import { WelcomeScreen } from './WelcomeScreen';
import { HomeScreen } from './HomeScreen';
import { SearchScreen } from './SearchScreen';
import { CartScreen } from './CartScreen';
import { OrdersScreen } from './OrdersScreen';
import { ProfileScreen } from './ProfileScreen';

// Modals
import { DishDetailModal } from '../../components/customer/DishDetailModal';
import { CallWaiterModal } from '../../components/customer/CallWaiterModal';
import { CheckoutOverlay } from '../../components/customer/CheckoutOverlay';

// Icons
import { Home, Search, ShoppingCart, Clock, User, ConciergeBell, RefreshCw, AlertTriangle, LogOut, ShieldCheck, Check } from 'lucide-react';

export const MainContainer: React.FC = () => {
  const { tableId: routeTableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { isLoggedIn, cart, activeOrder, tableId, setTableId, phone, customerName } = useApp();
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'cart' | 'orders' | 'profile'>('home');
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const [initialSearchCategory, setInitialSearchCategory] = useState<MenuItem['category'] | undefined>(undefined);

  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'valid' | 'invalid' | 'locked'>('verifying');
  const [lockedSessionInfo, setLockedSessionInfo] = useState<any>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinPhoneInput, setJoinPhoneInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [waiterCalledNotice, setWaiterCalledNotice] = useState(false);

  // Modal Overlays
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Refs for tracking in popstate event listener
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const selectedDishRef = useRef(selectedDish);
  selectedDishRef.current = selectedDish;

  const showWaiterModalRef = useRef(showWaiterModal);
  showWaiterModalRef.current = showWaiterModal;

  const showCheckoutModalRef = useRef(showCheckoutModal);
  showCheckoutModalRef.current = showCheckoutModal;

  // Cart quantity count
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Get or initialize device ID
  const getDeviceId = () => {
    let devId = localStorage.getItem('dinesmart_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('dinesmart_device_id', devId);
    }
    return devId;
  };

  useEffect(() => {
    const verifyTableSession = async () => {
      if (!routeTableId || !token) {
        setVerificationStatus('invalid');
        return;
      }

      try {
        const tableNum = parseInt(routeTableId, 10);
        if (isNaN(tableNum) || tableNum <= 0) {
          setVerificationStatus('invalid');
          return;
        }

        const tableObj = await db.getTable(tableNum);
        // Table must exist in database AND token must match the registered table's qr_token
        if (!tableObj || !tableObj.qr_token || tableObj.qr_token !== token) {
          setVerificationStatus('invalid');
          return;
        }

        // STRICT 1-USER/SESSION LOCK PER QR CODE
        const deviceId = getDeviceId();
        const claimResult = await db.claimTableSession(tableNum, deviceId, phone, customerName);

        if (claimResult.status === 'locked') {
          setLockedSessionInfo(claimResult.activeSession);
          setVerificationStatus('locked');
          return;
        }

        if (claimResult.status === 'success') {
          setTableId(String(tableNum));
          localStorage.setItem('dinesmart_active_table', String(tableNum));
          localStorage.setItem('dinesmart_session_id', claimResult.sessionId || '');
          setVerificationStatus('valid');
        } else {
          setVerificationStatus('invalid');
        }
      } catch (e) {
        console.error('Error verifying table session:', e);
        setVerificationStatus('invalid');
      }
    };

    verifyTableSession();
  }, [routeTableId, token, setTableId, phone, customerName]);

  // 2-HOUR INACTIVITY AUTO LOGOUT & SESSION EXPIRATION
  useEffect(() => {
    if (verificationStatus !== 'valid' || !routeTableId) return;

    const tableNum = parseInt(routeTableId, 10);
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    let timer: any = null;

    const resetInactivityTimer = () => {
      if (timer) clearTimeout(timer);
      const devId = getDeviceId();
      db.touchTableActivity(tableNum, devId);

      timer = setTimeout(async () => {
        console.log('2 hours of user inactivity reached: automatically releasing QR session.');
        await db.releaseTableSession(tableNum);
        localStorage.removeItem('dinesmart_active_table');
        localStorage.removeItem('dinesmart_active_order');
        localStorage.removeItem('dinesmart_session_id');
        alert('Your 2-hour dining table session has expired due to inactivity. Please scan the QR code to begin a fresh session.');
        window.location.href = '/';
      }, TWO_HOURS_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [verificationStatus, routeTableId]);

  // SWIPE-BACK & BROWSER-BACK TRAP:
  useEffect(() => {
    window.history.replaceState({ tab: 'home' }, '');

    const handlePopState = () => {
      if (selectedDishRef.current) {
        setSelectedDish(null);
        window.history.pushState({ tab: activeTabRef.current }, '');
        return;
      }
      if (showWaiterModalRef.current) {
        setShowWaiterModal(false);
        window.history.pushState({ tab: activeTabRef.current }, '');
        return;
      }
      if (showCheckoutModalRef.current) {
        setShowCheckoutModal(false);
        window.history.pushState({ tab: activeTabRef.current }, '');
        return;
      }

      if (activeTabRef.current !== 'home') {
        setActiveTab('home');
        window.history.pushState({ tab: 'home' }, '');
      } else {
        window.history.pushState({ tab: 'home' }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateToSearch = (category?: MenuItem['category']) => {
    setInitialSearchCategory(category);
    window.history.pushState({ tab: 'search' }, '');
    setActiveTab('search');
  };

  const handleNavigateToTab = (tab: 'home' | 'search' | 'cart' | 'orders' | 'profile') => {
    if (tab === 'search') setInitialSearchCategory(undefined);
    if (tab !== activeTab) {
      window.history.pushState({ tab }, '');
    }
    setActiveTab(tab);
  };

  const handleExplicitLogout = async () => {
    if (routeTableId) {
      const tableNum = parseInt(routeTableId, 10);
      if (!isNaN(tableNum)) {
        await db.releaseTableSession(tableNum);
      }
    }
    localStorage.removeItem('dinesmart_active_table');
    localStorage.removeItem('dinesmart_active_order');
    localStorage.removeItem('dinesmart_session_id');
    window.location.href = '/';
  };

  const handleJoinSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinPhoneInput.trim()) {
      setJoinError('Please enter your phone number to re-join.');
      return;
    }

    const tableNum = parseInt(routeTableId || '0', 10);
    const devId = getDeviceId();
    const joined = await db.joinTableSession(tableNum, devId, joinPhoneInput.trim());
    if (joined) {
      setJoinSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } else {
      setJoinError('Phone number does not match the active session registered for this table.');
    }
  };

  if (verificationStatus === 'verifying') {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-bg text-brand-text font-sans">
        <div className="text-center space-y-3">
          <RefreshCw className="animate-spin text-primary mx-auto" size={32} />
          <p className="text-sm font-bold">Verifying Secure Table QR Token...</p>
        </div>
      </div>
    );
  }

  // OCCUPIED TABLE SESSION LOCK (PREVENTS QR OVERFLOW)
  if (verificationStatus === 'locked') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white font-sans p-6 selection:bg-orange-500 selection:text-white">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl p-7 border border-orange-500/30 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-orange-500/10 text-orange-400 rounded-full flex items-center justify-center mx-auto border border-orange-500/20 shadow-lg shadow-orange-500/10">
            <ShieldCheck size={32} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
              Active Dining Session Lock
            </span>
            <h2 className="text-2xl font-black text-white mt-3">Table #{routeTableId} is Occupied</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium mt-2">
              This table is currently in use by an active party. Only one active guest session is permitted per QR code to prevent order collisions and billing errors.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              Re-Join Session (Registered Diner)
            </button>

            <button
              onClick={async () => {
                await db.requestWaiter(String(routeTableId), 'Call Waiter');
                setWaiterCalledNotice(true);
              }}
              disabled={waiterCalledNotice}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 rounded-2xl text-xs transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              {waiterCalledNotice ? '✓ Waiter Notified to Clear Table' : 'Previous Party Left? Call Waiter to Free Table'}
            </button>

            <a
              href="/"
              className="inline-block w-full text-center text-slate-400 hover:text-white py-2 text-xs font-semibold transition-colors"
            >
              Scan a Different Table
            </a>
          </div>

          {/* Join modal */}
          {showJoinModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-left space-y-4">
                <h3 className="text-base font-extrabold text-white">Join Table #{routeTableId} Session</h3>
                <p className="text-xs text-slate-400">
                  Enter the phone number used by your dining party to link your device.
                </p>
                <form onSubmit={handleJoinSessionSubmit} className="space-y-3">
                  <input
                    type="tel"
                    value={joinPhoneInput}
                    onChange={(e) => setJoinPhoneInput(e.target.value)}
                    placeholder="Enter phone number (e.g. 9876543210)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                  {joinError && <p className="text-[11px] text-red-400 font-semibold">{joinError}</p>}
                  {joinSuccess && <p className="text-[11px] text-emerald-400 font-semibold">✓ Verified! Connecting session...</p>}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowJoinModal(false)}
                      className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-bold"
                    >
                      Verify & Join
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (verificationStatus === 'invalid') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-slate-800 font-sans p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-100 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Invalid Table QR Code</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Access is restricted to diners with an authenticated QR code. Please scan the genuine QR code sticker located on your dining table.
          </p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-block w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-2xl text-xs transition-colors shadow-sm"
            >
              Scan Table QR Code
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, show welcome gate
  if (!isLoggedIn || !welcomeCompleted) {
    return (
      <div className="customer-container">
        <WelcomeScreen onContinue={() => setWelcomeCompleted(true)} />
      </div>
    );
  }

  return (
    <div className="customer-container h-[100dvh] overflow-hidden flex flex-col relative bg-white shadow-2xl">
      
      {/* 1. STICKY TOP APP BAR */}
      <header className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md shadow-orange-500/20">
            TT
          </div>
          <div>
            <h1 className="font-extrabold text-brand-text text-sm tracking-tight leading-none">TableTap</h1>
            <span className="text-[10px] text-orange-600 font-bold mt-0.5 inline-block">Table #{tableId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Note 10: Replace bell icon with high-visibility Call Waiter Button */}
          <button
            onClick={() => setShowWaiterModal(true)}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-3.5 py-1.5 rounded-full text-xs font-black transition-all shadow-md shadow-orange-500/20 cursor-pointer"
          >
            <ConciergeBell size={14} />
            <span>Call Waiter</span>
          </button>

          {/* User Explicit Logout / Exit Table Button */}
          <button
            onClick={() => setShowExitModal(true)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
            title="Exit Table Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 2. MAIN SCROLLABLE VIEWPORT */}
      <main className="flex-1 overflow-y-auto pb-24 relative bg-brand-bg no-scrollbar">
        {activeTab === 'home' && (
          <HomeScreen 
            onSelectDish={setSelectedDish} 
            onNavigateToSearch={handleNavigateToSearch} 
          />
        )}
        
        {activeTab === 'search' && (
          <SearchScreen 
            initialCategory={initialSearchCategory} 
            onSelectDish={setSelectedDish} 
          />
        )}

        {activeTab === 'cart' && (
          <CartScreen 
            onOrderPlaced={() => handleNavigateToTab('orders')} 
            onNavigateToHome={() => handleNavigateToTab('home')} 
          />
        )}

        {activeTab === 'orders' && (
          <OrdersScreen 
            onAddMoreItems={() => handleNavigateToTab('search')} 
            onPayBill={() => setShowCheckoutModal(true)} 
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen 
            onNavigateToTab={handleNavigateToTab} 
            onSelectDish={setSelectedDish} 
          />
        )}
      </main>

      {/* 3. ROCK-SOLID STATIC BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 max-w-[480px] w-full bg-white/98 backdrop-blur-md border-t border-gray-100 px-3 py-2 flex justify-around items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex-shrink-0">
        {/* Home */}
        <button
          onClick={() => handleNavigateToTab('home')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home' ? 'text-primary font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Home size={20} className={activeTab === 'home' ? 'stroke-[2.5px] scale-110 transition-transform' : 'stroke-2'} />
          <span className="text-[10px]">Home</span>
        </button>

        {/* Search */}
        <button
          onClick={() => handleNavigateToTab('search')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'search' ? 'text-primary font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Search size={20} className={activeTab === 'search' ? 'stroke-[2.5px] scale-110 transition-transform' : 'stroke-2'} />
          <span className="text-[10px]">Search</span>
        </button>

        {/* Cart */}
        <button
          onClick={() => handleNavigateToTab('cart')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl relative transition-all cursor-pointer ${
            activeTab === 'cart' ? 'text-primary font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className="relative">
            <ShoppingCart size={20} className={activeTab === 'cart' ? 'stroke-[2.5px] scale-110 transition-transform' : 'stroke-2'} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-primary text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Cart</span>
        </button>

        {/* Orders status */}
        <button
          onClick={() => handleNavigateToTab('orders')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'orders' ? 'text-primary font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className="relative">
            <Clock size={20} className={activeTab === 'orders' ? 'stroke-[2.5px] scale-110 transition-transform' : 'stroke-2'} />
            {activeOrder && activeOrder.status !== 'Delivered' && (
              <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white animate-ping"></span>
            )}
          </div>
          <span className="text-[10px]">Orders</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => handleNavigateToTab('profile')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'profile' ? 'text-primary font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <User size={20} className={activeTab === 'profile' ? 'stroke-[2.5px] scale-110 transition-transform' : 'stroke-2'} />
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>

      {/* 4. MODALS & OVERLAYS */}
      
      {/* Dish Details Modal */}
      {selectedDish && (
        <DishDetailModal 
          item={selectedDish} 
          onClose={() => setSelectedDish(null)} 
        />
      )}

      {/* Call Waiter Modal */}
      {showWaiterModal && (
        <CallWaiterModal 
          onClose={() => setShowWaiterModal(false)} 
        />
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <CheckoutOverlay 
          onClose={() => setShowCheckoutModal(false)}
          onPaymentSuccess={() => {
            setShowCheckoutModal(false);
            handleNavigateToTab('orders');
          }}
        />
      )}

      {/* Exit / Logout Dining Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl border border-gray-100">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <LogOut size={22} />
            </div>
            <div>
              <h3 className="font-black text-sm text-gray-900">Exit Dining Session?</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Leaving Table #{tableId} will close your dining session and return to camera/lens.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Stay
              </button>
              <button
                onClick={handleExplicitLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
              >
                Exit Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MainContainer;
