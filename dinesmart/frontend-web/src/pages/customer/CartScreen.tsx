import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Trash2, Tag, Percent, ArrowRight, Check, Sparkles, Plus, AlertCircle } from 'lucide-react';
import { mlService } from '../../services/mlService';
import { MENU_ITEMS } from '../../data/menu';
import { MenuItem } from '../../types';
import { db } from '../../supabase';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';

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
    profile,
    addToCart,
    tableId
  } = useApp();

  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [promotions, setPromotions] = useState<any[]>([]);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  // Load real promotions from Supabase/db
  useEffect(() => {
    db.getPromotions().then(promos => setPromotions(promos || []));
  }, []);

  const getInstructionsKey = (instructions: string[], notes: string) => {
    return [...instructions.sort(), notes].join('|');
  };

  // Pricing math
  const subtotal = getCartTotal();
  const gst = Math.round(subtotal * 0.05);

  // Note 13: Calculate optimized coupon discount with condition increases
  let discount = 0;
  if (activeCoupon) {
    const matched = promotions.find(p => p.code.toUpperCase() === activeCoupon);
    if (matched) {
      if (matched.type === 'Percentage') {
        discount = Math.round((subtotal * Number(matched.discount)) / 100);
        if (matched.maxDiscount) discount = Math.min(discount, matched.maxDiscount);
      } else {
        discount = Number(matched.discount);
        // Condition increase: if subtotal exceeds ₹600 or ₹1000, grant bonus discount!
        if (subtotal >= 1000) discount += 30;
        else if (subtotal >= 600) discount += 15;
      }
    } else if (activeCoupon === 'WELCOME50') {
      discount = 50;
      if (subtotal >= 600) discount += 25; // condition increase!
    } else if (activeCoupon === 'LOYA100') {
      discount = Math.min(100, subtotal);
    } else if (activeCoupon === 'FESTIVE20' || activeCoupon === 'SAVE20') {
      discount = Math.min(150, Math.round(subtotal * 0.20));
      if (subtotal >= 800) discount += 20;
    }
  }
  discount = Math.min(discount, subtotal);

  const total = Math.max(0, subtotal + gst + tip - discount);

  // Note 13: Coupons apply optimized, clears input, increases based on conditions
  const handleApplyCoupon = () => {
    setCouponError('');
    setCouponSuccess('');

    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    // Check dynamic promotions from database
    const foundPromo = promotions.find(p => p.code.toUpperCase() === code && p.active);
    if (foundPromo) {
      const minBill = Number(foundPromo.min_bill || foundPromo.minBill || 0);
      if (subtotal < minBill) {
        setCouponError(`Min order of ₹${minBill} required for this coupon (Cart: ₹${subtotal})`);
        return;
      }
      setActiveCoupon(code);
      setCouponSuccess(`Coupon ${code} applied successfully!`);
      setCouponCode('');
      return;
    }

    // Built-in presets
    if (code === 'WELCOME50') {
      if (subtotal < 150) {
        setCouponError('WELCOME50 requires a minimum order of ₹150');
        return;
      }
      setActiveCoupon('WELCOME50');
      setCouponSuccess('WELCOME50 applied! ₹50 Discount');
      setCouponCode('');
    } else if (code === 'LOYA100') {
      if (profile && profile.points >= 100) {
        if (subtotal < 250) {
          setCouponError('LOYA100 requires minimum order of ₹250');
          return;
        }
        setActiveCoupon('LOYA100');
        setCouponSuccess('LOYA100 applied! ₹100 Discount (100 pts)');
        setCouponCode('');
      } else {
        setCouponError('Insufficient loyalty points (need 100 points)');
      }
    } else if (code === 'SAVE20' || code === 'FESTIVE20') {
      setActiveCoupon(code);
      setCouponSuccess(`${code} applied! 20% Discount`);
      setCouponCode('');
    } else {
      setCouponError('Invalid or expired coupon code');
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
        <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-6 animate-pulse">
          🛒
        </div>
        <h2 className="text-xl font-black text-brand-text mb-2">Your Cart is Empty</h2>
        <p className="text-gray-500 text-xs leading-relaxed max-w-[240px] mx-auto mb-6">
          Scan the table QR code or explore the menu to add delicious dishes to your table order.
        </p>
        <button
          onClick={onNavigateToHome}
          className="bg-orange-500 text-white font-extrabold py-3.5 px-7 rounded-2xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all text-xs cursor-pointer active:scale-95"
        >
          Explore Menu
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-36 overflow-y-auto no-scrollbar flex flex-col">
      {/* Table Header Info */}
      <div className="p-4 bg-orange-50/60 border-b border-orange-100/60 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-orange-600 font-extrabold uppercase tracking-wider">Active Table</span>
          <h3 className="font-extrabold text-sm text-slate-800">Table #{tableId} Cart</h3>
        </div>
        <span className="text-xs font-bold bg-white text-orange-600 px-3 py-1 rounded-full border border-orange-200">
          {cart.reduce((s, i) => s + i.quantity, 0)} Items
        </span>
      </div>

      {/* Cart Items List */}
      <div className="p-4 bg-white space-y-4 border-b border-gray-100">
        {cart.map((item) => {
          const key = getInstructionsKey(item.selectedInstructions, item.customNotes);
          const hasCustomizations = item.selectedInstructions.length > 0 || item.customNotes;

          return (
            <div 
              key={`${item.menuItem.id}-${key}`}
              className="flex justify-between items-start gap-3 pb-3.5 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                  <ImageWithFallback 
                    src={item.menuItem.image} 
                    alt={item.menuItem.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-brand-text text-xs truncate">{item.menuItem.name}</h4>
                  
                  {hasCustomizations && (
                    <div className="text-[10px] text-gray-500 mt-0.5 space-y-0.5 leading-tight">
                      {item.selectedInstructions.length > 0 && (
                        <p className="truncate text-orange-600 font-medium">✓ {item.selectedInstructions.join(', ')}</p>
                      )}
                      {item.customNotes && (
                        <p className="truncate italic text-slate-400">"{item.customNotes}"</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs font-black text-primary mt-1">₹{item.menuItem.price * item.quantity}</p>
                </div>
              </div>

              {/* Quantity Counter & Delete */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center border border-gray-200 rounded-full py-0.5 px-2 bg-gray-50">
                  <button
                    onClick={() => updateCartQuantity(item.menuItem.id, key, -1)}
                    className="text-gray-500 font-bold text-xs hover:text-brand-text px-1 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-4 text-center text-xs font-bold text-brand-text">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.menuItem.id, key, 1)}
                    className="text-gray-500 font-bold text-xs hover:text-brand-text px-1 cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.menuItem.id, key)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🤖 ML Frequently Ordered Together (Market Basket Analysis) */}
      {(() => {
        const cartDishNames = cart.map(c => c.menuItem.name);
        const recommendedPairNames = Array.from(new Set(
          cart.flatMap(item => mlService.getPairingsForDish(item.menuItem.name).map(a => a.pairedWith))
        )).filter(name => !cartDishNames.includes(name));

        const recommendedDishes = recommendedPairNames
          .map(name => MENU_ITEMS.find(m => m.name.toLowerCase() === name.toLowerCase()))
          .filter((d): d is MenuItem => !!d)
          .slice(0, 3);

        if (recommendedDishes.length === 0) return null;

        return (
          <div className="p-4 bg-orange-50/40 border-b border-orange-100/60">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-black text-brand-text">Frequently Ordered Together</span>
            </div>
            
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {recommendedDishes.map(rec => (
                <div 
                  key={rec.id}
                  className="bg-white p-2 rounded-2xl border border-orange-100 flex items-center gap-2 flex-shrink-0 shadow-xs"
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                    <ImageWithFallback 
                      src={rec.image} 
                      alt={rec.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="min-w-0 pr-1">
                    <h5 className="font-bold text-[11px] text-brand-text truncate max-w-[90px]">{rec.name}</h5>
                    <span className="text-[10px] font-extrabold text-primary">₹{rec.price}</span>
                  </div>
                  <button
                    onClick={() => addToCart(rec, 1, [], '')}
                    className="w-7 h-7 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-xs ml-1 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Note 13: Coupons & Promotions Section */}
      <div className="p-4 bg-white border-b border-gray-100">
        <h4 className="font-extrabold text-xs text-brand-text mb-2.5 flex items-center gap-1.5">
          <Tag size={13} className="text-orange-500" />
          <span>Apply Offers & Coupons</span>
        </h4>

        {activeCoupon ? (
          <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black">
                ✓
              </div>
              <div>
                <span className="font-black text-xs text-emerald-900">{activeCoupon}</span>
                <p className="text-[10px] text-emerald-700 font-semibold">₹{discount} Discount Saved</p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-xs font-extrabold text-red-500 hover:text-red-700 cursor-pointer px-2"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code (e.g. WELCOME50)"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs uppercase font-extrabold focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={handleApplyCoupon}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
            {couponError && <p className="text-[11px] text-red-500 font-semibold">{couponError}</p>}
            {couponSuccess && <p className="text-[11px] text-emerald-600 font-semibold">{couponSuccess}</p>}
          </div>
        )}
      </div>

      {/* Tip for Staff */}
      <div className="p-4 bg-white border-b border-gray-100">
        <h4 className="font-extrabold text-xs text-brand-text mb-2 flex items-center gap-1.5">
          <span>💖</span>
          <span>Add Waiter & Staff Tip</span>
        </h4>
        <div className="flex gap-2 mb-2">
          {[20, 30, 50, 100].map(amount => (
            <button
              key={amount}
              onClick={() => selectTip(amount)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                tip === amount
                  ? 'bg-orange-500 border-orange-500 text-white shadow-xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              ₹{amount}
            </button>
          ))}
        </div>
      </div>

      {/* Bill Breakdown */}
      <div className="p-4 bg-white space-y-2 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>Item Subtotal</span>
          <span className="font-bold text-slate-800">₹{subtotal}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>GST (5%)</span>
          <span className="font-bold text-slate-800">₹{gst}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600 font-bold">
            <span>Coupon Discount</span>
            <span>-₹{discount}</span>
          </div>
        )}
        {tip > 0 && (
          <div className="flex justify-between text-orange-600 font-bold">
            <span>Staff Tip</span>
            <span>+₹{tip}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-gray-100">
          <span>Grand Total</span>
          <span className="text-orange-600 text-base">₹{total}</span>
        </div>
      </div>

      {/* Sticky Bottom Place Order Action Bar */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 z-20 shadow-xl">
        <button
          onClick={handlePlaceOrder}
          disabled={isPlacing}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-orange-500/25 flex items-center justify-between px-6 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <span>{isPlacing ? 'Sending to Kitchen...' : `Confirm & Place Order`}</span>
          <div className="flex items-center gap-1.5">
            <span>₹{total}</span>
            <ArrowRight size={16} />
          </div>
        </button>
      </div>
    </div>
  );
};
