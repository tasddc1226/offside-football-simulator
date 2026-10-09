// ───────── 인앱 상품 구매 확인 (T-11-174) ─────────
// 앱이 보낸 스토어 거래를 스토어 기준으로 확인한다. 상품 · 앱 · 구단주 표시(account)가 맞고 결제가 끝난 거래만 통과한다.
import type { IapClaimBody, IapStore } from '@offside/contracts';
import { DEFAULT_BUNDLE_ID } from '../auth/apple-id-token.js';
import type { Bindings } from '../env.js';
import { APPLE_ROOT_G3_SHA256, verifyAppleTransaction } from './apple.js';
import { acknowledgeGooglePurchase, getGooglePurchase } from './google.js';

export type IapRejection = 'INVALID' | 'PENDING' | 'OTHER_ACCOUNT';

export type IapVerdict =
  | {
      ok: true;
      transactionId: string;
      /** 한 거래에 산 개수(보통 1). */
      quantity: number;
      /** Apple Sandbox · Google 테스트 구매. */
      test: boolean;
      /** 아이템을 준 뒤 스토어에 알릴 일(Google 승인). 없으면 undefined. */
      after?: () => Promise<void>;
    }
  | { ok: false; reason: IapRejection };

/** 이 구단주가 살 수 있는 스토어. Google은 서비스 계정 키가 있어야 하고, IAP_TESTERS가 있으면 그 구단주만 산다. */
export function iapStores(env: Bindings, profileId: string): IapStore[] {
  if (env.IAP_TESTERS && !env.IAP_TESTERS.split(',').some((id) => id.trim() === profileId))
    return [];
  return env.GOOGLE_PLAY_SA_JSON ? ['apple', 'google'] : ['apple'];
}

/** 구단주 표시: 프로필 id(prf_<uuid>)의 uuid. Apple appAccountToken은 uuid여야 한다. */
export const iapAccount = (profileId: string) => profileId.replace(/^prf_/, '');

const quantityOf = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 1);

/**
 * 거래를 확인한다. 스토어에 닿지 못하면 던진다(앱이 다음 실행 때 다시 보낸다).
 * opts.appleRoot · fetcher는 테스트만 바꾼다.
 */
export async function verifyIapClaim(
  env: Bindings,
  input: IapClaimBody,
  account: string,
  opts: { nowS: number; fetcher?: typeof fetch; appleRoot?: string },
): Promise<IapVerdict> {
  if (input.store === 'apple') {
    const tx = await verifyAppleTransaction(input.token, opts.appleRoot ?? APPLE_ROOT_G3_SHA256);
    if (
      !tx ||
      tx.bundleId !== (env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID) ||
      tx.productId !== input.productId ||
      tx.type !== 'Consumable' ||
      tx.revocationDate ||
      !tx.transactionId
    )
      return { ok: false, reason: 'INVALID' };
    if (tx.appAccountToken?.toLowerCase() !== account.toLowerCase())
      return { ok: false, reason: 'OTHER_ACCOUNT' };
    return {
      ok: true,
      transactionId: String(tx.transactionId),
      quantity: quantityOf(tx.quantity),
      test: tx.environment !== 'Production',
    };
  }
  const sa = env.GOOGLE_PLAY_SA_JSON;
  if (!sa) throw new Error('GOOGLE_PLAY_SA_JSON missing');
  const p = await getGooglePurchase(sa, input.productId, input.token, opts);
  if (!p || p.purchaseState === 1) return { ok: false, reason: 'INVALID' };
  if (p.purchaseState === 2) return { ok: false, reason: 'PENDING' };
  if (p.purchaseState !== 0) return { ok: false, reason: 'INVALID' };
  if (p.obfuscatedExternalAccountId !== account) return { ok: false, reason: 'OTHER_ACCOUNT' };
  return {
    ok: true,
    // purchaseToken이 구매마다 하나다(orderId는 테스트 구매에 없을 수 있다).
    transactionId: input.token,
    quantity: quantityOf(p.quantity),
    test: p.purchaseType === 0,
    ...(p.acknowledgementState === 0
      ? { after: () => acknowledgeGooglePurchase(sa, input.productId, input.token, opts) }
      : {}),
  };
}
