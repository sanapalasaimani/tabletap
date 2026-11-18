import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../supabase';
import { Order } from '../../types';
import { 
  X, ShieldCheck, CheckCircle2, 
  Banknote, Clock
} from 'lucide-react';

interface CheckoutOverlayProps {
  onClose: () => void;
  onPaymentSuccess: () => void;
  specificOrder?: Order | null;
}

type CheckoutStep = 'summary' | 'awaiting_cash' | 'success';

export const CheckoutOverlay: React.FC<CheckoutOverlayProps> = ({ onClose, onPaymentSuccess, specificOrder }) => {
  const { activeOrder, setActiveOrder, orderHistory, refreshOrderHistory, profile, tableId, activeBillRequest, refreshBillStatus } = useApp();
  const [step, setStep] = useState<CheckoutStep>(() => (activeBillRequest ? 'awaiting_cash' : 'summary'));
  const [isProcessing, setIsProcessing] = useState(false);

  // Compute unpaid table orders to prevent mismatch (only unpaid orders can ever be billed)
  const unpaidOrders = useMemo(() => {
    if (specificOrder) {
      return specificOrder.paymentStatus !== 'Paid' && specificOrder.status !== 'Cancelled' ? [specificOrder] : [];
    }
    const list = (orderHistory || []).filter(
      o => {
        const isSameTable = String(o.tableId) === String(tableId);
        const orderAgeHours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60);
        return isSameTable && o.paymentStatus !== 'Paid' && o.status !== 'Cancelled' && (isNaN(orderAgeHours) || orderAgeHours < 12);
      }
    );
    if (activeOrder && String(activeOrder.tableId) === String(tableId) && activeOrder.paymentStatus !== 'Paid' && activeOrder.status !== 'Cancelled' && !list.some(o => o.id === activeOrder.id)) {
      list.unshift(activeOrder);
    }
    return list;
  }, [orderHistory, activeOrder, tableId, specificOrder]);

  const targetOrders = unpaidOrders;
  const totalAmount = targetOrders.reduce((sum, o) => sum + o.total, 0);
  const totalSubtotal = targetOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalGst = targetOrders.reduce((sum, o) => sum + o.gst, 0);
  const totalTip = targetOrders.reduce((sum, o) => sum + o.tip, 0);
  const totalDiscount = targetOrders.reduce((sum, o) => sum + o.discount, 0);
  const allItems = targetOrders.flatMap(o => o.items);
  const pointsEarned = Math.floor(totalAmount * 0.1);

  // Preserve receipt total when transitioning to success after unpaidOrders drops to 0
  const [paidAmountSnapshot, setPaidAmountSnapshot] = useState<number>(totalAmount);
  useEffect(() => {
    if (totalAmount > 0 && step !== 'success') {
      setPaidAmountSnapshot(totalAmount);
    }
  }, [totalAmount, step]);

  // If a bill request is already active, ensure overlay shows awaiting_cash instead of allowing duplicate request
  useEffect(() => {
    if (activeBillRequest && step === 'summary') {
      setStep('awaiting_cash');
    }
  }, [activeBillRequest, step]);

  // Polling for waiter acceptance & cash payment collection confirmation
  useEffect(() => {
    if (step !== 'awaiting_cash') return;

    const checkPaymentSettled = async () => {
      if (targetOrders.length === 0) return;
      try {
        await refreshBillStatus();
        const orderIds = targetOrders.map(o => o.id);
        const allLive = await Promise.all(orderIds.map(id => db.getOrder(id)));
        const allPaid = allLive.length > 0 && allLive.every(o => o && o.paymentStatus === 'Paid');

        if (allPaid) {
          if (activeOrder && allLive[0]) {
            const matchedActive = allLive.find(o => o && o.id === activeOrder.id);
            if (matchedActive) setActiveOrder(matchedActive);
          }
          await refreshOrderHistory();
          await refreshBillStatus();
          setStep('success');
        }
      } catch (err) {
        console.warn('Error checking order payment status:', err);
      }
    };

    const interval = setInterval(checkPaymentSettled, 2000);

    const handleOrderPaidEvent = (e: any) => {
      const orderId = e?.detail?.orderId;
      const orderTableId = e?.detail?.tableId;
      if (
        (orderId && targetOrders.some(o => o.id === orderId)) ||
        (orderTableId && String(orderTableId) === String(tableId))
      ) {
        Promise.all([refreshOrderHistory(), refreshBillStatus()]).then(() => setStep('success'));
      }
    };

    window.addEventListener('dinesmart_order_paid', handleOrderPaidEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('dinesmart_order_paid', handleOrderPaidEvent);
    };
  }, [step, targetOrders, tableId, activeOrder, refreshOrderHistory, refreshBillStatus, setActiveOrder]);

  if (targetOrders.length === 0 && step !== 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in font-sans">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-100">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="font-black text-lg text-slate-800">Bill Paid & Settled</h3>
          <p className="text-xs text-gray-500">
            All orders for Table #{tableId} have already been collected and paid. No further payment is required.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Cash Payment Request (Alerts waiter; waiter must accept & collect payment)
  const handleRequestCashPayment = async () => {
    if (targetOrders.length === 0) return;
    setIsProcessing(true);
    try {
      // Persist Cash payment method on each unpaid order in Supabase + local cache
      for (const ord of targetOrders) {
        await db.markOrderPaymentRequested(ord.id, 'Cash');
      }

      // Notify waiter of bill payment request (deduplicated per table)
      await db.requestWaiter(tableId, 'Request Bill');
      await refreshBillStatus();

      setStep('awaiting_cash');
    } catch (err) {
      console.warn('Error requesting cash payment:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const isWaiterAccepted = activeBillRequest?.status === 'Accepted';
  const displayPaidAmount = step === 'success' ? (paidAmountSnapshot || totalAmount) : totalAmount;
  const displayPointsEarned = Math.floor(displayPaidAmount * 0.1);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in font-sans">
      <div className="absolute inset-0" onClick={step === 'success' ? undefined : onClose}></div>

      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl overflow-hidden shadow-2xl z-10 animate-slide-up flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <div>
            <h3 className="font-black text-brand-text text-base">
              {step === 'summary' && (specificOrder ? `Order #${specificOrder.id} Bill` : 'Table Bill Summary')}
              {step === 'awaiting_cash' && 'Awaiting Waiter Confirmation'}
              {step === 'success' && 'Payment Successful'}
            </h3>
            <span className="text-[11px] text-gray-400 font-semibold">Table #{tableId} • Pay with Cash</span>
          </div>

          {step !== 'success' && (
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Content Container */}
        <div className="overflow-y-auto no-scrollbar p-5 pb-32">
          
          {/* STEP 1: BILL SUMMARY */}
          {step === 'summary' && (
            <div className="space-y-5">
              {/* Table details */}
              <div className="bg-orange-50/70 rounded-2xl p-4 border border-orange-100/70 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-orange-600 font-extrabold uppercase tracking-wider">
                    {specificOrder ? 'Single Order Bill' : 'Table Bill'}
                  </span>
                  <p className="font-extrabold text-brand-text text-sm mt-0.5">
                    {targetOrders.length === 1 ? `Order #${targetOrders[0].id}` : `${targetOrders.length} Unpaid Orders`}
                  </p>
                  {targetOrders.length > 1 && (
                    <p className="text-[11px] text-orange-800 font-medium mt-0.5">
                      {targetOrders.map(o => `#${o.id.replace('ord_', '')} (₹${o.total})`).join(' + ')} = ₹{totalAmount}
                    </p>
                  )}
                </div>
                <span className="bg-white text-orange-600 text-xs font-black px-3 py-1 rounded-full border border-orange-200 shadow-xs">
                  Table #{tableId}
                </span>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-3">
                <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider">Itemized Receipt</h4>
                <div className="space-y-2.5 divide-y divide-gray-50">
                  {allItems.map((item, idx) => (
                    <div key={`${item.menuItemId || item.name}-${idx}`} className="flex justify-between items-start text-xs pt-2 first:pt-0">
                      <div className="min-w-0 flex-1 pr-4">
                        <span className="font-bold text-brand-text">{item.name}</span>
                        <span className="text-gray-400 font-bold ml-1.5">x {item.quantity}</span>
                        {item.instructions && item.instructions.length > 0 && (
                          <p className="text-[10px] text-orange-600 font-medium">✓ {item.instructions.join(', ')}</p>
                        )}
                      </div>
                      <span className="font-black text-brand-text flex-shrink-0">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown Summary */}
              <div className="border-t border-gray-100 pt-4 space-y-2.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-brand-text">₹{totalSubtotal}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>GST (5%)</span>
                  <span className="font-bold text-brand-text">₹{totalGst}</span>
                </div>
                {totalTip > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Staff Tip</span>
                    <span className="font-bold text-orange-600">+₹{totalTip}</span>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-bold bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                    <span>Coupon Discount</span>
                    <span>-₹{totalDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 border-t border-dashed border-gray-200 pt-3">
                  <span>Final Total to Pay</span>
                  <span className="text-primary text-base">₹{totalAmount}</span>
                </div>
              </div>

              {/* Cash Payment Highlight Banner */}
              <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/80 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Banknote size={22} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-emerald-950">Payment Method: Pay with Cash</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Please pay <strong>₹{totalAmount}</strong> in physical cash to your waiter or at the billing counter. Your waiter will confirm payment upon receiving the money.
                  </p>
                </div>
              </div>

              {/* Loyalty banner */}
              <div className="bg-primary/5 rounded-2xl p-3.5 border border-primary/10 flex items-center gap-3">
                <span className="text-xl">✨</span>
                <p className="text-[10px] text-primary font-medium leading-relaxed">
                  Paying this bill will earn you <strong className="font-bold">{pointsEarned} DineSmart reward points</strong>!
                </p>
              </div>

              <div className="flex justify-center items-center gap-1.5 text-[10px] text-gray-400 font-semibold py-1">
                <ShieldCheck size={14} className="text-gray-400" />
                <span>100% Verified Table Bill Settlement (Cash)</span>
              </div>
            </div>
          )}

          {/* STEP 2: AWAITING WAITER ACCEPTANCE & CASH COLLECTION */}
          {step === 'awaiting_cash' && (
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="relative w-20 h-20 mx-auto">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-2 ${
                  isWaiterAccepted
                    ? 'bg-emerald-50 text-emerald-600 shadow-emerald-500/10 border-emerald-200'
                    : 'bg-amber-50 text-amber-500 shadow-amber-500/10 border-amber-200'
                }`}>
                  {isWaiterAccepted ? <CheckCircle2 size={38} /> : <Clock size={38} className="animate-pulse" />}
                </div>
                <span className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                  ₹
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-brand-text">
                  {isWaiterAccepted ? 'Waiter Accepted Your Request!' : 'Waiting for Waiter to Accept'}
                </h3>
                <p className="text-gray-500 text-xs leading-relaxed max-w-[280px] mx-auto">
                  {isWaiterAccepted ? (
                    <>Your waiter has accepted the payment request and is coming to <strong>Table #{tableId}</strong> to collect <strong className="text-slate-900 font-black">₹{totalAmount}</strong>.</>
                  ) : (
                    <>A waiter has been notified to accept and collect <strong className="text-slate-900 font-black">₹{totalAmount}</strong> in cash at <strong>Table #{tableId}</strong>.</>
                  )}
                </p>
              </div>

              <div className={`rounded-2xl p-4 border text-left space-y-2 text-xs max-w-[340px] mx-auto ${
                isWaiterAccepted
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : 'bg-amber-50/80 border-amber-200'
              }`}>
                <div className={`flex items-center gap-2 font-bold ${isWaiterAccepted ? 'text-emerald-900' : 'text-amber-900'}`}>
                  <span className={`w-2 h-2 rounded-full animate-ping ${isWaiterAccepted ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  <span>{isWaiterAccepted ? 'Waiter is on the way to collect cash' : 'Hand cash once waiter arrives'}</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isWaiterAccepted ? 'text-emerald-800' : 'text-amber-800'}`}>
                  As soon as your waiter collects the money and taps <strong>"Collect Payment"</strong>, your bill will be permanently settled.
                </p>
              </div>

              <p className="text-[10px] text-gray-400 font-medium">
                Listening for live waiter confirmation...
              </p>
            </div>
          )}

          {/* STEP 3: PAYMENT SUCCESS */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                <CheckCircle2 size={48} fill="rgba(16, 185, 129, 0.1)" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-2xl font-black text-brand-text">Payment Collected!</h2>
                <p className="text-gray-500 text-xs leading-relaxed max-w-[260px] mx-auto">
                  Your cash payment of <strong className="text-emerald-600 font-bold text-sm">₹{displayPaidAmount}</strong> has been collected and confirmed by your waiter.
                </p>
              </div>

              {/* Receipt info */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left space-y-2 text-xs max-w-[340px] mx-auto">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Table</span>
                  <span className="font-bold text-brand-text">Table #{tableId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Payment Method</span>
                  <span className="font-bold text-brand-text">
                    Cash (Collected by Waiter)
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200/50 pt-2 text-emerald-700 font-bold">
                  <span>Reward Points Earned</span>
                  <span>+{displayPointsEarned} Points</span>
                </div>
              </div>

              {/* Success Rewards banner */}
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 max-w-[340px] mx-auto text-center flex flex-col items-center">
                <span className="text-2xl mb-1">🎁</span>
                <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Loyalty Points</span>
                <h4 className="font-bold text-brand-text text-sm mt-1">+{displayPointsEarned} Points Added!</h4>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed max-w-[240px]">
                  Points credited to your account. Current balance: <strong className="font-semibold text-brand-text">{profile ? profile.points + displayPointsEarned : displayPointsEarned} pts</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-20">
          {step === 'summary' && (
            <button
              onClick={handleRequestCashPayment}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-300 active:scale-98"
            >
              <Banknote size={18} />
              <span>{isProcessing ? 'Alerting Waiter...' : `Pay with Cash • ₹${totalAmount}`}</span>
            </button>
          )}

          {step === 'awaiting_cash' && (
            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-6 rounded-2xl transition-all text-center text-xs cursor-pointer"
            >
              Keep Dining (We'll update once waiter confirms)
            </button>
          )}

          {step === 'success' && (
            <button
              onClick={onPaymentSuccess}
              className="w-full bg-primary hover:bg-orange-600 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-primary/25 transition-all text-center cursor-pointer"
            >
              Done & Return
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
