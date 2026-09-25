// ───────── 순수 포맷/집계 헬퍼 (ui.ts의 문자열 템플릿 함수들을 컴포넌트가 쓰기 좋은 형태로 분리) ─────────
import { labelOf } from '../game/engine.js';
import { LEAGUES, POS } from '../game/data.js';
import type { AttrKey, Pos } from '../game/data.js';
import {
  ovrRole, mainRole, ROLES, ROLE_NAME, POS_ROLES, faceOf, radarOrder, FACE_ABBR, GK_ABBR, SUBS,
} from '../game/attributes.js';
import type { CareerRecord, GameState } from '../game/types.js';

/** 이름을 공개하지 않은 선수 표기(명예의 전당·서버 최초 기록). */
export function anonName(pos: Pos, number: number | null): string {
  return `익명의 ${POS[pos].label}${number != null ? ` No.${number}` : ''}`;
}

export function seasonLabelOf(r: CareerRecord): string {
  const L = LEAGUES.find((l) => l.name === r.league);
  return L && L.tier >= 4 ? `${r.year}-${String((r.year + 1) % 100).padStart(2, '0')}` : `${r.year}`;
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
    return { key: k, labelKr: labelOf(s, k), abbr: abbr[k]!, x, y, labelX: x, labelY: y - 7, anchor, value: v, delta: d };
  });
  // T-10-003: 능력치가 바뀔 때(훈련·이벤트) rd-now 폴리곤을 즉시 스냅하지 않고 부드럽게 모핑하기
  // 위해, Radar.svelte가 nowVals(순서대로의 숫자 배열)를 직접 트윈하고 poly()와 같은 방식으로
  // 각 프레임의 좌표 문자열을 다시 계산할 수 있도록 toPoly를 함께 내보낸다.
  const toPoly = (vals: number[]) => poly(vals);
  return { CX, rings, spokes, prev, now, nowVals, toPoly, dots, points, ariaLabel: order.map((k) => `${labelOf(s, k)} ${Math.round(s.attrs[k])}`).join(', ') };
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
  const tier = (v: number): 't1' | 't2' | 't3' | 't4' => (v >= 80 ? 't4' : v >= 70 ? 't3' : v >= 50 ? 't2' : 't1');
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
    return { key: g, abbr: abbr[g]!, labelKr: labelOf(s, g), value: Math.round(s.attrs[g]), tier: tier(s.attrs[g]), rows };
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

/** 마지막 글자의 종성 번호(0 = 받침 없음). 한글이 아니면 -1. */
function jongOf(word: string): number {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
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
