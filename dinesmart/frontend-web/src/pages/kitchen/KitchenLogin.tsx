import React, { useState, useEffect } from 'react';
import { ConciergeBell, Mail, ShieldAlert, Key } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Setup local Supabase client for authentication
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface KitchenLoginProps {
  onLoginSuccess: () => void;
}

export const KitchenLogin: React.FC<KitchenLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  
  // States
  const [step, setStep] = useState<1 | 2>(1); // 1 = Credential check, 2 = Email Verification
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Poll for verification status
  useEffect(() => {
    if (step !== 2 || !email || !supabase) return;

    const interval = setInterval(async () => {
      try {
        // Attempt sign in to check if email is verified
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: 'table_tap@796'
        });

        if (!signInError && data?.user) {
          if (data.user.email_confirmed_at) {
            setIsEmailVerified(true);
            localStorage.setItem('tabletap_kitchen_token', 'session_chef1');
            clearInterval(interval);
            onLoginSuccess();
          }
        }
      } catch (err) {
        console.error('Error polling verification:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [step, email]);

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (username.trim() === 'table_tap' && password.trim() === 'table_tap@796') {
      setStep(2);
    } else {
      setError('Invalid username or password');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!supabase) {
      setError('Supabase is not configured. Cannot verify email.');
      return;
    }

    setLoading(true);

    try {
      // 1. Try to sign in first to see if user already exists
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: 'table_tap@796'
      });

      if (!signInError && signInData?.user) {
        if (signInData.user.email_confirmed_at) {
          // Already verified, log in instantly
          setIsEmailVerified(true);
          localStorage.setItem('tabletap_kitchen_token', 'session_chef1');
          onLoginSuccess();
          return;
        } else {
          // Not verified yet, resend confirmation link
          setVerificationSent(true);
          setError('Verification email is already sent. Please verify it in your inbox.');
          setLoading(false);
          return;
        }
      }

      // 2. If login fails because user does not exist, sign them up
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: 'table_tap@796'
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setVerificationSent(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (!email || !supabase) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: 'table_tap@796'
      });

      if (signInError) {
        setError(signInError.message === 'Email not confirmed' 
          ? 'Email is still unverified. Please check your inbox and click the verification link.' 
          : signInError.message
        );
      } else if (data?.user?.email_confirmed_at) {
        setIsEmailVerified(true);
        localStorage.setItem('tabletap_kitchen_token', 'session_chef1');
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check verification status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-brand-bg px-6 py-10 min-h-screen font-sans">
      {/* Brand Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary/10">
          <ConciergeBell size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-brand-text">
          Table<span className="text-primary">Tap</span> Kitchen
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Kitchen Management Console</p>
      </div>

      {step === 1 ? (
        /* Step 1: Credential login */
        <form 
          onSubmit={handleCredentialSubmit}
          className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-lg border border-gray-100 space-y-4"
        >
          <h2 className="text-base font-extrabold text-brand-text border-b border-gray-50 pb-3 mb-2 flex items-center gap-1.5">
            <Key size={16} className="text-primary" />
            <span>Kitchen Login</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 text-brand-text font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 text-brand-text font-medium"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all text-sm cursor-pointer"
          >
            Verify Credentials
          </button>
        </form>
      ) : (
        /* Step 2: Email Verification Gate */
        <form 
          onSubmit={handleEmailSubmit}
          className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-lg border border-gray-100 space-y-4"
        >
          <h2 className="text-base font-extrabold text-brand-text border-b border-gray-50 pb-3 mb-2 flex items-center gap-1.5">
            <Mail size={16} className="text-primary" />
            <span>Email Security Verification</span>
          </h2>

          <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
            To secure the kitchen dashboard, please register or login with your email. A verification link will be sent from Supabase.
          </p>

          {!verificationSent ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Your Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 text-brand-text font-medium"
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100">
                  ⚠️ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all text-sm disabled:bg-gray-300 cursor-pointer"
              >
                {loading ? 'Sending verification...' : 'Send Verification Link'}
              </button>
            </>
          ) : (
            <div className="space-y-4 text-center">
              <div className="p-3 bg-green-50 border border-green-100 text-green-700 text-xs rounded-2xl font-bold flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                <span>Verification Link Sent to {email}</span>
              </div>
              <p className="text-[10px] text-gray-400">
                Please check your email and click the confirmation link. The dashboard will open automatically once verified.
              </p>

              {error && (
                <p className="text-red-500 text-xs font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100 text-left">
                  ⚠️ {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={loading}
                  className="flex-1 bg-brand-text hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  I've Verified My Email
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-gray-200 text-gray-500 font-bold py-2.5 px-4 rounded-xl text-xs bg-white cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
