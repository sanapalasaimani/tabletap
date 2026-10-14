import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { Clock, CheckCircle2, ShoppingBag, CreditCard, ChevronRight, ChevronDown, MessageSquare, Utensils, AlertCircle } from 'lucide-react';
import { FeedbackModal } from '../../components/customer/FeedbackModal';

interface OrdersScreenProps {
  onAddMoreItems: () => void;
  onPayBill: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ onAddMoreItems, onPayBill }) => {
  const { activeOrder, orderHistory, refreshOrderHistory, tableId } = useApp();
  const [historyTab, setHistoryTab] = useState<'All' | 'Completed'>('All');
  const [selectedFeedbackOrderId, setSelectedFeedbackOrderId] = useState<string | null>(null);
  const [showItemTrackingBreakdown, setShowItemTrackingBreakdown] = useState(true);

  // Status mapping
  const statuses = [
    { name: 'Confirmed', label: 'Order Confirmed', desc: 'Your order has been received by the kitchen' },
    { name: 'Preparing', label: 'Preparing', desc: 'Chef is gathering fresh ingredients' },
    { name: 'Cooking', label: 'Cooking', desc: 'Our chef is cooking your delicious food' },
    { name: 'Ready to Serve', label: 'Ready to Serve', desc: 'Food is prepared! Waiter is bringing it to your table' },
    { name: 'Delivered', label: 'Delivered', desc: 'Delivered! Bon appétit!' },
  ];

  const getStatusIndex = (status: Order['status']) => {
    return statuses.findIndex(s => s.name === status);
  };

  const currentStepIdx = activeOrder ? getStatusIndex(activeOrder.status) : -1;

  // Session-isolated history: Prioritize orders belonging to current table and session
  const sessionOrders = orderHistory.filter(order => {
    // Only show orders for this table during active dining
    return String(order.tableId) === String(tableId);
  });

  const displayHistory = (sessionOrders.length > 0 ? sessionOrders : orderHistory).filter(order => {
    // Exclude currently active tracking order if it's not delivered yet
    if (activeOrder && order.id === activeOrder.id && activeOrder.status !== 'Delivered') {
      return false;
    }
    if (historyTab === 'Completed') return order.status === 'Delivered';
    return true;
  });

  // Calculate total across orders placed in this session
  const hasPlacedOrders = !!activeOrder || sessionOrders.length > 0;
  const currentTableTotal = (activeOrder ? activeOrder.total : 0) + 
    sessionOrders.filter(o => o.id !== activeOrder?.id).reduce((sum, o) => sum + o.total, 0);

  const isOrderRated = (order: Order) => {
    return order.feedbackSubmitted || localStorage.getItem(`dinesmart_rated_${order.id}`) === 'true';
  };

  return (
    <div className="flex-1 pb-36 overflow-y-auto no-scrollbar relative flex flex-col justify-between min-h-full">
      <div>
        {/* 1. ACTIVE ORDER TRACKER */}
        {activeOrder && activeOrder.status !== 'Delivered' ? (
          <div className="p-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-4">
              <div className="flex justify-between items-start border-b border-gray-50 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider">
                      Live Kitchen Status
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      Table #{activeOrder.tableId}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-brand-text text-base mt-1">Order #{activeOrder.id}</h3>
                  {/* Note 15: Exact Timestamp in order tracker */}
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                    ⏰ Placed at {new Date(activeOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                  <Clock size={12} />
                  <span>15-20 mins</span>
                </div>
              </div>

              {/* Timeline Progress */}
              <div className="relative pl-7 space-y-5">
                {/* Vertical line connector */}
                <div className="absolute left-3 top-2.5 bottom-2.5 w-0.5 bg-gray-100">
                  <div 
                    className="w-full bg-primary transition-all duration-500" 
                    style={{ height: `${(currentStepIdx / (statuses.length - 1)) * 100}%` }}
                  ></div>
                </div>

                {statuses.map((step, idx) => {
                  const isCompleted = idx < currentStepIdx;
                  const isActive = idx === currentStepIdx;

                  return (
                    <div key={step.name} className="relative flex gap-4">
                      {/* Circle Indicator */}
                      <div className="absolute -left-7 top-0.5 flex items-center justify-center">
                        {isCompleted ? (
                          <CheckCircle2 size={16} className="text-primary" fill="rgba(255, 122, 0, 0.1)" />
                        ) : isActive ? (
                          <span className="w-4 h-4 rounded-full bg-primary border-4 border-primary/20 animate-pulse flex-shrink-0"></span>
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-gray-200 border-2 border-white flex-shrink-0"></span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className={`text-sm font-bold leading-none ${isActive ? 'text-primary' : isCompleted ? 'text-brand-text' : 'text-gray-400'}`}>
                          {step.label}
                        </h4>
                        {isActive && (
                          <p className="text-xs text-gray-500 mt-1 leading-normal">
                            {step.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Note 16: Individual Item Tracking & Price Breakdown */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowItemTrackingBreakdown(!showItemTrackingBreakdown)}
                  className="w-full flex justify-between items-center text-xs font-bold text-slate-700 hover:text-primary transition-colors cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Utensils size={13} className="text-orange-500" />
                    <span>Track Items in this Order ({activeOrder.items.length})</span>
                  </span>
                  {showItemTrackingBreakdown ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {showItemTrackingBreakdown && (
                  <div className="space-y-2 mt-3 bg-gray-50/70 rounded-2xl p-3 border border-gray-100">
                    {activeOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-start text-xs border-b border-gray-100/60 pb-2 last:border-b-0 last:pb-0">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 leading-tight">
                            {item.quantity}x {item.name}
                          </p>
                          {item.instructions && item.instructions.length > 0 && (
                            <p className="text-[10px] text-orange-600 font-medium mt-0.5">
                              {item.instructions.join(' • ')}
                            </p>
                          )}
                          {item.customNotes && (
                            <p className="text-[10px] text-slate-400 italic">
                              "{item.customNotes}"
                            </p>
                          )}
                        </div>
                        <span className="font-extrabold text-slate-900 whitespace-nowrap">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200/60 font-black text-xs text-slate-900">
                      <span>Total Active Amount:</span>
                      <span className="text-orange-600 text-sm">₹{activeOrder.total}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Add More Items inside tracker */}
              <div className="mt-4 pt-3">
                <button
                  onClick={onAddMoreItems}
                  className="w-full py-2.5 px-4 border border-orange-200 text-orange-600 font-bold text-xs rounded-xl hover:bg-orange-50 transition-all text-center cursor-pointer active:scale-98"
                >
                  + Add More Dishes to this Table
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 2. ORDER HISTORY SECTION */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-extrabold text-brand-text text-base">Session Order History</h3>
              <p className="text-[11px] text-slate-400 font-medium">Table #{tableId} Orders</p>
            </div>
          </div>

          {/* Tab triggers (Note 5: Removed Cancelled tab) */}
          <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 mb-4">
            {(['All', 'Completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setHistoryTab(tab)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl text-center transition-all ${
                  historyTab === tab
                    ? 'bg-white text-brand-text shadow-sm'
                    : 'text-gray-500 hover:text-brand-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Orders list */}
          {displayHistory.length > 0 ? (
            <div className="space-y-3.5">
              {displayHistory.map((order) => {
                const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const timeStr = new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const rated = isOrderRated(order);

                return (
                  <div 
                    key={order.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start border-b border-gray-50 pb-2.5 mb-2.5">
                      <div>
                        <h4 className="font-extrabold text-brand-text text-sm">Order #{order.id}</h4>
                        {/* Note 15: Exact Time Saved & Displayed in history */}
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5 flex items-center gap-1">
                          <span>📅 {dateStr}</span>
                          <span>•</span>
                          <span>⏰ {timeStr}</span>
                        </p>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        order.status === 'Delivered' 
                          ? 'bg-green-50 text-green-600' 
                          : 'bg-orange-50 text-orange-600'
                      }`}>
                        {order.status === 'Delivered' ? 'Completed' : order.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1 mb-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.name} x {item.quantity}</span>
                          <span className="font-bold text-brand-text">₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-50 pt-2.5">
                      <span className="text-xs font-black text-brand-text">Total: ₹{order.total}</span>
                      
                      {/* Note 4: Single time rating only */}
                      {order.status === 'Delivered' && !rated ? (
                        <button
                          onClick={() => setSelectedFeedbackOrderId(order.id)}
                          className="flex items-center gap-1 text-[11px] bg-orange-500 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-orange-600 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <MessageSquare size={12} />
                          <span>Rate Experience</span>
                        </button>
                      ) : rated ? (
                        <span className="text-[11px] text-emerald-600 font-extrabold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl">
                          ✓ Rated (Thank You)
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium italic">
                          {order.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <ShoppingBag className="text-gray-300 mx-auto mb-2" size={32} />
              <p className="text-gray-500 text-xs font-semibold">No order history for Table #{tableId} yet.</p>
              <p className="text-[11px] text-gray-400 mt-1">Dishes ordered during your current session will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Note 19 & Note 7: Single Prominent ("Pedda") Button at the Bottom */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 z-20 shadow-lg">
        {hasPlacedOrders ? (
          <button
            onClick={onPayBill}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <CreditCard size={18} />
            <span>Request Table Bill • ₹{currentTableTotal}</span>
          </button>
        ) : (
          <button
            onClick={onAddMoreItems}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <ShoppingBag size={18} />
            <span>Browse Menu & Place Order</span>
          </button>
        )}
      </div>

      {/* Render Feedback Modal if triggered */}
      {selectedFeedbackOrderId && (
        <FeedbackModal
          orderId={selectedFeedbackOrderId}
          onClose={() => setSelectedFeedbackOrderId(null)}
          onSubmitSuccess={() => {
            if (selectedFeedbackOrderId) {
              localStorage.setItem(`dinesmart_rated_${selectedFeedbackOrderId}`, 'true');
            }
            setSelectedFeedbackOrderId(null);
            refreshOrderHistory();
          }}
        />
      )}
    </div>
  );
};
