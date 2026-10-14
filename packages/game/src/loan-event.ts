// T-11-257 시즌 중 임대 면담. 주전이 아니면서 출전·공격 포인트가 적거나 이번 시즌 이벤트에서 두 번 이상 실패하면 나온다.
// 임대를 요청하면 시즌 뒤 이적시장에 임대 제의가 붙는다(season.ts loanEligible·loanOffers).
import { clamp } from './rng.js';
import { addStat, isPro, leagueOf, roleOf } from './engine.js';
import { milDone } from './military.js';
import { gLoanText as L } from './i18n/ko/gLoan.js';
import type { EventDef, GameState } from './types.js';

/** 이번 시즌 출전이 경기 수의 절반 아래거나, 포지션에 비해 공격 포인트·평점이 낮다. */
function quietSeason(s: GameState): boolean {
  const S = s.season;
  if (!S.played) return false;
  if (S.apps < S.played * 0.5) return true;
  const ga = S.goals + S.assists;
  if (s.pos === 'FW') return ga < S.apps * 0.3;
  if (s.pos === 'MF') return ga < S.apps * 0.15;
  return S.ratingSum / Math.max(1, S.apps) < 6.6;
}
const failsThisSeason = (s: GameState) => (s.flags['evFail' + s.year] as number) || 0;

export function loanTalkReady(s: GameState): boolean {
  return (
    isPro(s) &&
    !leagueOf(s.leagueId).amateur &&
    s.phase >= 1 &&
    s.age <= 26 &&
    !s.loan &&
    s.flags.loanReq !== s.year &&
    !!s.contract &&
    s.contract.years >= 2 &&
    !s.mil.serving &&
    (milDone(s) || s.age < 26) &&
    roleOf(s) !== '주전' && // i18n-ignore 역할 저장값
    (quietSeason(s) || failsThisSeason(s) >= 2)
  );
}

export const LOAN_EVENT: EventDef = {
  id: 'loan-talk',
  get title() {
    return L.title;
  },
  w: 3,
  cond: loanTalkReady,
  text: () => L.text,
  choices: [
    {
      label: () => L.askLabel,
      ok: {
        text: () => L.askResult,
        fx: (s) => {
          s.flags.loanReq = s.year;
          addStat(s, 'morale', 2);
          addStat(s, 'trust', -0.5);
        },
      },
    },
    {
      label: () => L.stayLabel,
      p: (s) => clamp(0.4 + s.trust * 0.05, 0.25, 0.7),
      ok: {
        text: () => L.stayResult,
        fx: (s) => {
          addStat(s, 'trust', 1);
          addStat(s, 'morale', 3);
        },
      },
      fail: {
        text: () => L.stayFail,
        fx: (s) => addStat(s, 'morale', -3),
      },
    },
  ],
};
