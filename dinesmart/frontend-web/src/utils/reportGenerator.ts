import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const generateReportData = (data: any, settings: any) => {
  const cur = settings.currency || '₹';
  const { orders = [], staff = [], menuItems = [] } = data;

  // 1. Summary Metrics from Original Order Records
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.status !== 'Cancelled' ? Number(o.total || 0) : 0), 0);
  const completedOrders = orders.filter((o: any) => o.status === 'Completed' || o.status === 'Delivered').length;
  const cancelledOrders = orders.filter((o: any) => o.status === 'Cancelled').length;
  const totalOrdersCount = orders.length;
  const cancelRate = totalOrdersCount ? ((cancelledOrders / totalOrdersCount) * 100).toFixed(2) + '%' : '0%';
  const avgOrder = completedOrders ? Math.round(totalRevenue / completedOrders) : 0;

  const itemCounts: Record<string, number> = {};
  const itemRevenue: Record<string, number> = {};
  orders.forEach((o: any) => {
    if (o.status !== 'Cancelled' && Array.isArray(o.items)) {
      o.items.forEach((i: any) => {
        itemCounts[i.name] = (itemCounts[i.name] || 0) + (Number(i.quantity) || 1);
        itemRevenue[i.name] = (itemRevenue[i.name] || 0) + ((Number(i.quantity) || 1) * (Number(i.price) || 0));
      });
    }
  });
  const topItem = Object.entries(itemCounts).sort((a,b) => b[1] - a[1])[0];
  const topMenuItem = topItem ? topItem[0] : 'N/A';

  const summary = [
    ['Total Revenue', `${cur}${totalRevenue.toLocaleString('en-IN')}`],
    ['Total Orders', totalOrdersCount.toString()],
    ['Completed Orders', completedOrders.toString()],
    ['Cancelled Orders', cancelledOrders.toString()],
    ['Cancel Rate', cancelRate],
    ['Average Order Value', `${cur}${avgOrder.toLocaleString('en-IN')}`],
    ['Top Menu Item', topMenuItem],
    ['Top Payment Method', 'Cash / Online']
  ];

  // 2. Sales Summary (Grouped by Date)
  const salesByDate: Record<string, any> = {};
  let totalTax = 0;
  orders.forEach((o: any) => {
    const d = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    if (!salesByDate[d]) salesByDate[d] = { orders: 0, revenue: 0, tax: 0, net: 0 };
    salesByDate[d].orders += 1;
    if (o.status !== 'Cancelled') {
      const orderTotal = Number(o.total || 0);
      const orderTax = Number(o.gst || 0);
      salesByDate[d].revenue += orderTotal;
      salesByDate[d].tax += orderTax;
      totalTax += orderTax;
      salesByDate[d].net += (orderTotal - orderTax);
    }
  });
  const salesSummary = Object.keys(salesByDate).map(d => [
    d, 
    salesByDate[d].orders.toString(), 
    `${cur}${salesByDate[d].revenue.toLocaleString('en-IN')}`, 
    `${cur}${salesByDate[d].tax.toLocaleString('en-IN')}`, 
    `${cur}${salesByDate[d].net.toLocaleString('en-IN')}`
  ]);

  // 3. Orders
  const ordersList = orders.map((o: any) => [
    o.id || '',
    o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
    o.tableId ? `Table ${o.tableId}` : (o.location || 'Dine-In'),
    Array.isArray(o.items) ? o.items.reduce((s:number, i:any)=>s+(Number(i.quantity)||1), 0).toString() : '0',
    `${cur}${Number(o.total || 0).toLocaleString('en-IN')}`,
    o.status || 'Confirmed'
  ]);

  // 4. Menu Items
  const menuItemsList = menuItems.map((m: any) => [
    m.id || '',
    m.name || '',
    m.category || '',
    `${cur}${Number(m.price || 0)}`,
    (itemCounts[m.name] || 0).toString(),
    `${cur}${(itemRevenue[m.name] || 0).toLocaleString('en-IN')}`
  ]);

  // 5. Staff
  const staffList = staff.map((s: any) => [
    s.empid || s.id || '',
    s.name || '',
    s.role || 'Staff',
    s.shift || 'General',
    `${cur}${Number(s.salary || 0).toLocaleString('en-IN')}`,
    'Active'
  ]);

  // 6. Payments
  const paymentsList = orders.filter((o:any)=>o.status!=='Cancelled').map((o: any) => [
    `PAY-${String(o.id).replace(/\D/g, '') || Math.floor(Math.random()*10000)}`,
    o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    o.paymentMethod || 'Cash',
    `${cur}${Number(o.total || 0).toLocaleString('en-IN')}`,
    'Success'
  ]);

  // 7. Taxes
  const taxesList = [
    ['Total Recorded', `${cur}${(totalTax/2).toLocaleString('en-IN')}`, `${cur}${(totalTax/2).toLocaleString('en-IN')}`, `${cur}0`, `${cur}${totalTax.toLocaleString('en-IN')}`]
  ];

  return {
    summary, salesSummary, ordersList, menuItemsList, staffList, paymentsList, taxesList
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
  addTablePage('Orders', [['Order ID', 'Date', 'Location', 'Items', 'Total', 'Status']], reportData.ordersList);
  // 4. Menu Items
  addTablePage('Menu Items', [['ID', 'Name', 'Category', 'Price', 'Sold', 'Revenue']], reportData.menuItemsList);
  // 5. Staff
  addTablePage('Staff', [['ID', 'Name', 'Role', 'Shift', 'Salary', 'Status']], reportData.staffList);
  // 6. Payments
  addTablePage('Payments', [['ID', 'Date', 'Method', 'Amount', 'Status']], reportData.paymentsList);
  // 7. Taxes
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
    ['Hotel Name', settings.restaurantName || 'Babai Hotel'],
    ['Address', `${settings.address || ''}, ${settings.city || ''} ${settings.pinCode || ''}`],
    ['Phone', settings.mobile || ''],
    ['Email', settings.email || ''],
    ['GSTIN', settings.gstNo || ''],
    ['Manager', settings.ownerName || 'Admin'],
    ['Report Period', 'Live Operations'],
    ['Generated', new Date().toLocaleString()],
    [],
    ...reportData.summary
  ];
  addSheet('Summary', summaryHead, summaryBody);

  addSheet('Sales', ['Date', 'Orders', 'Revenue', 'Tax', 'Net'], reportData.salesSummary);
  addSheet('Orders', ['Order ID', 'Date', 'Location', 'Items', 'Total', 'Status'], reportData.ordersList);
  addSheet('Menu Items', ['ID', 'Name', 'Category', 'Price', 'Sold', 'Revenue'], reportData.menuItemsList);
  addSheet('Staff', ['ID', 'Name', 'Role', 'Shift', 'Salary', 'Status'], reportData.staffList);
  addSheet('Payments', ['ID', 'Date', 'Method', 'Amount', 'Status'], reportData.paymentsList);
  addSheet('Taxes', ['Period', 'CGST', 'SGST', 'IGST', 'Total'], reportData.taxesList);

  XLSX.writeFile(wb, 'Comprehensive_Hotel_Report.xlsx');
};
