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

/** 프로 경력이 없어 몸값을 매길 수 없는 카드의 기준가(만 원) — 1억. */
export const CARD_VALUE_FLOOR = 10_000;

/**
 * T-11-080 카드 기준가(만 원): 최고 OVR을 찍은 시즌 중 마지막 시즌의 몸값. 카드 능력치가 같은 OVR이면 나중 시즌을
 * 남기는 것과 맞춘다. 그 시즌이 대학·현역 복무라 0이면 가장 비쌌던 프로 시즌, 프로 경력이 없으면 CARD_VALUE_FLOOR.
 */
export function cardValue(career: ValueRow[], peak: number): number {
  const last = career.findLast((r) => r.ovr === peak);
  return (last && seasonValue(last)) || peakValue(career)?.value || CARD_VALUE_FLOOR;
}

/**
 * 몸값·이적료 표기(T-10-100): 큰 두 단위까지만 — '1조 2,346억' · '263억 1천만' · '5천 3백만'.
 * 아래 단위에서 반올림하고, 반올림으로 자리가 올라가면(9,999억 6천만 → 1조) 윗 단위로 쓴다. 0 이하는 '-'.
 */
export function fmtValue(man: number): string {
  if (man <= 0) return '-';
  const r = (u: number) => Math.round(man / u) * u;
  const v = r(10_000) >= 100_000_000 ? r(10_000) : r(1000) >= 10_000 ? r(1000) : r(100);
  if (!v) return '1백만 미만';
  // [윗 단위 크기, 윗 단위, 아랫 단위 크기, 아랫 단위, 꼬리]
  const [hu, hn, lu, ln, tail] =
    v >= 100_000_000
      ? [100_000_000, '조', 10_000, '억', '']
      : v >= 10_000
        ? [10_000, '억', 1000, '천만', '']
        : [1000, '천', 100, '백', '만'];
  const hi = Math.floor(v / hu),
    lo = (v % hu) / lu;
  return (
    [hi && `${hi.toLocaleString()}${hn}`, lo && `${lo.toLocaleString()}${ln}`]
      .filter(Boolean)
      .join(' ') + tail
  );
}
