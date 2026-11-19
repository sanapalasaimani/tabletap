import React, { useState, useEffect } from 'react';
import { QrCode, Banknote, CheckCircle2, Clock, RotateCcw, AlertTriangle, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../../supabase';
import { Order } from '../../types';

interface WaiterPaymentTerminalProps {
  waiterId: string;
  waiterName: string;
  tableId: string;
  orders: Order[];
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export const WaiterPaymentTerminal: React.FC<WaiterPaymentTerminalProps> = ({
  waiterId,
  waiterName,
  tableId,
  orders,
  onClose,
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'SELECT' | 'UPI_QR' | 'CASH' | 'SUCCESS'>('SELECT');

  // Filter only unpaid orders for this table
  const unpaidOrders = orders.filter(
    o => String(o.tableId) === String(tableId) && o.paymentStatus !== 'Paid' && o.status !== 'Cancelled'
  );

  const totalAmount = unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const subtotal = unpaidOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
  const tax = unpaidOrders.reduce((sum, o) => sum + (Number(o.gst) || 0), 0);
  const discount = unpaidOrders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
  const tip = unpaidOrders.reduce((sum, o) => sum + (Number(o.tip) || 0), 0);
  const allItems = unpaidOrders.flatMap(o => o.items || []);

  // UPI State
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(300);
  const [isQrExpired, setIsQrExpired] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);

  // Cash State
  const [cashTendered, setCashTendered] = useState<string>('');
  const [changeToReturn, setChangeToReturn] = useState<number>(0);
  const [cashError, setCashError] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [settledMethod, setSettledMethod] = useState<'UPI' | 'CASH'>('CASH');

  // Play audio chime on success
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const now = audioCtx.currentTime;

      const playTone = (freq: number, start: number, dur: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };

      playTone(523.25, now, 0.1);        // C5
      playTone(659.25, now + 0.1, 0.1);  // E5
      playTone(783.99, now + 0.2, 0.2);  // G5
      playTone(1046.5, now + 0.3, 0.35); // C6
    } catch {
      // AudioContext unavailable
    }
  };

  // Generate Dynamic UPI QR Code
  const generateUpiQr = async () => {
    setGeneratingQr(true);
    setIsQrExpired(false);
    setTimerSeconds(300);

    try {
      const refId = unpaidOrders.length === 1 ? unpaidOrders[0].id : `tbl_${tableId}_${Date.now().toString().slice(-4)}`;
      const upiUri = `upi://pay?pa=tabletap@icici&pn=TableTap%20Restaurant&tr=${refId}&am=${totalAmount.toFixed(2)}&cu=INR&tn=Bill%20Table%20${tableId}`;

      const dataUrl = await QRCode.toDataURL(upiUri, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      setQrImageUrl(dataUrl);
      setActiveTab('UPI_QR');
    } catch (err) {
      console.error('Failed to generate UPI QR:', err);
      alert('Unable to generate UPI QR code. Please try again.');
    } finally {
      setGeneratingQr(false);
    }
  };

  // 5-Minute Expiry Countdown
  useEffect(() => {
    if (activeTab !== 'UPI_QR' || isQrExpired) return;

    const timer = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsQrExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTab, isQrExpired]);

  // UPI Polling / Real-Time Settlement Listener
  useEffect(() => {
    if (activeTab !== 'UPI_QR') return;

    const handleOrderPaid = (e: any) => {
      const paidTbl = e?.detail?.tableId;
      if (String(paidTbl) === String(tableId)) {
        setSettledMethod('UPI');
        playSuccessChime();
        setActiveTab('SUCCESS');
        onPaymentSuccess();
      }
    };

    window.addEventListener('dinesmart_order_paid', handleOrderPaid);
    return () => window.removeEventListener('dinesmart_order_paid', handleOrderPaid);
  }, [activeTab, tableId, onPaymentSuccess]);

  // Cash Calculation
  const handleCashInput = (val: string) => {
    setCashTendered(val);
    setCashError(null);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setChangeToReturn(Math.max(0, num - totalAmount));
    } else {
      setChangeToReturn(0);
    }
  };

  const handleQuickCash = (amt: number) => {
    setCashTendered(String(amt));
    setCashError(null);
    setChangeToReturn(Math.max(0, amt - totalAmount));
  };

  // Complete Payment Finalizer
  const finalizePayment = async (method: 'UPI' | 'CASH', tendered?: number, change?: number) => {
    setSubmittingPayment(true);
    try {
      const paidTimestamp = new Date().toISOString();

      // 1. Settle each order for this table
      for (const ord of unpaidOrders) {
        await db.payOrder(ord.id, method);
      }

      // 2. Mark table's bill waiter requests as Completed
      const allReqs = await db.getWaiterRequests();
      const tableBillReqs = allReqs.filter(
        r => String(r.tableId) === String(tableId) &&
             r.requestType === 'Request Bill' &&
             (r.status === 'Pending' || r.status === 'Accepted')
      );
      for (const req of tableBillReqs) {
        await db.updateWaiterRequestStatus(req.id, 'Completed');
      }

      // 3. Record transaction in database
      for (const ord of unpaidOrders) {
        await (db as any).recordPaymentTransaction?.({
          orderId: ord.id,
          tableId,
          channel: method,
          amount: ord.total,
          cashTendered: method === 'CASH' ? tendered : undefined,
          cashChangeReturned: method === 'CASH' ? change : undefined,
          waiterId,
          waiterName,
          paidAt: paidTimestamp,
        });
      }

      // 4. Release table session
      await db.releaseTableSession(Number(tableId));

      // 5. Broadcast global event to update customer screen and kitchen/admin
      window.dispatchEvent(new CustomEvent('dinesmart_order_paid', {
        detail: { tableId, orderId: unpaidOrders[0]?.id, method }
      }));

      setSettledMethod(method);
      playSuccessChime();
      setActiveTab('SUCCESS');
      onPaymentSuccess();
    } catch (err: any) {
      console.error('Payment settlement error:', err);
      alert('Failed to settle payment: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Cash Confirmation
  const handleConfirmCashPayment = () => {
    const num = parseFloat(cashTendered);
    if (isNaN(num) || num < totalAmount) {
      setCashError(`Received cash must be at least ₹${totalAmount.toFixed(2)}`);
      return;
    }
    finalizePayment('CASH', num, changeToReturn);
  };

  // Simulate/Verify UPI Webhook Confirmation (for testing and demo)
  const handleSimulateUpiSuccess = () => {
    finalizePayment('UPI');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-2 sm:p-6 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg mx-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-slate-100">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
          <button 
            onClick={activeTab === 'SELECT' ? onClose : () => setActiveTab('SELECT')} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-center">
            <h3 className="font-black text-base tracking-tight">Table #{tableId} Bill Terminal</h3>
            <p className="text-[11px] text-slate-400 font-medium">Attendant: {waiterName} ({waiterId})</p>
          </div>
          <span className="bg-orange-500/20 text-[#FF6B00] border border-orange-500/40 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
            Active
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* TAB 1: SELECT MODE & BILL DETAILS */}
          {activeTab === 'SELECT' && (
            <div className="space-y-4">
              {/* Bill Details Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Bill Breakdown</span>
                  <span className="text-xs font-extrabold text-slate-700">{unpaidOrders.length} Order(s)</span>
                </div>

                {/* Items */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 text-xs">
                  {allItems.map((it, idx) => (
                    <div key={idx} className="pt-1.5 first:pt-0 flex justify-between text-slate-700">
                      <span className="font-medium truncate mr-2">{it.name} × {it.quantity}</span>
                      <span className="font-bold shrink-0">₹{(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="border-t border-slate-200 mt-3 pt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-slate-800">₹{tax.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Discount</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  {tip > 0 && (
                    <div className="flex justify-between text-orange-600 font-bold">
                      <span>Staff Tip</span>
                      <span>+₹{tip.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-300 pt-2 text-base font-black text-slate-900">
                    <span>Grand Total Due</span>
                    <span className="text-orange-600 text-xl font-mono">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Show QR vs Collect Cash */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button
                  onClick={generateUpiQr}
                  disabled={generatingQr || totalAmount <= 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-4.5 rounded-2xl flex flex-col items-center justify-center gap-2 font-black transition-all active:scale-95 cursor-pointer shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  <QrCode size={32} />
                  <span className="text-xs">Show UPI QR</span>
                  <span className="text-[10px] font-medium text-indigo-200">GPay, PhonePe, Paytm</span>
                </button>

                <button
                  onClick={() => {
                    setCashTendered(String(totalAmount));
                    setChangeToReturn(0);
                    setActiveTab('CASH');
                  }}
                  disabled={totalAmount <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-4.5 rounded-2xl flex flex-col items-center justify-center gap-2 font-black transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  <Banknote size={32} />
                  <span className="text-xs">Collect Cash</span>
                  <span className="text-[10px] font-medium text-emerald-200">Tender & Change Math</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-1">
                <ShieldCheck size={14} />
                <span>Audited Transaction • Waiter ID #{waiterId}</span>
              </div>
            </div>
          )}

          {/* TAB 2: FULL-SCREEN DYNAMIC UPI QR */}
          {activeTab === 'UPI_QR' && (
            <div className="flex flex-col items-center text-center space-y-3 py-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Customer Scan & Pay
              </span>
              <h2 className="text-3xl font-black text-slate-900 font-mono">
                ₹{totalAmount.toFixed(2)}
              </h2>

              {/* Dynamic QR Container */}
              <div className="relative p-3.5 bg-white border-2 border-indigo-500 rounded-3xl shadow-xl flex items-center justify-center">
                {qrImageUrl && !isQrExpired ? (
                  <img src={qrImageUrl} alt="UPI QR" className="w-56 h-56 object-contain rounded-xl" />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4">
                    <AlertTriangle className="text-amber-500 mb-2" size={36} />
                    <p className="text-xs font-black text-slate-800">QR Code Expired</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Regenerate for security</p>
                  </div>
                )}
              </div>

              {/* Countdown & Status */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <Clock size={15} className={isQrExpired ? 'text-red-500' : 'text-slate-500'} />
                <span className={isQrExpired ? 'text-red-600 font-bold' : 'text-slate-600 font-semibold'}>
                  {isQrExpired ? 'Expired after 5 mins' : `Expires in ${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}`}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 max-w-[280px]">
                Ask customer to scan using any UPI App (Google Pay, PhonePe, Paytm, BHIM).
              </p>

              {/* Action Buttons */}
              <div className="w-full space-y-2 pt-2">
                <button
                  onClick={handleSimulateUpiSuccess}
                  disabled={submittingPayment}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-100 transition-all active:scale-98"
                >
                  <Sparkles size={16} />
                  <span>{submittingPayment ? 'Settling...' : 'Confirm UPI Payment Received'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={generateUpiQr}
                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Regenerate QR</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('SELECT')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Switch to Cash
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COLLECT CASH */}
          {activeTab === 'CASH' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-800">Total Payable</span>
                <span className="text-2xl font-black text-emerald-950 font-mono">₹{totalAmount.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Cash Received From Customer (₹)
                </label>
                <input
                  type="number"
                  autoFocus
                  placeholder={`e.g. ${totalAmount}`}
                  value={cashTendered}
                  onChange={(e) => handleCashInput(e.target.value)}
                  className="w-full text-2xl font-mono font-black p-3.5 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 outline-none text-slate-900"
                />
              </div>

              {/* Quick Cash Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  totalAmount,
                  Math.ceil(totalAmount / 100) * 100,
                  Math.ceil(totalAmount / 500) * 500,
                  Math.ceil(totalAmount / 1000) * 1000,
                ]
                  .filter((v, idx, arr) => arr.indexOf(v) === idx && v >= totalAmount)
                  .map((val) => (
                    <button
                      key={val}
                      onClick={() => handleQuickCash(val)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      ₹{val}
                    </button>
                  ))}
              </div>

              {/* Change To Return Display */}
              <div className="bg-slate-100 p-4 rounded-2xl flex justify-between items-center border border-slate-200">
                <span className="font-bold text-slate-600 text-xs">Change to Return</span>
                <span className={`text-2xl font-mono font-black ${changeToReturn > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  ₹{changeToReturn.toFixed(2)}
                </span>
              </div>

              {cashError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                  {cashError}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setActiveTab('SELECT')}
                  className="flex-1 border border-slate-200 py-3 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmCashPayment}
                  disabled={submittingPayment}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-emerald-200 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  {submittingPayment ? 'Settling...' : 'Confirm Paid (Mark Settled)'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENT SUCCESS */}
          {activeTab === 'SUCCESS' && (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 size={40} />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Payment Completed!</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Table #{tableId} has been settled via <strong>{settledMethod}</strong>. The table is now marked Available.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-left space-y-1.5 max-w-xs mx-auto font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Settled Amount</span>
                  <span className="font-bold text-slate-900">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Method</span>
                  <span className="font-bold text-slate-900">{settledMethod}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Collected By</span>
                  <span className="font-bold text-slate-900">{waiterName}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-2xl text-xs font-black cursor-pointer shadow-lg transition-all"
              >
                Close & Return to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
