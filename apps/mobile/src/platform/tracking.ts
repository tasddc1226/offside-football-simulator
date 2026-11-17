// T-11-740 iOS 앱 추적 허용(ATT) 창을 앱이 직접 띄운다.
// T-11-698은 AdMob 동의 확인(UMP)의 IDFA 설명 메시지가 ATT 창을 띄우게 두었는데, 그 메시지는 광고를 처음 요청할 때만 열리고
// 콘솔 설정 · 지역에 따라 아예 안 열릴 수 있다. 1.1.9 심사(iPad, iPadOS 27.2.1)에서 창을 찾지 못해 2.1로 반려됐다.
// 그래서 첫 화면이 뜬 뒤 '아직 묻지 않음'이면 한 번 묻고, 광고 동의 확인(adConsent)은 이 답을 기다린 뒤 진행한다.
import { AppState, Platform } from 'react-native';

/** 앱이 활성 상태가 될 때까지 기다린다. 비활성 상태에서 요청하면 iOS가 창 없이 거부로 돌려준다. */
function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      sub.remove();
      resolve();
    });
  });
}

let asked: Promise<boolean> | undefined;
/**
 * iOS 추적 허용 여부. 아직 묻지 않았으면 창을 띄우고 답을 돌려준다(앱 실행마다 한 번만 확인).
 * 추적 모듈이 없는 옛 스토어 빌드(OTA)와 iOS가 아닌 기기는 허용하지 않은 것으로 본다.
 */
export const askTracking = () =>
  (asked ??= (async () => {
    if (Platform.OS !== 'ios') return false;
    try {
      const tt = await import('expo-tracking-transparency');
      if (!tt.isAvailable()) return false;
      const now = await tt.getTrackingPermissionsAsync();
      if (now.status !== 'undetermined') return now.granted;
      await whenActive();
      // 첫 화면이 그려진 뒤 띄워야 창이 확실히 보인다(스플래시가 걷히는 중에는 무시될 수 있다).
      await new Promise((r) => setTimeout(r, 600));
      return (await tt.requestTrackingPermissionsAsync()).granted;
    } catch {
      return false;
    }
  })());
