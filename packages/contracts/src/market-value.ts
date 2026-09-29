/**
 * T-10-100 선수 몸값. zod가 없는 서브패스(`@offside/contracts/market-value`) — 웹(시즌 몸값·은퇴 크레딧)과 서버
 * (명예의 전당 가치 순, 옛 은퇴 기록 소급)가 같은 식을 쓴다. 시즌 몸값은 이적 제안 이적료와 같은 식(리그 연봉 ×
 * 나이 배수)이고, 은퇴 가치는 가장 비쌌던 세 시즌 평균에 레전드 점수만큼 웃돈을 얹는다. 판정·밸런스에는 쓰지 않는다.
 */
import { LEAGUE_BASE, type LeagueBase } from './club-names.js';

/** 레전드 점수 이만큼마다 은퇴 가치가 1배씩 더 붙는다. */
export const LEGACY_PER = 250;

const BY_ID = new Map(LEAGUE_BASE.map((l) => [l.id, l]));
const BY_NAME = new Map(LEAGUE_BASE.map((l) => [l.name, l]));

/** 연봉(만 원/년): 리그 자금력 × OVR. */
export function salaryFor(leagueId: string, o: number): number {
  return Math.round((BY_ID.get(leagueId)!.wealth * 1000 * Math.exp((o - 60) / 10)) / 10) * 10;
}

/** 리그·OVR·나이로 매긴 몸값(만 원). 이적 제안 이적료의 기준. */
export function valueFor(leagueId: string, o: number, age: number): number {
  return Math.round((salaryFor(leagueId, o) * (age <= 24 ? 5 : age <= 29 ? 4 : 2)) / 100) * 100;
}

/** 몸값을 매기는 데 쓰는 시즌 기록(웹 CareerRecord · 서버 스냅샷 시즌). */
export interface ValueRow {
  league: string;
  clubId?: string | undefined;
  mil?: boolean | undefined;
  ovr: number;
  age: number;
}

/** 시즌 기록의 리그. 구단 id가 없는 옛 기록(T-10-066 이전)도 리그 이름으로 찾는다 — 김천 상무는 'K리그1'. */
export function rowLeague(r: Pick<ValueRow, 'league' | 'clubId'>): LeagueBase | undefined {
  return BY_NAME.get(r.league) ?? (r.clubId ? BY_ID.get(r.clubId.split('-')[0]!) : undefined);
}

/** 그 시즌을 마쳤을 때의 몸값(만 원). 고교·대학·현역 복무 시즌은 0. */
export function seasonValue(r: ValueRow): number {
  const L = rowLeague(r);
  return r.mil || !L || L.amateur ? 0 : valueFor(L.id, r.ovr, r.age);
}

/** 몸값이 가장 높았던 시즌(같으면 먼저). 프로 기록이 없으면 null. */
export function peakValue<R extends ValueRow>(career: R[]): { value: number; row: R } | null {
  let best: { value: number; row: R } | null = null;
  for (const row of career) {
    const value = seasonValue(row);
    if (value > (best?.value ?? 0)) best = { value, row };
  }
  return best;
}

/** 은퇴 가치(만 원, 천만 단위): 상위 세 시즌 몸값 평균 × (1 + 레전드 점수 / LEGACY_PER). 세 시즌이 안 되면 모자란 만큼 0. */
export function retireValue(career: ValueRow[], legendScore: number): number {
  const top = career
    .map(seasonValue)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const avg = top.reduce((a, b) => a + b, 0) / 3;
  return Math.round((avg * (1 + Math.max(0, legendScore) / LEGACY_PER)) / 1000) * 1000;
}
