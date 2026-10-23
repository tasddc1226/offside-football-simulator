import type { Db } from '../client.js';

// T-11-454 웹 결제(엑솔라) 주문 읽기 · 쓰기. 아이템 지급 · 회수는 인앱 구매와 같은 grantIapPurchase · revokeIapPurchase.

export type WebPayOrder = {
  orderId: string;
  profileId: string;
  productId: string;
  xsollaOrderId: string;
  status: 'READY' | 'PAID' | 'CANCELED';
};

const COLUMNS = `order_id orderId, profile_id profileId, product_id productId, xsolla_order_id xsollaOrderId, status`;

export async function createWebPayOrder(
  db: Db,
  o: {
    orderId: string;
    profileId: string;
    productId: string;
    xsollaOrderId: string;
    test: boolean;
    now: string;
  },
) {
  await db.$client
    .prepare(
      `INSERT INTO web_pay_orders (order_id, profile_id, product_id, xsolla_order_id, status, test, created_at)
       VALUES (?, ?, ?, ?, 'READY', ?, ?)`,
    )
    .bind(o.orderId, o.profileId, o.productId, o.xsollaOrderId, o.test ? 1 : 0, o.now)
    .run();
}

export const webPayOrderOf = (db: Db, orderId: string) =>
  db.$client
    .prepare(`SELECT ${COLUMNS} FROM web_pay_orders WHERE order_id = ?`)
    .bind(orderId)
    .first<WebPayOrder>();

export const webPayOrderByXsollaId = (db: Db, xsollaOrderId: string) =>
  db.$client
    .prepare(`SELECT ${COLUMNS} FROM web_pay_orders WHERE xsolla_order_id = ?`)
    .bind(xsollaOrderId)
    .first<WebPayOrder>();

/** 결제된 주문을 PAID로(READY만 바꾼다 — 같은 웹훅을 다시 받아도 그대로). */
export async function markWebPayPaid(db: Db, xsollaOrderId: string, now: string) {
  await db.$client
    .prepare(
      `UPDATE web_pay_orders SET status = 'PAID', paid_at = ? WHERE xsolla_order_id = ? AND status = 'READY'`,
    )
    .bind(now, xsollaOrderId)
    .run();
}

/**
 * 환불 · 차지백된 주문을 CANCELED로. 결제 웹훅보다 취소가 먼저 와도 나중 지급이 아이템을 주지 않게 환불 표시를 같이 남긴다
 * (grantIapPurchase가 iap_refund_markers를 본다).
 */
export async function markWebPayCanceled(
  db: Db,
  store: string,
  xsollaOrderId: string,
  now: string,
) {
  const d1 = db.$client;
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO iap_refund_markers (store, transaction_id, refunded_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(store, xsollaOrderId, now),
    d1
      .prepare(
        `UPDATE web_pay_orders SET status = 'CANCELED', canceled_at = ?
         WHERE xsolla_order_id = ? AND status != 'CANCELED'`,
      )
      .bind(now, xsollaOrderId),
  ]);
}
