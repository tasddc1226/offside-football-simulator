// T-11-079 보상형 광고를 끝까지 보면 이번 시즌 스카우트 평가를 연다(규칙은 app-core potential-peek).
// 광고 제거(T-11-069)를 산 사용자는 광고 없이 바로 연다. 비개인화 광고만 요청하고, 동의는 배너와 같은 UMP를 쓴다.
// 연 기록은 커리어 id + 시즌으로 이 기기에만 남긴다(세이브·서버와 무관). 개발 빌드는 구글 테스트 광고를 쓴다.
import { Platform } from 'react-native';
import { proxy } from 'valtio';
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { parsePeek, peekOf, type PotentialPeek } from '@offside/app-core/potential-peek';
import type { GameState } from '@offside/game/types';
import { askConsent } from './adConsent';
import { adFree } from './adFree';
import { kv } from './setup';

/** AdMob 보상형 광고 단위(scout-peek-rewarded, 리워드 1 스카우트 평가). 단위가 없는 플랫폼은 광고 제거 구매자만 연다. */
const UNIT = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: 'ca-app-pub-3797087216173591/6888876318',
      android: 'ca-app-pub-3797087216173591/3915228615',
    });

const KEY = 'offside_pot_peek';

export const potPeek = proxy({
  peek: parsePeek(kv.getString(KEY)) as PotentialPeek | null,
  busy: false,
  message: '',
});

/** 광고를 볼 수 있거나(단위 있음) 광고 없이 열 수 있으면(광고 제거) 버튼을 보인다. */
export const peekAvailable = () => adFree.owned || !!UNIT;

function open(s: GameState) {
  const peek = peekOf(s);
  kv.set(KEY, JSON.stringify(peek));
  potPeek.peek = peek;
}

/** 광고를 띄우고 보상을 받으면 연다. 광고를 못 불러오거나 중간에 닫으면 그대로 둔다. */
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

/** '이번 시즌 평가 보기' 버튼. */
export async function openPeek(s: GameState) {
  if (potPeek.busy) return;
  if (adFree.owned) return open(s);
  if (!UNIT) return;
  potPeek.busy = true;
  potPeek.message = '';
  try {
    if (!(await askConsent())) {
      potPeek.message = '지금은 광고를 불러올 수 없어요. 잠시 뒤 다시 시도해 주세요.';
      return;
    }
    if (await watch(UNIT)) open(s);
    else potPeek.message = '광고를 끝까지 보면 평가를 볼 수 있어요.';
  } finally {
    potPeek.busy = false;
  }
}
