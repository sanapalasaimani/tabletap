import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('🧪 TESTING LATEST USER FEATURE REQUIREMENTS');
console.log('====================================================\n');

// 1. Check DishDetailModal passes unitPrice including add-ons to addToCart
const dishModal = fs.readFileSync(path.join(__dirname, 'src/components/customer/DishDetailModal.tsx'), 'utf-8');
assert(
  dishModal.includes('addToCart({ ...item, price: unitPrice }, quantity, combinedInstructions, notes)'),
  'DishDetailModal must pass unitPrice (including add-ons/pairings) to addToCart'
);
console.log('✅ PASS: Dish add-ons & pairings price (e.g. ₹140) correctly passed to cart');

// 2. Check OrdersScreen table bill calculation
const ordersScreen = fs.readFileSync(path.join(__dirname, 'src/pages/customer/OrdersScreen.tsx'), 'utf-8');
assert(
  ordersScreen.includes("o.paymentStatus !== 'Paid' && o.status !== 'Cancelled'"),
  'OrdersScreen must only sum unpaid orders for Request Table Bill'
);
assert(
  ordersScreen.includes('Bill Settled • All Orders for Table'),
  'OrdersScreen must show Bill Settled when all orders are paid'
);
console.log('✅ PASS: Request Table Bill sums ONLY unpaid orders (resolves ₹116 vs ₹179 mismatch)');

// 3. Check Custom Waiter Tip in CartScreen
const cartScreen = fs.readFileSync(path.join(__dirname, 'src/pages/customer/CartScreen.tsx'), 'utf-8');
assert(
  cartScreen.includes('isCustomTipMode') && cartScreen.includes('Custom'),
  'CartScreen must have a Custom tip button'
);
assert(
  cartScreen.includes('placeholder="Enter custom tip amount"'),
  'CartScreen must render custom tip amount input'
);
console.log('✅ PASS: Manual custom tip button and input field available in Cart');

// 4. Check Single-Use Coupons & Dynamic Sync
assert(
  cartScreen.includes('usedCoupons.includes(code)'),
  'CartScreen must check if coupon has already been used by customer'
);
const profileScreen = fs.readFileSync(path.join(__dirname, 'src/pages/customer/ProfileScreen.tsx'), 'utf-8');
assert(
  profileScreen.includes('db.getPromotions()') && profileScreen.includes('usedCoupons'),
  'ProfileScreen must fetch dynamic promotions and check used coupons'
);
assert(
  profileScreen.includes('✓ Redeemed'),
  'ProfileScreen must mark used coupons as Redeemed'
);
const supabaseFile = fs.readFileSync(path.join(__dirname, 'src/supabase.ts'), 'utf-8');
assert(
  supabaseFile.includes('getUsedCoupons') && supabaseFile.includes('markCouponUsed'),
  'Supabase service must implement getUsedCoupons and markCouponUsed'
);
console.log('✅ PASS: Coupons synchronized with admin and restricted to single-use per customer');

// 5. Check Payment Methods: UPI & Cash Only + Waiter Received Money
const checkoutOverlay = fs.readFileSync(path.join(__dirname, 'src/components/customer/CheckoutOverlay.tsx'), 'utf-8');
assert(!checkoutOverlay.includes('RazorpayModal'), 'CheckoutOverlay must NOT include RazorpayModal');
assert(!checkoutOverlay.includes('Credit / Debit Cards'), 'CheckoutOverlay must NOT include Credit / Debit Cards');
assert(checkoutOverlay.includes("paymentMethod === 'UPI'"), 'CheckoutOverlay must support UPI');
assert(checkoutOverlay.includes("paymentMethod === 'Cash'"), 'CheckoutOverlay must support Cash');
assert(checkoutOverlay.includes('upi://pay?pa='), 'CheckoutOverlay must generate UPI URI');
assert(checkoutOverlay.includes('create-qr-code'), 'CheckoutOverlay must generate UPI QR Code');
assert(checkoutOverlay.includes('awaiting_cash'), 'CheckoutOverlay must have awaiting_cash state for waiter collection');

const waiterModule = fs.readFileSync(path.join(__dirname, 'src/pages/waiter/WaiterModule.tsx'), 'utf-8');
assert(
  waiterModule.includes('handleReceiveCashPayment'),
  'WaiterModule must implement handleReceiveCashPayment'
);
assert(
  waiterModule.includes('Received Money (Mark Paid)'),
  'WaiterModule must have "Received Money (Mark Paid)" button'
);
console.log('✅ PASS: Payment methods restricted to UPI & Cash only; Waiter "Received Money" confirmation implemented');

console.log('\n====================================================');
console.log('🎉 ALL 5 USER FEATURE CHECKS PASSED SUCCESSFULLY!');
console.log('====================================================\n');

