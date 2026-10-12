import React, { useState, useEffect } from 'react';
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
import { Home, Search, ShoppingCart, Clock, User, ConciergeBell, RefreshCw, AlertTriangle } from 'lucide-react';

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

  const handleNavigateToSearch = (category?: MenuItem['category']) => {
    setInitialSearchCategory(category);
    setActiveTab('search');
  };

  const handleNavigateToTab = (tab: 'home' | 'search' | 'cart' | 'orders' | 'profile') => {
    if (tab === 'search') setInitialSearchCategory(undefined);
    setActiveTab(tab);
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
    <div className="customer-container">
      <div className="flex-grow flex flex-col h-screen overflow-hidden bg-brand-bg relative">
      
      {/* 1. STICKY TOP APP BAR */}
      {activeTab !== 'profile' && (
        <header className="flex justify-between items-center px-5 py-4 bg-white border-b border-gray-100 flex-shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-primary/10">
              TT
            </div>
            <div>
              <h1 className="font-extrabold text-brand-text text-sm tracking-tight leading-none">TableTap</h1>
              <span className="text-[10px] text-gray-400 font-semibold mt-0.5 inline-block">Table {tableId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowWaiterModal(true)}
              className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <ConciergeBell size={13} />
              <span>Call Waiter</span>
            </button>
          </div>
        </header>
      )}

      {/* 2. MAIN PAGE DISPLAY CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
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
            onOrderPlaced={() => setActiveTab('orders')} 
            onNavigateToHome={() => setActiveTab('home')} 
          />
        )}

        {activeTab === 'orders' && (
          <OrdersScreen 
            onAddMoreItems={() => setActiveTab('search')} 
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

      {/* 3. MOBILE SYSTEM BOTTOM NAVIGATION BAR */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-3 py-2.5 flex justify-around items-center z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] flex-shrink-0">
        {/* Home */}
        <button
          onClick={() => handleNavigateToTab('home')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'home' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Home size={20} className={activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-2'} />
          <span className="text-[10px] font-bold">Home</span>
        </button>

        {/* Search */}
        <button
          onClick={() => handleNavigateToTab('search')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'search' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Search size={20} className={activeTab === 'search' ? 'stroke-[2.5px]' : 'stroke-2'} />
          <span className="text-[10px] font-bold">Search</span>
        </button>

        {/* Cart */}
        <button
          onClick={() => handleNavigateToTab('cart')}
          className={`flex flex-col items-center gap-1 relative transition-all ${
            activeTab === 'cart' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className="relative">
            <ShoppingCart size={20} className={activeTab === 'cart' ? 'stroke-[2.5px]' : 'stroke-2'} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[8px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Cart</span>
        </button>

        {/* Orders status */}
        <button
          onClick={() => handleNavigateToTab('orders')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'orders' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className="relative">
            <Clock size={20} className={activeTab === 'orders' ? 'stroke-[2.5px]' : 'stroke-2'} />
            {activeOrder && activeOrder.status !== 'Delivered' && (
              <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white animate-ping"></span>
            )}
          </div>
          <span className="text-[10px] font-bold">Orders</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => handleNavigateToTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'profile' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <User size={20} className={activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-2'} />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </nav>

      {/* 4. MODALS & OVERLAYS INTERFACES */}
      
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
            setActiveTab('orders'); // stay on orders to rate feedback or view order history
          }}
        />
      )}

      </div>
    </div>
  );
};
