// T-11-159 광고 SDK(AppLovin MAX) 시작과 키. 배너(AdSlot)와 보상형 광고(rewarded)가 같이 쓴다.
// MAX가 AdMob·Meta Audience Network 입찰을 붙여 한 번에 고른다(미디에이션 설정은 MAX 대시보드).
// 맞춤 광고 동의를 받지 않는다 — 모든 지역에서 개인 정보 처리 동의 없음(setHasUserConsent(false))으로 비개인화 광고만 받고,
// iOS 추적 동의 창(ATT)·MAX 약관 흐름도 띄우지 않는다. 시작에 실패하면 광고를 요청하지 않는다.
// 운영자 기기의 테스트 광고는 MAX 미디에이션 디버거의 Test Mode로 켠다(T-11-143 AdMob 테스트 기기 대신).
import { Platform } from 'react-native';
import AppLovinMAX, { Privacy } from 'react-native-applovin-max';

/** MAX SDK 키. 비어 있으면 광고를 모두 끈다(광고 제거 구매자만 보상을 받는다). */
const SDK_KEY = '';

/** MAX 광고 단위. 플랫폼에 단위가 없으면 그 자리 광고를 끈다. */
const UNITS = {
  banner: { ios: '', android: '' },
  candidates: { ios: '', android: '' },
  peek: { ios: '', android: '' },
  boost: { ios: '', android: '' },
};
export type AdPlacement = keyof typeof UNITS;
export const unitOf = (p: AdPlacement) => (SDK_KEY && Platform.select(UNITS[p])) || undefined;

let ready: Promise<boolean> | undefined;
/** SDK를 앱 실행마다 한 번 시작한다. 시작했으면 true. */
export const startAds = () =>
  (ready ??= (async () => {
    Privacy.setHasUserConsent(false);
    Privacy.setDoNotSell(true);
    await AppLovinMAX.initialize(SDK_KEY);
    return true;
  })().catch(() => false));
