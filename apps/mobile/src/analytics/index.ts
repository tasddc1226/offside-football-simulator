import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createNativeAnalytics, type NativeAnalyticsSDK } from '@offside/app-core/analytics-native';
import {
  CONSENT_KEY,
  LEDGER_KEY,
  parseConsent,
  parseLedger,
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
export const nativeAnalytics = createNativeAnalytics({
  enabled,
  load,
  readConsent: () => parseConsent(kv.getString(CONSENT_KEY)),
  writeConsent: (value) => kv.set(CONSENT_KEY, value),
  readLedger: () => parseLedger(kv.getString(LEDGER_KEY)),
  writeLedger: (value) => kv.set(LEDGER_KEY, JSON.stringify(value)),
  now: Date.now,
  appVersion: Constants.expoConfig?.version ?? 'unknown',
});
export const { analytics, trackPage } = nativeAnalytics;
