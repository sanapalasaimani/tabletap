import React, { useState, useEffect } from 'react';
import { ChefHat, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (role: string) => void;
  sessionExpiredNotice?: string;
}

const SLIDE_IMAGES: string[] = [
  'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=1400&q=85',
];

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, sessionExpiredNotice }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active slide index for left-side image slider
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isAutoCyclePaused, setIsAutoCyclePaused] = useState(false);

  // Auto-slide through images every 4 seconds
  useEffect(() => {
    if (isAutoCyclePaused) return;
    const interval = setInterval(() => {
      setActiveSlideIndex(prev => (prev + 1) % SLIDE_IMAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoCyclePaused]);

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
      {/* 1. LEFT SIDE: PURE FULL-BLEED SLIDING FOOD IMAGES         */}
      {/* ========================================================= */}
      <div 
        className="w-full md:w-1/2 lg:w-7/12 h-64 sm:h-80 md:h-full relative overflow-hidden flex-shrink-0 bg-slate-900"
        onMouseEnter={() => setIsAutoCyclePaused(true)}
        onMouseLeave={() => setIsAutoCyclePaused(false)}
      >
        <div
          className="flex w-full h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
        >
          {SLIDE_IMAGES.map((src, idx) => (
            <div key={idx} className="w-full h-full flex-shrink-0">
              <img
                src={src}
                alt={`Restaurant dish ${idx + 1}`}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}
        </div>

        {/* Minimal Slide Dots */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {SLIDE_IMAGES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSlideIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeSlideIndex === idx
                  ? 'w-7 bg-white shadow-sm'
                  : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
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
