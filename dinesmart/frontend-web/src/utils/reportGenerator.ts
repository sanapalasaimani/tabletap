import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const generateReportData = (data: any, settings: any) => {
  const cur = settings.currency || '₹';
  const { orders = [], staff = [], menuItems = [] } = data;

  // 1. Summary Metrics
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.status !== 'Cancelled' ? o.total : 0), 0);
  const completedOrders = orders.filter((o: any) => o.status === 'Completed').length;
  const cancelledOrders = orders.filter((o: any) => o.status === 'Cancelled').length;
  const totalOrdersCount = orders.length;
  const cancelRate = totalOrdersCount ? ((cancelledOrders / totalOrdersCount) * 100).toFixed(2) + '%' : '0%';
  const avgOrder = completedOrders ? Math.round(totalRevenue / completedOrders) : 0;
  const totalExpenses = Math.round(totalRevenue * 0.6); // Mocked 60% margin
  const netProfit = totalRevenue - totalExpenses;

  const itemCounts: Record<string, number> = {};
  const itemRevenue: Record<string, number> = {};
  orders.forEach((o: any) => {
    if (o.status !== 'Cancelled') {
      o.items.forEach((i: any) => {
        itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
        itemRevenue[i.name] = (itemRevenue[i.name] || 0) + (i.quantity * i.price);
      });
    }
  });
  const topItem = Object.entries(itemCounts).sort((a,b) => b[1] - a[1])[0];
  const topMenuItem = topItem ? topItem[0] : 'N/A';

  const summary = [
    ['Total Revenue', `${cur}${totalRevenue.toLocaleString()}`],
    ['Total Orders', totalOrdersCount.toString()],
    ['Completed Orders', completedOrders.toString()],
    ['Cancelled Orders', cancelledOrders.toString()],
    ['Cancel Rate', cancelRate],
    ['Average Order Value', `${cur}${avgOrder.toLocaleString()}`],
    ['Total Expenses', `${cur}${totalExpenses.toLocaleString()}`],
    ['Net Profit', `${cur}${netProfit.toLocaleString()}`],
    ['Top Menu Item', topMenuItem],
    ['Top Payment Method', 'Cash']
  ];

  // 2. Sales Summary (Grouped by Date)
  const salesByDate: Record<string, any> = {};
  let totalTax = 0;
  orders.forEach((o: any) => {
    const d = new Date(o.createdAt).toISOString().split('T')[0];
    if (!salesByDate[d]) salesByDate[d] = { orders: 0, revenue: 0, tax: 0, net: 0 };
    salesByDate[d].orders += 1;
    if (o.status !== 'Cancelled') {
      salesByDate[d].revenue += o.total;
      salesByDate[d].tax += o.gst || 0;
      totalTax += o.gst || 0;
      salesByDate[d].net += (o.total - (o.gst || 0));
    }
  });
  const salesSummary = Object.keys(salesByDate).map(d => [
    d, 
    salesByDate[d].orders.toString(), 
    `${cur}${salesByDate[d].revenue.toLocaleString()}`, 
    `${cur}${salesByDate[d].tax.toLocaleString()}`, 
    `${cur}${salesByDate[d].net.toLocaleString()}`
  ]);

  // 3. Orders
  const ordersList = orders.map((o: any) => [
    o.id,
    new Date(o.createdAt).toISOString().split('T')[0],
    o.customerPhone || 'Guest',
    o.items.reduce((s:number, i:any)=>s+i.quantity, 0).toString(),
    `${cur}${o.total.toLocaleString()}`,
    o.status
  ]);

  // 4. Customers (Aggregated from Orders)
  const custMap: Record<string, any> = {};
  orders.forEach((o: any) => {
    if (!o.customerPhone) return;
    if (!custMap[o.customerPhone]) {
      custMap[o.customerPhone] = { id: `CUS-${Object.keys(custMap).length + 100}`, phone: o.customerPhone, visits: 0, spent: 0, last: '' };
    }
    custMap[o.customerPhone].visits += 1;
    if (o.status !== 'Cancelled') custMap[o.customerPhone].spent += o.total;
    const d = new Date(o.createdAt).toISOString().split('T')[0];
    if (d > custMap[o.customerPhone].last) custMap[o.customerPhone].last = d;
  });
  const customersList = Object.values(custMap).map(c => [
    c.id, 'Guest ' + c.id.split('-')[1], c.phone, c.visits.toString(), `${cur}${c.spent.toLocaleString()}`, c.last
  ]);

  // 5. Menu Items
  const menuItemsList = menuItems.map((m: any) => [
    m.id, m.name, m.category, `${cur}${m.price}`, (itemCounts[m.name] || 0).toString(), `${cur}${(itemRevenue[m.name] || 0).toLocaleString()}`
  ]);

  // 6. Staff
  const staffList = staff.map((s: any) => [
    s.empid || s.id, s.name, s.role, s.shift, `${cur}${s.salary.toLocaleString()}`, 'Active'
  ]);

  // 8. Payments
  const paymentsList = orders.filter((o:any)=>o.status!=='Cancelled').map((o: any) => [
    `PAY-${o.id.split('_')[1] || o.id}`, new Date(o.createdAt).toISOString().split('T')[0], o.paymentMethod || 'Cash', `${cur}${o.total.toLocaleString()}`, 'Success'
  ]);

  // 9. Reservations (Mocked if empty)
  const reservationsList = [
    ['RES-300', 'Aarav Mehta', '2026-07-11', '4', 'T18', 'Confirmed'],
    ['RES-301', 'Priya Nair', '2026-07-12', '6', 'T9', 'Confirmed'],
    ['RES-302', 'Rahul Verma', '2026-07-13', '4', 'T1', 'Confirmed'],
    ['RES-303', 'Sneha Kapoor', '2026-07-14', '2', 'T1', 'Confirmed'],
    ['RES-304', 'Vikram Iyer', '2026-07-15', '5', 'T8', 'Seated'],
  ];

  // 10. Expenses (Mocked)
  const expensesList = [
    ['2026-07-11', 'Groceries', 'FreshMart', `${cur}15,108`],
    ['2026-07-12', 'Utilities', 'BESCOM', `${cur}14,469`],
    ['2026-07-13', 'Salaries', 'Payroll', `${cur}1,476`],
    ['2026-07-14', 'Maintenance', 'FixIt Co', `${cur}16,642`],
    ['2026-07-15', 'Marketing', 'AdWorks', `${cur}11,327`],
  ];

  // 11. Taxes
  const taxesList = [
    ['This Week', `${cur}${(totalTax/2).toLocaleString()}`, `${cur}${(totalTax/2).toLocaleString()}`, `${cur}0`, `${cur}${totalTax.toLocaleString()}`]
  ];

  return {
    summary, salesSummary, ordersList, customersList, menuItemsList, staffList, paymentsList, reservationsList, expensesList, taxesList
  };
};

export const generateComprehensivePDF = (data: any, settings: any) => {
  const doc = new jsPDF();
  const reportData = generateReportData(data, settings);
  let pageNumber = 1;

  const drawHeaderFooter = (title: string, data: any) => {
    // Header background
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 30, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.restaurantName || 'Restaurant Name', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Complete Hotel Operations Report', 14, 22);
    
    const today = new Date().toLocaleString();
    doc.setFontSize(8);
    doc.text(`Generated: ${today}`, 196, 15, { align: 'right' });
    doc.text(`Period: This Week`, 196, 22, { align: 'right' });

    // Page Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 40);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${settings.restaurantName || 'Hotel'} • Confidential Report`, 14, 290);
    doc.text(`Page ${pageNumber}`, 196, 290, { align: 'right' });
  };

  const addTablePage = (title: string, head: string[][], body: any[][], isFirstPage = false) => {
    if (!isFirstPage) {
      doc.addPage();
      pageNumber++;
    }
    
    drawHeaderFooter(title, data);

    let startY = 45;
    if (isFirstPage) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0,0,0);
      
      const fullAddress = `${settings.address || ''}, ${settings.landmark ? settings.landmark + ', ' : ''}${settings.city || ''}, ${settings.state || ''}, ${settings.country || ''} - ${settings.pinCode || ''}`.replace(/(^[,\s]+)|([,\s]+$)/g, '');
      doc.text(`Address: ${fullAddress}`, 14, 48);
      
      const phones = [settings.mobile, settings.alternateMobile].filter(Boolean).join(', ');
      doc.text(`Phone: ${phones || 'N/A'}   Email: ${settings.email || 'N/A'}`, 14, 54);
      
      doc.text(`GSTIN: ${settings.gstNo || 'N/A'}   FSSAI: ${settings.fssai || 'N/A'}`, 14, 60);
      
      doc.text(`Manager: ${settings.ownerName || 'N/A'}   Branch: ${settings.branchName || 'N/A'}`, 14, 66);
      
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) => d.toLocaleDateString();
      doc.text(`Period: ${formatDate(lastWeek)} to ${formatDate(today)}`, 14, 72);
      
      startY = 80;
    }

    autoTable(doc, {
      startY,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }, // Orange theme matching reference
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { bottom: 20 }
    });
  };

  // 1. Summary
  addTablePage('Hotel Information', [['Metric', 'Value']], reportData.summary, true);
  // 2. Sales Summary
  addTablePage('Sales Summary', [['Date', 'Orders', 'Revenue', 'Tax', 'Net']], reportData.salesSummary);
  // 3. Orders
  addTablePage('Orders', [['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Status']], reportData.ordersList);
  // 4. Customers
  addTablePage('Customers', [['ID', 'Name', 'Phone', 'Visits', 'Spent', 'Last Visit']], reportData.customersList);
  // 5. Menu Items
  addTablePage('Menu Items', [['ID', 'Name', 'Category', 'Price', 'Sold', 'Revenue']], reportData.menuItemsList);
  // 6. Staff
  addTablePage('Staff', [['ID', 'Name', 'Role', 'Shift', 'Salary', 'Status']], reportData.staffList);
  // 8. Payments
  addTablePage('Payments', [['ID', 'Date', 'Method', 'Amount', 'Status']], reportData.paymentsList);
  // 9. Reservations
  addTablePage('Reservations', [['ID', 'Guest', 'Date', 'Guests', 'Table', 'Status']], reportData.reservationsList);
  // 10. Expenses
  addTablePage('Expenses', [['Date', 'Category', 'Vendor', 'Amount']], reportData.expensesList);
  // 11. Taxes
  addTablePage('Taxes', [['Period', 'CGST', 'SGST', 'IGST', 'Total']], reportData.taxesList);

  doc.save('Comprehensive_Hotel_Report.pdf');
};

export const generateComprehensiveExcel = (data: any, settings: any) => {
  const reportData = generateReportData(data, settings);
  const wb = XLSX.utils.book_new();

  const addSheet = (sheetName: string, head: string[], body: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  // 1. Summary
  const summaryHead = ['Field', 'Value'];
  const summaryBody = [
    ['Hotel Name', settings.restaurantName || ''],
    ['Address', `${settings.address || ''}, ${settings.city || ''} ${settings.pinCode || ''}`],
    ['Phone', settings.mobile || ''],
    ['Email', settings.email || ''],
    ['GSTIN', settings.gstNo || ''],
    ['Manager', settings.ownerName || ''],
    ['Report Period', 'This Week'],
    ['Generated', new Date().toLocaleString()],
    [],
    ...reportData.summary
  ];
  addSheet('Summary', summaryHead, summaryBody);

  addSheet('Sales', ['Date', 'Orders', 'Revenue', 'Tax', 'Net'], reportData.salesSummary);
  addSheet('Orders', ['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Status'], reportData.ordersList);
  addSheet('Customers', ['ID', 'Name', 'Phone', 'Visits', 'Spent', 'Last Visit'], reportData.customersList);
  addSheet('Menu Items', ['ID', 'Name', 'Category', 'Price', 'Sold', 'Revenue'], reportData.menuItemsList);
  addSheet('Staff', ['ID', 'Name', 'Role', 'Shift', 'Salary', 'Status'], reportData.staffList);
  addSheet('Payments', ['ID', 'Date', 'Method', 'Amount', 'Status'], reportData.paymentsList);
  addSheet('Reservations', ['ID', 'Guest', 'Date', 'Guests', 'Table', 'Status'], reportData.reservationsList);
  addSheet('Expenses', ['Date', 'Category', 'Vendor', 'Amount'], reportData.expensesList);
  addSheet('Taxes', ['Period', 'CGST', 'SGST', 'IGST', 'Total'], reportData.taxesList);

  XLSX.writeFile(wb, 'Comprehensive_Hotel_Report.xlsx');
};
