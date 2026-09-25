// ───────── 세부 능력치 체계 (FIFA / EA SPORTS FC 방식) ─────────
import { ATTR_KEYS, POS, type AttrKey, type Pos } from './data.js';
import { clamp, ri } from './rng.js';
import type { GameState } from './types.js';

export const SUBS: Record<string, string> = {
  acc: '가속력', spr: '질주 속도',
  pos: '위치 선정', fin: '골 결정력', pow: '슛 파워', lng: '중거리 슛', vol: '발리슛', pen: '페널티킥',
  vis: '시야', cro: '크로스', fk: '프리킥', spa: '짧은 패스', lpa: '긴 패스', cur: '커브',
  agi: '민첩성', bal: '밸런스', rea: '반응 속도', bc: '볼 컨트롤', drb: '드리블', com: '침착성',
  int: '가로채기', hea: '헤딩 정확도', awa: '수비 인식', stt: '스탠딩 태클', sli: '슬라이딩 태클',
  jmp: '점프력', stm: '체력', str: '힘', agg: '적극성',
  div: '다이빙', han: '핸들링', kic: '킥', gkp: '포지셔닝', ref: '반사 신경',
};
export const SUB_KEYS = Object.keys(SUBS);
export const GK_SUBS = ['div', 'han', 'kic', 'gkp', 'ref'];

type Face = Partial<Record<AttrKey, Partial<Record<string, number>>>>;
export const FACE: Record<AttrKey, Record<string, number>> = {
  pac: { acc: 0.45, spr: 0.55 },
  sho: { pos: 0.05, fin: 0.45, pow: 0.2, lng: 0.2, vol: 0.05, pen: 0.05 },
  pas: { vis: 0.2, cro: 0.2, fk: 0.05, spa: 0.35, lpa: 0.15, cur: 0.05 },
  dri: { agi: 0.1, bal: 0.05, rea: 0.05, bc: 0.3, drb: 0.45, com: 0.05 },
  def: { int: 0.2, hea: 0.1, awa: 0.3, stt: 0.3, sli: 0.1 },
  phy: { jmp: 0.05, stm: 0.25, str: 0.5, agg: 0.2 },
};
export const GK_FACE: Record<AttrKey, Record<string, number>> = {
  def: { div: 1 }, pac: { ref: 0.8, rea: 0.2 }, phy: { han: 0.7, jmp: 0.15, str: 0.15 },
  pas: { kic: 0.6, lpa: 0.2, spa: 0.2 }, dri: { gkp: 0.8, com: 0.2 }, sho: { acc: 0.45, spr: 0.55 },
};
export const faceOf = (s: GameState) => (s.pos === 'GK' ? GK_FACE : FACE);
export const RADAR_ORDER: { field: AttrKey[]; GK: AttrKey[] } = {
  field: ['pac', 'sho', 'pas', 'dri', 'def', 'phy'],
  GK: ['def', 'phy', 'pas', 'pac', 'sho', 'dri'],
};
export const radarOrder = (pos: Pos): AttrKey[] => (pos === 'GK' ? RADAR_ORDER.GK : RADAR_ORDER.field);
export const FACE_ABBR: Record<AttrKey, string> = { pac: 'PAC', sho: 'SHO', pas: 'PAS', dri: 'DRI', def: 'DEF', phy: 'PHY' };
export const GK_ABBR: Record<AttrKey, string> = { def: 'DIV', phy: 'HAN', pas: 'KIC', pac: 'REF', sho: 'SPD', dri: 'POS' };

const ROLE_RAW: Record<string, Record<string, number>> = {
  ST: { fin: 18, pos: 13, hea: 10, pow: 10, rea: 8, drb: 7, bc: 10, vol: 2, lng: 3, acc: 4, spr: 5, str: 5, com: 5 },
  CF: { fin: 11, pos: 13, hea: 2, pow: 5, rea: 9, drb: 14, bc: 15, lng: 4, acc: 5, spr: 5, spa: 9, vis: 8 },
  RW: { fin: 10, pos: 9, rea: 7, drb: 16, bc: 14, lng: 4, acc: 7, spr: 6, agi: 3, cro: 9, spa: 9, vis: 6 },
  CAM: { fin: 7, pos: 9, rea: 7, drb: 13, bc: 15, lng: 5, acc: 4, agi: 3, spa: 16, vis: 14, lpa: 4, com: 3 },
  CM: { rea: 8, drb: 7, bc: 14, lng: 4, spa: 17, lpa: 13, vis: 13, int: 5, stt: 5, stm: 6, pos: 6, com: 2 },
  CDM: { rea: 7, bc: 10, spa: 14, lpa: 10, vis: 4, int: 14, awa: 14, stt: 12, sli: 5, stm: 6, str: 4, agg: 5 },
  RB: { acc: 5, spr: 7, stm: 8, rea: 8, bc: 7, cro: 9, hea: 4, spa: 7, int: 12, awa: 8, stt: 11, sli: 14 },
  CB: { spr: 2, rea: 5, bc: 4, hea: 10, spa: 5, int: 13, awa: 14, stt: 17, sli: 14, str: 10, agg: 7, jmp: 3 },
  GK: { div: 21, han: 21, kic: 5, ref: 21, rea: 11, gkp: 21 },
};
export const ROLES: Record<string, Record<string, number>> = Object.fromEntries(
  Object.entries(ROLE_RAW).map(([r, w]) => {
    const t = Object.values(w).reduce((a, b) => a + b, 0);
    return [r, Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / t]))];
  }),
);
export const ROLE_NAME: Record<string, string> = {
  ST: '스트라이커', CF: '섀도 스트라이커', RW: '윙어', CAM: '공격형 미드필더', CM: '중앙 미드필더', CDM: '수비형 미드필더', RB: '풀백', CB: '센터백', GK: '골키퍼',
};
const TYPE_ROLE: Record<string, string> = {
  poacher: 'ST', speed: 'ST', target: 'ST', maker: 'CAM', b2b: 'CM', winger: 'RW', stopper: 'CB', fullback: 'RB', libero: 'CB', shot: 'GK', sweeper: 'GK', wall: 'GK',
};
export const POS_ROLES: Record<Pos, string[]> = { FW: ['ST', 'CF', 'RW'], MF: ['CAM', 'CM', 'CDM', 'RW'], DF: ['CB', 'RB', 'CDM'], GK: ['GK'] };
export const mainRole = (s: GameState): string => TYPE_ROLE[s.type] ?? POS_ROLES[s.pos][0]!;

function groupOfSub(face: Face, k: string): AttrKey | null {
  for (const g in face) if ((face as Record<string, Record<string, number>>)[g]?.[k] !== undefined) return g as AttrKey;
  return null;
}
export const GROUP_W: Record<string, Record<AttrKey, number>> = Object.fromEntries(
  Object.keys(ROLES).map((r) => {
    const face = r === 'GK' ? GK_FACE : FACE;
    const w = Object.fromEntries(ATTR_KEYS.map((g) => [g, 0])) as Record<AttrKey, number>;
    for (const [k, v] of Object.entries(ROLES[r]!)) {
      const g = groupOfSub(face, k);
      if (g) w[g] += v;
    }
    return [r, w];
  }),
);
export const wOf = (s: GameState): Record<AttrKey, number> => GROUP_W[mainRole(s)]!;

export function ovrRole(s: GameState, role: string): number {
  let t = 0;
  for (const [k, v] of Object.entries(ROLES[role]!)) t += (s.sub[k] ?? 0) * v;
  return t;
}
export function ovr(s: GameState): number {
  return Math.round(ovrRole(s, mainRole(s)));
}
export function syncFace(s: GameState) {
  const F = faceOf(s);
  for (const g of ATTR_KEYS) {
    let t = 0;
    for (const [k, v] of Object.entries(F[g]!)) t += (s.sub[k] ?? 0) * v;
    s.attrs[g] = Math.round(t * 10) / 10;
  }
}

export function spreadAttr(s: GameState, k: AttrKey, v: number) {
  const F = faceOf(s)[k]!;
  const W = ROLES[mainRole(s)]!;
  const sh: Record<string, number> = {};
  let norm = 0;
  for (const [i, f] of Object.entries(F)) {
    sh[i] = 0.5 + (W[i] ?? 0) * (v > 0 ? 1.5 : 6);
    norm += f * sh[i]!;
  }
  for (const i in F) s.sub[i] = clamp(Math.round((s.sub[i]! + (v * sh[i]!) / norm) * 10) / 10, 1, 99);
  syncFace(s);
}

export function initSubs(s: GameState, base: Record<AttrKey, number>, targetOvr?: number) {
  const role = mainRole(s);
  const W = ROLES[role]!;
  const F = faceOf(s);
  const GW = GROUP_W[role]!;
  const core = ATTR_KEYS.reduce((t, g) => t + base[g] * GW[g], 0);
  s.sub = {};
  for (const k of SUB_KEYS) {
    const g = groupOfSub(F, k);
    if (!g) {
      s.sub[k] = clamp((s.pos === 'GK' ? 28 : GK_SUBS.includes(k) ? 12 : 30) + ri(-5, 5), 5, 60);
      continue;
    }
    const gv = base[g];
    const w = W[k] ?? 0;
    const a = Math.min(0.6, w * 4);
    const v = Math.max(gv, gv + a * (core - gv)) + (w ? Math.round((w * 100 - 5) * 0.25) : -1) + ri(-4, 4);
    s.sub[k] = clamp(v, 10, 80);
  }
  if (targetOvr !== undefined) {
    const d = targetOvr - ovrRole(s, role);
    for (const k in W) s.sub[k] = clamp(Math.round((s.sub[k]! + d) * 10) / 10, 5, 99);
  }
  syncFace(s);
}
export function legacyOvr(pos: Pos, a: Record<AttrKey, number>): number {
  const w = POS[pos].w;
  return ATTR_KEYS.reduce((t, k) => t + a[k] * (w[k] ?? 0), 0);
}
