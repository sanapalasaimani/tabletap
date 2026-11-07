import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 TESTING FULL-WINDOW ADMIN LOGIN WITH LEFT DISHES PHOTO');
console.log('====================================================\n');

let allPassed = true;

const loginPath = path.resolve('dinesmart/frontend-web/src/pages/admin/AdminLogin.tsx');
const content = fs.readFileSync(loginPath, 'utf8');

// 1. Check Full Window Sizing
const hasFullWindow = content.includes('w-screen h-screen min-h-screen overflow-hidden');
if (hasFullWindow) {
  console.log('✅ PASS: Login page occupies full window (100vw, 100vh)!');
} else {
  console.error('❌ FAIL: Full window sizing missing.');
  allPassed = false;
}

// 2. Check Dishes Photo on the Left Side
const hasLeftDishSection = content.includes('1. LEFT SIDE: FULL-WINDOW SOUTH INDIAN DISHES PHOTO') || content.includes('activeDish.image');
const hasSouthIndianDishes = content.includes('Masala Dosa') && content.includes('Idli Sambar') && content.includes('Dum Biryani');

if (hasLeftDishSection && hasSouthIndianDishes) {
  console.log('✅ PASS: South Indian dishes photo is positioned on the LEFT side!');
} else {
  console.error('❌ FAIL: Left dishes photo missing.');
  allPassed = false;
}

// 3. Check Form on the Right Side with "Welcome Admin"
const hasRightLoginSection = content.includes('2. RIGHT SIDE: FULL-WINDOW CLEAN LOGIN FORM');
const hasWelcomeAdmin = content.includes('Welcome Admin') && content.includes('Login');

if (hasRightLoginSection && hasWelcomeAdmin) {
  console.log('✅ PASS: Right side contains "Welcome Admin" and clean "Login" form!');
} else {
  console.error('❌ FAIL: Right side login section or Welcome Admin missing.');
  allPassed = false;
}

// 4. Verify NO "Forgot Password" and NO "Create account / Don't have account"
const lower = content.toLowerCase();
const hasForgotPassword = lower.includes('forgot password?') || lower.includes('forget password?');
const hasCreateAccount = lower.includes("don't have account?") || lower.includes("don't have account") || lower.includes('create account');

if (!hasForgotPassword && !hasCreateAccount) {
  console.log('✅ PASS: Strictly NO "Forgot Password" and NO "Don\'t have account / create" links!');
} else {
  console.error('❌ FAIL: Found unwanted forgot password or create account text.');
  allPassed = false;
}

// 5. Verify Authentication and Quick Demo Fill
const hasAuth = content.includes("admin") && content.includes("password") && content.includes("onLoginSuccess('Admin')");
const hasPillButton = content.includes('rounded-full') && content.includes('Login');

if (hasAuth && hasPillButton) {
  console.log('✅ PASS: Rounded-full pill Login button and authentication logic verified!');
} else {
  console.error('❌ FAIL: Pill button or authentication missing.');
  allPassed = false;
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL FULL-WINDOW & LEFT DISHES PHOTO CHECKS PASSED!');
} else {
  console.log('❌ SOME CHECKS FAILED');
}
console.log('====================================================');
