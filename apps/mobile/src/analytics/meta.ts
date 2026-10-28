// T-11-563 Meta 앱 이벤트(안드로이드 앱 설치 광고의 설치 측정). 앱 이용 분석에 동의한 동안만 SDK를 켠다.
// 네이티브 모듈(modules/meta-app-events)은 1.1.6 빌드부터 있다. 옛 빌드 · iOS에서는 모듈이 없어 아무것도 하지 않는다.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { nativeAnalytics } from './index';

type MetaAppEvents = { setEnabled(enabled: boolean): boolean };

const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<MetaAppEvents>('MetaAppEvents') : null;
let applied: boolean | undefined;

function sync() {
  const on = nativeAnalytics.enabled() && nativeAnalytics.getConsent() === 'granted';
  if (!native || on === applied) return;
  try {
    if (native.setEnabled(on)) applied = on;
  } catch {
    /* 측정은 선택 기능이다 */
  }
}

/** 부팅 때 한 번(분석 초기화 뒤). 지금 동의 상태를 맞추고, 동의를 바꾸면 따라간다. */
export function startMetaAppEvents() {
  sync();
  nativeAnalytics.onConsent(sync);
}
