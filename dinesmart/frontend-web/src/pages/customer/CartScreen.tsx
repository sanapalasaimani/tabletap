import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Trash2, Tag, Percent, ArrowRight, Check } from 'lucide-react';

interface CartScreenProps {
  onOrderPlaced: () => void;
  onNavigateToHome: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({ onOrderPlaced, onNavigateToHome }) => {
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    getCartTotal, 
    placeOrder, 
    profile 
  } = useApp();

  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  const getInstructionsKey = (instructions: string[], notes: string) => {
    return [...instructions.sort(), notes].join('|');
  };

  const handleApplyCoupon = () => {
    setCouponError('');
    setCouponSuccess('');

    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'WELCOME50') {
      setActiveCoupon('WELCOME50');
      setCouponSuccess('WELCOME50 applied! ₹50 Discount');
      setCouponCode('');
    } else if (code === 'LOYA100') {
      if (profile && profile.points >= 100) {
        setActiveCoupon('LOYA100');
        setCouponSuccess('LOYA100 applied! ₹100 Discount (100 pts)');
        setCouponCode('');
      } else {
        setCouponError('Insufficient loyalty points (need 100 points)');
      }
    } else {
      setCouponError('Invalid coupon code');
    }
  };

  const handleRemoveCoupon = () => {
    setActiveCoupon(null);
    setCouponSuccess('');
  };

  const selectTip = (val: number) => {
    setTip(val);
    setCustomTip('');
  };

  const handleCustomTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomTip(val);
    setTip(val ? parseInt(val) : 0);
  };

  // Pricing math
  const subtotal = getCartTotal();
  const gst = Math.round(subtotal * 0.05);
  
  let discount = 0;
  if (activeCoupon === 'WELCOME50') discount = 50;
  if (activeCoupon === 'LOYA100') discount = Math.min(100, subtotal + gst + tip); // Cap discount

  const total = Math.max(0, subtotal + gst + tip - discount);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsPlacing(true);
    try {
      await placeOrder(tip, activeCoupon || undefined);
      onOrderPlaced();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 animate-pulse">
          🛒
        </div>
        <h2 className="text-xl font-bold text-brand-text mb-2">Your Cart is Empty</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-[240px] mx-auto mb-6">
          Scan the QR code or browse our menu to add mouth-watering dishes to your cart.
        </p>
        <button
          onClick={onNavigateToHome}
          className="bg-primary text-white font-bold py-3.5 px-6 rounded-full hover:bg-primary-hover shadow-lg shadow-primary/15 transition-all text-sm"
        >
          Explore Menu
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-32 overflow-y-auto no-scrollbar flex flex-col">
      <div className="p-5 flex justify-between items-center border-b border-gray-50 bg-white">
        <h2 className="text-xl font-bold text-brand-text">Your Cart</h2>
        <button 
          onClick={onNavigateToHome}
          className="text-xs font-semibold text-primary"
        >
          + Add more
        </button>
      </div>

      {/* Cart Items List */}
      <div className="p-5 space-y-4 bg-white border-b border-gray-50">
        {cart.map((item) => {
          const key = getInstructionsKey(item.selectedInstructions, item.customNotes);
          const hasCustomizations = item.selectedInstructions.length > 0 || item.customNotes;

          return (
            <div 
              key={`${item.menuItem.id}-${key}`}
              className="flex justify-between items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div className="flex gap-3 flex-1 min-w-0">
                <img 
                  src={item.menuItem.image} 
                  alt={item.menuItem.name} 
                  className="w-14 h-14 rounded-lg object-cover bg-gray-50 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-brand-text text-sm truncate">{item.menuItem.name}</h4>
                  
                  {hasCustomizations && (
                    <div className="text-[10px] text-gray-400 mt-0.5 space-y-0.5 leading-tight">
                      {item.selectedInstructions.length > 0 && (
                        <p className="truncate">Options: {item.selectedInstructions.join(', ')}</p>
                      )}
                      {item.customNotes && (
                        <p className="truncate italic">Note: "{item.customNotes}"</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs font-bold text-primary mt-1">₹{item.menuItem.price}</p>
                </div>
              </div>

              {/* Quantity Counter & Delete */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center border border-gray-200 rounded-full py-1 px-2.5 bg-gray-50">
                  <button
                    onClick={() => updateCartQuantity(item.menuItem.id, key, -1)}
                    className="text-gray-500 font-bold text-xs hover:text-brand-text px-1"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-brand-text">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.menuItem.id, key, 1)}
                    className="text-gray-500 font-bold text-xs hover:text-brand-text px-1"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.menuItem.id, key)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coupon section */}
      <div className="p-5 bg-white border-b border-gray-50">
        <h3 className="font-bold text-brand-text text-sm mb-3 flex items-center gap-1.5">
          <Tag size={16} className="text-primary" />
          <span>Apply Coupon</span>
        </h3>
        
        {!activeCoupon ? (
          <div className="space-y-3">
            <div className="flex gap-2.5">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter coupon (e.g. WELCOME50)"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-brand-text font-semibold uppercase"
              />
              <button
                onClick={handleApplyCoupon}
                className="bg-primary text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-primary-hover shadow-sm"
              >
                Apply
              </button>
            </div>
            {couponError && <p className="text-[10px] text-red-500 font-semibold">{couponError}</p>}
            
            {/* Quick Coupon suggestions */}
            <div className="flex gap-2">
              <button 
                onClick={() => { setCouponCode('WELCOME50'); }}
                className="text-[10px] bg-brand-bg text-primary border border-primary/20 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Percent size={10} />
                <span>WELCOME50</span>
              </button>
              {profile && profile.points >= 100 && (
                <button 
                  onClick={() => { setCouponCode('LOYA100'); }}
                  className="text-[10px] bg-brand-bg text-primary border border-primary/20 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <Percent size={10} />
                  <span>LOYA100 (100 pts)</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center bg-green-50/50 border border-green-200/50 p-3 rounded-2xl">
            <div className="flex items-center gap-2 text-green-700 text-xs font-semibold">
              <Check size={16} className="bg-green-100 p-0.5 rounded-full" />
              <span>{couponSuccess}</span>
            </div>
            <button 
              onClick={handleRemoveCoupon}
              className="text-xs text-red-500 font-bold hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Tip Section */}
      <div className="p-5 bg-white border-b border-gray-50">
        <h3 className="font-bold text-brand-text text-sm mb-3">Tip your waiter</h3>
        <p className="text-[10px] text-gray-400 mb-3">Thank you for supporting our service staff.</p>
        <div className="flex gap-2.5">
          {[20, 50, 100].map((val) => (
            <button
              key={val}
              onClick={() => selectTip(val)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                tip === val && !customTip
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              ₹{val}
            </button>
          ))}
          <div className="flex-1 relative">
            <input
              type="text"
              value={customTip}
              onChange={handleCustomTipChange}
              placeholder="Other"
              className={`w-full text-center py-2 text-xs font-semibold rounded-xl border focus:outline-none focus:ring-1 focus:ring-primary/20 ${
                customTip ? 'border-primary text-primary bg-primary/5' : 'border-gray-200 text-gray-600 bg-white'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Bill summary details */}
      <div className="p-5 bg-white space-y-3.5">
        <h3 className="font-bold text-brand-text text-sm border-b border-gray-50 pb-2">Bill Summary</h3>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Item Total</span>
          <span className="font-medium text-brand-text">₹{subtotal}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>GST (5%)</span>
          <span className="font-medium text-brand-text">₹{gst}</span>
        </div>
        {tip > 0 && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Waiter Tip</span>
            <span className="font-medium text-brand-text">₹{tip}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between items-center text-xs text-green-600 font-semibold bg-green-50/50 p-2 rounded-xl border border-green-100/50">
            <span>Discount Applied</span>
            <span>-₹{discount}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm font-bold text-brand-text border-t border-gray-50 pt-3.5">
          <span>Total Amount</span>
          <span className="text-primary text-base">₹{total}</span>
        </div>
      </div>

      {/* Place Order Fixed Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-gray-400 block font-semibold">Total Amount</span>
          <strong className="text-lg text-primary">₹{total}</strong>
        </div>
        <button
          onClick={handlePlaceOrder}
          disabled={isPlacing}
          className="bg-primary text-white font-bold py-3.5 px-7 rounded-full hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center gap-2 group disabled:bg-gray-300"
        >
          <span>{isPlacing ? 'Placing Order...' : 'Place Order'}</span>
          {!isPlacing && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
        </button>
      </div>
    </div>
  );
};
