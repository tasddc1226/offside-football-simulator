// ───────── 순수 포맷/집계 헬퍼 (ui.ts의 문자열 템플릿 함수들을 컴포넌트가 쓰기 좋은 형태로 분리) ─────────
import { labelOf } from '../game/engine.js';
import { LEAGUES } from '../game/data.js';
import type { AttrKey } from '../game/data.js';
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
} from '../game/attributes.js';
import type { CareerRecord, GameState } from '../game/types.js';

export { anonName } from '../game/pos-label.js';
export { fmtValue } from '@offside/contracts/market-value';

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

// 한글 검색(T-10-099): 초성(ㅂㄹㅈ)과 타이핑 중인 마지막 글자(브랒 → 브라질)도 맞는 것으로 본다.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
// 홑받침 번호 → 같은 소리의 초성 번호. 겹받침은 다음 글자로 넘기지 않는다.
const JONG_CHO: Record<number, number> = { 1: 0, 2: 1, 4: 2, 7: 3, 8: 5, 16: 6, 17: 7, 19: 9, 20: 10, 21: 11, 22: 12, 23: 14, 24: 15, 25: 16, 26: 17, 27: 18 };

const syl = (c: string): number => {
  const n = c.charCodeAt(0) - 0xac00;
  return n >= 0 && n <= 11171 ? n : -1;
};
const choOf = (c: string): number => {
  const n = syl(c);
  return n < 0 ? -1 : Math.floor(n / 588);
};

/** 검색어 한 글자 q가 이름의 name[i]에 맞는가. last면 받침이 다음 글자의 초성으로 넘어가는 경우도 본다. */
function charMatches(q: string, name: string, i: number, last: boolean): boolean {
  const c = name[i]!;
  if (q === c) return true;
  const qc = CHO.indexOf(q);
  if (qc >= 0) return choOf(c) === qc;
  const qs = syl(q);
  const cs = syl(c);
  if (!last || qs < 0 || cs < 0 || Math.floor(qs / 28) !== Math.floor(cs / 28)) return false;
  const qj = qs % 28;
  // '브' → 브·블·븐… / '블' → 브 + 다음 글자 초성 ㄹ(브라질)
  return qj === 0 || (cs % 28 === 0 && JONG_CHO[qj] != null && i + 1 < name.length && choOf(name[i + 1]!) === JONG_CHO[qj]);
}

/** 이름에서 한글 검색어가 시작하는 위치(띄어쓰기·대소문자 무시). 없으면 -1, 빈 검색어는 0. */
export function koMatchAt(name: string, query: string): number {
  const q = query.replace(/\s+/g, '').toLowerCase();
  const n = name.replace(/\s+/g, '').toLowerCase();
  outer: for (let s = 0; s + q.length <= n.length; s++) {
    for (let k = 0; k < q.length; k++) if (!charMatches(q[k]!, n, s + k, k === q.length - 1)) continue outer;
    return s;
  }
  return -1;
}
