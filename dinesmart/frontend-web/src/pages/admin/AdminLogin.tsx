import React, { useState, useEffect } from 'react';
import { ChefHat, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, Star, Utensils, CheckCircle2 } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (role: string) => void;
  sessionExpiredNotice?: string;
}

interface SouthIndianDish {
  id: string;
  name: string;
  category: string;
  rating: number;
  image: string;
  tag: string;
  description: string;
  highlights: string[];
}

const SOUTH_INDIAN_DISHES: SouthIndianDish[] = [
  {
    id: 'dosa',
    name: 'Crispy Ghee Roast Masala Dosa',
    category: 'South Indian Breakfast / All Day',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80',
    tag: '⭐ Signature Delicacy',
    description: 'Golden, paper-thin fermented rice crepe roasted with pure desi ghee, stuffed with spiced potato podimas, served with coconut chutney & piping hot sambar.',
    highlights: ['Pure Desi Ghee', 'Traditional Chutneys', 'Crisp Roast']
  },
  {
    id: 'idli',
    name: 'Steamed Idli Sambar Platter',
    category: 'Breakfast Specialty',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80',
    tag: '🌿 Pillow-Soft & Fresh',
    description: 'Pillow-soft fermented rice cakes freshly steamed, accompanied by hot lentil vegetable sambar, red chili-tomato paste, and freshly grated coconut dip.',
    highlights: ['100% Steamed', 'Low Calorie', 'Podi Ghee Toss']
  },
  {
    id: 'biryani',
    name: 'Hyderabadi Dum Biryani',
    category: 'Chef Special Main Course',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80',
    tag: '👑 Royal Nizam Legacy',
    description: 'Long-grain basmati layered with tender spiced meat or vegetables, slow-cooked in a sealed clay handi on slow fire (dum) with saffron and caramelized onions.',
    highlights: ['Slow Dum Cooked', 'Saffron Fragrance', 'Mirchi Ka Salan']
  },
  {
    id: 'thali',
    name: 'South Indian Banana Leaf Feast',
    category: 'Traditional Thali',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=1000&q=80',
    tag: '🍃 Authentic Grand Thali',
    description: 'A lavish multi-course meal served on green banana leaf featuring steamed ponni rice, drumstick sambar, pepper rasam, avial, poriyal, appalam, and creamy payasam.',
    highlights: ['Banana Leaf Serve', '12+ Authentic Items', 'Traditional Flavors']
  }
];

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, sessionExpiredNotice }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active South Indian dish for showcase
  const [activeDishIndex, setActiveDishIndex] = useState(0);
  const [isAutoCyclePaused, setIsAutoCyclePaused] = useState(false);

  // Auto-cycle through South Indian dishes every 5 seconds
  useEffect(() => {
    if (isAutoCyclePaused) return;
    const interval = setInterval(() => {
      setActiveDishIndex(prev => (prev + 1) % SOUTH_INDIAN_DISHES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoCyclePaused]);

  const activeDish = SOUTH_INDIAN_DISHES[activeDishIndex];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter your admin username and password.');
      return;
    }

    setLoading(true);

    // Authenticate credentials
    setTimeout(() => {
      if (username.trim().toLowerCase() === 'admin' && password === 'password') {
        localStorage.setItem('dinesmart_admin_token', 'session_admin1');
        localStorage.setItem('dinesmart_admin_role', 'Admin');
        localStorage.setItem('dinesmart_admin_last_active', String(Date.now()));
        onLoginSuccess('Admin');
      } else {
        setError('Invalid credentials. Please enter username "admin" and password "password".');
      }
      setLoading(false);
    }, 600);
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('password');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden select-none">
      
      {/* Background Subtle Ambient Blurs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-400/15 blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/15 blur-[120px] pointer-events-none"></div>

      {/* Modern Two-Column Card Container */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] border border-slate-200/80 overflow-hidden flex flex-col md:flex-row relative z-10">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: MODERN LOGIN FORM */}
        {/* ========================================================= */}
        <div className="w-full md:w-5/12 lg:w-5/12 p-8 sm:p-10 lg:p-12 flex flex-col justify-between bg-white">
          <div>
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25 flex-shrink-0">
                <ChefHat size={22} className="rotate-3" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight text-slate-900 leading-none">TableTap</h3>
                <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider block mt-0.5">Admin Workspace</span>
              </div>
            </div>

            {/* Main Form Heading matching modern layout */}
            <div className="mt-8 mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Login</h1>
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                Sign in to manage kitchen orders, daily menus, staff operations, and business analytics.
              </p>
            </div>

            {/* Session Expired Notice if any */}
            {sessionExpiredNotice && (
              <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
                <span>⏱️</span>
                <span>{sessionExpiredNotice}</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-ping"></span>
                <span>{error}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    className="w-full bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-2xl py-3 pl-4 pr-11 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-orange-500/15 transition-all"
                  />
                  <div className="absolute right-4 text-slate-400 pointer-events-none">
                    <User size={18} />
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-2xl py-3 pl-4 pr-11 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-orange-500/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Login Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-[#FF6B00] via-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.99] text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Signing in to Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Demo Credentials Footer Helper */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="text-[11px] text-slate-500">
              Demo: <strong className="text-slate-800">admin</strong> / <strong className="text-slate-800">password</strong>
            </div>
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Fill Demo
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: "WELCOME ADMIN" + SOUTH INDIAN FOOD SHOWCASE */}
        {/* ========================================================= */}
        <div 
          className="w-full md:w-7/12 lg:w-7/12 bg-gradient-to-br from-slate-900 via-[#141824] to-[#1f1610] p-8 sm:p-10 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden border-t md:border-t-0 md:border-l border-slate-800"
          onMouseEnter={() => setIsAutoCyclePaused(true)}
          onMouseLeave={() => setIsAutoCyclePaused(false)}
        >
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Header with "Welcome Admin" */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-orange-500/20 border border-orange-500/30 text-orange-400">
              <Sparkles size={11} />
              <span>South Indian Cuisine Hub</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-3">
              Welcome Admin
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1.5 leading-relaxed max-w-lg">
              Manage your restaurant's South Indian delicacies, oversee real-time kitchen preparation, monitor table orders, and drive revenue growth.
            </p>
          </div>

          {/* Featured South Indian Dish Visual Showcase Card */}
          <div className="my-6 relative z-10">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 group bg-slate-800/80">
              {/* Dish Photo */}
              <div className="h-48 sm:h-56 w-full overflow-hidden relative">
                <img
                  src={activeDish.image}
                  alt={activeDish.name}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

                {/* Floating Rating & Tag Pill */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-extrabold text-amber-300 border border-white/10 flex items-center gap-1">
                    <Star size={11} className="fill-amber-300 text-amber-300" />
                    <span>{activeDish.rating}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-orange-500/90 backdrop-blur-md text-[10px] font-extrabold text-white shadow-sm">
                    {activeDish.tag}
                  </span>
                </div>

                {/* Dish Details Overlay on Image */}
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <h4 className="text-base sm:text-lg font-black text-white drop-shadow-md">
                    {activeDish.name}
                  </h4>
                  <p className="text-[11px] text-slate-200 font-medium line-clamp-1 drop-shadow mt-0.5">
                    {activeDish.description}
                  </p>
                </div>
              </div>

              {/* Highlights Pill Row */}
              <div className="px-4 py-2.5 bg-slate-900/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                <div className="flex items-center gap-2">
                  {activeDish.highlights.map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-slate-300">
                      <CheckCircle2 size={10} className="text-emerald-400" />
                      <span>{h}</span>
                    </span>
                  ))}
                </div>
                <span className="text-[9px] uppercase tracking-wider text-orange-400 font-bold">
                  {activeDish.category}
                </span>
              </div>
            </div>

            {/* Dish Switcher Buttons (specifically South Indian style) */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {SOUTH_INDIAN_DISHES.map((dish, idx) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => setActiveDishIndex(idx)}
                  className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
                    activeDishIndex === idx
                      ? 'bg-orange-500/20 border-orange-500/60 ring-2 ring-orange-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className={`text-[10px] font-extrabold truncate ${activeDishIndex === idx ? 'text-white' : 'text-slate-300'}`}>
                    {dish.id === 'dosa' ? 'Masala Dosa' : dish.id === 'idli' ? 'Idli Sambar' : dish.id === 'biryani' ? 'Dum Biryani' : 'Banana Thali'}
                  </p>
                  <p className="text-[9px] text-orange-400/90 font-medium truncate mt-0.5">
                    ⭐ {dish.rating}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Live Operations Pill */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-medium relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Kitchen Display & Table Sessions Active</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300 font-bold">
              <Utensils size={12} className="text-orange-400" />
              <span>South Indian Specials</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;
