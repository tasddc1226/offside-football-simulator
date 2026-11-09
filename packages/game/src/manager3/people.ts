// T-11-648 감독 커리어 3 사람: 감독 시작 능력치, 선수 만들기 · 몸값 · 성장 · 유스. 난수는 부르는 쪽이 넘기는 r()만 쓴다.
import type { ManagerOrigin } from '@offside/contracts/manager-rules';
import { CLUBS, LEAGUES, type League } from '../data.js';
import { managerStart } from '../manager.js';
import { RIVAL_COUNTRY } from '../rival-names.js';
import { squadName } from './names.js';
import {
  M3_ATTRS,
  M3_LICENSE_CAP,
  M3_ROLE_GROUP,
  M3_TRAITS,
  type M3Attrs,
  type M3License,
  type M3Role,
} from './rules.js';
import type { M3Club, M3Player, M3State } from './types.js';

export type R = () => number;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ri = (r: R, a: number, b: number) => Math.floor(a + r() * (b - a + 1));
export const pickOf = <T>(r: R, a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
export function gauss(r: R): number {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// T-11-457 시즌 2에 연 리그는 감독 모드에서 쓰지 않는다(커리어 2와 같다).
export const M3_LEAGUES: League[] = LEAGUES.filter((l) => !l.amateur && !l.added);
export const leagueOf = (id: string): League => M3_LEAGUES.find((l) => l.id === id)!;
export const clubsOf = (leagueId: string) => CLUBS.filter((c) => c.leagueId === leagueId);
export const MAX_TIER = Math.max(...M3_LEAGUES.map((l) => l.tier));

// ───────── 감독 ─────────

/** 선수 시절 기록으로 정한 감독 능력치(흔들림 없음, 자격 C 상한 안). 후보 이력서 미리 보기가 이 값을 쓴다. */
export function baseAttrs(o: ManagerOrigin): M3Attrs {
  const st = managerStart(o);
  const peak = clamp(o.peak, 50, 99);
  const fw = o.pos === 'FW' ? 1 : 0;
  const df = o.pos === 'DF' || o.pos === 'GK' ? 1 : 0;
  const mf = o.pos === 'MF' ? 1 : 0;
  const base: M3Attrs = {
    atk: 28 + fw * 14 + mf * 6 + (peak - 60) * 0.35,
    def: 28 + df * 14 + mf * 6 + (peak - 60) * 0.35,
    tac: 26 + o.seasons * 1.2 + mf * 8,
    mgmt: st.control * 0.75,
    motiv: 30 + o.trophies * 1.5 + o.caps / 6,
    youth: 32,
    eye: 26 + o.seasons * 0.9 + o.clubs * 2.5,
    disc: 28 + o.apps / 25,
    adapt: st.adapt * 0.75,
  };
  return Object.fromEntries(
    M3_ATTRS.map((k) => [k, clamp(Math.round(base[k]), 15, M3_LICENSE_CAP.C)]),
  ) as M3Attrs;
}

/** 실제 시작값: 기본값에 ±5 안쪽 흔들림. */
export function startAttrs(o: ManagerOrigin, r: R): M3Attrs {
  const base = baseAttrs(o);
  return Object.fromEntries(
    M3_ATTRS.map((k) => [
      k,
      clamp(Math.round(base[k] + clamp(gauss(r) * 2.5, -5, 5)), 15, M3_LICENSE_CAP.C),
    ]),
  ) as M3Attrs;
}

export const attrCap = (l: M3License) => M3_LICENSE_CAP[l];
export const avgAttr = (a: M3Attrs) => M3_ATTRS.reduce((t, k) => t + a[k], 0) / M3_ATTRS.length;

// ───────── 선수 ─────────

/** 구단이 있는 리그의 이름 풀(한국 리그는 KR). 다섯에 하나는 다른 나라 선수. */
function nationFor(leagueId: string, r: R): string {
  const home = RIVAL_COUNTRY[leagueId] ?? 'KR';
  if (r() < 0.8) return home;
  return pickOf(r, ['KR', ...Object.values(RIVAL_COUNTRY)]);
}

/** 몸값(만 원). OVR이 1 오를 때 12%, 어리고 잠재력이 높을수록 비싸다. */
export function playerValue(p: Pick<M3Player, 'ovr' | 'pot' | 'age'>): number {
  const ageF = p.age <= 21 ? 1.25 : p.age <= 27 ? 1 : p.age <= 30 ? 0.8 : p.age <= 33 ? 0.5 : 0.25;
  const upside = 1 + clamp(p.pot - p.ovr, 0, 30) / 30;
  return Math.max(
    500,
    Math.round((10000 * Math.pow(1.12, p.ovr - 50) * ageF * upside) / 100) * 100,
  );
}
/** 시즌 주급 총액(만 원): 몸값의 12% 근처, 리그 자금력이 높으면 더 준다. */
export const wageFor = (p: Pick<M3Player, 'ovr' | 'pot' | 'age'>, wealth: number) =>
  Math.max(200, Math.round((playerValue(p) * (0.1 + wealth / 400)) / 100) * 100);

const ROLE_MIX: readonly M3Role[] = [
  'GK',
  'GK',
  'GK',
  'CB',
  'CB',
  'CB',
  'CB',
  'FB',
  'FB',
  'FB',
  'FB',
  'DM',
  'DM',
  'CM',
  'CM',
  'CM',
  'AM',
  'AM',
  'WG',
  'WG',
  'WG',
  'ST',
  'ST',
  'ST',
];

/** 같은 선수단에 같은 이름이 둘 생기지 않게 몇 번 다시 뽑는다(판매 · 방출 때 구분되게). */
function uniqueName(r: R, nat: string, taken: Set<string>): string {
  let name = squadName(r, nat);
  for (let i = 0; i < 12 && taken.has(name); i++) name = squadName(r, nat);
  taken.add(name);
  return name;
}

export function makePlayer(
  s: Pick<M3State, 'nextId'> & { squad?: readonly M3Player[] },
  r: R,
  o: {
    role: M3Role;
    age: number;
    ovr: number;
    pot: number;
    leagueId: string;
    academy?: boolean;
    /** 피할 이름(없으면 지금 선수단 이름). 새 이름이 더해진다. */
    taken?: Set<string>;
  },
): M3Player {
  const wealth = leagueOf(o.leagueId).wealth;
  const nat = o.academy ? (RIVAL_COUNTRY[o.leagueId] ?? 'KR') : nationFor(o.leagueId, r);
  const taken = o.taken ?? new Set((s.squad ?? []).map((p) => p.name));
  const p: M3Player = {
    id: s.nextId++,
    name: uniqueName(r, nat, taken),
    nat,
    role: o.role,
    age: o.age,
    ovr: clamp(Math.round(o.ovr), 30, 99),
    pot: clamp(Math.round(Math.max(o.pot, o.ovr)), 30, 99),
    morale: ri(r, 55, 75),
    fit: 100,
    inj: 0,
    contract: ri(r, 1, 4),
    wage: 0,
    trait: r() < 0.45 ? pickOf(r, M3_TRAITS) : null,
    academy: !!o.academy,
    apps: 0,
    goals: 0,
    listed: null,
  };
  p.wage = wageFor(p, wealth);
  return p;
}

/** 구단 선수단 24명: 주전 11명 평균이 구단 전력 근처가 되게 만든다. */
export function makeSquad(s: Pick<M3State, 'nextId'>, club: M3Club, r: R): M3Player[] {
  const taken = new Set<string>();
  return ROLE_MIX.map((role, i) => {
    // 앞쪽(역할마다 첫 번째 · 두 번째)은 주전감, 뒤쪽은 백업 · 유망주.
    const depth = ROLE_MIX.slice(0, i).filter((x) => x === role).length;
    const starter = depth < (role === 'GK' ? 1 : role === 'CB' || role === 'FB' ? 2 : 1);
    const young = !starter && r() < 0.35;
    const age = young ? ri(r, 17, 21) : starter ? ri(r, 22, 31) : ri(r, 20, 33);
    const ovr = club.base + (starter ? 1 : -4) + gauss(r) * 2.5 - (young ? 5 : 0);
    const pot = ovr + (age <= 21 ? 4 + r() * 12 : age <= 25 ? r() * 5 : 0);
    return makePlayer(s, r, { role, age, ovr, pot, leagueId: club.leagueId, taken });
  });
}

export const groupOf = (p: Pick<M3Player, 'role'>) => M3_ROLE_GROUP[p.role];

/**
 * 시즌 리뷰 성장: 어린 선수는 잠재력 쪽으로(훈련장 · 유스 육성 · 출전 비율), 25~29세는 작게 흔들리고 30세부터 떨어진다.
 * 돌려주는 값은 OVR 변화.
 */
export function developPlayer(
  p: M3Player,
  r: R,
  o: { trainFac: number; youthAttr: number; playRatio: number },
): number {
  const before = p.ovr;
  const gap = Math.max(0, p.pot - p.ovr);
  let d: number;
  if (p.age <= 21) {
    const rate = 0.2 + o.trainFac * 0.03 + o.youthAttr / 450;
    d = gap * rate * (0.55 + 0.45 * o.playRatio) + gauss(r);
  } else if (p.age <= 24) {
    d = gap * (0.14 + o.trainFac * 0.02) * (0.6 + 0.4 * o.playRatio) + gauss(r) * 0.8;
  } else if (p.age <= 29) {
    d = gauss(r) * 0.9 + (p.trait === 'pro' ? 0.3 : p.trait === 'lazy' ? -0.4 : 0);
  } else if (p.age <= 32) d = -1 - r() * 1.5;
  else d = -2 - r() * 2.5;
  if (p.trait === 'pro' && d < 0) d *= 0.7;
  p.ovr = clamp(Math.round(p.ovr + d), 30, Math.max(p.pot, p.ovr));
  if (p.ovr > p.pot) p.pot = p.ovr;
  p.age += 1;
  return p.ovr - before;
}

/** 은퇴할지(나이 · 실력). */
export const retires = (p: M3Player, leagueAvg: number, r: R) =>
  (p.age >= 34 && r() < (p.age - 33) * 0.28) || (p.age >= 32 && p.ovr < leagueAvg - 16);

/** 유스 인테이크 3~5명(유스 시설 · 유스 육성, 드물게 대형 유망주). */
export function youthIntake(s: M3State, r: R): M3Player[] {
  const club = s.club!;
  const L = leagueOf(club.leagueId);
  const n = 3 + (club.youthFac >= 4 ? 1 : 0) + (r() < 0.4 ? 1 : 0);
  const out: M3Player[] = [];
  const taken = new Set(s.squad.map((p) => p.name));
  for (let i = 0; i < n; i++) {
    const wonder = r() < 0.03 + s.attrs.youth / 3000;
    const ovr = L.avg - 15 + club.youthFac + gauss(r) * 3;
    const pot =
      L.avg - 4 + club.youthFac * 2 + s.attrs.youth / 10 + gauss(r) * 5 + (wonder ? 12 : 0);
    const p = makePlayer(s, r, {
      role: pickOf(r, ROLE_MIX),
      age: ri(r, 16, 17),
      ovr,
      pot,
      leagueId: club.leagueId,
      academy: true,
      taken,
    });
    p.contract = 3;
    out.push(p);
  }
  return out;
}

/** 리그 등급으로 정한 시설 수준(1~5). */
export const facilitiesFor = (tier: number) => clamp(1 + Math.round(tier / 2), 1, 5);
