import React, { useState } from 'react';
import { 
  X, ShieldCheck, CheckCircle2, Smartphone, CreditCard, 
  Building2, Wallet, ArrowRight, Loader2, Sparkles, QrCode
} from 'lucide-react';

interface RazorpayModalProps {
  orderId: string;
  tableId: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  onPaymentSuccess: (paymentId: string) => void;
  onClose: () => void;
}

type PaymentTab = 'upi' | 'card' | 'netbanking' | 'wallet';

export const RazorpayModal: React.FC<RazorpayModalProps> = ({
  orderId,
  tableId,
  amount,
  customerName = 'Valued Guest',
  customerPhone = '9876543210',
  onPaymentSuccess,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<PaymentTab>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'qr'>('gpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPaymentId, setGeneratedPaymentId] = useState('');

  // Form states for Card
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8821');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvv, setCardCvv] = useState('742');

  const handlePay = () => {
    setIsProcessing(true);
    const mockPayId = 'pay_' + Math.random().toString(36).substring(2, 11).toUpperCase();
    setGeneratedPaymentId(mockPayId);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onPaymentSuccess(mockPayId);
      }, 1500);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
      <div className="absolute inset-0" onClick={isProcessing ? undefined : onClose}></div>

      <div className="relative w-full max-w-[420px] bg-white rounded-3xl overflow-hidden shadow-2xl z-10 border border-slate-200 animate-slide-up">
        {/* Razorpay Header */}
        <div className="bg-[#0C2340] text-white p-5 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284C7] flex items-center justify-center font-black text-white text-base shadow-md">
              R
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-wide">Razorpay</span>
                <span className="bg-[#0284C7]/30 text-[#38BDF8] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">TableTap DineSmart • Table {tableId}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Amount to Pay</span>
            <span className="text-lg font-black text-emerald-400">₹{amount.toLocaleString('en-IN')}</span>
          </div>

          {!isProcessing && !isSuccess && (
            <button 
              onClick={onClose}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Success Screen */}
        {isSuccess ? (
          <div className="p-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle2 size={36} className="stroke-[2.5]" />
            </div>
            <h3 className="text-lg font-black text-slate-800">Payment Successful!</h3>
            <p className="text-xs text-slate-500 mt-1">Transaction verified via Razorpay Gateway</p>
            <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Payment ID:</span>
                <span className="font-mono font-bold text-slate-800">{generatedPaymentId}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Order ID:</span>
                <span className="font-bold text-slate-800">#{orderId}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-600">₹{amount}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>100% Secured 256-bit encrypted checkout</span>
            </p>
          </div>
        ) : (
          /* Payment Form */
          <div className="p-5">
            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('upi')}
                className={`py-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'upi' ? 'bg-white text-[#0C2340] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Smartphone size={15} />
                <span className="text-[10px]">UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`py-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'card' ? 'bg-white text-[#0C2340] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CreditCard size={15} />
                <span className="text-[10px]">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('netbanking')}
                className={`py-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'netbanking' ? 'bg-white text-[#0C2340] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Building2 size={15} />
                <span className="text-[10px]">NetBanking</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('wallet')}
                className={`py-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'wallet' ? 'bg-white text-[#0C2340] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Wallet size={15} />
                <span className="text-[10px]">Wallets</span>
              </button>
            </div>

            {/* TAB 1: UPI */}
            {activeTab === 'upi' && (
              <div className="space-y-2.5 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('gpay')}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      selectedUpiApp === 'gpay' ? 'border-[#0284C7] bg-blue-50/40 text-blue-900 font-extrabold' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-xs">Google Pay</span>
                    <span className="text-base">🟢</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('phonepe')}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      selectedUpiApp === 'phonepe' ? 'border-[#0284C7] bg-blue-50/40 text-blue-900 font-extrabold' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-xs">PhonePe</span>
                    <span className="text-base">🟣</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('paytm')}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      selectedUpiApp === 'paytm' ? 'border-[#0284C7] bg-blue-50/40 text-blue-900 font-extrabold' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-xs">Paytm UPI</span>
                    <span className="text-base">🔵</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('qr')}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      selectedUpiApp === 'qr' ? 'border-[#0284C7] bg-blue-50/40 text-blue-900 font-extrabold' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-xs">Dynamic QR</span>
                    <QrCode size={16} className="text-[#0284C7]" />
                  </button>
                </div>

                {selectedUpiApp === 'qr' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Scan with any UPI app</p>
                    <div className="w-24 h-24 bg-white border border-slate-300 rounded-xl mx-auto flex items-center justify-center p-2 shadow-xs">
                      <QrCode size={72} className="text-slate-800" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 block">tabletap.pay@razorpay</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CREDIT / DEBIT CARDS */}
            {activeTab === 'card' && (
              <div className="space-y-3 animate-fade-in text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 font-bold outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expiry</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">CVV</label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: NETBANKING */}
            {activeTab === 'netbanking' && (
              <div className="grid grid-cols-2 gap-2 animate-fade-in text-xs">
                {['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Axis Bank', 'Kotak Bank', 'Other Banks'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-left hover:border-sky-500 transition-all cursor-pointer"
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}

            {/* TAB 4: WALLETS */}
            {activeTab === 'wallet' && (
              <div className="space-y-2 animate-fade-in text-xs">
                {['Amazon Pay Balance', 'Mobikwik Wallet', 'Freecharge'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 flex justify-between items-center hover:border-sky-500 transition-all cursor-pointer"
                  >
                    <span>{w}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}

            {/* Submit Pay Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full py-3.5 rounded-2xl bg-[#0284C7] hover:bg-sky-600 active:scale-98 text-white font-black text-sm shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Secure Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₹{amount.toLocaleString('en-IN')} with Razorpay</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-slate-400 font-bold">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>Secured by Razorpay • PCI-DSS Level 1 Certified</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
