// T-10-012 확률 도감의 문구 만들기(공통 규칙 · 선택지 확률 표기). 웹 EventDex.svelte와 앱 Dex 화면이 함께 쓴다.
import { EVENT_RULES, JITTER_RANGE } from '@offside/game/engine';
import type { DexChoice } from '@offside/game/eventDex';
import { zoneWidth } from '@offside/game/minigame';
import { dexText as L } from './i18n/ko/dex';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const span = ([lo, hi]: readonly [number, number]) => `${pct(lo)}~${pct(hi)}`;

/** 도감 맨 위 '공통 규칙' — [용어, 설명] 목록(게임 코드의 상수에서 바로 뽑는다). */
export function dexRules(): (readonly [string, string])[] {
  const R = EVENT_RULES;
  const cost = R.safeCost
    .map((c) => `${c.label} −${c.min === c.max ? c.min : `${c.min}~${c.max}`}`)
    .join(' / ');
  return [
    [L.ruleRateTerm, L.ruleRate({ pre: pct(R.rate.preseason), season: pct(R.rate.season) })],
    [L.ruleSameTerm, L.ruleSame({ n: R.cooldown })],
    [L.ruleRollTerm, L.ruleRoll],
    [L.ruleMiniTerm, L.ruleMini],
    [L.ruleSafeTerm, L.ruleSafe({ span: span(JITTER_RANGE.safe), twist: pct(R.twist), cost })],
    [L.ruleResultTerm, L.ruleResult({ span: span(JITTER_RANGE.normal) })],
    [
      L.ruleTwistTerm,
      L.ruleTwist({
        twist: pct(R.twist),
        ok: pct(R.twistUp.ok),
        fail: pct(R.twistUp.fail),
        safe: pct(R.twistUp.safe),
      }),
    ],
  ];
}

/** 선택지 한 줄의 오른쪽 표기(확률·안전·확정·미니게임 구간 넓이). */
export function oddsText(c: DexChoice): string {
  if (c.kind === 'safe') return L.oddsSafe;
  if (c.kind === 'sure') return L.oddsSure;
  if (c.min === null || c.max === null) return L.oddsVaries;
  // T-10-089 미니게임 선택지는 확률이 아니라 성공 구간 넓이다.
  if (c.mg) {
    const mg = c.mg;
    const [lo, hi] = [c.min, c.max].map((v) => Math.round(zoneWidth(v / 100, mg) * 100));
    return L.oddsMinigame({ range: lo === hi ? String(lo) : `${lo}~${hi}` });
  }
  return c.min === c.max ? `${c.min}%` : `${c.min}~${c.max}%`;
}
