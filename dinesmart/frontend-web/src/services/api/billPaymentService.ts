/**
 * DineSmart Bill Payment API Client Service
 * Encapsulates the 6 standard full-stack payment lifecycle endpoints:
 * 1. POST /orders/:id/request-payment (Customer)
 * 2. POST /orders/:id/accept-payment (Waiter APK)
 * 3. POST /orders/:id/generate-upi-qr (Waiter APK / Customer)
 * 4. POST /orders/:id/pay-cash (Waiter APK)
 * 5. POST /webhooks/payment (Gateway/Callback simulation)
 * 6. GET  /orders/:id/status (Customer & Waiter live poll)
 */

import { db } from '../../supabase';
import { Order } from '../../types';

export interface BillPaymentStatus {
  orderId: string;
  tableId: string;
  total: number;
  billState: 'OPEN' | 'PAYMENT_REQUESTED' | 'ACCEPTED' | 'PAID' | 'FAILED' | 'EXPIRED';
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod?: string;
  acceptedByWaiterId?: string;
  acceptedByWaiterName?: string;
  paidAt?: string;
}

export interface UpiQrResponse {
  success: boolean;
  orderId: string;
  tableId: string;
  amount: number;
  qrPayload: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface CashPaymentResult {
  success: boolean;
  orderId: string;
  tableId: string;
  amount: number;
  cashTendered: number;
  changeToReturn: number;
  billState: 'PAID';
  paidAt: string;
}

export const billPaymentApi = {
  /**
   * 1. Customer initiates bill settlement request
   * State Transition: OPEN -> PAYMENT_REQUESTED
   */
  requestPayment: async (orderId: string, tableId: string, method: string = 'Cash'): Promise<{ success: boolean; order: Order | null; billState: string }> => {
    // 1. Mark order with payment requested state in Supabase
    const order = await db.markOrderPaymentRequested(orderId, method);
    // 2. Insert or update the active waiter request for this table
    await db.requestWaiter(tableId, 'Request Bill');

    return {
      success: true,
      order,
      billState: 'PAYMENT_REQUESTED'
    };
  },

  /**
   * 2. Waiter accepts the payment request
   * State Transition: PAYMENT_REQUESTED -> ACCEPTED
   */
  acceptPayment: async (
    orderId: string,
    waiterId: string,
    waiterName: string
  ): Promise<{ success: boolean; order: Order | null; billState: string }> => {
    const order = await db.markOrderPaymentAccepted(orderId, waiterId, waiterName);
    return {
      success: true,
      order,
      billState: 'ACCEPTED'
    };
  },

  /**
   * 3. Generate dynamic bill QR code for exact total
   * Generates unique payment URL link with 5-minute expiry
   */
  generateUpiQr: (orderId: string, tableId: string, amount: number): UpiQrResponse => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tabletap.vercel.app';
    const qrPayload = `${origin}/pay/${encodeURIComponent(orderId)}?table=${encodeURIComponent(tableId)}&amount=${amount.toFixed(2)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return {
      success: true,
      orderId,
      tableId,
      amount,
      qrPayload,
      expiresAt,
      expiresInSeconds: 300
    };
  },

  /**
   * 4. Waiter collects cash and confirms settlement
   * State Transition: ACCEPTED -> PAID (method: CASH)
   */
  payCash: async (
    orderId: string,
    tableId: string,
    amount: number,
    cashTendered: number,
    waiterId: string = 'WTR-01',
    waiterName: string = 'Staff Waiter'
  ): Promise<CashPaymentResult> => {
    const changeToReturn = Math.max(0, cashTendered - amount);

    // 1. Mark order paid in Supabase
    await db.payOrder(orderId, 'Cash', { id: waiterId, name: waiterName });

    // 2. Record ledger transaction
    await db.recordPaymentTransaction({
      orderId,
      tableId,
      channel: 'CASH',
      amount,
      cashTendered,
      cashChangeReturned: changeToReturn,
      waiterId,
      waiterName
    });

    // 3. Release table session
    const numericTableId = parseInt(tableId, 10) || 5;
    await db.releaseTableSession(numericTableId);

    // 4. Notify app listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dinesmart_order_paid', {
        detail: { orderId, tableId, method: 'Cash', amount }
      }));
    }

    return {
      success: true,
      orderId,
      tableId,
      amount,
      cashTendered,
      changeToReturn,
      billState: 'PAID',
      paidAt: new Date().toISOString()
    };
  },

  /**
   * 5. Gateway / QR webhook settlement
   * State Transition: ANY -> PAID (method: UPI)
   */
  handlePaymentWebhook: async (
    orderId: string,
    tableId: string,
    amount: number,
    gatewayRef?: string
  ): Promise<{ success: boolean; billState: string }> => {
    await db.payOrder(orderId, 'UPI');
    await db.recordPaymentTransaction({
      orderId,
      tableId,
      channel: 'UPI',
      amount
    });
    const numericTableId = parseInt(tableId, 10) || 5;
    await db.releaseTableSession(numericTableId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dinesmart_order_paid', {
        detail: { orderId, tableId, method: 'UPI', amount, gatewayRef }
      }));
    }

    return {
      success: true,
      billState: 'PAID'
    };
  },

  /**
   * 6. Live Order / Bill status polling
   * Returns current payment and bill lifecycle state
   */
  getStatus: async (orderId: string): Promise<BillPaymentStatus | null> => {
    const order = await db.getOrder(orderId);
    if (!order) return null;

    return {
      orderId: order.id,
      tableId: order.tableId,
      total: order.total,
      billState: (order.billState as any) || (order.paymentStatus === 'Paid' ? 'PAID' : 'OPEN'),
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      acceptedByWaiterId: order.acceptedByWaiterId,
      acceptedByWaiterName: order.acceptedByWaiterName,
      paidAt: order.paidAt
    };
  }
};
