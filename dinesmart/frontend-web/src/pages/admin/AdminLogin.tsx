import React, { useState, useEffect } from 'react';
import { ChefHat, User, Eye, EyeOff, ArrowRight, Star, CheckCircle2 } from 'lucide-react';

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
  description: string;
  highlights: string[];
}

const SOUTH_INDIAN_DISHES: SouthIndianDish[] = [
  {
    id: 'dosa',
    name: 'Crispy Ghee Roast Masala Dosa',
    category: 'Breakfast & All-Day Classic',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1400&q=85',
    description: 'Golden, paper-thin fermented rice crepe roasted with pure desi ghee, served with coconut chutney & piping hot vegetable sambar.',
    highlights: ['Pure Desi Ghee', 'Fresh Chutneys', 'Golden Roast']
  },
  {
    id: 'idli',
    name: 'Steamed Idli Sambar Platter',
    category: 'Breakfast Specialty',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1400&q=85',
    description: 'Pillow-soft fermented rice cakes freshly steamed, accompanied by hot lentil vegetable sambar and freshly ground chutneys.',
    highlights: ['100% Steamed', 'Low Calorie', 'Podi Ghee Toss']
  },
  {
    id: 'biryani',
    name: 'Hyderabadi Dum Biryani',
    category: 'Chef Special Main Course',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1400&q=85',
    description: 'Long-grain basmati layered with rich spices, slow-cooked in a sealed handi with saffron and caramelized onions.',
    highlights: ['Slow Dum Cooked', 'Saffron Fragrance', 'Mirchi Ka Salan']
  },
  {
    id: 'thali',
    name: 'South Indian Banana Leaf Feast',
    category: 'Traditional Grand Thali',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=1400&q=85',
    description: 'A lavish multi-course meal on green banana leaf with steamed rice, drumstick sambar, rasam, avial, poriyal & payasam.',
    highlights: ['Banana Leaf Serve', '12+ Authentic Items', 'Traditional Flavors']
  }
];

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, sessionExpiredNotice }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active South Indian dish for showcase
  const [activeDishIndex, setActiveDishIndex] = useState(0);
  const [isAutoCyclePaused, setIsAutoCyclePaused] = useState(false);

  // Auto-cycle through dishes every 5 seconds
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
      setError('Please fill in both username and password.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const isUsernameMatch = username.trim().toLowerCase() === 'admin@got11'.toLowerCase();
      const isPasswordMatch = password === 'TableTap@GOT11';

      if (isUsernameMatch && isPasswordMatch) {
        localStorage.setItem('dinesmart_admin_token', 'session_admin1');
        localStorage.setItem('dinesmart_admin_role', 'Admin');
        localStorage.setItem('dinesmart_admin_last_active', String(Date.now()));
        onLoginSuccess('Admin');
      } else {
        setError('Invalid username or password. Please try again.');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="w-screen h-screen min-h-screen overflow-hidden flex flex-col md:flex-row bg-white font-sans select-none">
      
      {/* ========================================================= */}
      {/* 1. LEFT SIDE: FULL-WINDOW SOUTH INDIAN DISHES PHOTO */}
      {/* ========================================================= */}
      <div 
        className="w-full md:w-1/2 lg:w-7/12 h-64 sm:h-80 md:h-full relative overflow-hidden flex-shrink-0 bg-slate-900"
        onMouseEnter={() => setIsAutoCyclePaused(true)}
        onMouseLeave={() => setIsAutoCyclePaused(false)}
      >
        {/* Full-bleed South Indian Dish Image */}
        <img
          src={activeDish.image}
          alt={activeDish.name}
          className="w-full h-full object-cover object-center transition-all duration-700 ease-out scale-100 hover:scale-105"
        />

        {/* Ambient Dark Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60 pointer-events-none"></div>

        {/* Bottom Dish Details & Selector */}
        <div className="absolute bottom-6 left-6 right-6 z-10 space-y-3">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-xs">
                <Star size={10} className="fill-slate-950 text-slate-950" />
                <span>{activeDish.rating} Rating</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-orange-300 font-extrabold">
                {activeDish.category}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-snug drop-shadow-lg">
              {activeDish.name}
            </h3>

            <p className="text-xs sm:text-sm text-slate-200 font-medium line-clamp-2 mt-1 leading-relaxed drop-shadow">
              {activeDish.description}
            </p>

            <div className="hidden md:flex items-center gap-2 mt-2.5">
              {activeDish.highlights.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-200 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  <span>{h}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Dish Switcher Pills */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/15">
            {SOUTH_INDIAN_DISHES.map((dish, idx) => (
              <button
                key={dish.id}
                type="button"
                onClick={() => setActiveDishIndex(idx)}
                className={`py-1.5 px-2 rounded-xl text-left transition-all border cursor-pointer ${
                  activeDishIndex === idx
                    ? 'bg-orange-500/30 border-orange-400 text-white shadow-md shadow-orange-500/20'
                    : 'bg-black/40 backdrop-blur-xs border-white/10 text-slate-300 hover:bg-black/60 hover:text-white'
                }`}
              >
                <p className="text-[10px] font-extrabold truncate">
                  {dish.id === 'dosa' ? 'Masala Dosa' : dish.id === 'idli' ? 'Idli Sambar' : dish.id === 'biryani' ? 'Dum Biryani' : 'Banana Thali'}
                </p>
                <p className="text-[9px] text-amber-300 font-bold truncate">
                  ★ {dish.rating}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. RIGHT SIDE: FULL-WINDOW CLEAN LOGIN FORM */}
      {/* ========================================================= */}
      <div className="w-full md:w-1/2 lg:w-5/12 h-full flex flex-col justify-between items-center bg-white p-6 sm:p-10 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-sm my-auto">
          
          {/* Header matching reference image: Clean "Login" + "Welcome Admin" */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 flex items-center justify-center text-white mx-auto shadow-md shadow-orange-500/20 mb-3">
              <ChefHat size={26} className="rotate-3" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Login</h1>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mt-1">Welcome Admin</p>
          </div>

          {/* Session Expired Notice if any */}
          {sessionExpiredNotice && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl flex items-center gap-2">
              <span>⏱️</span>
              <span>{sessionExpiredNotice}</span>
            </div>
          )}

          {/* Error Message Alert */}
          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-ping"></span>
              <span>{error}</span>
            </div>
          )}

          {/* Form matching reference image layout */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input 1: Username with user icon on the right */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                className="w-full bg-[#f1f5f9] hover:bg-slate-100 focus:bg-white border border-transparent focus:border-[#FF6B00] rounded-2xl py-3.5 pl-5 pr-12 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/15 transition-all shadow-2xs"
              />
              <div className="absolute right-4 text-slate-400 pointer-events-none">
                <User size={18} />
              </div>
            </div>

            {/* Input 2: Password with eye icon on the right */}
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full bg-[#f1f5f9] hover:bg-slate-100 focus:bg-white border border-transparent focus:border-[#FF6B00] rounded-2xl py-3.5 pl-5 pr-12 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/15 transition-all shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-4 text-slate-400 hover:text-slate-700 focus:outline-none cursor-pointer transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Large Pill Login Button matching reference image */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-[#FF6B00] to-orange-500 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white font-black py-4 px-6 rounded-full text-sm transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Signing In...</span>
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

        {/* Minimal Footer */}
        <p className="text-[10px] text-slate-400 font-semibold text-center mt-6">
          TableTap Admin Workspace • Protected Session
        </p>
      </div>

    </div>
  );
};

export default AdminLogin;
