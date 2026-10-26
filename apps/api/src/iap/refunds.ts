import { REMOVE_ADS_PRODUCT_ID } from '@offside/contracts/cup';
import { markPurchaseRefund } from '../db/repos/adFreePurchases.js';
// ───────── 인앱 상품 환불 회수 (T-11-215) ─────────
// 소모성 상품을 환불받고도 아이템을 계속 쓰지 못하게, 스토어가 알려 준 환불 거래의 아이템을 회수한다(이용약관 1항).
// Apple은 App Store 서버 알림(REFUND)을 바로 받고, Google은 매일 cron이 무효화된 구매 목록을 읽는다. 회수는 거래마다 한 번이고
// 지금 가진 장수 안에서만 뺀다(repos/iap.ts revokeIapPurchase).
import { recordBillingAlert } from './alerts.js';
import { DEFAULT_BUNDLE_ID } from '../auth/apple-id-token.js';
import type { Db } from '../db/client.js';
import { revokeIapPurchase, type IapRevoke } from '../db/repos/iap.js';
import { revokeSeasonPass } from '../db/repos/seasonPass.js';
import type { Bindings } from '../env.js';
import { APPLE_ROOT_G3_SHA256, verifyAppleNotification, verifyAppleTransaction } from './apple.js';
import { listVoidedPurchases } from './google.js';

const log = (job: string, fields: Record<string, unknown>) =>
  console.log(JSON.stringify({ level: 'info', job, ...fields }));

/** 회수 결과 로그(선수명·토큰 원문 없이 거래 id 끝자리만). */
const summary = (r: IapRevoke) =>
  r.found ? { already: r.already, item: r.item, qty: r.qty, revoked: r.revoked } : { found: false };

export type AppleNotifyResult = 'invalid' | 'ignored' | 'revoked';

/**
 * App Store 서버 알림 한 건. 서명이 맞지 않으면 invalid(400), 다른 앱이거나 환불이 아니면 ignored, 환불이면 회수.
 * appleRoot는 테스트만 바꾼다.
 */
export async function handleAppleNotification(
  env: Bindings,
  db: Db,
  signedPayload: string,
  now: string,
  appleRoot = APPLE_ROOT_G3_SHA256,
): Promise<AppleNotifyResult> {
  const note = await verifyAppleNotification(signedPayload, appleRoot);
  if (!note) return 'invalid';
  if (note.data?.bundleId !== (env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID)) return 'ignored';
  if (env.BILLING_ALERTS_ENABLED === '1') {
    if (note.notificationType === 'TEST' && note.notificationUUID) {
      await recordBillingAlert(
        env,
        {
          store: 'apple',
          transactionId: note.notificationUUID,
          kind: 'test',
          productId: 'Store notification test',
          test: true,
        },
        now,
      );
    } else if (
      ['ONE_TIME_CHARGE', 'SUBSCRIBED', 'DID_RENEW', 'REFUND'].includes(
        note.notificationType ?? '',
      ) &&
      note.data?.signedTransactionInfo
    ) {
      const tx = await verifyAppleTransaction(note.data.signedTransactionInfo, appleRoot);
      if (
        !tx ||
        tx.bundleId !== (env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID) ||
        !tx.transactionId ||
        !tx.productId ||
        !['Production', 'Sandbox'].includes(tx.environment ?? '') ||
        tx.environment !== note.data.environment
      )
        return 'invalid';
      await recordBillingAlert(
        env,
        {
          store: 'apple',
          transactionId: String(tx.transactionId),
          kind:
            note.notificationType === 'REFUND'
              ? 'refund'
              : note.notificationType === 'DID_RENEW'
                ? 'renewal'
                : 'purchase',
          productId: tx.productId,
          test: tx.environment === 'Sandbox',
        },
        now,
      );
    }
  }
  if (note.notificationType !== 'REFUND' || !note.data.signedTransactionInfo) {
    log('iap-apple-notify', { type: note.notificationType ?? null, handled: false });
    return 'ignored';
  }
  const tx = await verifyAppleTransaction(note.data.signedTransactionInfo, appleRoot);
  if (!tx?.transactionId) return 'invalid';
  await markPurchaseRefund(
    db.$client,
    'apple',
    String(
      tx.productId === REMOVE_ADS_PRODUCT_ID
        ? (tx.originalTransactionId ?? tx.transactionId)
        : tx.transactionId,
    ),
    now,
  );
  // T-11-511 시즌 패스 거래면 패스를 닫고 그 패스로 받은 아이템을 회수한다.
  if (await revokeSeasonPass(db, 'apple', String(tx.transactionId), now)) {
    log('pass-refund', { store: 'apple', tx: String(tx.transactionId).slice(-6) });
    return 'revoked';
  }
  const r = await revokeIapPurchase(db, 'apple', String(tx.transactionId), now);
  log('iap-refund', { store: 'apple', tx: String(tx.transactionId).slice(-6), ...summary(r) });
  return 'revoked';
}

/** Google이 무효화 목록을 보관하는 기간 안에서, 매일 cron이 겹쳐 읽는 범위(하루 실패해도 다음 날 다시 본다). */
export const GOOGLE_VOIDED_WINDOW_MS = 7 * 24 * 3600 * 1000;

/** 최근 무효화된 Google 구매를 회수한다. 서비스 계정 키가 없으면 건너뛴다. */
export async function syncGoogleVoided(
  env: Bindings,
  db: Db,
  nowMs: number,
  fetcher?: typeof fetch,
): Promise<{ seen: number; revoked: number; unknown: number } | 'skipped'> {
  const sa = env.GOOGLE_PLAY_SA_JSON;
  if (!sa) return 'skipped';
  const list = await listVoidedPurchases(sa, nowMs - GOOGLE_VOIDED_WINDOW_MS, {
    // A recovered daily job can carry an old business date; OAuth must be issued now.
    nowS: Math.floor(Date.now() / 1000),
    ...(fetcher ? { fetcher } : {}),
  });
  const now = new Date(nowMs).toISOString();
  let revoked = 0;
  let unknown = 0;
  for (const v of list) {
    await markPurchaseRefund(env.DB, 'google', v.purchaseToken, now);
    // T-11-511 시즌 패스 거래(무효화 목록에 매일 겹쳐 나온다 — 닫는 건 한 번뿐이다).
    if (await revokeSeasonPass(db, 'google', v.purchaseToken, now)) continue;
    const r = await revokeIapPurchase(db, 'google', v.purchaseToken, now);
    if (env.BILLING_ALERTS_ENABLED === '1' && r.found) {
      const row = await env.DB.prepare(
        'SELECT product_id, test FROM iap_purchases WHERE store = ? AND transaction_id = ?',
      )
        .bind('google', v.purchaseToken)
        .first<{ product_id: string; test: number }>();
      if (row)
        await recordBillingAlert(
          env,
          {
            store: 'google',
            transactionId: v.purchaseToken,
            kind: 'refund',
            productId: row.product_id,
            test: !!row.test,
          },
          now,
        );
    }
    if (!r.found) unknown++;
    else if (!r.already) {
      revoked++;
      log('iap-refund', { store: 'google', ...summary(r) });
    }
  }
  return { seen: list.length, revoked, unknown };
}
