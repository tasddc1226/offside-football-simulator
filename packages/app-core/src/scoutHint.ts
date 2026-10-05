// 시즌 결산의 스카우트 한마디. 문장은 앱 문구(i18n appScout)에서 읽는다 — 첫 화면에 실리는 potential-view.ts와 나눠 둔다.
import { hashStr } from '@offside/game/hash';
import { potFogged, potGrade, potScouted } from '@offside/game/stats';
import type { GameState } from '@offside/game/types';
import { appScoutText as L } from './i18n/ko/appScout';

/** 문장 묶음별 칸 수(i18n appScout의 한국어·영어 묶음과 같다). */
const POOL_SIZE: Record<string, number> = {
  earlyHigh: 4,
  earlyMid: 4,
  earlyLow: 4,
  lateS: 3,
  lateA: 3,
  lateB: 3,
  lateC: 3,
  lateD: 3,
};

/** 시즌 결산의 스카우트 한마디(스카우트가 직접 하는 말). 등급 글자 없이 스카우트 평가(potGrade)의 수준만 문장으로 알려 준다.
 * 문장은 선수 이름과 시즌으로 고른다. 게임 RNG를 쓰지 않고, 같은 시즌을 다시 열어도 같은 문장이며 시즌마다 바뀐다. */
export function scoutHint(s: GameState, year: number): string | null {
  if (!potScouted(s)) return null;
  const g = potGrade(s);
  // 재평가(21·24세)가 모두 끝나기 전에는 3단계로만 알려 준다. 화면 등급이 범위로 흐린 구간과 같다.
  const pool = potFogged(s)
    ? g === 'S' || g === 'A'
      ? 'earlyHigh'
      : g === 'D'
        ? 'earlyLow'
        : 'earlyMid'
    : `late${g}`;
  // 이름으로 시작 문장을 정하고 시즌마다 다음 문장으로 넘긴다. 연속한 두 시즌은 같은 문장이 나오지 않는다.
  return L.hint({ pool, i: (hashStr(s.name) + year) % POOL_SIZE[pool]! });
}
