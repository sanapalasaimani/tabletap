import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { Clock, CheckCircle2, ShoppingBag, CreditCard, ChevronRight, MessageSquare } from 'lucide-react';
import { FeedbackModal } from '../../components/customer/FeedbackModal';

interface OrdersScreenProps {
  onAddMoreItems: () => void;
  onPayBill: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ onAddMoreItems, onPayBill }) => {
  const { activeOrder, orderHistory, refreshOrderHistory } = useApp();
  const [historyTab, setHistoryTab] = useState<'All' | 'Completed' | 'Cancelled'>('All');
  const [selectedFeedbackOrderId, setSelectedFeedbackOrderId] = useState<string | null>(null);

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

  // Filter history
  const filteredHistory = orderHistory.filter(order => {
    // Exclude currently active tracking order if it's not delivered yet
    if (activeOrder && order.id === activeOrder.id && activeOrder.status !== 'Delivered') {
      return false;
    }
    if (historyTab === 'Completed') return order.status === 'Delivered';
    if (historyTab === 'Cancelled') return false; // mockup doesn't have actual cancel yet
    return true;
  });

  return (
    <div className="flex-1 pb-24 overflow-y-auto no-scrollbar">
      {/* 1. ACTIVE ORDER TRACKER */}
      {activeOrder && activeOrder.status !== 'Delivered' ? (
        <div className="p-5">
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-6">
            <div className="flex justify-between items-start border-b border-gray-50 pb-4 mb-4">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Order</span>
                <h3 className="font-extrabold text-brand-text text-base mt-0.5">Order #{activeOrder.id}</h3>
              </div>
              <div className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                <Clock size={12} />
                <span>20-25 mins</span>
              </div>
            </div>

            {/* Timeline Progress */}
            <div className="relative pl-7 space-y-6">
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
                const isUpcoming = idx > currentStepIdx;

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

            {/* Tracker Actions */}
            <div className="grid grid-cols-2 gap-3 mt-6 border-t border-gray-50 pt-5">
              <button
                onClick={onAddMoreItems}
                className="py-3 px-4 border border-primary/20 text-primary font-bold text-xs rounded-2xl hover:bg-primary/5 transition-all text-center"
              >
                Add More Items
              </button>
              
              <button
                onClick={onPayBill}
                className="py-3 px-4 bg-primary text-white font-bold text-xs rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all text-center flex items-center justify-center gap-1.5"
              >
                <CreditCard size={14} />
                <span>Request Bill</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. ORDER HISTORY SECTION */}
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-brand-text text-base">Order History</h3>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1 mb-4">
          {(['All', 'Completed', 'Cancelled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setHistoryTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl text-center transition-all ${
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
        {filteredHistory.length > 0 ? (
          <div className="space-y-4">
            {filteredHistory.map((order) => {
              const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div 
                  key={order.id}
                  className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start border-b border-gray-50 pb-3 mb-3">
                    <div>
                      <h4 className="font-bold text-brand-text text-sm">Order #{order.id}</h4>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{dateStr}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'Delivered' 
                        ? 'bg-green-50 text-green-600' 
                        : 'bg-orange-50 text-orange-600'
                    }`}>
                      {order.status === 'Delivered' ? 'Completed' : 'Processing'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1 mb-3.5">
                    {order.items.map(item => (
                      <div key={item.menuItemId} className="flex justify-between">
                        <span>{item.name} x {item.quantity}</span>
                        <span className="font-medium text-brand-text">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center border-t border-gray-50 pt-3">
                    <span className="text-xs font-bold text-brand-text">Total: ₹{order.total}</span>
                    
                    {order.status === 'Delivered' && !order.feedbackSubmitted ? (
                      <button
                        onClick={() => setSelectedFeedbackOrderId(order.id)}
                        className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        <MessageSquare size={12} />
                        <span>Rate Experience</span>
                      </button>
                    ) : order.feedbackSubmitted ? (
                      <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                        ✓ Rated
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
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-100/60 shadow-sm">
            <ShoppingBag className="text-gray-300 mx-auto mb-3" size={32} />
            <p className="text-gray-400 text-xs font-medium">No order history found.</p>
          </div>
        )}
      </div>

      {/* Render Feedback Modal if triggered */}
      {selectedFeedbackOrderId && (
        <FeedbackModal
          orderId={selectedFeedbackOrderId}
          onClose={() => setSelectedFeedbackOrderId(null)}
          onSubmitSuccess={() => {
            setSelectedFeedbackOrderId(null);
            refreshOrderHistory();
          }}
        />
      )}
    </div>
  );
};
