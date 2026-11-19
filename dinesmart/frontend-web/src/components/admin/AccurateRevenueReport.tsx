import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, TrendingUp, Calendar, AlertCircle, RefreshCw, CheckCircle2, QrCode, Banknote, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from '../../supabase';

type TimeframeRange = 'today' | 'week' | 'month' | 'custom';

export const AccurateRevenueReport: React.FC = () => {
  const [timeframe, setTimeframe] = useState<TimeframeRange>('today');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchReport = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await db.getAccurateRevenueReport(timeframe, customFrom, customTo);
      setReportData(data);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to fetch accurate revenue report:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [timeframe, customFrom, customTo]);

  // Initial load, real-time polling every 30s, and instant sync on payment events
  useEffect(() => {
    fetchReport(true);
    const interval = setInterval(() => fetchReport(false), 30000);

    const handleOrderPaid = () => fetchReport(false);
    window.addEventListener('dinesmart_order_paid', handleOrderPaid);

    return () => {
      clearInterval(interval);
      window.removeEventListener('dinesmart_order_paid', handleOrderPaid);
    };
  }, [fetchReport]);

  const summary = reportData?.summary;
  const reconciliation = reportData?.reconciliation;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Controls: Filter Tabs & Custom Date Range */}
      <div className="bg-white p-4.5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'today', label: 'Today (00:00 - 23:59)' },
              { id: 'week', label: 'This Week (Mon - Sun)' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeframe(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                timeframe === tab.id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {timeframe === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700 outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700 outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Refresh & Timezone Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Timezone: Asia/Kolkata (+05:30)
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Last synced: {lastUpdated || 'Syncing...'}
            </span>
          </div>
          <button
            onClick={() => fetchReport(true)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-pointer transition-colors"
            title="Refresh Revenue"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* Daily Reconciliation Banner */}
      {reconciliation && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
            reconciliation.isBalanced
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/90 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className={reconciliation.isBalanced ? 'text-emerald-600' : 'text-amber-600'} />
            <div>
              <span className="font-black text-sm">
                {reconciliation.isBalanced ? 'Financial Reconciliation Verified' : 'Reconciliation Notice'}
              </span>
              <p className="text-[11px] font-normal mt-0.5 opacity-90">
                Sum of settled PAID orders (<strong>₹{reconciliation.ordersPaidSum.toFixed(2)}</strong>) matches recorded transactions (UPI + Cash).
              </p>
            </div>
          </div>
          <span className="font-mono text-xs bg-white/80 border border-emerald-300/60 px-3 py-1 rounded-full text-emerald-800 font-black">
            Balanced: ₹{reconciliation.ordersPaidSum.toFixed(2)}
          </span>
        </div>
      )}

      {/* Key Financial Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Revenue */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-bl-full pointer-events-none -z-0" />
            <div className="relative z-10">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Revenue (with GST)</span>
              <h3 className="text-3xl font-black text-slate-900 mt-1 font-mono">
                ₹{summary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Net: ₹{summary.netRevenue.toFixed(2)} • GST: ₹{summary.totalTax.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Card 2: Paid Orders & AOV */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Paid Volume & AOV</span>
            <h3 className="text-3xl font-black text-indigo-600 mt-1 font-mono">
              {summary.paidOrdersCount}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Average Order Value: <strong className="text-slate-800">₹{summary.averageOrderValue}</strong>
            </p>
          </div>

          {/* Card 3: UPI Payments */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">UPI Collected</span>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <QrCode size={11} /> UPI
                </span>
              </div>
              <h3 className="text-2xl font-black text-indigo-600 mt-1 font-mono">
                ₹{summary.upiAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.upiCount} orders ({summary.paidOrdersCount > 0 ? Math.round((summary.upiCount / summary.paidOrdersCount) * 100) : 0}% share)
            </p>
          </div>

          {/* Card 4: Cash Payments */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Cash Collected</span>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Banknote size={11} /> Cash
                </span>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                ₹{summary.cashAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.cashCount} orders ({summary.paidOrdersCount > 0 ? Math.round((summary.cashCount / summary.paidOrdersCount) * 100) : 0}% share)
            </p>
          </div>
        </div>
      )}

      {/* Chart: Time Distribution (Hourly for Today, Daily for Week/Month) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-black text-sm text-slate-900 tracking-tight">
              {timeframe === 'today' ? 'Hourly Revenue Timeline (Asia/Kolkata)' : 'Daily Revenue Distribution'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Only includes orders settled with status <strong>PAID</strong> within the selected timeframe.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 font-semibold bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
            {timeframe.toUpperCase()}
          </span>
        </div>

        <div className="h-64 w-full">
          {reportData?.chartData && reportData.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No paid orders in this timeframe.
            </div>
          )}
        </div>
      </div>

      {/* Performance Grids: Waiter Performance, Table Performance & Top Dishes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Waiter Leaderboard */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <UserCheck size={16} className="text-indigo-600" />
            <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">Revenue Per Waiter</h4>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {reportData?.waiterPerformance && reportData.waiterPerformance.length > 0 ? (
              reportData.waiterPerformance.map((w: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{w.waiterName}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{w.ordersServed} orders served</span>
                  </div>
                  <span className="font-black font-mono text-indigo-700">₹{w.totalCollected.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No waiter collections recorded.</p>
            )}
          </div>
        </div>

        {/* Table Performance */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <IndianRupee size={16} className="text-emerald-600" />
            <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">Revenue Per Table</h4>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {reportData?.tablePerformance && reportData.tablePerformance.length > 0 ? (
              reportData.tablePerformance.map((t: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{t.tableId}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{t.orderCount} order sessions</span>
                  </div>
                  <span className="font-black font-mono text-emerald-700">₹{t.totalRevenue.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No table revenues recorded.</p>
            )}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <TrendingUp size={16} className="text-orange-600" />
            <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">Top Selling Dishes</h4>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {reportData?.topItems && reportData.topItems.length > 0 ? (
              reportData.topItems.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="truncate mr-2">
                    <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{item.quantity} sold</span>
                  </div>
                  <span className="font-black font-mono text-orange-600 shrink-0">₹{item.revenue.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No dishes sold in this period.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
