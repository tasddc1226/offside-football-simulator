import type { Db } from '../client.js';

// T-11-454 웹 결제(토스페이먼츠) 주문 읽기 · 쓰기. 아이템 지급 · 회수는 인앱 구매와 같은 grantIapPurchase · revokeIapPurchase.

export type WebPayOrder = {
  orderId: string;
  profileId: string;
  productId: string;
  amount: number;
  status: 'READY' | 'DONE' | 'CANCELED';
  paymentKey: string | null;
};

const COLUMNS = `order_id orderId, profile_id profileId, product_id productId, amount, status,
  payment_key paymentKey`;

export async function createWebPayOrder(
  db: Db,
  o: { orderId: string; profileId: string; productId: string; amount: number; now: string },
) {
  await db.$client
    .prepare(
      `INSERT INTO web_pay_orders (order_id, profile_id, product_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, 'READY', ?)`,
    )
    .bind(o.orderId, o.profileId, o.productId, o.amount, o.now)
    .run();
}

export const webPayOrderOf = (db: Db, orderId: string) =>
  db.$client
    .prepare(`SELECT ${COLUMNS} FROM web_pay_orders WHERE order_id = ?`)
    .bind(orderId)
    .first<WebPayOrder>();

export const webPayOrderByPaymentKey = (db: Db, paymentKey: string) =>
  db.$client
    .prepare(`SELECT ${COLUMNS} FROM web_pay_orders WHERE payment_key = ?`)
    .bind(paymentKey)
    .first<WebPayOrder>();

/** 승인한 주문을 DONE으로. READY인 주문만 바꾼다(같은 결제의 재승인은 그대로). */
export async function markWebPayDone(
  db: Db,
  p: { orderId: string; paymentKey: string; method: string | null; test: boolean; now: string },
) {
  await db.$client
    .prepare(
      `UPDATE web_pay_orders SET status = 'DONE', payment_key = ?, method = ?, test = ?, approved_at = ?
       WHERE order_id = ? AND status = 'READY'`,
    )
    .bind(p.paymentKey, p.method, p.test ? 1 : 0, p.now, p.orderId)
    .run();
}

export async function markWebPayCanceled(db: Db, paymentKey: string, now: string) {
  await db.$client
    .prepare(
      `UPDATE web_pay_orders SET status = 'CANCELED', canceled_at = ?
       WHERE payment_key = ? AND status = 'DONE'`,
    )
    .bind(now, paymentKey)
    .run();
}
