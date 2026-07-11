import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MenuItem } from '../../types';
import { 
  User, Award, Gift, Clock, Heart, Settings, 
  HelpCircle, LogOut, ChevronRight, ArrowLeft,
  Droplet, Inbox, FileText, ConciergeBell, CheckCircle
} from 'lucide-react';

interface ProfileScreenProps {
  onNavigateToTab: (tab: 'home' | 'search' | 'cart' | 'orders' | 'profile') => void;
  onSelectDish: (item: MenuItem) => void;
}

type ProfileSubView = 'main' | 'favorites' | 'help' | 'coupons';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigateToTab, onSelectDish }) => {
  const { profile, logoutCustomer, favorites, toggleFavorite, callWaiter, tableId } = useApp();
  const [subView, setSubView] = useState<ProfileSubView>('main');
  const [waiterRequested, setWaiterRequested] = useState(false);
  const [waiterRequestType, setWaiterRequestType] = useState('');

  const handleHelpRequest = async (type: 'Water' | 'Cutlery' | 'Tissue' | 'Call Waiter' | 'Request Bill') => {
    setWaiterRequestType(type);
    await callWaiter(type);
    setWaiterRequested(true);
    setTimeout(() => {
      setWaiterRequested(false);
    }, 4000);
  };

  const getTierColor = (tier: string) => {
    if (tier === 'Platinum') return 'from-teal-400 to-emerald-500';
    if (tier === 'Gold') return 'from-amber-400 to-yellow-600';
    if (tier === 'Silver') return 'from-gray-300 to-gray-500';
    return 'from-orange-400 to-orange-600'; // Bronze
  };

  if (subView === 'favorites') {
    return (
      <div className="flex-1 pb-24 overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="p-5 flex items-center gap-3 border-b border-gray-50 bg-white sticky top-0 z-30">
          <button onClick={() => setSubView('main')} className="text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-brand-text">Favourite Dishes</h2>
        </div>

        {/* Favorites list */}
        <div className="p-5 space-y-4">
          {favorites.length > 0 ? (
            favorites.map((dish) => (
              <div
                key={dish.id}
                onClick={() => onSelectDish(dish)}
                className="flex bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-all cursor-pointer items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <img 
                    src={dish.image} 
                    alt={dish.name} 
                    className="w-14 h-14 rounded-lg object-cover shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-brand-text text-sm truncate group-hover:text-primary transition-colors">
                      {dish.name}
                    </h4>
                    <p className="text-xs font-bold text-primary mt-1">₹{dish.price}</p>
                  </div>
                </div>
                
                {/* Remove heart */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(dish);
                  }}
                  className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center transition-colors"
                >
                  <Heart size={16} fill="#EF4444" stroke="none" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-50 p-6">
              <Heart className="text-gray-300 mx-auto mb-3" size={32} />
              <p className="text-gray-400 text-xs font-medium">No favorites added yet.</p>
              <button 
                onClick={() => onNavigateToTab('search')}
                className="text-xs text-primary font-bold mt-2 hover:underline"
              >
                Explore Dishes
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (subView === 'help') {
    const helpOptions: { type: 'Water' | 'Cutlery' | 'Tissue' | 'Call Waiter' | 'Request Bill'; label: string; icon: React.ReactNode }[] = [
      { type: 'Water', label: 'Need Water', icon: <Droplet className="text-blue-500" size={20} /> },
      { type: 'Cutlery', label: 'Need Cutlery', icon: <Inbox className="text-orange-500" size={20} /> },
      { type: 'Tissue', label: 'Need Tissue', icon: <FileText className="text-purple-500" size={20} /> },
      { type: 'Call Waiter', label: 'Call Waiter', icon: <ConciergeBell className="text-emerald-500" size={20} /> },
      { type: 'Request Bill', label: 'Request Bill', icon: <ChevronRight className="text-rose-500" size={20} /> },
    ];

    return (
      <div className="flex-1 pb-24 overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="p-5 flex items-center gap-3 border-b border-gray-50 bg-white sticky top-0 z-30">
          <button onClick={() => setSubView('main')} className="text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-brand-text">Help & Support</h2>
        </div>

        {/* Live notification popup */}
        {waiterRequested && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 animate-fade-in shadow-sm">
            <CheckCircle className="text-emerald-500 flex-shrink-0" size={20} />
            <div className="text-xs">
              <p className="font-bold">Request Placed</p>
              <p className="text-[10px] text-emerald-700/90">"{waiterRequestType}" sent for Table {tableId}</p>
            </div>
          </div>
        )}

        {/* Support Menu */}
        <div className="p-5 space-y-4">
          <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 ml-1">Quick Help</h3>
          <div className="space-y-3">
            {helpOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleHelpRequest(opt.type)}
                className="w-full flex items-center justify-between p-4 bg-white border border-gray-100/80 rounded-2xl shadow-sm hover:border-primary/20 transition-all text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shadow-inner">
                    {opt.icon}
                  </div>
                  <span className="font-semibold text-brand-text text-sm">{opt.label}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'coupons') {
    return (
      <div className="flex-1 pb-24 overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="p-5 flex items-center gap-3 border-b border-gray-50 bg-white sticky top-0 z-30">
          <button onClick={() => setSubView('main')} className="text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-brand-text">Available Coupons</h2>
        </div>

        {/* Coupons list */}
        <div className="p-5 space-y-4">
          <div className="bg-white rounded-3xl border-2 border-dashed border-primary/20 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-brand-bg rounded-full"></div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-brand-bg rounded-full"></div>
            
            <span className="bg-primary/10 text-primary font-extrabold text-[10px] tracking-widest uppercase px-3 py-1 rounded-full">
              Flat Discount
            </span>
            <h3 className="text-lg font-black text-brand-text mt-3">₹50 OFF on first order</h3>
            <p className="text-xs text-gray-400 mt-1">Use code <strong className="text-primary uppercase">WELCOME50</strong>. Min order ₹100.</p>
          </div>

          <div className="bg-white rounded-3xl border-2 border-dashed border-primary/20 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-brand-bg rounded-full"></div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-brand-bg rounded-full"></div>
            
            <span className="bg-orange-500/10 text-orange-500 font-extrabold text-[10px] tracking-widest uppercase px-3 py-1 rounded-full">
              Loyalty Special
            </span>
            <h3 className="text-lg font-black text-brand-text mt-3">₹100 Loyalty Cash</h3>
            <p className="text-xs text-gray-400 mt-1">Redeem 100 reward points. Use code <strong className="text-primary uppercase">LOYA100</strong>.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-24 overflow-y-auto no-scrollbar">
      {/* Profile Card Header */}
      <div className="p-5 bg-gradient-to-b from-primary/10 via-primary/[0.02] to-transparent flex flex-col items-center pt-8">
        <div className="relative">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center border-4 border-white shadow-md text-primary font-bold text-2xl uppercase">
            {profile?.name.charAt(0) || <User size={32} />}
          </div>
          <span className={`absolute bottom-0 right-0 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm bg-gradient-to-r ${getTierColor(profile?.tier || 'Bronze')}`}>
            {profile?.tier || 'Bronze'}
          </span>
        </div>

        <h3 className="text-xl font-bold text-brand-text mt-3.5">{profile?.name || 'Valued Guest'}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{profile?.phone || 'No Phone Linked'}</p>

        {/* Loyalty Points display */}
        <div className="w-full bg-white border border-gray-100 rounded-3xl p-4.5 shadow-sm mt-5 flex justify-around text-center">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Reward Points</span>
            <strong className="text-xl text-primary font-black mt-1 block">{profile?.points || 0}</strong>
          </div>
          <div className="w-px bg-gray-100"></div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Loyalty Tier</span>
            <strong className="text-xl text-brand-text font-black mt-1 block">{profile?.tier || 'Bronze'}</strong>
          </div>
        </div>
      </div>

      {/* Menu Actions Grid */}
      <div className="px-5 space-y-3">
        {/* Coupons */}
        <button
          onClick={() => setSubView('coupons')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-100/80 rounded-2xl shadow-sm hover:border-primary/20 transition-all text-left active:scale-[0.98]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Gift size={18} />
            </div>
            <div>
              <span className="font-semibold text-brand-text text-sm block">Coupons</span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">3 discount codes available</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        {/* Order History */}
        <button
          onClick={() => onNavigateToTab('orders')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-100/80 rounded-2xl shadow-sm hover:border-primary/20 transition-all text-left active:scale-[0.98]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <Clock size={18} />
            </div>
            <div>
              <span className="font-semibold text-brand-text text-sm block">Order History</span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">View previous receipts</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        {/* Favourite Dishes */}
        <button
          onClick={() => setSubView('favorites')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-100/80 rounded-2xl shadow-sm hover:border-primary/20 transition-all text-left active:scale-[0.98]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
              <Heart size={18} />
            </div>
            <div>
              <span className="font-semibold text-brand-text text-sm block">Favourite Dishes</span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">Dishes you liked most</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        {/* Help & Support */}
        <button
          onClick={() => setSubView('help')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-100/80 rounded-2xl shadow-sm hover:border-primary/20 transition-all text-left active:scale-[0.98]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
              <HelpCircle size={18} />
            </div>
            <div>
              <span className="font-semibold text-brand-text text-sm block">Help & Support</span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">Paging waiter, cutlery request</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        {/* Logout */}
        <button
          onClick={logoutCustomer}
          className="w-full flex items-center justify-between p-4 bg-red-50/50 border border-red-100/50 rounded-2xl shadow-sm hover:bg-red-50 transition-all text-left active:scale-[0.98] mt-6"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <LogOut size={18} />
            </div>
            <span className="font-semibold text-red-600 text-sm">Logout / Switch Account</span>
          </div>
          <ChevronRight size={16} className="text-red-400" />
        </button>
      </div>
    </div>
  );
};
