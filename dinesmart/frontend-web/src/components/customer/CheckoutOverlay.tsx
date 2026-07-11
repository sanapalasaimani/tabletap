import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../supabase';
import { X, Check, CreditCard, Wallet, Smartphone, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface CheckoutOverlayProps {
  onClose: () => void;
  onPaymentSuccess: () => void;
}

type CheckoutStep = 'summary' | 'payment' | 'success';

export const CheckoutOverlay: React.FC<CheckoutOverlayProps> = ({ onClose, onPaymentSuccess }) => {
  const { activeOrder, setActiveOrder, refreshOrderHistory, profile } = useApp();
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [selectedUpiProvider, setSelectedUpiProvider] = useState('Google Pay');
  const [isPaying, setIsPaying] = useState(false);

  if (!activeOrder) return null;

  const handlePay = async () => {
    setIsPaying(true);
    // Simulate API checkout call
    const methodLabel = paymentMethod === 'UPI' ? `UPI (${selectedUpiProvider})` : paymentMethod;
    const updated = await db.payOrder(activeOrder.id, methodLabel);
    setIsPaying(false);
    if (updated) {
      setActiveOrder(updated);
      await refreshOrderHistory();
      setStep('success');
    }
  };

  const pointsEarned = Math.floor(activeOrder.total * 0.1);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in">
      <div className="absolute inset-0" onClick={step === 'success' ? undefined : onClose}></div>

      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl overflow-hidden shadow-2xl z-10 animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-20">
          <h3 className="font-bold text-brand-text text-base">
            {step === 'summary' && 'Bill Summary'}
            {step === 'payment' && 'Payment Method'}
            {step === 'success' && 'Payment Successful'}
          </h3>
          {step !== 'success' && (
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Content Container */}
        <div className="overflow-y-auto no-scrollbar p-5 pb-28">
          
          {/* STEP 1: BILL SUMMARY */}
          {step === 'summary' && (
            <div className="space-y-5">
              {/* Table details */}
              <div className="bg-brand-bg rounded-2xl p-4 border border-gray-100 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Active Checkout</span>
                  <p className="font-bold text-brand-text text-sm mt-0.5">Order #{activeOrder.id}</p>
                </div>
                <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
                  Table {activeOrder.tableId}
                </span>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider">Itemized Receipt</h4>
                <div className="space-y-2.5">
                  {activeOrder.items.map(item => (
                    <div key={item.menuItemId} className="flex justify-between items-start text-xs">
                      <div className="min-w-0 flex-1 pr-4">
                        <span className="font-semibold text-brand-text">{item.name}</span>
                        <span className="text-gray-400 font-medium ml-1">x {item.quantity}</span>
                      </div>
                      <span className="font-bold text-brand-text flex-shrink-0">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown Summary */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-brand-text">₹{activeOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>GST (5%)</span>
                  <span className="font-semibold text-brand-text">₹{activeOrder.gst}</span>
                </div>
                {activeOrder.tip > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Waiter Tip</span>
                    <span className="font-semibold text-brand-text">₹{activeOrder.tip}</span>
                  </div>
                )}
                {activeOrder.discount > 0 && (
                  <div className="flex justify-between text-xs text-green-600 font-semibold bg-green-50/50 p-2.5 rounded-xl border border-green-100/50">
                    <span>Discount Coupon Applied</span>
                    <span>-₹{activeOrder.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-brand-text border-t border-gray-100 pt-3">
                  <span>Total Amount Payable</span>
                  <span className="text-primary text-base">₹{activeOrder.total}</span>
                </div>
              </div>

              {/* Loyalty banner suggestion */}
              <div className="bg-primary/5 rounded-2xl p-3.5 border border-primary/10 flex items-center gap-3">
                <span className="text-xl">✨</span>
                <p className="text-[10px] text-primary font-medium leading-relaxed">
                  Paying this bill will earn you <strong className="font-bold">{pointsEarned} DineSmart points</strong> which can be used to redeem food discounts on your next visit!
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTOR */}
          {step === 'payment' && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <p className="text-xs text-gray-400 font-semibold">Total Amount Payable</p>
                <strong className="text-3xl font-black text-primary mt-1 block">₹{activeOrder.total}</strong>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                {/* UPI Option */}
                <label 
                  onClick={() => setPaymentMethod('UPI')}
                  className={`flex flex-col p-4 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'UPI' ? 'border-primary bg-primary/[0.02]' : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Smartphone className={paymentMethod === 'UPI' ? 'text-primary' : 'text-gray-500'} size={20} />
                      <span className="font-semibold text-brand-text text-sm">UPI apps (Instant Check)</span>
                    </div>
                    <input 
                      type="radio" 
                      name="payment_main" 
                      checked={paymentMethod === 'UPI'} 
                      onChange={() => {}}
                      className="accent-primary w-4 h-4" 
                    />
                  </div>
                  
                  {/* UPI Apps Grid */}
                  {paymentMethod === 'UPI' && (
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-gray-100 animate-fade-in">
                      {['Google Pay', 'PhonePe', 'Paytm'].map((upi) => (
                        <button
                          key={upi}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUpiProvider(upi);
                          }}
                          className={`py-2 px-1 text-center font-bold text-[10px] rounded-xl border transition-all ${
                            selectedUpiProvider === upi 
                              ? 'border-primary text-primary bg-primary/5' 
                              : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {upi}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                {/* Credit / Debit Card Option */}
                <label 
                  onClick={() => setPaymentMethod('Card')}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'Card' ? 'border-primary bg-primary/[0.02]' : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className={paymentMethod === 'Card' ? 'text-primary' : 'text-gray-500'} size={20} />
                    <span className="font-semibold text-brand-text text-sm">Credit / Debit Cards</span>
                  </div>
                  <input 
                    type="radio" 
                    name="payment_main" 
                    checked={paymentMethod === 'Card'} 
                    onChange={() => {}}
                    className="accent-primary w-4 h-4" 
                  />
                </label>

                {/* Pay with Wallets */}
                <label 
                  onClick={() => setPaymentMethod('Wallet')}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'Wallet' ? 'border-primary bg-primary/[0.02]' : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className={paymentMethod === 'Wallet' ? 'text-primary' : 'text-gray-500'} size={20} />
                    <span className="font-semibold text-brand-text text-sm">Digital Wallets (Amazon, Mobikwik)</span>
                  </div>
                  <input 
                    type="radio" 
                    name="payment_main" 
                    checked={paymentMethod === 'Wallet'} 
                    onChange={() => {}}
                    className="accent-primary w-4 h-4" 
                  />
                </label>

                {/* Cash */}
                <label 
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'Cash' ? 'border-primary bg-primary/[0.02]' : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className={paymentMethod === 'Cash' ? 'text-primary' : 'text-gray-500'} size={20} />
                    <span className="font-semibold text-brand-text text-sm">Pay with Cash (Ask Waiter)</span>
                  </div>
                  <input 
                    type="radio" 
                    name="payment_main" 
                    checked={paymentMethod === 'Cash'} 
                    onChange={() => {}}
                    className="accent-primary w-4 h-4" 
                  />
                </label>
              </div>

              <div className="flex justify-center items-center gap-1.5 text-[10px] text-gray-400 font-semibold py-1">
                <ShieldCheck size={14} className="text-gray-400" />
                <span>100% Safe & Secure Payments</span>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT SUCCESS */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-5">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                <CheckCircle2 size={48} fill="rgba(16, 185, 129, 0.1)" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-2xl font-black text-brand-text">Payment Successful</h2>
                <p className="text-gray-500 text-xs leading-relaxed max-w-[260px] mx-auto">
                  Your payment of <strong className="text-emerald-600 font-bold text-sm">₹{activeOrder.total}</strong> has been received successfully.
                </p>
              </div>

              {/* Receipt info */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left space-y-2 text-xs max-w-[340px] mx-auto">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Order ID</span>
                  <span className="font-bold text-brand-text">#{activeOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Method</span>
                  <span className="font-bold text-brand-text">{activeOrder.paymentMethod || 'UPI (Google Pay)'}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200/50 pt-2 text-emerald-700 font-semibold">
                  <span>Loyalty Points Gained</span>
                  <span>+{pointsEarned} Points</span>
                </div>
              </div>

              {/* Success Rewards announcement */}
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 max-w-[340px] mx-auto text-center flex flex-col items-center">
                <span className="text-2xl mb-1">🎁</span>
                <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Loyalty System</span>
                <h4 className="font-bold text-brand-text text-sm mt-1">You earned {pointsEarned} Points!</h4>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed max-w-[240px]">
                  Points added to profile. Current total: <strong className="font-semibold text-brand-text">{profile ? profile.points + pointsEarned : pointsEarned} points</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
          {step === 'summary' && (
            <button
              onClick={() => setStep('payment')}
              className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-full hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Proceed to Pay</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {step === 'payment' && (
            <button
              onClick={handlePay}
              disabled={isPaying}
              className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-full hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-1.5 disabled:bg-gray-300"
            >
              <span>{isPaying ? 'Processing Payment...' : `Pay Securely ₹${activeOrder.total}`}</span>
            </button>
          )}

          {step === 'success' && (
            <button
              onClick={onPaymentSuccess}
              className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-full hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all text-center"
            >
              Back to Home
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
