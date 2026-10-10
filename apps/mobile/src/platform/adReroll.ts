// T-11-154 광고 보고 후보 다시 뽑기(규칙은 app-core ad-reroll). 하루 횟수는 이 기기에만 남긴다. 광고 제거 구매자는 광고 없이
// 받는다. 광고는 후보 잠재력과 같은 단위('candidates')를 쓰므로 버튼 종류도 그 화면의 rewardOffer('candidates')를 그대로 쓴다.
import { adRerollsLeft, spendAdReroll } from '@offside/app-core/ad-reroll';
import { adText as L } from '@offside/app-core/i18n/ko/ad';
import { claimReward } from './rewarded';
import { kv } from './setup';

const KEY = 'offside_ad_reroll';

/** 오늘 남은 횟수. */
export const adRerollLeft = () => adRerollsLeft(kv.getString(KEY));

/** 광고를 끝까지 보면 횟수를 하나 쓰고 reroll을 부른다. 못 받으면 보여 줄 안내, 받으면 ''. */
export function claimAdReroll(reroll: () => void): Promise<string> {
  return claimReward(
    'candidates',
    () => {
      kv.set(KEY, spendAdReroll(kv.getString(KEY)));
      reroll();
    },
    L.adRerollWatch,
  );
}
