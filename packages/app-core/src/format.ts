// ───────── 순수 포맷/집계 헬퍼 (ui.ts의 문자열 템플릿 함수들을 컴포넌트가 쓰기 좋은 형태로 분리) ─────────
import { labelOf } from '@offside/game/engine';
import { LEAGUES } from '@offside/game/data';
import type { AttrKey } from '@offside/game/data';
import {
  ovrRole,
  mainRole,
  ROLES,
  ROLE_NAME,
  POS_ROLES,
  faceOf,
  radarOrder,
  FACE_ABBR,
  GK_ABBR,
  SUBS,
} from '@offside/game/attributes';
import type { CareerRecord, GameState } from '@offside/game/types';
import { homeLiveText as L } from './i18n/ko/homeLive.js';

import { anonName as anonNameIn } from '@offside/game/pos-label';
import { getLocale } from './i18n/core.js';

/** 이름을 공개하지 않은 선수 표기(지금 언어로). */
export const anonName = (pos: Parameters<typeof anonNameIn>[0], number: number | null): string =>
  anonNameIn(pos, number, getLocale());
// 몸값 표기는 지금 언어를 따른다(한국어는 contracts의 서버 표기, 영어는 원화 약식).
import { fmtValue } from '@offside/game/player';
export { fmtValue };

/**
 * 선수 카드 등급(카드 색). 레전드 점수로 정하는 두 특별 등급이 먼저, 나머지는 최고 OVR 구간으로 정한다.
 * - 아이콘: 레전드 점수 1,800 이상(은퇴 등급 '역대 최고의 전설'의 시즌 1 기준). 시즌 1 카드의 약 2%.
 * - 레전드: 1,100 이상('월드클래스 레전드' 기준). 약 14%.
 * - 엘리트 85+ · 골드 75–84 · 실버 65–74 · 브론즈 64 이하. 근거: 2026-10-07 운영 카드 분포(시즌 1 8,693장).
 * 프리시즌 카드도 같은 점수 기준을 쓴다 — 프리시즌 은퇴 등급표(preMin)로 가르면 프리시즌 카드의 19%가 아이콘이 된다.
 */
export type CardTier = 'icon' | 'legend' | 'elite' | 'gold' | 'silver' | 'bronze';
export const CARD_ICON_SCORE = 1800;
export const CARD_LEGEND_SCORE = 1100;
export const cardTier = (legendScore: number | null | undefined, peak: number): CardTier => {
  const score = legendScore ?? 0;
  if (score >= CARD_ICON_SCORE) return 'icon';
  if (score >= CARD_LEGEND_SCORE) return 'legend';
  return peak >= 85 ? 'elite' : peak >= 75 ? 'gold' : peak >= 65 ? 'silver' : 'bronze';
};
/** 레전드 점수로 오른 특별 등급(아이콘 · 레전드)인지. */
export const isLegendTier = (tier: string): boolean => tier === 'icon' || tier === 'legend';

/** T-11-114 선수 카드 시즌 뱃지 — 프리시즌 PRE, 그 뒤는 S1·S2…(이름은 teamSeasonName). */
export const cardSeasonBadge = (season: number): string => (season === 0 ? 'PRE' : `S${season}`);
/** 시즌 뱃지 바탕색(웹·앱 같이) — 프리시즌 보라, 시즌 1부터는 네 색을 차례로 돈다. 카드 등급 색과 섞이지 않는 진한 색. */
const PRESEASON_COLOR = '#6a4a9c';
const CARD_SEASON_COLORS = ['#1f7a5c', '#b0472f', '#2e5d7a', '#8a5a14'];
export const cardSeasonColor = (season: number): string =>
  season === 0 ? PRESEASON_COLOR : CARD_SEASON_COLORS[(season - 1) % CARD_SEASON_COLORS.length]!;

/** 구단주 팀 선수 카드 아랫줄(웹·앱 같이): 능력치 안내가 먼저, 없으면 T-11-080 카드 기준가. 둘 다 없으면 null. */
export function cardFootNote(p: {
  attrs?: object | null | undefined;
  attrsEstimated?: boolean | undefined;
  cardValue?: number | null | undefined;
}): string | null {
  if (!p.attrs) return L.attrsNone;
  if (p.attrsEstimated) return L.attrsEstimated;
  return p.cardValue ? L.baseValue({ value: fmtValue(p.cardValue) }) : null;
}

export function seasonLabelOf(r: CareerRecord): string {
  const L = LEAGUES.find((l) => l.name === r.league);
  return L && L.tier >= 4
    ? `${r.year}-${String((r.year + 1) % 100).padStart(2, '0')}`
    : `${r.year}`;
}

export function totals(s: Pick<GameState, 'career'>) {
  return s.career.reduce(
    (a, r) => ({ p: a.p + r.apps, g: a.g + r.goals, a: a.a + r.assists, cs: a.cs + (r.cs || 0) }),
    { p: 0, g: 0, a: 0, cs: 0 },
  );
}

// ───────── 능력치 카드 파생 데이터 (ui.ts attrCard 262~314줄 포트) ─────────
export interface RadarPoint {
  key: AttrKey;
  labelKr: string;
  abbr: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor: 'start' | 'middle' | 'end';
  value: number;
  delta: number;
}
export function radarData(s: GameState) {
  const order = radarOrder(s.pos);
  const abbr = s.pos === 'GK' ? GK_ABBR : FACE_ABBR;
  const CX = 150,
    R = 92,
    n = order.length;
  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [CX + (Math.cos(a) * R * v) / 100, CX + (Math.sin(a) * R * v) / 100];
  };
  const poly = (vals: number[]) => polyPoints(vals, R, CX);
  const rings = [20, 40, 60, 80, 100].map((r) => poly(order.map(() => r)));
  const spokes = order.map((_, i) => pt(i, 100));
  const prev = s.seasonStart ? poly(order.map((k) => s.seasonStart[k])) : null;
  const nowVals = order.map((k) => s.attrs[k]);
  const now = poly(nowVals);
  const dots = order.map((k, i) => pt(i, s.attrs[k]));
  const points: RadarPoint[] = order.map((k, i) => {
    const [x, y] = pt(i, 126);
    const v = Math.round(s.attrs[k]);
    const d = s.seasonStart ? v - Math.round(s.seasonStart[k]) : 0;
    const anchor = Math.abs(x - CX) < 4 ? 'middle' : x > CX ? 'start' : 'end';
    return {
      key: k,
      labelKr: labelOf(s, k),
      abbr: abbr[k]!,
      x,
      y,
      labelX: x,
      labelY: y - 7,
      anchor,
      value: v,
      delta: d,
    };
  });
  // T-10-003: 능력치가 바뀔 때(훈련·이벤트) rd-now 폴리곤을 즉시 스냅하지 않고 부드럽게 모핑하기
  // 위해, Radar.svelte가 nowVals(순서대로의 숫자 배열)를 직접 트윈하고 poly()와 같은 방식으로
  // 각 프레임의 좌표 문자열을 다시 계산할 수 있도록 toPoly를 함께 내보낸다.
  const toPoly = (vals: number[]) => poly(vals);
  return {
    CX,
    rings,
    spokes,
    prev,
    now,
    nowVals,
    toPoly,
    dots,
    points,
    ariaLabel: order.map((k) => `${labelOf(s, k)} ${Math.round(s.attrs[k])}`).join(', '),
  };
}

export interface AttrGroupRow {
  key: string;
  name: string;
  value: number;
  tier: 't1' | 't2' | 't3' | 't4';
  bold: boolean;
}
export interface AttrGroup {
  key: AttrKey;
  abbr: string;
  labelKr: string;
  value: number;
  tier: 't1' | 't2' | 't3' | 't4';
  rows: AttrGroupRow[];
}
export function attrData(s: GameState) {
  const role = mainRole(s),
    W = ROLES[role]!,
    F = faceOf(s);
  const order = radarOrder(s.pos);
  const abbr = s.pos === 'GK' ? GK_ABBR : FACE_ABBR;
  const tier = (v: number): 't1' | 't2' | 't3' | 't4' =>
    v >= 80 ? 't4' : v >= 70 ? 't3' : v >= 50 ? 't2' : 't1';
  const roles = [...new Set([role, ...POS_ROLES[s.pos]])].map((r) => ({
    role: r,
    on: r === role,
    title: ROLE_NAME[r],
    ovr: Math.round(ovrRole(s, r)),
  }));
  const groups: AttrGroup[] = order.map((g) => {
    const rows = Object.keys(F[g]!)
      .sort((x, y) => (W[y] || 0) - (W[x] || 0) || s.sub[y]! - s.sub[x]!)
      .map((k) => {
        const v = Math.round(s.sub[k]!);
        return { key: k, name: SUBS[k]!, value: v, tier: tier(v), bold: (W[k] || 0) >= 0.05 };
      });
    return {
      key: g,
      abbr: abbr[g]!,
      labelKr: labelOf(s, g),
      value: Math.round(s.attrs[g]),
      tier: tier(s.attrs[g]),
      rows,
    };
  });
  return { role, roleName: ROLE_NAME[role], roles, groups };
}

/** 레이더 다각형 좌표. 0~100 값을 중심 c, 반지름 r에 매핑하고 12시 방향부터 시계 방향으로 돈다. */
export function polyPoints(vals: readonly number[], r: number, c: number): string {
  return vals
    .map((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / vals.length;
      return `${(c + (Math.cos(a) * r * v) / 100).toFixed(1)},${(c + (Math.sin(a) * r * v) / 100).toFixed(1)}`;
    })
    .join(' ');
}

// 숫자로 끝나면 한국어 읽기(영·일·이·삼·사·오·육·칠·팔·구)의 받침을 쓴다: ㅇ(21)·ㄹ(8)·ㅁ(16)·ㄱ(1).
const DIGIT_JONG = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];

/** 마지막 글자의 종성 번호(0 = 받침 없음). 한글·숫자가 아니면 -1. */
function jongOf(word: string): number {
  const last = word.charCodeAt(word.length - 1);
  if (last >= 48 && last <= 57) return DIGIT_JONG[last - 48]!;
  const code = last - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : -1;
}

/** 이름 뒤에 '로/으로'를 붙인다. 받침이 없거나 ㄹ이면 '로', 한글이 아니면 '(으)로'. */
export function withRo(name: string): string {
  const jong = jongOf(name);
  if (jong < 0) return `${name}(으)로`;
  return `${name}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}

/** 받침이 있으면 '이', 없으면(한글이 아니어도) '가'. */
export const iGa = (word: string): string => (jongOf(word) > 0 ? '이' : '가');
/** 받침이 있으면 '과', 없으면(한글이 아니어도) '와'. */
export const waGwa = (word: string): string => (jongOf(word) > 0 ? '과' : '와');
/** 단어 뒤에 '을/를'을 붙인다. 받침이 있으면 '을', 없으면(한글이 아니어도) '를'. */
export const withEulReul = (word: string): string => `${word}${jongOf(word) > 0 ? '을' : '를'}`;

/** 경과 시간(ms)을 '방금 · N분 전 · N시간 전 · 어제 · N일 전'으로(홈 라이브·전광판). */
export function agoKo(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return L.agoNow;
  if (s < 3600) return L.agoMin({ n: Math.floor(s / 60) });
  if (s < 86400) return L.agoHour({ n: Math.floor(s / 3600) });
  return s < 172800 ? L.agoYesterday : L.agoDay({ n: Math.floor(s / 86400) });
}
