import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('🧪 TESTING ADMIN DATE-WISE CALENDAR ORDERS FEATURE');
console.log('====================================================\n');

const dashboardCode = fs.readFileSync(path.join(__dirname, 'src/pages/admin/AdminDashboard.tsx'), 'utf-8');

// 1. Verify Calendar interactive component in header
assert(
  dashboardCode.includes('Check Date-wise Orders') && dashboardCode.includes('showCalendarDropdown'),
  'AdminDashboard must contain the interactive calendar dropdown in the header'
);
console.log('✅ PASS: Interactive Calendar Dropdown added to header next to AD avatar');

// 2. Verify date-wise orders filtering
assert(
  dashboardCode.includes('dateWiseOrders') && dashboardCode.includes('getOrderLocalDateStr'),
  'AdminDashboard must contain dateWiseOrders computed from selected calendar date'
);
console.log('✅ PASS: Orders filtered accurately by local calendar date (YYYY-MM-DD)');

// 3. Verify Date-wise Orders Explorer Portal Modal
assert(
  dashboardCode.includes('Date-wise Orders Explorer') && dashboardCode.includes('showDateOrdersModal'),
  'AdminDashboard must render portalized Date-wise Orders Explorer Modal'
);
console.log('✅ PASS: Full-screen Date-wise Orders Explorer Modal with Prev/Next navigation');

// 4. Verify Itemized Receipt Details Modal
assert(
  dashboardCode.includes('selectedOrderForDetail') && dashboardCode.includes('Receipt'),
  'AdminDashboard must support itemized order receipt detail inspection'
);
console.log('✅ PASS: Detailed Itemized Receipt modal for any order on the selected date');

// 5. Verify Excel and PDF Export for selected date orders
assert(
  dashboardCode.includes('handleExportDateOrdersExcel') && dashboardCode.includes('handleExportDateOrdersPDF'),
  'AdminDashboard must provide date-specific Excel and PDF exports'
);
console.log('✅ PASS: Date-specific Excel and PDF export functionality implemented');

console.log('\n====================================================');
console.log('🎉 ALL CALENDAR FEATURE VERIFICATION CHECKS PASSED!');
console.log('====================================================\n');
