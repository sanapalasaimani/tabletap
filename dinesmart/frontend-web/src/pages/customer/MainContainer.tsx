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
import { Home, Search, ShoppingCart, Clock, User, ConciergeBell, RefreshCw, AlertTriangle, LogOut } from 'lucide-react';

export const MainContainer: React.FC = () => {
  const { tableId: routeTableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { isLoggedIn, cart, activeOrder, tableId, setTableId } = useApp();
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'cart' | 'orders' | 'profile'>('home');
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const [initialSearchCategory, setInitialSearchCategory] = useState<MenuItem['category'] | undefined>(undefined);

  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'valid' | 'invalid'>('verifying');

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
        if (tableObj && tableObj.qr_token && tableObj.qr_token === token) {
          setTableId(String(tableNum));
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
  }, [routeTableId, token, setTableId]);

  // SWIPE-BACK & BROWSER-BACK TRAP:
  // When user swipes back on mobile, return to 'home'. Only exit when user clicks Logout.
  useEffect(() => {
    // Initial replaceState to establish history entry
    window.history.replaceState({ tab: 'home' }, '');

    const handlePopState = () => {
      // 1. Close modal if open
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

      // 2. If user is in search, cart, orders, or profile -> go back to home!
      if (activeTabRef.current !== 'home') {
        setActiveTab('home');
        window.history.pushState({ tab: 'home' }, '');
      } else {
        // If already on home, trap state so they don't drop out into Google Lens by accident
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

  const handleExplicitLogout = () => {
    // Clear user state and navigate back out to landing / Google Lens
    localStorage.removeItem('dinesmart_active_table');
    localStorage.removeItem('dinesmart_active_order');
    window.location.href = '/';
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
          <button
            onClick={() => setShowWaiterModal(true)}
            className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <ConciergeBell size={13} />
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
