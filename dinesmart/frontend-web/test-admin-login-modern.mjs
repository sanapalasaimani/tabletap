import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 TESTING MODERN ADMIN LOGIN PAGE');
console.log('====================================================\n');

let allPassed = true;

const loginPath = path.resolve('dinesmart/frontend-web/src/pages/admin/AdminLogin.tsx');
const content = fs.readFileSync(loginPath, 'utf8');

// 1. Check for Modern Two-Column Split Layout
const hasSplitLayout = content.includes('flex-col md:flex-row') && content.includes('md:w-5/12') && content.includes('md:w-7/12');
if (hasSplitLayout) {
  console.log('✅ PASS: Modern two-column horizontal split layout implemented matching reference design!');
} else {
  console.error('❌ FAIL: Two-column split layout not found.');
  allPassed = false;
}

// 2. Check for "Welcome Admin" on Right Side
const hasWelcomeAdmin = content.includes('Welcome Admin');
const hasSouthIndianHeader = content.includes('South Indian Cuisine Hub') || content.includes('South Indian');
if (hasWelcomeAdmin && hasSouthIndianHeader) {
  console.log('✅ PASS: Right side prominent "Welcome Admin" heading with South Indian branding present!');
} else {
  console.error('❌ FAIL: "Welcome Admin" or South Indian branding missing.');
  allPassed = false;
}

// 3. Check for Specifically South Indian Food Dishes
const hasMasalaDosa = content.includes('Crispy Ghee Roast Masala Dosa');
const hasIdliSambar = content.includes('Steamed Idli Sambar Platter');
const hasBiryani = content.includes('Hyderabadi Dum Biryani');
const hasBananaThali = content.includes('South Indian Banana Leaf Feast');

if (hasMasalaDosa && hasIdliSambar && hasBiryani && hasBananaThali) {
  console.log('✅ PASS: Specifically South Indian food dishes showcase (Masala Dosa, Idli Sambar, Dum Biryani, Banana Leaf Feast) present!');
} else {
  console.error('❌ FAIL: South Indian dishes missing.');
  allPassed = false;
}

// 4. Verify NO "Forgot Password" and NO "Create Account"
const lower = content.toLowerCase();
const hasForgotPassword = lower.includes('forgot password') || lower.includes('forget password');
const hasCreateAccount = lower.includes("don't have account") || lower.includes('create account') || lower.includes('sign up');

if (!hasForgotPassword && !hasCreateAccount) {
  console.log('✅ PASS: Strictly NO "Forgot Password" and NO "Don\'t have account / create" links!');
} else {
  console.error('❌ FAIL: Found unwanted forgot password or create account links.');
  allPassed = false;
}

// 5. Verify Authentication Logic and Demo Fill
const hasAuth = content.includes("admin") && content.includes("password") && content.includes("onLoginSuccess('Admin')");
const hasQuickFill = content.includes('handleQuickFill');

if (hasAuth && hasQuickFill) {
  console.log('✅ PASS: Admin authentication logic and 1-click Quick Demo Fill helper verified!');
} else {
  console.error('❌ FAIL: Authentication logic or Quick Fill missing.');
  allPassed = false;
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL MODERN ADMIN LOGIN VERIFICATION CHECKS PASSED!');
} else {
  console.log('❌ SOME CHECKS FAILED');
}
console.log('====================================================');
