import React, { useState } from 'react';
import { ChefHat, Lock, User, Eye, EyeOff } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (role: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    // Simulate authentication
    setTimeout(() => {
      if (username.toLowerCase() === 'admin' && password === 'password') {
        localStorage.setItem('dinesmart_admin_token', 'session_admin1');
        localStorage.setItem('dinesmart_admin_role', 'Admin');
        onLoginSuccess('Admin');
      } else {
        setError('Invalid username or password. (Hint: admin / password)');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/20 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-300/20 blur-[100px] pointer-events-none"></div>

      {/* Main Glassmorphic Login Card */}
      <div className="w-full max-w-[420px] bg-white/95 backdrop-blur-xl border border-white/25 rounded-3xl p-8 shadow-2xl relative z-10">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-orange-500/25 mb-4 animate-bounce-slow">
            <ChefHat size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent font-sans">
            TableTap
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Admin Workspace</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-xl flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-ping"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Input */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700"
              />
              <User size={16} className="absolute left-4 text-slate-400" />
            </div>
          </div>

          {/* Password Input */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-11 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700"
              />
              <Lock size={16} className="absolute left-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 cursor-pointer active:scale-98"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Authenticating Workspace...</span>
              </>
            ) : (
              <span>Access Admin Dashboard</span>
            )}
          </button>
        </form>

        {/* Demo details hint */}
        <p className="text-[10px] text-slate-450 text-center mt-6 leading-relaxed bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
          Demo Access Credentials: <strong className="text-slate-600 font-bold">admin</strong> / <strong className="text-slate-600 font-bold">password</strong>
        </p>

      </div>
    </div>
  );
};
