/**
 * T-11-375 구단 디비전. 디비전은 팀 레이팅의 구간이다(따로 승점을 쌓지 않는다). 경계는 서버 밸런스 키(teamDiv1~7)라
 * 운영 도구에서 바꾸고, 올라간 디비전은 레이팅이 그 경계보다 guard만큼 더 떨어져야 내려간다(경계 위에서 한 판 지고 바로
 * 강등되지 않게). zod가 없는 서브패스(`@offside/contracts/team-division`)라 웹 · 앱이 값으로 가져와도 번들이 작다.
 * 디비전은 키(index)로 저장하고, 이름은 화면이 언어마다 그린다(app-core `i18n/<lang>/teamDivision`).
 */
import type { BalanceValues } from './balance-spec.js';

export const TEAM_DIVISION_KEYS = [
  'amateur',
  'semi2',
  'semi1',
  'pro2',
  'pro1',
  'elite2',
  'elite1',
  'master',
] as const;
export type TeamDivisionKey = (typeof TEAM_DIVISION_KEYS)[number];
/** 가장 높은 디비전(마스터)의 index. */
export const TEAM_DIVISION_TOP = TEAM_DIVISION_KEYS.length - 1;
/** 시즌 보상(배지 · 리롤권)을 주는 가장 낮은 디비전(프로 II). */
export const TEAM_DIVISION_REWARD_MIN = 3;

export type DivisionRules = {
  /** bounds[i]: 디비전 i → i + 1로 올라가는 레이팅(늘 오름차순, 길이 7). */
  bounds: number[];
  guard: number;
};

type DivisionBalance = Pick<
  BalanceValues,
  | 'teamDiv1'
  | 'teamDiv2'
  | 'teamDiv3'
  | 'teamDiv4'
  | 'teamDiv5'
  | 'teamDiv6'
  | 'teamDiv7'
  | 'teamDivGuard'
>;

/** 밸런스 값 → 경계(앞 경계보다 낮게 두면 앞 경계 값을 써서 늘 오름차순이다). */
export function divisionRules(b: DivisionBalance): DivisionRules {
  const raw = [b.teamDiv1, b.teamDiv2, b.teamDiv3, b.teamDiv4, b.teamDiv5, b.teamDiv6, b.teamDiv7];
  const bounds: number[] = [];
  for (const v of raw) bounds.push(Math.max(v, bounds.at(-1) ?? -Infinity));
  return { bounds, guard: Math.max(0, b.teamDivGuard) };
}

/** 레이팅만 보고 정한 디비전(강등 보호 없이). */
export const bandOf = (rating: number, bounds: readonly number[]): number =>
  bounds.reduce((n, b) => n + (rating >= b ? 1 : 0), 0);

/**
 * 경기 뒤 디비전. 오를 때는 레이팅 구간 그대로, 내려갈 때는 지금 디비전 경계보다 guard점 더 떨어진 만큼만 내려간다
 * (한 번에 두 디비전 넘게 움직일 수도 있다). 서버 SQL(`divisionSql`)과 같은 식이다.
 */
export function nextDivision(rating: number, prev: number, rules: DivisionRules): number {
  const band = bandOf(rating, rules.bounds);
  const kept = bandOf(rating + rules.guard, rules.bounds);
  return Math.max(band, Math.min(clampDivision(prev), kept));
}

export const clampDivision = (d: number): number =>
  Math.min(TEAM_DIVISION_TOP, Math.max(0, Math.trunc(d) || 0));

export type DivisionProgress = {
  division: number;
  /** 다음 디비전까지 남은 레이팅(마스터면 null). */
  gap: number | null;
  /** 지금 디비전 안에서 다음 경계까지 얼마나 왔는지(0~1, 마스터면 1). */
  ratio: number;
  /** 레이팅이 지금 디비전 경계 아래(강등 보호 중)면 내려가기까지 남은 레이팅. 아니면 null. */
  guardLeft: number | null;
};

/** 팀 화면 머리의 "다음 디비전까지 n점" 막대. 아마추어의 막대 시작은 첫 경계 − 100이다. */
export function divisionProgress(
  rating: number,
  division: number,
  rules: DivisionRules,
): DivisionProgress {
  const d = clampDivision(division);
  const { bounds, guard } = rules;
  const floor = d > 0 ? bounds[d - 1]! : bounds[0]! - 100;
  const guardLeft = d > 0 && rating < floor ? Math.max(0, rating - (floor - guard)) : null;
  if (d === TEAM_DIVISION_TOP) return { division: d, gap: null, ratio: 1, guardLeft };
  const next = bounds[d]!;
  const gap = Math.max(0, next - rating);
  const ratio = next > floor ? Math.min(1, Math.max(0, (rating - floor) / (next - floor))) : 1;
  return { division: d, gap, ratio, guardLeft };
}

/** 시즌 마감 디비전 → 리롤권 장수(프로 II 아래는 0). */
export function divisionRerolls(
  division: number,
  b: Pick<
    BalanceValues,
    'teamDivReward3' | 'teamDivReward4' | 'teamDivReward5' | 'teamDivReward6' | 'teamDivReward7'
  >,
): number {
  const by = [
    0,
    0,
    0,
    b.teamDivReward3,
    b.teamDivReward4,
    b.teamDivReward5,
    b.teamDivReward6,
    b.teamDivReward7,
  ];
  return by[clampDivision(division)] ?? 0;
}
