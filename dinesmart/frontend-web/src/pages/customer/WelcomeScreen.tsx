import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ConciergeBell, Phone, User, ChevronRight } from 'lucide-react';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const { tableId: urlTableId } = useParams<{ tableId: string }>();
  const { tableId, setTableId, loginCustomer, phone: existingPhone } = useApp();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urlTableId) {
      setTableId(urlTableId);
    }
  }, [urlTableId]);

  // If already logged in, skip welcome
  useEffect(() => {
    if (existingPhone) {
      onContinue();
    }
  }, [existingPhone]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      await loginCustomer(phoneNumber, name);
      onContinue();
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-brand-bg px-6 py-10 min-h-screen">
      {/* Brand Header */}
      <div className="text-center pt-8">
        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
          <ConciergeBell size={40} className="text-white animate-bounce" />
        </div>
        <h1 className="text-3xl font-extrabold text-brand-text tracking-tight">
          Table<span className="text-primary">Tap</span>
          <span className="text-primary font-bold text-xs align-super bg-primary/10 px-2 py-0.5 rounded-full ml-1">AI</span>
        </h1>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">TAP. ORDER. ENJOY.</p>
      </div>

      {/* Main Form Box */}
      <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100/50 border border-gray-50 my-auto">
        <h2 className="text-xl font-bold text-brand-text mb-1">Welcome 👋</h2>
        <p className="text-gray-500 text-xs mb-6">Let's order something delicious!</p>

        <form onSubmit={handleStart} className="space-y-4">
          {/* Table display */}
          <div className="bg-brand-bg rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 block">Your Table</span>
              <strong className="text-lg text-brand-text">Table {tableId}</strong>
            </div>
            <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
              QR Verified
            </span>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Name</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">
                <User size={16} />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 text-brand-text font-medium"
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Mobile Number</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-brand-text text-sm font-semibold border-r border-gray-200 pr-2">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter Mobile Number"
                className="w-full pl-16 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 text-brand-text font-semibold tracking-wider"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs font-medium bg-red-50 p-2.5 rounded-xl border border-red-100">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 group mt-2"
          >
            <span>{loading ? 'Entering...' : 'Continue'}</span>
            {!loading && <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      </div>

      {/* Footer disclaimer */}
      <div className="text-center">
        <p className="text-[10px] text-gray-400">
          🔒 We do not share your number with anyone. It is only used to track orders and rewards.
        </p>
      </div>
    </div>
  );
};
