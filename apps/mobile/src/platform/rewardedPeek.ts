// T-11-079 보상형 광고를 끝까지 보면 이번 시즌 스카우트 평가를 연다(규칙은 app-core potential-peek, 광고는 rewarded.ts).
// 광고 제거(T-11-069)를 산 사용자는 광고 없이 바로 연다. 연 기록은 커리어 id + 시즌으로 이 기기에만 남긴다(세이브·서버와 무관).
import { proxy } from 'valtio';
import { parsePeek, peekOf, type PotentialPeek } from '@offside/app-core/potential-peek';
import type { GameState } from '@offside/game/types';
import { claimReward, rewardAvailable } from './rewarded';
import { kv } from './setup';
import { adText as L } from '@offside/app-core/i18n/ko/ad';

const KEY = 'offside_pot_peek';

export const potPeek = proxy({
  peek: parsePeek(kv.getString(KEY)) as PotentialPeek | null,
  busy: false,
  message: '',
});

/** 광고를 볼 수 있거나(단위 있음) 광고 없이 열 수 있으면(광고 제거) 버튼을 보인다. */
export const peekAvailable = rewardAvailable;

function open(s: GameState) {
  const peek = peekOf(s);
  kv.set(KEY, JSON.stringify(peek));
  potPeek.peek = peek;
}

/** '이번 시즌 평가 보기' 버튼. */
export async function openPeek(s: GameState) {
  if (potPeek.busy) return;
  potPeek.busy = true;
  potPeek.message = '';
  try {
    potPeek.message = await claimReward(() => open(s), L.rewardedWatch);
  } finally {
    potPeek.busy = false;
  }
}
