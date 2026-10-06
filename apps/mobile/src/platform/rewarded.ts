// 보상형 광고(AdMob) 공용 재생. 후보 잠재력(T-11-118)·잠재력 엿보기·강화가 쓴다.
// T-11-117 두 곳의 실적을 따로 보려고 광고 단위를 나눴다(재생 흐름은 같다).
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

/** AdMob 보상형 광고 단위. 단위가 없는 플랫폼은 광고 제거 구매자만 보상을 받는다. */
const UNITS = {
  candidates: {
    ios: 'ca-app-pub-3797087216173591/3708867561',
    android: 'ca-app-pub-3797087216173591/3204550669',
  },
  /** ios·android-scout-peek-rewarded */
  peek: {
    ios: 'ca-app-pub-3797087216173591/6888876318',
    android: 'ca-app-pub-3797087216173591/3915228615',
  },
  /** ios·android-potential-boost-rewarded */
  boost: {
    ios: 'ca-app-pub-3797087216173591/9962450572',
    android: 'ca-app-pub-3797087216173591/7873589266',
  },
};
type RewardPlacement = keyof typeof UNITS;
const unitOf = (p: RewardPlacement) => (__DEV__ ? TestIds.REWARDED : Platform.select(UNITS[p]));

/** 광고를 볼 수 있거나(단위 있음) 광고 없이 받을 수 있으면(광고 제거) 버튼을 보인다. */
export const rewardAvailable = (p: RewardPlacement) => adFree.owned || !!unitOf(p);
/** 보상 버튼 종류 — 광고 제거 구매자는 'free', 광고를 볼 수 있으면 'ad', 둘 다 아니면 null. owned는 화면이 구독한 값. */
export const rewardOffer = (p: RewardPlacement, owned: boolean): 'free' | 'ad' | null =>
  owned ? 'free' : unitOf(p) ? 'ad' : null;

/**
 * 광고를 띄운 결과 — 끝까지 봐서 보상(earned), 보다가 닫음(closed), 불러오기·보여 주기 실패(failed).
 * 불러오지 못한 광고(게재 제한 · 광고 없음 · 네트워크)를 '끝까지 안 봤다'로 안내하지 않으려고 나눈다.
 */
type WatchResult = 'earned' | 'closed' | 'failed';

function watch(unit: string): Promise<WatchResult> {
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true });
    let earned = false;
    let shown = false;
    const offs = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show()
          .then(() => (shown = true))
          .catch(() => done());
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.OPENED, () => {
        shown = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done()),
      ad.addAdEventListener(AdEventType.ERROR, () => done()),
    ];
    // 불러오기가 끝나지 않으면(네트워크) 20초에서 끊는다. 보여 주는 중이면 닫힐 때 끝난다.
    const timer = setTimeout(() => !ad.loaded && done(), 20_000);
    function done() {
      clearTimeout(timer);
      offs.forEach((off) => off());
      resolve(earned ? 'earned' : shown ? 'closed' : 'failed');
    }
    ad.load();
  });
}

/**
 * 보상을 받으면 onEarned를 부르고 ''를, 못 받으면 보여 줄 안내를 돌려준다(동의·불러오기 실패 = 불러올 수 없음,
 * 끝까지 보지 않음 = skipped).
 * 광고 제거 구매자는 광고 없이 바로 받는다.
 */
export async function claimReward(
  p: RewardPlacement,
  onEarned: () => void,
  skipped: string,
): Promise<string> {
  if (!adFree.owned) {
    const unit = unitOf(p);
    if (!unit || !(await askConsent())) return adText.rewardedUnavailable;
    const result = await watch(unit);
    if (result === 'failed') return adText.rewardedUnavailable;
    if (result === 'closed') return skipped;
  }
  onEarned();
  return '';
}
