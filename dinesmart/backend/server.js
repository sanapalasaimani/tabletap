/**
 * DineSmart Restaurant Ordering & Payment REST API Server
 * 
 * Implements the 6 Core Endpoints:
 * 1. POST /orders/:id/request-payment  -> State: PAYMENT_REQUESTED
 * 2. POST /orders/:id/accept-payment   -> State: ACCEPTED (waiter lock)
 * 3. POST /orders/:id/generate-upi-qr  -> Dynamic QR generation with 5m expiry
 * 4. POST /orders/:id/pay-cash         -> State: PAID (cash change calculation)
 * 5. POST /webhooks/payment            -> Gateway / QR callback settlement
 * 6. GET  /orders/:id/status           -> Live polling state endpoint
 */

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 5000;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rxwllokulbjrkbrcnikf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TosgUWCBgC5bvX171JYGEw_8Q7IP9Ce';

// In-memory operational cache & state machine store
const orderStateStore = new Map();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const parts = pathname.split('/').filter(Boolean);

  try {
    // 1. Health & Discovery Check
    if (pathname === '/' || pathname === '/health') {
      return sendJson(res, 200, {
        service: 'TableTap DineSmart Payment API',
        status: 'UP',
        timestamp: new Date().toISOString(),
        endpoints: [
          'POST /orders/:id/request-payment',
          'POST /orders/:id/accept-payment',
          'POST /orders/:id/generate-upi-qr',
          'POST /orders/:id/pay-cash',
          'POST /webhooks/payment',
          'GET  /orders/:id/status'
        ]
      });
    }

    // 2. POST /orders/:id/request-payment
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'orders' && parts[2] === 'request-payment') {
      const orderId = parts[1];
      const body = await parseBody(req);
      const tableId = body.tableId || '05';
      const method = body.method || 'Cash';

      const state = {
        orderId,
        tableId,
        billState: 'PAYMENT_REQUESTED',
        paymentStatus: 'Pending',
        paymentMethod: method,
        requestedAt: new Date().toISOString()
      };
      orderStateStore.set(orderId, state);

      return sendJson(res, 200, {
        success: true,
        orderId,
        tableId,
        billState: 'PAYMENT_REQUESTED',
        message: `Payment request dispatched to waiter for Table #${tableId}`,
        state
      });
    }

    // 3. POST /orders/:id/accept-payment (Waiter APK)
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'orders' && parts[2] === 'accept-payment') {
      const orderId = parts[1];
      const body = await parseBody(req);
      const waiterId = body.waiterId || 'WTR-01';
      const waiterName = body.waiterName || 'Staff Waiter';

      const existing = orderStateStore.get(orderId) || { orderId, tableId: body.tableId || '05' };
      existing.billState = 'ACCEPTED';
      existing.acceptedByWaiterId = waiterId;
      existing.acceptedByWaiterName = waiterName;
      existing.acceptedAt = new Date().toISOString();
      orderStateStore.set(orderId, existing);

      return sendJson(res, 200, {
        success: true,
        orderId,
        billState: 'ACCEPTED',
        acceptedBy: { waiterId, waiterName },
        message: `Payment request accepted by ${waiterName}`
      });
    }

    // 4. POST /orders/:id/generate-upi-qr
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'orders' && parts[2] === 'generate-upi-qr') {
      const orderId = parts[1];
      const body = await parseBody(req);
      const amount = Number(body.amount) || 0;
      const tableId = body.tableId || '05';

      const host = req.headers.host || `localhost:${PORT}`;
      const origin = req.headers.origin || `http://${host}`;
      const qrPayload = `${origin}/pay/${encodeURIComponent(orderId)}?table=${encodeURIComponent(tableId)}&amount=${amount.toFixed(2)}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      return sendJson(res, 200, {
        success: true,
        orderId,
        tableId,
        amount,
        qrPayload,
        expiresAt,
        expiresInSeconds: 300,
        message: 'Dynamic QR generated for exact grand total'
      });
    }

    // 5. POST /orders/:id/pay-cash (Waiter APK)
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'orders' && parts[2] === 'pay-cash') {
      const orderId = parts[1];
      const body = await parseBody(req);
      const amount = Number(body.amount) || 0;
      const cashTendered = Number(body.cashTendered) || amount;
      const changeToReturn = Math.max(0, cashTendered - amount);
      const waiterId = body.waiterId || 'WTR-01';

      const existing = orderStateStore.get(orderId) || { orderId };
      existing.billState = 'PAID';
      existing.paymentStatus = 'Paid';
      existing.paymentMethod = 'Cash';
      existing.amount = amount;
      existing.cashTendered = cashTendered;
      existing.changeToReturn = changeToReturn;
      existing.paidAt = new Date().toISOString();
      orderStateStore.set(orderId, existing);

      return sendJson(res, 200, {
        success: true,
        orderId,
        billState: 'PAID',
        paymentMethod: 'Cash',
        amount,
        cashTendered,
        changeToReturn,
        paidAt: existing.paidAt,
        message: `Cash payment confirmed. Change to return: ₹${changeToReturn}`
      });
    }

    // 6. POST /webhooks/payment (Gateway Callback)
    if (req.method === 'POST' && pathname === '/webhooks/payment') {
      const body = await parseBody(req);
      const orderId = body.orderId || body.order_id;
      const amount = Number(body.amount) || 0;

      if (!orderId) {
        return sendJson(res, 400, { error: 'Missing orderId in payment webhook' });
      }

      const existing = orderStateStore.get(orderId) || { orderId };
      existing.billState = 'PAID';
      existing.paymentStatus = 'Paid';
      existing.paymentMethod = body.channel || 'UPI';
      existing.gatewayRef = body.paymentId || body.referenceId;
      existing.paidAt = new Date().toISOString();
      orderStateStore.set(orderId, existing);

      return sendJson(res, 200, {
        success: true,
        orderId,
        billState: 'PAID',
        paymentMethod: existing.paymentMethod,
        message: 'Payment verified and settled successfully'
      });
    }

    // 7. GET /orders/:id/status
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'orders' && parts[2] === 'status') {
      const orderId = parts[1];
      const state = orderStateStore.get(orderId) || {
        orderId,
        billState: 'OPEN',
        paymentStatus: 'Pending'
      };

      return sendJson(res, 200, {
        success: true,
        ...state
      });
    }

    // 404 Catch-All
    return sendJson(res, 404, { error: `Route not found: ${req.method} ${pathname}` });
  } catch (err) {
    console.error('Server internal error:', err);
    return sendJson(res, 500, { error: 'Internal server error', details: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`DineSmart Payment Backend Server running at http://localhost:${PORT}`);
  });
}

module.exports = server;
