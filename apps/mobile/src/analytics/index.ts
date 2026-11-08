import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createNativeAnalytics, type NativeAnalyticsSDK } from '@offside/app-core/analytics-native';
import {
  CONSENT_KEY,
  LEDGER_KEY,
  parseConsent,
  parseLedger,
} from '@offside/app-core/analytics-model';
import { subscribe } from 'valtio';
import { onClubSignal, setClubAccountKey } from '@offside/app-core/clubSignals';
import { profileKey } from '@offside/app-core/retireExperiment';
import { RETIRE_EXP_STORE } from '@offside/app-core/retireExpMetrics';
import { kv } from '../platform/setup';
import { accountCache } from '../store';

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
  readRetireExp: () => kv.getString(RETIRE_EXP_STORE) ?? null,
  writeRetireExp: (raw) =>
    raw === null ? kv.remove(RETIRE_EXP_STORE) : kv.set(RETIRE_EXP_STORE, raw),
  retireAccountKey: () => accountKeyNow(),
  // host가 이 모듈을 import하므로 순환을 피해 필요할 때만 불러온다(5분 메모 계정 확인).
  retireNeedAccount: () => {
    void import('../game/host').then((m) => m.ensureAccount()).catch(() => {});
  },
});
export const { analytics, trackPage } = nativeAnalytics;
/** 강화권 · 스카우트권 구매 퍼널(@offside/app-core/commerceStage). 동의 · SDK 실패는 결제에 닿지 않는다. */
export const trackCommerce: typeof nativeAnalytics.commerce = (o, alive) =>
  nativeAnalytics.commerce(o, alive);
/** 이용 분석 동의가 바뀔 때(구매 퍼널이 진행 중 시도 · 서버 확인 중 표를 버린다). */
export const onAnalyticsConsent = (fn: () => void) => nativeAnalytics.onConsent(fn);
/** T-11-669 지금 계정 키(원래 ID가 아니라 profileKey). null = 계정 없음, undefined = 확인 중 · 연결 실패. */
function accountKeyNow(): string | null | undefined {
  const p = accountCache.value;
  if (p === undefined || p === 'error') return undefined;
  return p ? profileKey(p.id) : null;
}
/** T-11-669 은퇴 화면 실험 계측(웹 analytics retireExp와 같은 이벤트). */
export const { retireExp } = nativeAnalytics;
setClubAccountKey(accountKeyNow);
// 서버가 팀 저장 · 구단 경기 결과를 돌려준 순간(api/team). 요청 당시 계정 키와 함께 넘긴다.
onClubSignal((sig, requestKey) => retireExp.club(sig, requestKey));
// 계정 확인 결과가 바뀌면(로그인 · 로그아웃 · 삭제 · 다른 계정) 이전 노출 귀속을 지운다.
subscribe(accountCache, () => retireExp.account(accountKeyNow()));
