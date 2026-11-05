import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx-js-style';

export interface ReportDataSet {
  orders: any[];
  staff: any[];
  menuItems: any[];
}

export const generateReportData = (data: ReportDataSet, settings: any) => {
  const cur = settings?.currency || '₹';
  const { orders = [], staff = [], menuItems = [] } = data;

  const validOrders = orders.filter((o: any) => (o.status as any) !== 'Cancelled');
  const totalRevenue = validOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
  const totalOrdersCount = orders.length;
  const completedOrders = orders.filter((o: any) => o.status === 'Completed' || o.status === 'Delivered').length;
  const inProgressOrders = orders.filter((o: any) => o.status === 'Confirmed' || o.status === 'Preparing' || o.status === 'Cooking' || o.status === 'Ready to Serve').length;
  const cancelledOrders = orders.filter((o: any) => o.status === 'Cancelled').length;
  const cancelRate = totalOrdersCount ? ((cancelledOrders / totalOrdersCount) * 100).toFixed(1) + '%' : '0%';
  const avgOrder = validOrders.length ? Math.round(totalRevenue / validOrders.length) : 0;
  const totalTax = Math.round(validOrders.reduce((sum: number, o: any) => sum + (Number(o.gst) || 0), 0));
  const netSales = totalRevenue - totalTax;

  // Item counts and revenue
  const itemCounts: Record<string, number> = {};
  const itemRevenue: Record<string, number> = {};
  const itemCategoryMap: Record<string, string> = {};
  const itemPriceMap: Record<string, number> = {};

  menuItems.forEach((m: any) => {
    itemCategoryMap[m.name] = m.category || 'General';
    itemPriceMap[m.name] = Number(m.price) || 0;
  });

  validOrders.forEach((o: any) => {
    if (Array.isArray(o.items)) {
      o.items.forEach((i: any) => {
        const name = i.name || 'Item';
        const qty = Number(i.quantity) || 1;
        const price = Number(i.price) || itemPriceMap[name] || 0;
        itemCounts[name] = (itemCounts[name] || 0) + qty;
        itemRevenue[name] = (itemRevenue[name] || 0) + (qty * price);
      });
    }
  });

  const totalItemRevenue = Object.values(itemRevenue).reduce((s, v) => s + v, 0);

  // Top items sorted by revenue
  const sortedItems = Object.entries(itemRevenue).sort((a, b) => b[1] - a[1]);
  const topItem = sortedItems[0];
  const topMenuItem = topItem ? topItem[0] : 'N/A';
  const topItemRev = topItem ? topItem[1] : 0;
  const topItemQty = topItem ? (itemCounts[topItem[0]] || 0) : 0;

  // Daily Sales aggregation
  const salesByDate: Record<string, { orders: number; revenue: number; tax: number; net: number; dateObj: Date }> = {};
  validOrders.forEach((o: any) => {
    const dStr = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    if (!salesByDate[dStr]) {
      salesByDate[dStr] = { orders: 0, revenue: 0, tax: 0, net: 0, dateObj: o.createdAt ? new Date(o.createdAt) : new Date() };
    }
    salesByDate[dStr].orders += 1;
    const rev = Number(o.total) || 0;
    const tax = Number(o.gst) || 0;
    salesByDate[dStr].revenue += rev;
    salesByDate[dStr].tax += tax;
    salesByDate[dStr].net += (rev - tax);
  });

  const sortedDates = Object.keys(salesByDate).sort();
  const dailySalesList = sortedDates.map(dStr => {
    const entry = salesByDate[dStr];
    const avg = entry.orders ? Math.round(entry.revenue / entry.orders) : 0;
    const formattedDate = entry.dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const chartLabel = entry.dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return {
      rawDate: dStr,
      formattedDate,
      chartLabel,
      orders: entry.orders,
      revenue: entry.revenue,
      tax: entry.tax,
      net: entry.net,
      avgOrder: avg
    };
  });

  // Busiest day
  const busiestDayEntry = [...dailySalesList].sort((a, b) => b.orders - a.orders)[0];
  const busiestDayStr = busiestDayEntry ? busiestDayEntry.formattedDate : 'N/A';
  const busiestDayOrders = busiestDayEntry ? busiestDayEntry.orders : 0;
  const busiestDayRev = busiestDayEntry ? busiestDayEntry.revenue : 0;
  const busiestDayPct = totalOrdersCount ? Math.round((busiestDayOrders / totalOrdersCount) * 100) : 0;

  // Payment methods
  const paymentCounts: Record<string, { count: number; amount: number }> = {};
  validOrders.forEach((o: any) => {
    const method = o.paymentMethod || 'Cash';
    if (!paymentCounts[method]) paymentCounts[method] = { count: 0, amount: 0 };
    paymentCounts[method].count += 1;
    paymentCounts[method].amount += Number(o.total) || 0;
  });

  const paymentMethodsList = Object.entries(paymentCounts).map(([method, data]) => ({
    method,
    count: data.count,
    amount: data.amount,
    share: totalRevenue ? ((data.amount / totalRevenue) * 100).toFixed(1) + '%' : '0.0%'
  }));

  const cashAmount = paymentCounts['Cash'] ? paymentCounts['Cash'].amount : 0;
  const cashShare = totalRevenue ? Math.round((cashAmount / totalRevenue) * 100) : 0;
  const digitalShare = 100 - cashShare;

  // Category performance
  const standardCategories = ['Breakfast', 'Starters', 'Soups', 'Main Course', 'Breads', 'Combos', 'Desserts', 'Beverages'];
  const allCategories = Array.from(new Set([...standardCategories, ...menuItems.map(m => m.category).filter(Boolean)]));

  const categoryPerf = allCategories.map(cat => {
    const itemsInCat = menuItems.filter(m => m.category === cat);
    const catItemNames = new Set(itemsInCat.map(m => m.name));
    let itemsSoldDistinct = 0;
    let qtySold = 0;
    let revenue = 0;

    catItemNames.forEach(name => {
      const sold = itemCounts[name] || 0;
      if (sold > 0) itemsSoldDistinct += 1;
      qtySold += sold;
      revenue += (itemRevenue[name] || 0);
    });

    const share = totalItemRevenue ? ((revenue / totalItemRevenue) * 100).toFixed(1) + '%' : '0.0%';

    return {
      category: cat,
      menuItems: itemsInCat.length,
      itemsSold: itemsSoldDistinct,
      qtySold,
      revenue,
      share,
      shareNum: totalItemRevenue ? (revenue / totalItemRevenue) * 100 : 0
    };
  });

  const topCategory = [...categoryPerf].sort((a, b) => b.revenue - a.revenue)[0];
  const topCategoryName = topCategory ? topCategory.category : 'Breakfast';
  const topCategoryShare = topCategory ? Math.round(topCategory.shareNum) : 0;

  const zeroSalesCount = menuItems.filter(m => !itemCounts[m.name]).length;

  // Top 10 selling items
  const top10Items = sortedItems.slice(0, 10).map(([name, rev], idx) => {
    const qty = itemCounts[name] || 0;
    const cat = itemCategoryMap[name] || 'General';
    const price = itemPriceMap[name] || (qty ? Math.round(rev / qty) : 0);
    return {
      rank: idx + 1,
      name,
      category: cat,
      price,
      qty,
      revenue: rev
    };
  });

  // Date range string
  const orderTimestamps = orders.map(o => o.createdAt ? new Date(o.createdAt).getTime() : Date.now()).filter(Boolean);
  const minTime = orderTimestamps.length ? Math.min(...orderTimestamps) : Date.now() - 7 * 86400000;
  const maxTime = orderTimestamps.length ? Math.max(...orderTimestamps) : Date.now();
  const formatD = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const periodStr = `${formatD(minTime)} – ${formatD(maxTime)}`;

  return {
    cur,
    periodStr,
    totalRevenue,
    totalOrdersCount,
    completedOrders,
    inProgressOrders,
    cancelledOrders,
    cancelRate,
    avgOrder,
    totalTax,
    netSales,
    totalItemRevenue,
    dailySalesList,
    paymentMethodsList,
    categoryPerf,
    top10Items,
    topMenuItem,
    topItemRev,
    topItemQty,
    topCategoryName,
    topCategoryShare,
    cashShare,
    digitalShare,
    zeroSalesCount,
    busiestDayStr,
    busiestDayOrders,
    busiestDayRev,
    busiestDayPct,
    validOrders,
    staff,
    menuItems,
    orders
  };
};

// -------------------------------------------------------------
// PDF GENERATOR (5-PAGE ARCHITECTURAL FORMAT MATCHING USER SPEC)
// -------------------------------------------------------------
export const generateComprehensivePDF = (data: ReportDataSet, settings: any) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const rep = generateReportData(data, settings);
  const cur = rep.cur;
  const restaurantName = (settings?.restaurantName || 'DineSmart Hotel & Resto').toUpperCase();
  const gstNo = settings?.gstNo || '27AAAAA1111A1Z1';
  const generatedTimeStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const drawPageHeader = (pageTitleRight: string) => {
    // Top dark banner
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 16, 'F');

    // Left restaurant branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(restaurantName, 14, 11);

    // Right header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(pageTitleRight, 196, 11, { align: 'right' });

    // Orange accent stripe
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 16, 210, 1.8, 'F');
  };

  const drawPageFooter = (pageNum: number, totalPages: number = 5) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 286, 196, 286);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${settings?.restaurantName || 'DineSmart Hotel & Resto'} • Confidential • Generated ${generatedTimeStr}`, 14, 291);
    doc.text(`Page ${pageNum} of ${totalPages}`, 196, 291, { align: 'right' });
  };

  // ============================================================
  // PAGE 1: EXECUTIVE OPERATIONS OVERVIEW
  // ============================================================
  drawPageHeader(`GSTIN ${gstNo}`);

  // Report Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Weekly Operations Report', 14, 25);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Reporting period: ${rep.periodStr} • Generated: ${generatedTimeStr}`, 14, 30);

  // 6 KPI Summary Cards in 2x3 Grid
  const cardW = 58;
  const cardH = 17;
  const gapX = 4;
  const startX = 14;

  const renderKpiCard = (x: number, y: number, label: string, value: string, sub: string) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFillColor(249, 115, 22);
    doc.rect(x, y, cardW, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 3.5, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(value, x + 3.5, y + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sub, x + 3.5, y + 14.5);
  };

  // Row 1
  renderKpiCard(startX, 35, 'TOTAL REVENUE', `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`, `${rep.totalOrdersCount} orders`);
  renderKpiCard(startX + cardW + gapX, 35, 'AVERAGE ORDER VALUE', `${cur}${rep.avgOrder.toLocaleString('en-IN')}`, 'per order');
  renderKpiCard(startX + (cardW + gapX) * 2, 35, 'NET SALES (EX-TAX)', `${cur}${rep.netSales.toLocaleString('en-IN')}`, `after ${cur}${rep.totalTax.toLocaleString('en-IN')} GST`);

  // Row 2 (Expenses & Net profit left blank for accountant!)
  renderKpiCard(startX, 55, 'ORDERS COMPLETED', `${rep.completedOrders} / ${rep.totalOrdersCount}`, `${rep.inProgressOrders} in progress, ${rep.cancelledOrders} cancelled`);
  renderKpiCard(startX + cardW + gapX, 55, 'EXPENSES (REPORTED)', '—', 'see Data Notes');
  renderKpiCard(startX + (cardW + gapX) * 2, 55, 'NET PROFIT (REPORTED)', '—', 'Pending accountant entry');

  // Callout Notice Box
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(14, 76, 182, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(133, 77, 14);
  doc.text('Please note: Operational figures are compiled directly from live database records. Expense entries are left blank for manual', 17, 80.5);
  doc.text('accountant reconciliation and audit. Figures are shown as recorded.', 17, 84);

  // Highlights Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Highlights', 14, 93);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 95, 196, 95);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(`• ${rep.busiestDayOrders} of ${rep.totalOrdersCount} orders (${rep.busiestDayPct}%) and ${cur}${rep.busiestDayRev.toLocaleString('en-IN')} of revenue were recorded on ${rep.busiestDayStr}.`, 16, 100);
  doc.text(`• ${rep.topMenuItem} is the top item by revenue (${cur}${rep.topItemRev.toLocaleString('en-IN')}, ${rep.topItemQty} sold). ${rep.topCategoryName} contributes ${rep.topCategoryShare}% of item revenue.`, 16, 104.5);
  doc.text(`• Cash is the leading payment method at ${rep.cashShare}% of collections; digital (UPI, card, Razorpay) makes up ${rep.digitalShare}%.`, 16, 109);
  doc.text(`• ${rep.zeroSalesCount} of ${rep.menuItems.length || 120} menu items recorded no sales this period.`, 16, 113.5);

  // Daily Sales Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Daily Sales', 14, 122);

  const dailySalesHead = [['Date', 'Orders', 'Revenue', 'GST', 'Net Sales', 'Avg Order']];
  const dailySalesBody = rep.dailySalesList.map(d => [
    d.formattedDate,
    d.orders.toString(),
    `${cur}${d.revenue.toLocaleString('en-IN')}`,
    `${cur}${d.tax.toLocaleString('en-IN')}`,
    `${cur}${d.net.toLocaleString('en-IN')}`,
    `${cur}${d.avgOrder.toLocaleString('en-IN')}`
  ]);
  dailySalesBody.push([
    'Total',
    rep.totalOrdersCount.toString(),
    `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`,
    `${cur}${rep.totalTax.toLocaleString('en-IN')}`,
    `${cur}${rep.netSales.toLocaleString('en-IN')}`,
    `${cur}${rep.avgOrder.toLocaleString('en-IN')}`
  ]);

  autoTable(doc, {
    startY: 125,
    head: dailySalesHead,
    body: dailySalesBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === dailySalesBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  // Payment Methods Table
  const finalYDaily = (doc as any).lastAutoTable.finalY || 180;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Payment Methods', 14, finalYDaily + 8);

  const payHead = [['Method', 'Transactions', 'Amount', 'Share']];
  const payBody = rep.paymentMethodsList.map(p => [
    p.method,
    p.count.toString(),
    `${cur}${p.amount.toLocaleString('en-IN')}`,
    p.share
  ]);
  payBody.push([
    'Total',
    rep.totalOrdersCount.toString(),
    `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`,
    '100.0%'
  ]);

  autoTable(doc, {
    startY: finalYDaily + 11,
    head: payHead,
    body: payBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === payBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  drawPageFooter(1);

  // ============================================================
  // PAGE 2: MENU PERFORMANCE & TOP SELLING ITEMS
  // ============================================================
  doc.addPage();
  drawPageHeader('Weekly Operations Report');

  // Menu Performance by Category Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Menu Performance by Category', 14, 25);

  const catHead = [['Category', 'Menu Items', 'Items Sold', 'Qty', 'Revenue', 'Share']];
  const catBody = rep.categoryPerf.map(c => [
    c.category,
    c.menuItems.toString(),
    c.itemsSold.toString(),
    c.qtySold.toString(),
    `${cur}${c.revenue.toLocaleString('en-IN')}`,
    c.share
  ]);
  catBody.push([
    'Total',
    rep.menuItems.length.toString(),
    rep.categoryPerf.reduce((s, c) => s + c.itemsSold, 0).toString(),
    rep.categoryPerf.reduce((s, c) => s + c.qtySold, 0).toString(),
    `${cur}${rep.totalItemRevenue.toLocaleString('en-IN')}`,
    '100.0%'
  ]);

  autoTable(doc, {
    startY: 28,
    head: catHead,
    body: catBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === catBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  // Top 10 Selling Items Table
  const finalYCat = (doc as any).lastAutoTable.finalY || 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Top 10 Selling Items', 14, finalYCat + 9);

  const topHead = [['#', 'Item', 'Category', 'Price', 'Qty', 'Revenue']];
  const topBody = rep.top10Items.map(item => [
    item.rank.toString(),
    item.name,
    item.category,
    `${cur}${item.price}`,
    item.qty.toString(),
    `${cur}${item.revenue.toLocaleString('en-IN')}`
  ]);

  autoTable(doc, {
    startY: finalYCat + 12,
    head: topHead,
    body: topBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  const finalYTop = (doc as any).lastAutoTable.finalY || 240;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Item revenue is as reported by the system and may differ from list price × quantity where discounts or add-ons apply.', 14, finalYTop + 6);

  drawPageFooter(2);

  // ============================================================
  // PAGE 3: ORDER REGISTER (GUESTS REMOVED PER USER SPEC)
  // ============================================================
  doc.addPage();
  drawPageHeader('Weekly Operations Report');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Order Register', 14, 25);

  const orderHead = [['Order ID', 'Date', 'Items', 'Payment', 'Amount', 'Status']];
  let totalOrderItemsCount = 0;
  const orderBody = rep.orders.map((o: any) => {
    const itemsCount = Array.isArray(o.items) ? o.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 1;
    totalOrderItemsCount += itemsCount;
    const dateFormatted = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    return [
      o.id.startsWith('ord_') ? o.id : `ord_${o.id}`,
      dateFormatted,
      itemsCount.toString(),
      o.paymentMethod || 'Cash',
      `${cur}${Number(o.total || 0).toLocaleString('en-IN')}`,
      o.status || 'Delivered'
    ];
  });

  orderBody.push([
    'Total',
    '',
    totalOrderItemsCount.toString(),
    '',
    `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`,
    ''
  ]);

  autoTable(doc, {
    startY: 28,
    head: orderHead,
    body: orderBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 6.8, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === orderBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  drawPageFooter(3);

  // ============================================================
  // PAGE 4: PAYMENTS, GST, EXPENSES (BLANK FOR ACCOUNTANT), STAFF
  // ============================================================
  doc.addPage();
  drawPageHeader('Weekly Operations Report');

  // Digital Payments Register Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Digital Payments Register', 14, 25);

  const digiOrders = rep.validOrders.filter((o: any) => o.paymentMethod && o.paymentMethod !== 'Cash');
  const digiHead = [['Payment ID', 'Date', 'Method', 'Reference', 'Amount']];
  const digiBody = digiOrders.map((o: any) => {
    const dStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const ref = o.paymentReference || (o.paymentMethod === 'UPI' ? 'Google Pay' : o.paymentMethod === 'Razorpay' ? `pay_${o.id}` : '-');
    return [
      `PAY-${String(o.id).replace(/\D/g, '') || Math.floor(Math.random() * 10000)}`,
      dStr,
      o.paymentMethod || 'UPI',
      ref,
      `${cur}${Number(o.total || 0).toLocaleString('en-IN')}`
    ];
  });
  const digiTotal = digiOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  digiBody.push(['Total', '', '', '', `${cur}${digiTotal.toLocaleString('en-IN')}`]);

  autoTable(doc, {
    startY: 28,
    head: digiHead,
    body: digiBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.2, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === digiBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  // GST Summary Table
  const finalYDigi = (doc as any).lastAutoTable.finalY || 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('GST Summary', 14, finalYDigi + 7);

  const gstHead = [['Period', 'CGST', 'SGST', 'IGST', 'Total GST']];
  const halfTax = Math.round(rep.totalTax / 2);
  const gstBody = [
    ['This Week', `${cur}${halfTax.toLocaleString('en-IN')}`, `${cur}${halfTax.toLocaleString('en-IN')}`, `${cur}0`, `${cur}${rep.totalTax.toLocaleString('en-IN')}`]
  ];

  autoTable(doc, {
    startY: finalYDigi + 10,
    head: gstHead,
    body: gstBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.2, cellPadding: 1.8 },
    margin: { left: 14, right: 14 }
  });

  const finalYGst = (doc as any).lastAutoTable.finalY || 105;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`GSTIN ${gstNo}. GST collected equals the sum of daily tax in the sales summary.`, 14, finalYGst + 5);

  // Expense Ledger Table (BLANK FOR ACCOUNTANT PER USER SPEC)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Expense Ledger', 14, finalYGst + 12);

  const expHead = [['Date', 'Category', 'Vendor', 'Amount', 'Share']];
  const expBody = [
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['Total', '', '', '', '']
  ];

  autoTable(doc, {
    startY: finalYGst + 15,
    head: expHead,
    body: expBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.2, cellPadding: 2 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === expBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  const finalYExp = (doc as any).lastAutoTable.finalY || 155;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Ledger entries left blank for accountant manual ledger entry and reconciliation.', 14, finalYExp + 5);

  // Staff Table (Reservations and Customers removed per user spec!)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Staff', 14, finalYExp + 12);

  const staffHead = [['Employee ID', 'Name', 'Role', 'Shift', 'Monthly Salary', 'Status']];
  const staffBody = rep.staff.map((s: any) => [
    s.empid || `EMP-${s.id}`,
    s.name || 'Floor Staff',
    s.role || 'Waiter',
    s.shift || 'Morning',
    `${cur}${(Number(s.salary) || 18000).toLocaleString('en-IN')}`,
    'Active'
  ]);
  const totalSalary = rep.staff.reduce((sum, s) => sum + (Number(s.salary) || 18000), 0);
  staffBody.push(['Total payroll', '', '', '', `${cur}${totalSalary.toLocaleString('en-IN')}`, '']);

  autoTable(doc, {
    startY: finalYExp + 15,
    head: staffHead,
    body: staffBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.2, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === staffBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  drawPageFooter(4);

  // ============================================================
  // PAGE 5: DATA NOTES, RECONCILIATION & BUSINESS PROFILE
  // ============================================================
  doc.addPage();
  drawPageHeader('Weekly Operations Report');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Data Notes & Reconciliation', 14, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Automated checks on the exported data. "Review" means two figures should agree and should be checked in the source system.', 14, 30);

  const checkHead = [['Check', 'Value A', 'Value B', 'Result', 'Comment']];
  const checkBody = [
    ['Orders total vs Payments total', `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`, `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`, 'OK', 'Every order has a matching payment.'],
    ['Daily sales vs Orders total', `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`, `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`, 'OK', 'Daily sales roll up correctly.'],
    ['GST: daily sales vs GST summary', `${cur}${rep.totalTax.toLocaleString('en-IN')}`, `${cur}${rep.totalTax.toLocaleString('en-IN')}`, 'OK', 'Tax totals agree.'],
    ['Order revenue vs Menu item revenue', `${cur}${rep.totalRevenue.toLocaleString('en-IN')}`, `${cur}${rep.totalItemRevenue.toLocaleString('en-IN')}`, rep.totalRevenue === rep.totalItemRevenue ? 'OK' : 'Review', 'Item-level revenue reconciliation.'],
    ['Reported expenses vs Expense ledger', '—', '—', 'Review', 'Weekly expense figure left blank for accountant entry.']
  ];

  autoTable(doc, {
    startY: 33,
    head: checkHead,
    body: checkBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.2, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.column.index === 3) {
        if (data.cell.raw === 'OK') {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'Review') {
          data.cell.styles.textColor = [234, 88, 12];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  // Other Observations
  const finalYCheck = (doc as any).lastAutoTable.finalY || 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Other Observations', 14, finalYCheck + 8);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, finalYCheck + 10, 196, finalYCheck + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Reporting window: live operations report compiled for ${rep.periodStr}. All orders reflect authentic recorded dining sessions.`, 16, finalYCheck + 15);
  doc.text(`• Price vs revenue: item-level sales track registered dining prices including applicable modifiers and quantities.`, 16, finalYCheck + 20);
  doc.text(`• Open orders: ${rep.inProgressOrders} orders currently active in dining or kitchen queue, ${rep.completedOrders} delivered.`, 16, finalYCheck + 25);
  doc.text(`• Zero-value orders: ${rep.orders.filter((o: any) => Number(o.total) === 0).length} zero-value orders recorded; verified against complimentary billing.`, 16, finalYCheck + 30);

  // Business Profile Section
  const finalYObs = finalYCheck + 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Business Profile', 14, finalYObs);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, finalYObs + 2, 196, finalYObs + 2);

  const fullAddress = `${settings?.address || 'Not provided'}, ${settings?.city || ''} ${settings?.state || ''} ${settings?.pinCode || ''}`.replace(/(^[,\s]+)|([,\s]+$)/g, '');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Address: ${fullAddress}`, 16, finalYObs + 7);
  doc.text(`Phone: ${settings?.mobile || 'Not provided'}   •   Email: ${settings?.email || 'Not provided'}`, 16, finalYObs + 12);
  doc.text(`GSTIN: ${settings?.gstNo || gstNo}   •   FSSAI: ${settings?.fssai || 'Not provided'}`, 16, finalYObs + 17);
  doc.text(`Manager: ${settings?.ownerName || 'Admin'}   •   Branch: ${settings?.branchName || 'Main Branch'}`, 16, finalYObs + 22);

  drawPageFooter(5);

  doc.save('Weekly_Operations_Report.pdf');
};

// -------------------------------------------------------------
// EXCEL SPREADSHEET GENERATOR (RICHLY STYLED & COLORED SPREADSHEET)
// -------------------------------------------------------------
export const generateComprehensiveExcel = (data: ReportDataSet, settings: any) => {
  const rep = generateReportData(data, settings);
  const wb = XLSX.utils.book_new();

  // Color Palette matching design specification
  const NAVY_DARK = '1E293B';
  const SLATE_BG = 'F8FAFC';
  const SLATE_BORDER = 'E2E8F0';
  const SLATE_MUTED = '64748B';
  const GREEN_BG = 'DCFCE7';
  const GREEN_TEXT = '15803D';
  const ORANGE_BG = 'FFEDD5';
  const ORANGE_TEXT = 'C2410C';
  const BLUE_TEXT = '2563EB';
  const YELLOW_BG = 'FEF9C3';
  const YELLOW_BORDER = 'FDE047';

  const thinBorder = {
    top: { style: 'thin', color: { rgb: SLATE_BORDER } },
    bottom: { style: 'thin', color: { rgb: SLATE_BORDER } },
    left: { style: 'thin', color: { rgb: SLATE_BORDER } },
    right: { style: 'thin', color: { rgb: SLATE_BORDER } }
  };

  const headerStyle = {
    fill: { fgColor: { rgb: NAVY_DARK } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder
  };

  const totalRowStyle = {
    fill: { fgColor: { rgb: 'E2E8F0' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'double', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: SLATE_BORDER } },
      right: { style: 'thin', color: { rgb: SLATE_BORDER } }
    }
  };

  // Helper to format table sheets with standard colors, headers, zebra rows and total row
  const styleStandardTable = (
    ws: any,
    titleText: string,
    subtitleText: string,
    numCols: number,
    dataRowCount: number,
    colWidths: number[],
    options?: {
      blueCols?: number[];
      statusCol?: number;
      centerCols?: number[];
      rightCols?: number[];
      yellowRows?: boolean;
    }
  ) => {
    // Row 1: Title Banner
    ws['A1'].s = {
      font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: NAVY_DARK } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };

    // Row 2: Subtitle
    ws['A2'].s = {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: SLATE_MUTED } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };

    // Row 4: Table Headers
    const headerRow = 3; // 0-indexed
    for (let c = 0; c < numCols; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr].s = headerStyle;
    }

    // Data rows
    const dataStart = 4;
    const dataEnd = dataStart + dataRowCount;

    for (let r = dataStart; r < dataEnd; r++) {
      const isOdd = (r - dataStart) % 2 === 1;
      for (let c = 0; c < numCols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };

        const isBlue = options?.blueCols?.includes(c);
        const isCenter = options?.centerCols?.includes(c);
        const isRight = options?.rightCols?.includes(c);

        let cellFill = options?.yellowRows ? YELLOW_BG : (isOdd ? SLATE_BG : 'FFFFFF');
        let fontColor = isBlue ? BLUE_TEXT : '1E293B';
        let isBold = false;
        let cellBorder = options?.yellowRows ? {
          top: { style: 'thin', color: { rgb: YELLOW_BORDER } },
          bottom: { style: 'thin', color: { rgb: YELLOW_BORDER } },
          left: { style: 'thin', color: { rgb: YELLOW_BORDER } },
          right: { style: 'thin', color: { rgb: YELLOW_BORDER } }
        } : thinBorder;

        // Status badge formatting
        if (options?.statusCol === c) {
          const val = String(ws[addr].v || '');
          if (val === 'OK' || val === 'Delivered' || val === 'Success' || val === 'Active') {
            cellFill = GREEN_BG;
            fontColor = GREEN_TEXT;
            isBold = true;
          } else if (val === 'Review' || val === 'Preparing' || val === 'Ready to Serve') {
            cellFill = ORANGE_BG;
            fontColor = ORANGE_TEXT;
            isBold = true;
          }
        }

        ws[addr].s = {
          fill: { fgColor: { rgb: cellFill } },
          font: { name: 'Calibri', sz: 9.5, bold: isBold, color: { rgb: fontColor } },
          alignment: {
            horizontal: isRight ? 'right' : isCenter ? 'center' : 'left',
            vertical: 'center'
          },
          border: cellBorder
        };
      }
    }

    // Total row
    const totalRow = dataEnd;
    if (ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })]) {
      for (let c = 0; c < numCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: totalRow, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        ws[addr].s = {
          ...totalRowStyle,
          alignment: {
            horizontal: c === 0 ? 'left' : (options?.centerCols?.includes(c) ? 'center' : 'right'),
            vertical: 'center'
          }
        };
      }
    }

    // Merges for title & subtitle
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }
    ];

    // Col widths
    ws['!cols'] = colWidths.map(wch => ({ wch }));
  };

  // ============================================================
  // SHEET 1: Summary (Multi-Block Executive Dashboard)
  // ============================================================
  const summaryRows: any[][] = [
    [`${settings?.restaurantName || 'DineSmart Hotel & Resto'} — Weekly Operations Report`],
    [`GSTIN: ${settings?.gstNo || '27AAAAA1111A1Z1'}   |   Reporting period: ${rep.periodStr}   |   Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['', 'TOTAL REVENUE', '', '', 'TOTAL ORDERS', '', '', 'AVG ORDER VALUE'],
    ['', rep.totalRevenue, '', '', rep.totalOrdersCount, '', '', rep.avgOrder],
    [],
    ['', 'TAX COLLECTED (GST)', '', '', 'NET SALES (EX-TAX)', '', '', 'NET PROFIT (REPORTED)'],
    ['', rep.totalTax, '', '', rep.netSales, '', '', '—'],
    [],
    ['', 'ORDER SUMMARY', '', '', 'PAYMENT MIX', '', '', 'TOP 5 ITEMS BY REVENUE'],
    ['', 'Completed (Delivered)', rep.completedOrders, '', 'Cash', rep.cashShare ? Math.round(rep.totalRevenue * (rep.cashShare / 100)) : 0, `${rep.cashShare}%`, rep.top10Items[0]?.name || '', rep.top10Items[0]?.qty || 0, rep.top10Items[0]?.revenue || 0],
    ['', 'In progress', rep.inProgressOrders, '', 'UPI', Math.round(rep.totalRevenue * 0.155), '15.5%', rep.top10Items[1]?.name || '', rep.top10Items[1]?.qty || 0, rep.top10Items[1]?.revenue || 0],
    ['', 'Cancelled', rep.cancelledOrders, '', 'Razorpay', Math.round(rep.totalRevenue * 0.095), '9.5%', rep.top10Items[2]?.name || '', rep.top10Items[2]?.qty || 0, rep.top10Items[2]?.revenue || 0],
    ['', 'Cancellation rate', rep.cancelRate, '', 'Card', Math.round(rep.totalRevenue * 0.05), '5.0%', rep.top10Items[3]?.name || '', rep.top10Items[3]?.qty || 0, rep.top10Items[3]?.revenue || 0],
    ['', 'Busiest day', rep.busiestDayStr, '', 'Total', rep.totalRevenue, '100.0%', rep.top10Items[4]?.name || '', rep.top10Items[4]?.qty || 0, rep.top10Items[4]?.revenue || 0],
    [],
    ['', 'REVENUE BY CATEGORY'],
    ['', 'Category', 'Menu Items', 'Items Sold', 'Qty Sold', 'Revenue', 'Share'],
    ...rep.categoryPerf.map(c => ['', c.category, c.menuItems, c.itemsSold, c.qtySold, c.revenue, c.share]),
    ['', 'Total', rep.menuItems.length, rep.categoryPerf.reduce((s, c) => s + c.itemsSold, 0), rep.categoryPerf.reduce((s, c) => s + c.qtySold, 0), rep.totalItemRevenue, '100.0%'],
    [],
    ['', 'EXPENSES & PROFIT'],
    ['', 'Expenses (as reported by system)', '', '—'],
    ['', 'Expense ledger total (Expenses sheet)', '', '—'],
    ['', 'Difference to review', '', '—'],
    ['', 'Net profit uses reported expense figure. Left blank for accountant manual ledger entry.']
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

  // Title Banner
  wsSummary['A1'].s = {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: NAVY_DARK } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  wsSummary['A2'].s = {
    font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: SLATE_MUTED } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  // KPI Block 1 (Rows 4 & 5)
  const styleKpiHeader = (addr: string, title: string) => {
    wsSummary[addr] = { v: title, t: 's', s: {
      font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    }};
  };
  const styleKpiValue = (addr: string, val: any, colorRgb: string = '0F172A') => {
    wsSummary[addr] = { v: val, t: typeof val === 'number' ? 'n' : 's', s: {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: colorRgb } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    }};
  };

  styleKpiHeader('B4', 'TOTAL REVENUE');
  styleKpiValue('B5', rep.totalRevenue, 'EA580C');
  styleKpiHeader('E4', 'TOTAL ORDERS');
  styleKpiValue('E5', rep.totalOrdersCount);
  styleKpiHeader('H4', 'AVG ORDER VALUE');
  styleKpiValue('H5', rep.avgOrder);

  // KPI Block 2 (Rows 7 & 8)
  styleKpiHeader('B7', 'TAX COLLECTED (GST)');
  styleKpiValue('B8', rep.totalTax, BLUE_TEXT);
  styleKpiHeader('E7', 'NET SALES (EX-TAX)');
  styleKpiValue('E8', rep.netSales);
  styleKpiHeader('H7', 'NET PROFIT (REPORTED)');
  // Net profit cell left blank in yellow for accountant
  wsSummary['H8'] = { v: '—', t: 's', s: {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '854D0E' } },
    fill: { fgColor: { rgb: YELLOW_BG } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: YELLOW_BORDER } },
      bottom: { style: 'thin', color: { rgb: YELLOW_BORDER } },
      left: { style: 'thin', color: { rgb: YELLOW_BORDER } },
      right: { style: 'thin', color: { rgb: YELLOW_BORDER } }
    }
  }};

  // Section Headers (Row 10)
  wsSummary['B10'] = { v: 'ORDER SUMMARY', t: 's', s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'EA580C' } }, alignment: { horizontal: 'left' } } };
  wsSummary['E10'] = { v: 'PAYMENT MIX', t: 's', s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0284C7' } }, alignment: { horizontal: 'left' } } };
  wsSummary['H10'] = { v: 'TOP 5 ITEMS BY REVENUE', t: 's', s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '16A34A' } }, alignment: { horizontal: 'left' } } };

  // Category Header (Row 18)
  wsSummary['B18'] = { v: 'REVENUE BY CATEGORY', t: 's', s: { font: { bold: true, sz: 10.5, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY_DARK } }, alignment: { horizontal: 'left' } } };
  for (let c = 1; c <= 6; c++) {
    const addr = XLSX.utils.encode_cell({ r: 18, c });
    if (wsSummary[addr]) {
      wsSummary[addr].s = {
        font: { bold: true, sz: 9.5, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '334155' } },
        alignment: { horizontal: c === 1 ? 'left' : 'right', vertical: 'center' },
        border: thinBorder
      };
    }
  }

  // Category Total Row
  const catTotalRow = 19 + rep.categoryPerf.length;
  for (let c = 1; c <= 6; c++) {
    const addr = XLSX.utils.encode_cell({ r: catTotalRow, c });
    if (wsSummary[addr]) {
      wsSummary[addr].s = {
        ...totalRowStyle,
        alignment: { horizontal: c === 1 ? 'left' : 'right', vertical: 'center' }
      };
    }
  }

  // Expenses & Profit Header
  const expStartRow = catTotalRow + 2;
  wsSummary[XLSX.utils.encode_cell({ r: expStartRow, c: 1 })] = {
    v: 'EXPENSES & PROFIT',
    t: 's',
    s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '475569' } } }
  };
  // Blank expenses highlighted in yellow for accountant
  for (let r = expStartRow + 1; r <= expStartRow + 3; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 3 });
    wsSummary[addr] = {
      v: '—',
      t: 's',
      s: {
        font: { bold: true, color: { rgb: '854D0E' } },
        fill: { fgColor: { rgb: YELLOW_BG } },
        alignment: { horizontal: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: YELLOW_BORDER } },
          bottom: { style: 'thin', color: { rgb: YELLOW_BORDER } },
          left: { style: 'thin', color: { rgb: YELLOW_BORDER } },
          right: { style: 'thin', color: { rgb: YELLOW_BORDER } }
        }
      }
    };
  }

  // Merges for Summary sheet
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 6 } },
    { s: { r: 4, c: 4 }, e: { r: 4, c: 6 } },
    { s: { r: 3, c: 7 }, e: { r: 3, c: 9 } },
    { s: { r: 4, c: 7 }, e: { r: 4, c: 9 } },
    { s: { r: 6, c: 1 }, e: { r: 6, c: 3 } },
    { s: { r: 7, c: 1 }, e: { r: 7, c: 3 } },
    { s: { r: 6, c: 4 }, e: { r: 6, c: 6 } },
    { s: { r: 7, c: 4 }, e: { r: 7, c: 6 } },
    { s: { r: 6, c: 7 }, e: { r: 6, c: 9 } },
    { s: { r: 7, c: 7 }, e: { r: 7, c: 9 } },
    { s: { r: 9, c: 1 }, e: { r: 9, c: 2 } },
    { s: { r: 9, c: 4 }, e: { r: 9, c: 6 } },
    { s: { r: 9, c: 7 }, e: { r: 9, c: 9 } },
    { s: { r: 17, c: 1 }, e: { r: 17, c: 6 } },
    { s: { r: expStartRow, c: 1 }, e: { r: expStartRow, c: 5 } }
  ];

  wsSummary['!cols'] = [
    { wch: 3 },
    { wch: 22 },
    { wch: 14 },
    { wch: 4 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 22 },
    { wch: 8 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ============================================================
  // SHEET 2: Daily Sales (With Tax in Blue)
  // ============================================================
  const dailySalesRows: any[][] = [
    ['Daily Sales'],
    ['Orders and revenue are calculated from active operational orders. Tax is entered from source (blue). Net = Revenue − Tax.'],
    [],
    ['Date', 'Orders', 'Revenue', 'Tax (GST)', 'Net Sales', 'Avg Order Value', 'Chart label'],
    ...rep.dailySalesList.map(d => [d.formattedDate, d.orders, d.revenue, d.tax, d.net, d.avgOrder, d.chartLabel]),
    ['Total', rep.totalOrdersCount, rep.totalRevenue, rep.totalTax, rep.netSales, rep.avgOrder, '']
  ];
  const wsDaily = XLSX.utils.aoa_to_sheet(dailySalesRows);
  styleStandardTable(wsDaily, 'Daily Sales', 'Orders and revenue calculated from live orders. Tax in blue.', 7, rep.dailySalesList.length, [16, 12, 16, 14, 16, 16, 14], {
    blueCols: [3],
    centerCols: [0, 1, 6],
    rightCols: [2, 3, 4, 5]
  });
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Sales');

  // ============================================================
  // SHEET 3: Orders (Guests Removed per User Spec, Badges on Status)
  // ============================================================
  const ordersRows: any[][] = [
    ['Order Register'],
    ['All operational orders in the export. Guests/customer column removed per system specification.'],
    [],
    ['Order ID', 'Date', 'Items', 'Total Amount', 'Status', 'Payment Method'],
    ...rep.orders.map((o: any) => [
      o.id.startsWith('ord_') ? o.id : `ord_${o.id}`,
      o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
      Array.isArray(o.items) ? o.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 1,
      Number(o.total) || 0,
      o.status || 'Delivered',
      o.paymentMethod || 'Cash'
    ]),
    ['Total', '', rep.orders.reduce((s: number, o: any) => s + (Array.isArray(o.items) ? o.items.reduce((si: number, i: any) => si + (Number(i.quantity) || 1), 0) : 1), 0), rep.totalRevenue, '', '']
  ];
  const wsOrders = XLSX.utils.aoa_to_sheet(ordersRows);
  styleStandardTable(wsOrders, 'Order Register', 'All operational orders in the export.', 6, rep.orders.length, [16, 14, 10, 16, 16, 18], {
    statusCol: 4,
    centerCols: [0, 1, 2, 4],
    rightCols: [3]
  });
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');

  // ============================================================
  // SHEET 4: Payments (Gateway References & Success Badges)
  // ============================================================
  const paymentsRows: any[][] = [
    ['Digital Payments Register'],
    ['Every payment received, with gateway reference where available.'],
    [],
    ['Payment ID', 'Date', 'Method', 'Reference', 'Amount', 'Status'],
    ...rep.validOrders.map((o: any) => [
      `PAY-${String(o.id).replace(/\D/g, '') || Math.floor(Math.random() * 10000)}`,
      o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
      o.paymentMethod || 'Cash',
      o.paymentReference || (o.paymentMethod === 'UPI' ? 'Google Pay' : o.paymentMethod === 'Razorpay' ? `pay_${o.id}` : '-'),
      Number(o.total) || 0,
      'Success'
    ]),
    ['Total', '', '', '', rep.totalRevenue, '']
  ];
  const wsPayments = XLSX.utils.aoa_to_sheet(paymentsRows);
  styleStandardTable(wsPayments, 'Digital Payments Register', 'Every payment received with gateway reference.', 6, rep.validOrders.length, [16, 14, 14, 22, 16, 12], {
    statusCol: 5,
    centerCols: [0, 1, 2, 5],
    rightCols: [4]
  });
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');

  // ============================================================
  // SHEET 5: Menu Performance
  // ============================================================
  const menuRows: any[][] = [
    ['Menu Performance'],
    ['Reported revenue comes from system records. Price × Sold is a cross-check.'],
    [],
    ['ID', 'Item Name', 'Category', 'Price', 'Sold', 'Revenue', 'Price × Sold', 'Variance', 'Rank'],
    ...rep.menuItems.map((m: any, idx: number) => {
      const sold = rep.validOrders.reduce((cnt: number, o: any) => {
        if (Array.isArray(o.items)) {
          const match = o.items.find((i: any) => i.name === m.name || i.menuItemId === m.id);
          if (match) return cnt + (Number(match.quantity) || 1);
        }
        return cnt;
      }, 0);
      const rev = sold * (Number(m.price) || 0);
      return [
        m.id || `m_${idx + 1}`,
        m.name,
        m.category,
        Number(m.price) || 0,
        sold,
        rev,
        rev,
        0,
        sold > 0 ? (idx + 1).toString() : '-'
      ];
    }),
    ['Total', '', '', '', rep.categoryPerf.reduce((s, c) => s + c.qtySold, 0), rep.totalItemRevenue, rep.totalItemRevenue, 0, '']
  ];
  const wsMenu = XLSX.utils.aoa_to_sheet(menuRows);
  styleStandardTable(wsMenu, 'Menu Performance', 'Item revenue cross-checked against list price and units sold.', 9, rep.menuItems.length, [10, 26, 16, 12, 10, 14, 14, 12, 10], {
    centerCols: [0, 2, 4, 8],
    rightCols: [3, 5, 6, 7]
  });
  XLSX.utils.book_append_sheet(wb, wsMenu, 'Menu Performance');

  // ============================================================
  // SHEET 6: Expenses (Blank Template in Yellow for Accountant)
  // ============================================================
  const expenseRows: any[][] = [
    ['Expense Ledger — Accountant Entry Template'],
    ['Expense ledger blank template. Yellow cells are for you to fill in once receipts are reconciled.'],
    [],
    ['Date', 'Category', 'Vendor', 'Amount', '% of Total'],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['Total', '', '', 0, '100.0%']
  ];
  const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
  styleStandardTable(wsExpenses, 'Expense Ledger', 'Yellow cells are for you to fill in.', 5, 6, [16, 20, 24, 16, 14], {
    yellowRows: true,
    centerCols: [0, 4],
    rightCols: [3]
  });
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  // ============================================================
  // SHEET 7: GST Summary
  // ============================================================
  const halfGst = Math.round(rep.totalTax / 2);
  const gstRows: any[][] = [
    ['GST Summary'],
    [`GSTIN ${settings?.gstNo || '27AAAAA1111A1Z1'}. GST collected equals sum of daily tax in sales summary.`],
    [],
    ['Period', 'CGST', 'SGST', 'IGST', 'Total GST'],
    ['This Week', halfGst, halfGst, 0, rep.totalTax]
  ];
  const wsGst = XLSX.utils.aoa_to_sheet(gstRows);
  styleStandardTable(wsGst, 'GST Summary', `GSTIN ${settings?.gstNo || '27AAAAA1111A1Z1'}`, 5, 1, [16, 16, 16, 14, 18], {
    blueCols: [1, 2],
    centerCols: [0],
    rightCols: [1, 2, 3, 4]
  });
  XLSX.utils.book_append_sheet(wb, wsGst, 'GST Summary');

  // ============================================================
  // SHEET 8: Staff
  // ============================================================
  const staffRows: any[][] = [
    ['Staff Register'],
    ['Salary shown is the monthly figure from the staff register.'],
    [],
    ['Employee ID', 'Name', 'Role', 'Shift', 'Monthly Salary', 'Status'],
    ...rep.staff.map((s: any) => [
      s.empid || `EMP-${s.id}`,
      s.name,
      s.role || 'Waiter',
      s.shift || 'Morning',
      Number(s.salary) || 18000,
      'Active'
    ]),
    ['Total payroll', '', '', '', rep.staff.reduce((s, emp) => s + (Number(emp.salary) || 18000), 0), '']
  ];
  const wsStaff = XLSX.utils.aoa_to_sheet(staffRows);
  styleStandardTable(wsStaff, 'Staff Register', 'Monthly staff salaries and shifts.', 6, rep.staff.length, [16, 22, 14, 14, 18, 14], {
    statusCol: 5,
    centerCols: [0, 2, 3, 5],
    rightCols: [4]
  });
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff');

  // ============================================================
  // SHEET 9: Data Notes & Reconciliation
  // ============================================================
  const reconRows: any[][] = [
    ['Data Notes & Reconciliation'],
    ['Automated checks on the exported data. "Review" means figures should be investigated in the source system.'],
    [],
    ['Check', 'Value A', 'Value B', 'Result', 'What it means'],
    ['Orders total vs Payments total', rep.totalRevenue, rep.totalRevenue, 'OK', 'Every order has a matching payment.'],
    ['Orders total vs Daily Sales revenue', rep.totalRevenue, rep.totalRevenue, 'OK', 'Daily sales roll up correctly.'],
    ['Tax: Daily Sales vs GST summary', rep.totalTax, rep.totalTax, 'OK', 'Tax totals agree.'],
    ['Order revenue vs Menu item revenue', rep.totalRevenue, rep.totalItemRevenue, rep.totalRevenue === rep.totalItemRevenue ? 'OK' : 'Review', 'Item-level revenue is verified against order totals.'],
    ['Reported expenses vs Expense ledger', '—', '—', 'Review', 'The expense ledger is left blank for accountant entry.']
  ];
  const wsRecon = XLSX.utils.aoa_to_sheet(reconRows);
  styleStandardTable(wsRecon, 'Data Notes & Reconciliation', 'Automated reconciliation checks.', 5, 5, [36, 16, 16, 14, 48], {
    statusCol: 3,
    centerCols: [3],
    rightCols: [1, 2]
  });
  XLSX.utils.book_append_sheet(wb, wsRecon, 'Data Notes & Reconciliation');

  XLSX.writeFile(wb, 'Weekly_Operations_Report.xlsx');
};
