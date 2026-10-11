// T-11-068 광고 동의(UMP). EEA·영국·스위스는 AdMob 'OFFSIDE 유럽 동의' 메시지를 처음 광고를 요청할 때 한 번 띄운다.
// 배너(AdSlot)와 보상형 광고(T-11-079 rewardedPeek)가 같이 쓴다. 확인은 앱 실행마다 한 번, 대상 지역이 아니면 창 없이 끝난다.
// 확인에 실패하면 광고를 요청하지 않는다.
// T-11-143 운영자 기기는 실제 광고 대신 테스트 광고를 받는다(무효 트래픽 방지). 앱을 지웠다 깔면 ID가 바뀔 수 있다.
// ID는 기기 로그의 "<Google> To get test ads on this device" 줄에서 찾는다(해시값이라 비밀값 아님).
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

const TEST_DEVICES = ['cf501bb8e326505e664bd41f504f4164'];

let consent: Promise<boolean> | undefined;
export const askConsent = () =>
  (consent ??= mobileAds()
    .setRequestConfiguration({ testDeviceIdentifiers: TEST_DEVICES })
    .then(() => AdsConsent.gatherConsent())
    .then((info) => info.canRequestAds)
    .catch(() => false));
