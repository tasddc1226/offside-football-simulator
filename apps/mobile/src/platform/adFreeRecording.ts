import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch, getProfile, cachedGet } from '@offside/app-core/api/client';
import { CONSENT_KEY, parseConsent } from '@offside/app-core/analytics-model';
import { kv } from './setup';
import type { Purchase } from 'expo-iap';
/** Financial first-party recording only. This never logs a Firebase/Meta event. */
export function adFreeRecordingEnabled() {
  try {
    return (
      Constants.expoConfig?.extra?.accountPurchaseRecording === true &&
      parseConsent(kv.getString(CONSENT_KEY)) === 'granted'
    );
  } catch {
    return false;
  }
}
async function acquisitionChoice(): Promise<'granted' | 'denied' | 'unavailable'> {
  const state = await cachedGet<{ granted: boolean }>('/v1/acquisition/consent', 30_000);
  return state.ok ? (state.data.granted ? 'granted' : 'denied') : 'unavailable';
}
export async function adFreeAccount(): Promise<string | undefined> {
  if (!adFreeRecordingEnabled()) return undefined;
  try {
    const consent = await cachedGet<{ granted: boolean; profileId: string }>(
      '/v1/acquisition/consent',
      30_000,
    );
    if (!consent.ok || !consent.data.granted || !adFreeRecordingEnabled()) return undefined;
    const result = await getProfile();
    if (!result.ok || result.data.id !== consent.data.profileId || !adFreeRecordingEnabled())
      return undefined;
    const id = result.ok ? result.data.id.replace(/^prf_/, '') : '';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  } catch {
    return undefined;
  }
}
/** False keeps the StoreKit transaction pending, so a crash/offline result can retry on next sync. */
export async function recordAdFree(p: Purchase): Promise<boolean> {
  if (!adFreeRecordingEnabled()) return true;
  if (!p.purchaseToken || p.purchaseState !== 'purchased') return false;
  try {
    const choice = await acquisitionChoice();
    if (!adFreeRecordingEnabled()) return true;
    if (choice === 'denied') return true;
    if (choice === 'unavailable') return false;
    return (
      await apiFetch('/v1/iap/ad-free/record', {
        method: 'POST',
        keepCache: true,
        body: JSON.stringify({
          store: Platform.OS === 'ios' ? 'apple' : 'google',
          token: p.purchaseToken,
        }),
      })
    ).ok;
  } catch {
    return false;
  }
}
