import type { Bindings } from '../env.js';
import { recordBillingAlert } from './alerts.js';
import { ANDROID_PACKAGE, getGooglePurchase, getGoogleSubscription } from './google.js';
import { handleGoogleMembershipNotice } from './membership.js';

export async function handleGoogleRtdn(env: Bindings, body: unknown, now: string) {
  const envelope = body as {
    message?: { data?: unknown; messageId?: unknown };
    subscription?: unknown;
  } | null;
  if (typeof envelope?.message?.data !== 'string' || typeof envelope.message.messageId !== 'string')
    return 400;
  let note: {
    packageName?: string;
    testNotification?: object;
    oneTimeProductNotification?: {
      notificationType?: number;
      purchaseToken?: string;
      sku?: string;
    };
    subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
  };
  try {
    note = JSON.parse(atob(envelope.message.data));
  } catch {
    return 400;
  }
  if (note.packageName !== ANDROID_PACKAGE) return 400;
  if (note.testNotification) {
    await recordBillingAlert(
      env,
      {
        store: 'google',
        transactionId: envelope.message.messageId,
        kind: 'test',
        productId: 'Store notification test',
        test: true,
      },
      now,
    );
    return 204;
  }
  if (!env.GOOGLE_PLAY_SA_JSON) return 503;
  const opts = { nowS: Math.floor(Date.parse(now) / 1000) };
  const one = note.oneTimeProductNotification;
  if (
    one?.notificationType === 1 &&
    typeof one.sku === 'string' &&
    typeof one.purchaseToken === 'string'
  ) {
    const purchase = await getGooglePurchase(
      env.GOOGLE_PLAY_SA_JSON,
      one.sku,
      one.purchaseToken,
      opts,
    );
    if (purchase?.purchaseState === 0)
      await recordBillingAlert(
        env,
        {
          store: 'google',
          transactionId: one.purchaseToken,
          kind: 'purchase',
          productId: one.sku,
          test: purchase.purchaseType === 0,
        },
        now,
      );
  }
  const sub = note.subscriptionNotification;
  if (typeof sub?.purchaseToken === 'string') {
    // T-11-512 구독 알림은 종류와 상관없이 지금 상태를 다시 읽어 멤버십을 고친다(갱신 · 유예 · 보류 · 취소 · 환불 · 만료).
    const purchase = await getGoogleSubscription(env.GOOGLE_PLAY_SA_JSON, sub.purchaseToken, opts);
    if (purchase) await handleGoogleMembershipNotice(env, sub.purchaseToken, purchase, now);
    if (
      (sub.notificationType === 2 || sub.notificationType === 4) &&
      purchase?.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE'
    ) {
      for (const line of purchase.lineItems ?? [])
        if (line.productId && line.latestSuccessfulOrderId) {
          await recordBillingAlert(
            env,
            {
              store: 'google',
              transactionId: line.latestSuccessfulOrderId,
              kind: sub.notificationType === 2 ? 'renewal' : 'purchase',
              productId: line.productId,
              test: !!purchase.testPurchase,
            },
            now,
          );
        }
    }
  }
  return 204;
}
