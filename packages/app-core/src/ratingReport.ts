// T-11-379 선수 커리어 구간 결과의 평점 구성 · 성장 방향(표시만, 결과를 바꾸지 않는다). 웹 · 앱 게임 화면이 같이 쓴다 —
// 웹은 이 모듈을 지연 청크(RatingParts · GrowthDir)로만 불러 첫 화면 번들에 넣지 않는다. 초기 코드는 원자료만 담는다.
import {
  growthDirection,
  labelOf,
  type GrowthDirection,
  type MatchGame,
  type RatingParts,
  RATING_BASE,
} from '@offside/game/engine';
import type { GameState } from '@offside/game/types';
import { ratingReportText as R } from './i18n/ko/ratingReport.js';

const PART_KEYS = [
  'goals',
  'assists',
  'ovrEdge',
  'cond',
  'morale',
  'form',
  'cs',
  'def',
  'result',
] as const satisfies readonly (keyof RatingParts)[];
const PART_LABEL: Record<(typeof PART_KEYS)[number] | 'luck', () => string> = {
  goals: () => R.partGoals,
  assists: () => R.partAssists,
  ovrEdge: () => R.partOvrEdge,
  cond: () => R.partCond,
  morale: () => R.partMorale,
  form: () => R.partForm,
  cs: () => R.partCs,
  def: () => R.partDef,
  result: () => R.partResult,
  luck: () => R.partLuck,
};
export type RatingPartRow = { key: string; label: string; value: number };
export type RatingBreakdown = { base: number; avg: number; rows: RatingPartRow[] };

/**
 * 구간 평점 구성(뛴 경기 평균, 0.1 단위). 0.0인 몫은 뺀다. 반올림 · 상한(4.5~10)과 경기마다 흔들린 몫은 '그 밖의 흔들림'에
 * 모아, 기본 + 줄 합이 평균 평점과 꼭 맞게 한다. 뛴 경기가 없거나 구성이 없는 경기뿐이면 null.
 */
export function ratingBreakdown(
  games: readonly MatchGame[],
  base: number = RATING_BASE,
): RatingBreakdown | null {
  const played = games.filter((g) => g.mins > 0 && g.parts && g.rating !== undefined);
  if (!played.length) return null;
  const n = played.length;
  const avg = Math.round((played.reduce((t, g) => t + g.rating!, 0) / n) * 100) / 100;
  const rows: RatingPartRow[] = [];
  let shown = 0;
  for (const k of PART_KEYS) {
    const v = Math.round((played.reduce((t, g) => t + g.parts![k], 0) / n) * 10) / 10;
    if (v === 0) continue;
    rows.push({ key: k, label: PART_LABEL[k](), value: v });
    shown += v;
  }
  const rest = Math.round((avg - base - shown) * 10) / 10;
  if (rest !== 0) rows.push({ key: 'luck', label: PART_LABEL.luck(), value: rest });
  return { base, avg, rows };
}

/** 성장 방향 한 줄(능력치 카드 '성장이 느린 이유' 옆 · 시즌 결산). attr는 그 포지션의 능력치 이름. */
export function growthDirectionText(d: GrowthDirection, attr: string): string {
  const n = Math.round(Math.abs(d.gap));
  const up = d.gap >= 0;
  if (d.kind === 'def') return R.dirDef({ n, up });
  if (d.knee) return R.dirKnee;
  const p = { attr, pct: d.pct, n, up };
  return d.kind === 'goal' ? R.dirGoal(p) : R.dirAssist(p);
}

/** 성장 방향 원자료(게임 엔진 값 + 능력치 이름). 웹 초기 청크가 이 모듈 없이 들고 다닌다. */
export type GrowthDirInfo = { d: GrowthDirection; attr: string };
export const growthDirInfo = (s: GameState): GrowthDirInfo => {
  const d = growthDirection(s);
  return { d, attr: d.kind === 'def' ? '' : labelOf(s, d.attr) };
};
export const growthDirectionNote = (s: GameState): string => {
  const { d, attr } = growthDirInfo(s);
  return growthDirectionText(d, attr);
};

const signed1 = (x: number) => (x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1));
/** 평점 구성 한 줄("기본 6.2 · 골 +0.5 · OVR 우위 +0.3 …"). */
export const partsText = (b: RatingBreakdown): string =>
  [
    `${R.partBase} ${b.base.toFixed(1)}`,
    ...b.rows.map((r) => `${r.label} ${signed1(r.value)}`),
  ].join(' · ');
