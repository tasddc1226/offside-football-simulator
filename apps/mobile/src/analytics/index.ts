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
// 1.0.2 호환 번들: 이 빌드에는 Firebase 네이티브 모듈이 없다.
async function load(): Promise<NativeAnalyticsSDK | null> {
  return null;
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
