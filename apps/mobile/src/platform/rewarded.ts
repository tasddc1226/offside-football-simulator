// 보상형 광고(AppLovin MAX — T-11-159) 공용 재생. 후보 잠재력(T-11-118, 후보 다시 뽑기 T-11-154도 같은 단위)·잠재력 엿보기·강화가 쓴다.
// T-11-117 세 곳의 실적을 따로 보려고 광고 단위를 나눴다(재생 흐름은 같다). 비개인화 광고만 받는다(./ads).
import { RewardedAd } from 'react-native-applovin-max';
import { adText } from '@offside/app-core/i18n/ko/ad';
import { startAds, unitOf, type AdPlacement } from './ads';
import { adFree } from './adFree';

type RewardPlacement = Exclude<AdPlacement, 'banner'>;

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

/** 지금 재생 중인 광고. MAX 보상형 이벤트 리스너는 종류마다 하나뿐이라 처음 한 번 걸고 단위로 지금 재생에 나눠 준다. */
let playing: { unit: string; on: (e: 'loaded' | 'shown' | 'earned' | 'done') => void } | undefined;
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  const to =
    (e: 'loaded' | 'shown' | 'earned' | 'done') =>
    ({ adUnitId }: { adUnitId: string }) =>
      playing?.unit === adUnitId && playing.on(e);
  RewardedAd.addAdLoadedEventListener(to('loaded'));
  RewardedAd.addAdDisplayedEventListener(to('shown'));
  RewardedAd.addAdReceivedRewardEventListener(to('earned'));
  RewardedAd.addAdHiddenEventListener(to('done'));
  RewardedAd.addAdLoadFailedEventListener(to('done'));
  RewardedAd.addAdFailedToDisplayEventListener(to('done'));
}

function watch(unit: string): Promise<WatchResult> {
  listen();
  return new Promise((resolve) => {
    let earned = false;
    let shown = false;
    let loaded = false;
    const me = {
      unit,
      on(e: 'loaded' | 'shown' | 'earned' | 'done') {
        if (e === 'loaded') {
          loaded = true;
          RewardedAd.showAd(unit);
        } else if (e === 'shown') shown = true;
        else if (e === 'earned') earned = true;
        else done();
      },
    };
    playing = me;
    // 불러오기가 끝나지 않으면(네트워크) 20초에서 끊는다. 보여 주는 중이면 닫힐 때 끝난다.
    const timer = setTimeout(() => !loaded && done(), 20_000);
    function done() {
      clearTimeout(timer);
      if (playing === me) playing = undefined;
      resolve(earned ? 'earned' : shown ? 'closed' : 'failed');
    }
    RewardedAd.loadAd(unit);
  });
}

/**
 * 보상을 받으면 onEarned를 부르고 ''를, 못 받으면 보여 줄 안내를 돌려준다(SDK 시작·불러오기 실패 = 불러올 수 없음,
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
    if (!unit || !(await startAds())) return adText.rewardedUnavailable;
    const result = await watch(unit);
    if (result === 'failed') return adText.rewardedUnavailable;
    if (result === 'closed') return skipped;
  }
  onEarned();
  return '';
}
