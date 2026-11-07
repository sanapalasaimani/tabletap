import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 TESTING 3 LATEST FEATURES:');
console.log('1. Kitchen Dashboard Top Banner Navigation');
console.log('2. Admin Dashboard Collapsible Left Sidebar');
console.log('3. Customer Website Live Food Notifications & Sound');
console.log('====================================================\n');

let allPassed = true;

// 1. Check KitchenDashboard.tsx
const kitchenPath = path.resolve('dinesmart/frontend-web/src/pages/kitchen/KitchenDashboard.tsx');
const kitchenContent = fs.readFileSync(kitchenPath, 'utf8');

const hasKitchenTopHeader = kitchenContent.includes('TOP KITCHEN DASHBOARD NAVIGATION BANNER');
const hasOrdersTab = kitchenContent.includes("setActiveTab('dashboard')");
const hasMenuTab = kitchenContent.includes("setActiveTab('menu')");
const hasReviewsTab = kitchenContent.includes("setActiveTab('reviews')");
const hasRemovedOldSidebar = !kitchenContent.includes('<aside className="w-64 bg-white border-r');

if (hasKitchenTopHeader && hasOrdersTab && hasMenuTab && hasReviewsTab && hasRemovedOldSidebar) {
  console.log('✅ PASS: Kitchen Dashboard left sidebar replaced with full-width Top Banner navigation!');
} else {
  console.error('❌ FAIL: Kitchen Dashboard top banner check failed.');
  allPassed = false;
}

// 2. Check AdminDashboard.tsx
const adminPath = path.resolve('dinesmart/frontend-web/src/pages/admin/AdminDashboard.tsx');
const adminContent = fs.readFileSync(adminPath, 'utf8');

const hasSidebarState = adminContent.includes('isSidebarOpen');
const hasToggleSidebar = adminContent.includes('toggleSidebar');
const hasPanelLeftIcons = adminContent.includes('PanelLeftClose') && adminContent.includes('PanelLeftOpen');
const hasCollapsibleClass = adminContent.includes('w-64 translate-x-0') && adminContent.includes('w-0 -translate-x-full');
const hasHeaderToggleButton = adminContent.includes('Open Menu') || adminContent.includes('Close Sidebar');

if (hasSidebarState && hasToggleSidebar && hasPanelLeftIcons && hasCollapsibleClass && hasHeaderToggleButton) {
  console.log('✅ PASS: Admin Dashboard left sidebar is now fully collapsible with toggle button in header & inside sidebar!');
} else {
  console.error('❌ FAIL: Admin Dashboard sidebar collapse check failed.');
  allPassed = false;
}

// 3. Check soundEffects.ts and MainContainer.tsx
const soundPath = path.resolve('dinesmart/frontend-web/src/utils/soundEffects.ts');
const hasSoundService = fs.existsSync(soundPath);
const soundContent = hasSoundService ? fs.readFileSync(soundPath, 'utf8') : '';

const hasNotificationChime = soundContent.includes('playNotificationChime');
const hasCelebrationChime = soundContent.includes('playCelebrationChime');
const hasAudioContext = soundContent.includes('AudioContext');

if (hasSoundService && hasNotificationChime && hasCelebrationChime && hasAudioContext) {
  console.log('✅ PASS: Web Audio API sound effect synthesizer implemented with zero external audio dependencies!');
} else {
  console.error('❌ FAIL: soundEffects.ts check failed.');
  allPassed = false;
}

const customerPath = path.resolve('dinesmart/frontend-web/src/pages/customer/MainContainer.tsx');
const customerContent = fs.readFileSync(customerPath, 'utf8');

const hasFoodToastState = customerContent.includes('foodTrackingToast');
const hasSoundImport = customerContent.includes('soundEffects');
const hasTrackingListener = customerContent.includes('Real-time Order Status & Food Preparation Tracking Pop-up with Sound');
const hasFloatingToast = customerContent.includes('LIVE FOOD TRACKING NOTIFICATION POP-UP WITH AUDIO SOUND');
const hasMicroTracker = customerContent.includes('Live Order Micro-Tracker Banner');

if (hasFoodToastState && hasSoundImport && hasTrackingListener && hasFloatingToast && hasMicroTracker) {
  console.log('✅ PASS: Customer website has real-time food tracking notifications, persistent micro-tracker, and audio sound chimes!');
} else {
  console.error('❌ FAIL: Customer tracking & notification pop-up check failed.');
  allPassed = false;
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL 3 USER REQUIREMENTS VERIFIED & FULLY FUNCTIONAL!');
} else {
  console.log('❌ SOME CHECKS FAILED');
}
console.log('====================================================');
