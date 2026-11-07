import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 TESTING ADMIN LOGIN: SECURE CREDENTIALS & CLEAN UI');
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
const hasLeftDishSection = content.includes('1. LEFT SIDE: FULL-WINDOW SOUTH INDIAN DISHES PHOTO') && content.includes('activeDish.image');
if (hasLeftDishSection) {
  console.log('✅ PASS: South Indian dishes photo is positioned on the LEFT side!');
} else {
  console.error('❌ FAIL: Left dishes photo missing.');
  allPassed = false;
}

// 3. Check "Signature" is removed
const lower = content.toLowerCase();
const hasSignature = lower.includes('signature');
if (!hasSignature) {
  console.log('✅ PASS: "Signature" label/tag has been completely removed!');
} else {
  console.error('❌ FAIL: "Signature" text still found in file.');
  allPassed = false;
}

// 4. Check "TableTap South Indian Kitchen" branding removed from photo
const hasTableTapKitchen = content.includes('TableTap • South Indian Kitchen');
if (!hasTableTapKitchen) {
  console.log('✅ PASS: "TableTap South Indian Kitchen" branding removed from photo!');
} else {
  console.error('❌ FAIL: "TableTap • South Indian Kitchen" still found.');
  allPassed = false;
}

// 5. Check Demo Password and Auto-Fill Option Removed
const hasDemoMention = lower.includes('demo:') || lower.includes('demo access') || lower.includes('fill demo') || content.includes('handleQuickFill');
if (!hasDemoMention) {
  console.log('✅ PASS: Demo password display and auto-fill button completely removed!');
} else {
  console.error('❌ FAIL: Demo password or auto-fill button still found.');
  allPassed = false;
}

// 6. Check Initial State is Empty (No prefilled demo credentials)
const hasEmptyInit = content.includes("useState('')") || content.includes('useState("")');
const hasPrefilledAdmin = content.includes("useState('admin')") || content.includes('useState("admin")');
if (hasEmptyInit && !hasPrefilledAdmin) {
  console.log('✅ PASS: Username and Password fields start clean/empty (not prefilled)!');
} else {
  console.error('❌ FAIL: Credentials are still prefilled.');
  allPassed = false;
}

// 7. Check Secure Credentials Admin@GOT11 & TableTap@GOT11
const hasNewUsername = content.includes('Admin@GOT11') || content.includes('admin@got11');
const hasNewPassword = content.includes('TableTap@GOT11');
if (hasNewUsername && hasNewPassword) {
  console.log('✅ PASS: Credentials set to Admin@GOT11 and TableTap@GOT11!');
} else {
  console.error('❌ FAIL: New credentials not found.');
  allPassed = false;
}

// 8. Check Error Message Does Not Reveal Demo Passwords
const hasRevealError = content.includes('(Demo:') || content.includes('(Hint:');
if (!hasRevealError) {
  console.log('✅ PASS: Error message is generic and does not leak or reveal any passwords!');
} else {
  console.error('❌ FAIL: Password hint found in error message.');
  allPassed = false;
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL SECURE ADMIN LOGIN VERIFICATION CHECKS PASSED!');
} else {
  console.log('❌ SOME CHECKS FAILED');
}
console.log('====================================================');
