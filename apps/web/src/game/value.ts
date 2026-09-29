// T-10-100 선수 몸값. 시즌 몸값은 이적 제안 이적료와 같은 식(valueFor: 리그 · OVR · 나이)으로 시즌 기록마다 매기고,
// 은퇴 가치는 가장 비쌌던 세 시즌의 평균에 레전드 점수만큼 웃돈을 얹는다. 표시만 하고 판정·밸런스에는 쓰지 않는다.
import { LEAGUE_BASE, type LeagueBase } from '@offside/contracts/club-names';
import { valueFor } from './player.js';
import type { CareerRecord } from './types.js';

/** 레전드 점수 이만큼마다 은퇴 가치가 1배씩 더 붙는다. */
export const LEGACY_PER = 250;

const BY_NAME = new Map(LEAGUE_BASE.map((l) => [l.name, l]));
const BY_ID = new Map(LEAGUE_BASE.map((l) => [l.id, l]));

/** 시즌 기록의 리그. 구단 id가 없는 옛 기록(T-10-066 이전)도 리그 이름으로 찾는다 — 김천 상무는 'K리그1'. */
export function rowLeague(r: Pick<CareerRecord, 'league' | 'clubId'>): LeagueBase | undefined {
  return BY_NAME.get(r.league) ?? (r.clubId ? BY_ID.get(r.clubId.split('-')[0]!) : undefined);
}

/** 그 시즌을 마쳤을 때의 몸값(만 원). 고교·대학·현역 복무 시즌은 0. */
export function seasonValue(r: CareerRecord): number {
  const L = rowLeague(r);
  return r.mil || !L || L.amateur ? 0 : valueFor(L.id, r.ovr, r.age);
}

/** 몸값이 가장 높았던 시즌(같으면 먼저). 프로 기록이 없으면 null. */
export function peakValue(career: CareerRecord[]): { value: number; row: CareerRecord } | null {
  let best: { value: number; row: CareerRecord } | null = null;
  for (const row of career) {
    const value = seasonValue(row);
    if (value > (best?.value ?? 0)) best = { value, row };
  }
  return best;
}

/** 은퇴 가치(만 원, 천만 단위): 상위 세 시즌 몸값 평균 × (1 + 레전드 점수 / LEGACY_PER). 세 시즌이 안 되면 모자란 만큼 0. */
export function retireValue(career: CareerRecord[], legendScore: number): number {
  const top = career
    .map(seasonValue)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const avg = top.reduce((a, b) => a + b, 0) / 3;
  return Math.round((avg * (1 + Math.max(0, legendScore) / LEGACY_PER)) / 1000) * 1000;
}
