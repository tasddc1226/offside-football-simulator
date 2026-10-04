// T-11-068 광고 동의(UMP). EEA·영국·스위스는 AdMob 'OFFSIDE 유럽 동의' 메시지를 처음 광고를 요청할 때 한 번 띄운다.
// 배너(AdSlot)와 보상형 광고(T-11-079 rewardedPeek)가 같이 쓴다. 확인은 앱 실행마다 한 번, 대상 지역이 아니면 창 없이 끝난다.
// 확인에 실패하면 광고를 요청하지 않는다.
import { AdsConsent } from 'react-native-google-mobile-ads';

let consent: Promise<boolean> | undefined;
export const askConsent = () =>
  (consent ??= AdsConsent.gatherConsent()
    .then((info) => info.canRequestAds)
    .catch(() => false));
