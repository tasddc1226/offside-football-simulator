import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch, getProfile, cachedGet } from '@offside/app-core/api/client';
import { CONSENT_KEY, parseConsent } from '@offside/app-core/analytics-model';
import { REMOVE_ADS_PRODUCT_ID } from '@offside/contracts/cup';
import { kv } from './setup';
import { onSessionChanged } from './session';
import type { Purchase } from 'expo-iap';
const KEY = 'offside_ad_free_records_v1';
const MAX_AGE = 7 * 86400_000;
const MAX_RECORDS = 16;
type Choice = { granted: boolean; profileId: string };
type Entry = { store: 'apple' | 'google'; token: string; profileId: string; queuedAt: number };
let consentProfile: string | null = null;
let generation = 0;
let flushing: Promise<void> | null = null;
/** Financial first-party recording only; store acknowledgement never depends on this queue. */
export function adFreeRecordingEnabled() {
  try {
    return (
      (Platform.OS === 'ios' || Platform.OS === 'android') &&
      Constants.expoConfig?.extra?.accountPurchaseRecording === true &&
      parseConsent(kv.getString(CONSENT_KEY)) === 'granted'
    );
  } catch {
    return false;
  }
}
function entries(): Entry[] {
  try {
    const rows: unknown = JSON.parse(kv.getString(KEY) ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (e): e is Entry =>
          e &&
          (e.store === 'apple' || e.store === 'google') &&
          typeof e.token === 'string' &&
          e.token.length > 0 &&
          e.token.length <= 16384 &&
          typeof e.profileId === 'string' &&
          typeof e.queuedAt === 'number' &&
          e.queuedAt <= Date.now() &&
          e.queuedAt >= Date.now() - MAX_AGE,
      )
      .slice(-MAX_RECORDS);
  } catch {
    return [];
  }
}
function save(rows: Entry[]) {
  if (rows.length) kv.set(KEY, JSON.stringify(rows));
  else kv.remove(KEY);
}
function clear() {
  generation++;
  consentProfile = null;
  try {
    kv.remove(KEY);
  } catch {
    /* Collection fails closed when storage is unavailable. */
  }
}
const same = (a: Entry, b: Entry) => a.store === b.store && a.token === b.token;
function enqueue(e: Entry) {
  const rows = entries();
  if (!rows.some((x) => same(x, e))) save([...rows, e].slice(-MAX_RECORDS));
}
onSessionChanged(clear);
try {
  kv.addOnValueChangedListener((key) => {
    if (key === CONSENT_KEY && !adFreeRecordingEnabled()) clear();
  });
} catch {
  /* Older/mock runtimes still check before every request. */
}
async function choice() {
  return cachedGet<Choice>('/v1/acquisition/consent', 30_000);
}
export async function adFreeAccount(): Promise<string | undefined> {
  if (!adFreeRecordingEnabled()) {
    clear();
    return undefined;
  }
  const rev = generation;
  try {
    const consent = await choice();
    if (!consent.ok || !consent.data.granted || !adFreeRecordingEnabled() || rev !== generation)
      return undefined;
    const result = await getProfile();
    if (
      !result.ok ||
      result.data.id !== consent.data.profileId ||
      !adFreeRecordingEnabled() ||
      rev !== generation
    )
      return undefined;
    consentProfile = result.data.id;
    const id = result.data.id.replace(/^prf_/, '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  } catch {
    return undefined;
  }
}
/** Retry only on real app/store activity; no timer or login creation. */
export function flushAdFreeRecords(known?: Choice): Promise<void> {
  if (!adFreeRecordingEnabled()) {
    clear();
    return Promise.resolve();
  }
  if (!entries().length) {
    save([]);
    return Promise.resolve();
  }
  if (flushing) return flushing;
  const rev = generation;
  flushing = (async () => {
    const result = known ? { ok: true as const, data: known } : await choice();
    if (rev !== generation) return;
    if (!adFreeRecordingEnabled()) {
      clear();
      return;
    }
    if (!result.ok) return;
    if (!result.data.granted) {
      clear();
      return;
    }
    save(entries()); // Also remove expired/corrupt records without sending them.
    for (const e of entries()) {
      if (rev !== generation || !adFreeRecordingEnabled()) return;
      if (e.profileId !== result.data.profileId) continue;
      const r = await apiFetch('/v1/iap/ad-free/record', {
        method: 'POST',
        keepCache: true,
        body: JSON.stringify({ store: e.store, token: e.token, profileId: e.profileId }),
      });
      if (rev !== generation) return;
      if (r.ok) save(entries().filter((x) => !same(x, e)));
    }
  })()
    .catch(() => {})
    .finally(() => {
      flushing = null;
    });
  return flushing;
}
/** The return value concerns optional analytics only, never finishTransaction/entitlement. */
export async function recordAdFree(p: Purchase): Promise<boolean> {
  if (!adFreeRecordingEnabled()) {
    clear();
    return true;
  }
  if (
    p.productId !== REMOVE_ADS_PRODUCT_ID ||
    p.purchaseState !== 'purchased' ||
    !p.purchaseToken ||
    p.purchaseToken.length > 16384
  )
    return false;
  const rev = generation;
  const pending: Entry = {
    store: Platform.OS === 'ios' ? 'apple' : 'google',
    token: p.purchaseToken,
    profileId: consentProfile ?? '',
    queuedAt: Date.now(),
  };
  try {
    // A purchase preflight already established this consent/account. Persist synchronously
    // before the caller starts finishTransaction, even if the next request hangs.
    if (pending.profileId) enqueue(pending);
    const state = await choice();
    if (rev !== generation) return true;
    if (!adFreeRecordingEnabled()) {
      clear();
      return true;
    }
    if (!state.ok) return false;
    if (!state.data.granted) {
      clear();
      return true;
    }
    if (pending.profileId && pending.profileId !== state.data.profileId) return false;
    pending.profileId = state.data.profileId;
    consentProfile = state.data.profileId;
    enqueue(pending);
    await flushAdFreeRecords(state.data);
    return !entries().some((x) => same(x, pending));
  } catch {
    return false;
  }
}
