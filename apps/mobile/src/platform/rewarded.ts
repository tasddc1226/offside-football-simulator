// 보상형 광고(AdMob) 공용 재생. 잠재력 엿보기(T-11-079)·자금 부족 잠재력 강화(T-11-116)가 같은 단위를 쓴다.
// 비개인화 광고만 요청하고, 동의는 배너와 같은 UMP를 쓴다. 개발 빌드는 구글 테스트 광고를 쓴다.
import { Platform } from 'react-native';
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { adText } from '@offside/app-core/i18n/ko/ad';
import { askConsent } from './adConsent';
import { adFree } from './adFree';

/** AdMob 보상형 광고 단위(scout-peek-rewarded). 단위가 없는 플랫폼은 광고 제거 구매자만 보상을 받는다. */
const UNIT = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: 'ca-app-pub-3797087216173591/6888876318',
      android: 'ca-app-pub-3797087216173591/3915228615',
    });

/** 광고를 볼 수 있거나(단위 있음) 광고 없이 받을 수 있으면(광고 제거) 버튼을 보인다. */
export const rewardAvailable = () => adFree.owned || !!UNIT;
/** 보상 버튼 종류 — 광고 제거 구매자는 'free', 광고를 볼 수 있으면 'ad', 둘 다 아니면 null. owned는 화면이 구독한 값. */
export const rewardOffer = (owned: boolean): 'free' | 'ad' | null =>
  owned ? 'free' : UNIT ? 'ad' : null;

/** 광고를 띄우고 보상을 받았는지 돌려준다. 광고를 못 불러오거나 중간에 닫으면 false. */
function watch(unit: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true });
    let earned = false;
    const offs = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => done());
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done()),
      ad.addAdEventListener(AdEventType.ERROR, () => done()),
    ];
    // 불러오기가 끝나지 않으면(네트워크) 20초에서 끊는다. 보여 주는 중이면 닫힐 때 끝난다.
    const timer = setTimeout(() => !ad.loaded && done(), 20_000);
    function done() {
      clearTimeout(timer);
      offs.forEach((off) => off());
      resolve(earned);
    }
    ad.load();
  });
}

/**
 * 보상을 받으면 onEarned를 부르고 ''를, 못 받으면 보여 줄 안내를 돌려준다(동의·불러오기 실패, 끝까지 보지 않음 = skipped).
 * 광고 제거 구매자는 광고 없이 바로 받는다.
 */
export async function claimReward(onEarned: () => void, skipped: string): Promise<string> {
  if (!adFree.owned) {
    if (!UNIT || !(await askConsent())) return adText.rewardedUnavailable;
    if (!(await watch(UNIT))) return skipped;
  }
  onEarned();
  return '';
}
