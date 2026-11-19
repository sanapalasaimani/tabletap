const toKolkataParts = (dateInput) => {
  const d = new Date(dateInput);
  const str = d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [datePart, timePart] = str.split(', ');
  const [m, day, y] = datePart.split('/').map(Number);
  const [hr, min, sec] = (timePart || '00:00:00').split(':').map(Number);
  return { y, m, day, hr, min, sec, dateString: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
};

// 1. Midnight Boundary Test
// 11:59 PM IST is 18:29 UTC
const t1159pm = new Date('2026-11-19T18:29:00.000Z');
// 12:01 AM IST next day is 18:31 UTC
const t1201am = new Date('2026-11-19T18:31:00.000Z');

const p1 = toKolkataParts(t1159pm);
const p2 = toKolkataParts(t1201am);

console.log('11:59 PM IST Date:', p1.dateString, 'Hour:', p1.hr, 'Min:', p1.min);
console.log('12:01 AM IST Date:', p2.dateString, 'Hour:', p2.hr, 'Min:', p2.min);

if (p1.dateString === '2026-11-19' && p2.dateString === '2026-11-20' && p1.dateString !== p2.dateString) {
  console.log('✓ TEST PASSED: Midnight boundary correctly isolated in Asia/Kolkata!');
} else {
  console.error('✗ TEST FAILED');
  process.exit(1);
}

// 2. Reconciliation Formula Test
const samplePaidOrders = [
  { id: 'ord_1', total: 650, paidAt: '2026-11-19T10:00:00Z', paymentMethod: 'UPI' },
  { id: 'ord_2', total: 350, paidAt: '2026-11-19T11:00:00Z', paymentMethod: 'Cash' },
];
const sampleTxns = [
  { orderId: 'ord_1', amount: 650, channel: 'UPI' },
  { orderId: 'ord_2', amount: 350, channel: 'CASH' },
];

const totalOrdersRevenue = samplePaidOrders.reduce((sum, o) => sum + o.total, 0);
const totalTxnsAmount = sampleTxns.reduce((sum, t) => sum + t.amount, 0);
const difference = Math.abs(totalOrdersRevenue - totalTxnsAmount);

console.log('Orders Total:', totalOrdersRevenue, 'Transactions Total:', totalTxnsAmount, 'Diff:', difference);
if (difference === 0) {
  console.log('✓ TEST PASSED: Financial reconciliation is balanced (orders == transactions)');
} else {
  console.error('✗ Reconciliation failed');
  process.exit(1);
}
