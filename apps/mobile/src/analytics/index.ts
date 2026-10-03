import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createNativeAnalytics, type NativeAnalyticsSDK } from '@offside/app-core/analytics-native';
import {
  CONSENT_KEY,
  LEDGER_KEY,
  emptyLedger,
  type Ledger,
} from '@offside/app-core/analytics-model';
import { kv } from '../platform/setup';

// No web measurement ID, user ID, URL, campaign or gameplay state crosses this boundary.
const configured = Constants.expoConfig?.extra?.nativeAnalytics;
function enabled() {
  return (
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    configured?.[Platform.OS] === true &&
    configured?.enabled === true &&
    (!__DEV__ || configured?.environment === 'test')
  );
}
async function load(): Promise<NativeAnalyticsSDK | null> {
  try {
    const app = await import('@react-native-firebase/app');
    const api = await import('@react-native-firebase/analytics');
    if (!app.getApps().length) return null;
    const analytics = api.getAnalytics(app.getApp());
    return {
      collect: (value) => api.setAnalyticsCollectionEnabled(analytics, value),
      consent: async (value) =>
        api.setConsent(analytics, {
          analytics_storage: value,
          ad_storage: false,
          ad_user_data: false,
          ad_personalization: false,
        }),
      reset: () => api.resetAnalyticsData(analytics),
      // RNFirebase 26 modular logEvent discards its native Promise. Use the instance
      // method here so rejection is contained and SDK shutdown can serialize with it.
      event: (name, params) => analytics.logEvent(name, params),
    };
  } catch {
    return null;
  } // Expo Go, old binaries, missing native app or service configuration.
}
function readLedger(): Ledger {
  const raw = kv.getString(LEDGER_KEY);
  if (!raw) return emptyLedger();
  try {
    const value = JSON.parse(raw) as Ledger;
    if (
      !value ||
      !Array.isArray(value.entries) ||
      typeof value.seenStart !== 'boolean' ||
      !value.entries.every((e) => e && typeof e.id === 'string' && Number.isFinite(e.at))
    )
      return emptyLedger();
    if (
      value.next &&
      value.next.kind !== 'replace_active' &&
      !(
        value.next.kind === 'after_retirement' &&
        typeof value.next.id === 'string' &&
        typeof value.next.pos === 'string' &&
        typeof value.next.trait === 'string'
      )
    )
      value.next = null;
    return value;
  } catch {
    return emptyLedger();
  }
}
export const nativeAnalytics = createNativeAnalytics({
  enabled,
  load,
  readConsent: () => {
    const value = kv.getString(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  },
  writeConsent: (value) => kv.set(CONSENT_KEY, value),
  readLedger,
  writeLedger: (value) => kv.set(LEDGER_KEY, JSON.stringify(value)),
  now: Date.now,
  appVersion: Constants.expoConfig?.version ?? 'unknown',
});
export const { analytics, trackPage } = nativeAnalytics;
