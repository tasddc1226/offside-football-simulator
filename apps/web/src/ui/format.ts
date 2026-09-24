// ───────── 순수 포맷/집계 헬퍼 (ui.ts의 문자열 템플릿 함수들을 컴포넌트가 쓰기 좋은 형태로 분리) ─────────
import { LEAGUES } from '../game/data.js';
import type { AttrKey } from '../game/data.js';
import {
  ovrRole, mainRole, ROLES, ROLE_NAME, POS_ROLES, faceOf, RADAR_ORDER, FACE_ABBR, GK_ABBR, SUBS,
} from '../game/attributes.js';
import type { CareerRecord, GameState } from '../game/types.js';

export function seasonLabelOf(r: CareerRecord): string {
  const L = LEAGUES.find((l) => l.name === r.league);
  return L && L.tier >= 4 ? `${r.year}-${String((r.year + 1) % 100).padStart(2, '0')}` : `${r.year}`;
}

export function totals(s: GameState) {
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
  const order = (s.pos === 'GK' ? RADAR_ORDER.GK : RADAR_ORDER.field) as AttrKey[];
  const abbr = s.pos === 'GK' ? GK_ABBR : FACE_ABBR;
  const CX = 150,
    R = 92,
    n = order.length;
  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [CX + (Math.cos(a) * R * v) / 100, CX + (Math.sin(a) * R * v) / 100];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [20, 40, 60, 80, 100].map((r) => poly(order.map(() => r)));
  const spokes = order.map((_, i) => pt(i, 100));
  const prev = s.seasonStart ? poly(order.map((k) => s.seasonStart[k])) : null;
  const now = poly(order.map((k) => s.attrs[k]));
  const dots = order.map((k, i) => pt(i, s.attrs[k]));
  const points: RadarPoint[] = order.map((k, i) => {
    const [x, y] = pt(i, 126);
    const v = Math.round(s.attrs[k]);
    const d = s.seasonStart ? v - Math.round(s.seasonStart[k]) : 0;
    const anchor = Math.abs(x - CX) < 4 ? 'middle' : x > CX ? 'start' : 'end';
    return { key: k, labelKr: labelOfAttr(s, k), abbr: abbr[k]!, x, y, labelX: x, labelY: y - 7, anchor, value: v, delta: d };
  });
  return { CX, rings, spokes, prev, now, dots, points, ariaLabel: order.map((k) => `${labelOfAttr(s, k)} ${Math.round(s.attrs[k])}`).join(', ') };
}

// engine.ts의 labelOf는 GameState를 요구하는 시그니처라 여기서 재수출하지 않고 얇게 감싼다.
import { labelOf } from '../game/engine.js';
function labelOfAttr(s: GameState, k: AttrKey): string {
  return labelOf(s, k);
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
  const order = (s.pos === 'GK' ? RADAR_ORDER.GK : RADAR_ORDER.field) as AttrKey[];
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
    return { key: g, abbr: abbr[g]!, labelKr: labelOfAttr(s, g), value: Math.round(s.attrs[g]), tier: tier(s.attrs[g]), rows };
  });
  return { role, roleName: ROLE_NAME[role], roles, groups };
}
