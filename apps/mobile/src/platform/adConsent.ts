// T-11-068 광고 동의(UMP). EEA·영국·스위스는 AdMob 'OFFSIDE 유럽 동의' 메시지를 처음 광고를 요청할 때 한 번 띄운다.
// 배너(AdSlot)와 보상형 광고(T-11-079 rewardedPeek)가 같이 쓴다. 확인은 앱 실행마다 한 번, 대상 지역이 아니면 창 없이 끝난다.
// 확인에 실패하면 광고를 요청하지 않는다.
// T-11-143 운영자 기기는 실제 광고 대신 테스트 광고를 받는다(무효 트래픽 방지). 앱을 지웠다 깔면 ID가 바뀔 수 있다.
// ID는 기기 로그의 "<Google> To get test ads on this device" 줄에서 찾는다(해시값이라 비밀값 아님).
// T-11-478 동의 뒤 SDK를 초기화하고 광고를 요청한다. 미디에이션 어댑터(Meta · Liftoff · Pangle)는 초기화 때 준비되므로,
// 초기화 없이 바로 요청하면 첫 요청에 입찰 신호가 빠진다. 초기화가 늦어도 광고를 막지 않게 INIT_WAIT_MS까지만 기다린다.
// T-11-632 · T-11-687 요청 옵션은 여기서 정한다. 동의 확인 전과 iOS · 동의 메시지 지역은 비개인화이고, Android는 방침 9항의
// 날짜부터 풀린다(adPersonalization.ts).
// T-11-698 iOS는 동의 확인(UMP)이 IDFA 설명 메시지와 ATT 창을 띄운 뒤의 추적 허용 여부를 읽어 넘긴다.
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import { deviceLocales } from '@offside/app-core/i18n/core';
import { allowPersonalizedAds } from './adPersonalization';

// T-11-587 운영자 iPhone 재설치로 바뀐 ID(9401…)를 더한다. 옛 ID는 다른 설치본용으로 남긴다.
/** iOS 앱 추적 허용 여부. 추적 모듈이 없는 옛 스토어 빌드(OTA)는 허용하지 않은 것으로 본다. */
async function trackingAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const tt = await import('expo-tracking-transparency');
    if (!tt.isAvailable()) return false;
    return (await tt.getTrackingPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const TEST_DEVICES = ['cf501bb8e326505e664bd41f504f4164', '9401ba83ecab139866f77381004260bc'];
const INIT_WAIT_MS = 5_000;

let nonPersonalizedOnly = true;
/** askConsent가 끝난 뒤 광고를 만들 때 부른다. */
export const adRequestOptions = () => ({ requestNonPersonalizedAdsOnly: nonPersonalizedOnly });

let consent: Promise<boolean> | undefined;
export const askConsent = () =>
  (consent ??= mobileAds()
    .setRequestConfiguration({ testDeviceIdentifiers: TEST_DEVICES })
    .then(() => AdsConsent.gatherConsent())
    .then(async (info) => {
      if (!info.canRequestAds) return false;
      nonPersonalizedOnly = !allowPersonalizedAds({
        os: Platform.OS,
        locales: deviceLocales(),
        consentRequired: info.status !== AdsConsentStatus.NOT_REQUIRED,
        ...(Platform.OS === 'ios' ? { tracking: await trackingAllowed() } : {}),
      });
      await Promise.race([
        mobileAds()
          .initialize()
          .catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, INIT_WAIT_MS)),
      ]);
      return true;
    })
    .catch(() => false));
