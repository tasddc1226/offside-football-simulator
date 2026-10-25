// T-11-492 문자중계 2D 그라운드. 서버가 정한 결과와 중계 줄을 그라운드 위 짧은 움직임으로 보여 주는 연출이다. 경기 계산에는
// 선수 위치가 없고, 여기서 그리는 위치는 결과를 바꾸지 않는다. 줄의 문구 키(say)와 득점자 자리(slot)로 움직임을 고르고(글과
// 그림이 같은 장면을 말하게), 줄 내용으로 난수를 굴려 같은 경기는 다시 봐도 같은 움직임이 나온다. 웹 MatchGround.svelte ·
// 앱 MatchGround.tsx가 같이 쓴다.
// 좌표는 그라운드 가로(x: 0 = 홈 골문, 100 = 원정 골문)와 세로(y: 0 = 위) 백분율이다. 홈은 오른쪽으로 공격한다.
import { presetLayout } from '@offside/contracts/owner-team';
import { BASE_DETAIL, type BaseDetailPos, type DetailPos } from '@offside/contracts/positions';
import type { TeamMatch, TeamMoment } from './api/team.js';
import { lineWaitMs, rngOf, type LiveKind, type LiveLine } from './teamLive.js';
import type { NameOf } from './teamMoments.js';

export type GroundSide = 'home' | 'away';
export type Pt = readonly [number, number];

/** 그라운드 너비 : 높이(105m × 68m). */
export const GROUND_RATIO = 105 / 68;

export type GroundPlayer = {
  key: string;
  side: GroundSide;
  /** 연출용 등번호(자리로 정한다). */
  no: number;
  slot: BaseDetailPos;
  /** 그 팀 기준 왼쪽(0) → 오른쪽(100). */
  lane: number;
  x: number;
  y: number;
};

export type GroundPose = {
  ball: Pt;
  /** 기본 자리에서 따로 움직이는 선수(key → 위치). */
  moves?: Readonly<Record<string, Pt>>;
  /** 공을 가진 선수 · 장면의 주인공. */
  hl?: string;
  /** 장면 경기의 동료(주인공보다 조금 덜 강조). */
  mate?: string;
  /** 이름표(key → 이름). */
  tags?: Readonly<Record<string, string>>;
  /** 강조한 선수 말고는 흐리게(장면 멈춤). */
  dim?: boolean;
  /** 팀 전체가 밀리는 정도(가로 %, 홈 쪽이 +). */
  push?: number;
  /** 줄 대기 시간 중 이 동작이 쓰는 몫. */
  t: number;
  /** 골이 들어갔다(넣은 팀). */
  goal?: GroundSide;
};

/** 장면 카드의 선택지 화살표(n = 선택지 번호, 1부터). */
export type GroundArrow = { n: number; from: Pt; to: Pt; curve: boolean };

export type GroundSpot = {
  key: string;
  side: GroundSide;
  no: number;
  x: number;
  y: number;
  on: boolean;
  mate: boolean;
  dim: boolean;
  tag: string | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 공격하는 팀 기준(a: 자기 골문 0 → 상대 골문 100, lane: 그 팀 왼쪽 0 → 오른쪽 100)을 그라운드 좌표로. */
export const at = (side: GroundSide, a: number, lane: number): Pt =>
  side === 'home' ? [a, lane] : [100 - a, 100 - lane];

const KIT: Record<BaseDetailPos, readonly number[]> = {
  GK: [1],
  FB: [3, 2, 12],
  CB: [4, 5, 6, 15],
  DM: [6, 16],
  CM: [8, 14, 18],
  AM: [10, 20],
  W: [11, 7, 17],
  ST: [9, 19, 21],
};

/** 두 팀 22명의 기본 자리(포메이션 배치를 눕혀 홈은 왼쪽 진영, 원정은 오른쪽 진영). */
export function groundLineup(m: Pick<TeamMatch, 'home' | 'away'>): GroundPlayer[] {
  return (['home', 'away'] as const).flatMap((side) => {
    const layout = presetLayout(m[side].formation).map((p, i) => ({
      ...p,
      i,
      base: BASE_DETAIL[p.slot],
    }));
    const used = new Set<number>();
    const no = new Map<number, number>();
    for (const p of [...layout].sort((a, b) => a.x - b.x || a.i - b.i)) {
      const n = KIT[p.base].find((k) => !used.has(k)) ?? 30 + p.i;
      used.add(n);
      no.set(p.i, n);
    }
    return layout.map((p) => {
      const [x, y] = at(side, (100 - p.y) * 0.75, p.x);
      return { key: `${side[0]}${p.i}`, side, no: no.get(p.i)!, slot: p.base, lane: p.x, x, y };
    });
  });
}

const FALLBACK: Record<BaseDetailPos, readonly BaseDetailPos[]> = {
  GK: ['GK'],
  CB: ['CB', 'FB', 'DM'],
  FB: ['FB', 'W', 'CB'],
  DM: ['DM', 'CM', 'CB'],
  CM: ['CM', 'DM', 'AM'],
  AM: ['AM', 'CM', 'ST'],
  W: ['W', 'FB', 'AM', 'ST'],
  ST: ['ST', 'AM', 'W', 'CM'],
};
type Hint = 'L' | 'R' | undefined;

/** 그 자리(없으면 비슷한 자리)의 선수. hint면 그 쪽 측면 선수를 먼저 고른다. */
function role(
  team: readonly GroundPlayer[],
  want: BaseDetailPos,
  rnd: () => number,
  hint?: Hint,
  not: readonly string[] = [],
) {
  for (const b of FALLBACK[want]) {
    const c = team.filter((p) => p.slot === b && !not.includes(p.key));
    if (!c.length) continue;
    const near = hint ? c.filter((p) => (hint === 'L' ? p.lane < 50 : p.lane > 50)) : [];
    const list = near.length ? near : c;
    return list[Math.floor(rnd() * list.length)]!;
  }
  return team.find((p) => p.slot !== 'GK' && !not.includes(p.key)) ?? team[0]!;
}
const hintOf = (slot: DetailPos | undefined): Hint =>
  slot?.startsWith('L') ? 'L' : slot?.startsWith('R') ? 'R' : undefined;
const keeper = (team: readonly GroundPlayer[]) => team.find((p) => p.slot === 'GK') ?? team[0]!;
/** 그 자리에 가장 가까운 필드 선수 n명(골키퍼 제외). */
function nearest(team: readonly GroundPlayer[], pt: Pt, n = 1, not: readonly string[] = []) {
  return team
    .filter((p) => p.slot !== 'GK' && !not.includes(p.key))
    .sort((a, b) => Math.hypot(a.x - pt[0], a.y - pt[1]) - Math.hypot(b.x - pt[0], b.y - pt[1]))
    .slice(0, n);
}
/** 측면 선수가 달리는 줄(그 팀 기준). */
const wing = (p: GroundPlayer) => (p.lane < 50 ? 10 : 90);

type Move = readonly [GroundPlayer, Pt];

/** 한 줄의 동작 묶음. 앞 동작에서 옮긴 선수는 그 자리에 남는다. */
class Moves {
  private moved: Record<string, Pt> = {};
  readonly poses: GroundPose[] = [];
  constructor(
    private readonly push: number,
    start: Readonly<Record<string, Pt>> = {},
    private readonly tags?: Readonly<Record<string, string>>,
  ) {
    this.moved = { ...start };
  }
  add(
    t: number,
    ball: Pt,
    moves: readonly Move[],
    hl?: GroundPlayer,
    extra: Partial<GroundPose> = {},
  ) {
    for (const [p, q] of moves) this.moved[p.key] = q;
    this.poses.push({
      t,
      ball,
      moves: { ...this.moved },
      push: this.push,
      ...(hl ? { hl: hl.key } : {}),
      ...(this.tags ? { tags: this.tags } : {}),
      ...extra,
    });
    return this;
  }
}

/** 그 쪽 골문 안(공격하는 팀 기준 a 100). */
const netOf = (side: GroundSide, y: number): Pt => [side === 'home' ? 100 : 0, clamp(y, 46, 54)];

/**
 * 중계 줄 하나의 움직임. prev는 바로 앞 줄의 마지막 자세(골 줄은 빌드업에서 이어 간다, 장면 줄은 멈춘 장면에서 이어 간다).
 * 마지막 자세가 다음 줄 전까지 그대로 남는다.
 */
export function groundPoses(
  matchId: string,
  players: readonly GroundPlayer[],
  line: LiveLine,
  prev: GroundPose | null = null,
): GroundPose[] {
  const rnd = rngOf(`${matchId}:${line.minute}:${line.extra ?? 0}:${line.kind}:${line.say ?? ''}`);
  if (line.kind === 'kickoff' || line.kind === 'ht' || line.kind === 'ft' || !line.side)
    return [{ t: 1, ball: [50, 50] }];
  if (line.kind === 'moment')
    return [prev ? { ...prev, dim: false, t: 1 } : { t: 1, ball: at(line.side, 84, 50) }];

  const s = line.side;
  // 장면 경기 위기에서 막아 낸 줄은 우리(home)가 막은 것이라 공격한 쪽은 원정이다.
  const atk: GroundSide = line.say === 'crisisSave' ? 'away' : s;
  const T = players.filter((p) => p.side === atk);
  const D = players.filter((p) => p.side !== atk);
  const P = (a: number, lane: number) => at(atk, a, lane);
  const dir = atk === 'home' ? 1 : -1;
  const j = (rnd() - 0.5) * 8;
  const g = keeper(D);

  if (line.kind === 'goal') {
    const slot = line.slot;
    // 앞 장면의 주인공 · 동료가 같은 자리면 그 선수가 넣는다(빌드업 · 멈춘 장면에서 이어지게).
    const same = [prev?.hl, prev?.mate]
      .map((k) => T.find((p) => p.key === k))
      .find((p) => p && (!slot || p.slot === BASE_DETAIL[slot]));
    const sc = same ?? role(T, slot ? BASE_DETAIL[slot] : 'ST', rnd, hintOf(slot));
    const was = prev?.moves?.[sc.key] ?? P(89, 50 + j);
    // 측면 끝에서 이어 온 득점자는 안으로 파고든 뒤 찬다.
    const from: Pt =
      Math.abs(was[1] - 50) > 20 ? [atk === 'home' ? 90 : 10, was[1] < 50 ? 40 : 60] : was;
    const net = netOf(atk, from[1] + j / 2);
    const tags = line.goal ? { [sc.key]: line.goal.scorer } : undefined;
    return new Moves(dir * 6, prev?.moves, tags)
      .add(0.3, from, [[sc, from]], sc)
      .add(0.7, net, [[g, [atk === 'home' ? 97 : 3, net[1] + (net[1] < 50 ? 6 : -6)]]], sc, {
        goal: atk,
      }).poses;
  }

  if (line.kind === 'build') {
    const sc = role(T, line.slot ? BASE_DETAIL[line.slot] : 'ST', rnd, hintOf(line.slot));
    const mv = new Moves(dir * 5);
    switch (line.say) {
      case 'buildLeft':
      case 'buildRight': {
        const lane = line.say === 'buildLeft' ? 10 : 90;
        const [d] = nearest(D, P(78, lane));
        return mv
          .add(
            0.5,
            P(74, lane),
            [[sc, P(74, lane)], ...(d ? [[d, P(78, lane < 50 ? 18 : 82)] as Move] : [])],
            sc,
          )
          .add(
            0.5,
            P(91, lane < 50 ? 16 : 84),
            [
              [sc, P(91, lane < 50 ? 16 : 84)],
              ...(d ? [[d, P(88, lane < 50 ? 22 : 78)] as Move] : []),
            ],
            sc,
          ).poses;
      }
      case 'buildWide1': {
        const cr = role(T, 'W', rnd, sc.lane < 50 ? 'R' : 'L', [sc.key]);
        return mv
          .add(
            0.5,
            P(84, wing(cr)),
            [
              [cr, P(84, wing(cr))],
              [sc, P(82, 50)],
            ],
            cr,
          )
          .add(0.5, P(89, 48 + j), [[sc, P(89, 48 + j)]], sc).poses;
      }
      case 'buildWide2': {
        const lane = wing(sc);
        return mv
          .add(0.5, P(78, lane), [[sc, P(78, lane)]], sc)
          .add(0.5, P(85, lane < 50 ? 34 : 66), [[sc, P(85, lane < 50 ? 34 : 66)]], sc).poses;
      }
      case 'build2': {
        const m = role(T, 'CM', rnd, undefined, [sc.key]);
        const cbs = nearest(D, P(84, 50), 2);
        return mv
          .add(0.45, P(52, 50), [[m, P(52, 50)]], m)
          .add(
            0.55,
            P(84, 48 + j),
            [[sc, P(84, 48 + j)], ...cbs.map((d, i) => [d, P(82, i ? 58 : 42)] as Move)],
            sc,
          ).poses;
      }
      case 'buildFwd1': {
        const [d] = nearest(D, P(84, 50));
        return mv
          .add(0.45, P(76, 50), [[sc, P(76, 50)]], sc)
          .add(
            0.55,
            P(88, 50 + j / 2),
            [[sc, P(88, 50 + j / 2)], ...(d ? [[d, P(84, 46)] as Move] : [])],
            sc,
          ).poses;
      }
      case 'buildFwd2': {
        const [d] = nearest(D, P(84, 50));
        return mv
          .add(0.5, P(83, 50), [[sc, P(83, 50)], ...(d ? [[d, P(85.5, 50)] as Move] : [])], sc)
          .add(0.5, P(86, 55), [[sc, P(86, 55)], ...(d ? [[d, P(86, 50)] as Move] : [])], sc).poses;
      }
      case 'build3': {
        const two = nearest(T, P(90, 50), 2, [sc.key]);
        const ds = nearest(D, P(92, 50), 2);
        return mv
          .add(
            0.5,
            P(91, 54),
            [
              [sc, P(90, 48)],
              ...two.map((p, i) => [p, P(89, i ? 56 : 42)] as Move),
              ...ds.map((d, i) => [d, P(93, i ? 54 : 46)] as Move),
            ],
            sc,
          )
          .add(0.5, P(91, 48), [], sc).poses;
      }
      case 'buildMid1':
        return mv
          .add(0.5, P(68, 50), [[sc, P(68, 50)]], sc)
          .add(0.5, P(77, 46 + j), [[sc, P(77, 46 + j)]], sc).poses;
      case 'buildMid2': {
        const st = role(T, 'ST', rnd, undefined, [sc.key]);
        return mv
          .add(
            0.45,
            P(80, 44),
            [
              [st, P(80, 44)],
              [sc, P(70, 56)],
            ],
            st,
          )
          .add(
            0.55,
            P(86, 58),
            [
              [sc, P(86, 58)],
              [st, P(84, 44)],
            ],
            sc,
          ).poses;
      }
      case 'buildSet1': {
        const flag = sc.lane < 50 ? 2 : 98;
        const tk = role(T, 'W', rnd, flag < 50 ? 'L' : 'R', [sc.key]);
        return mv
          .add(
            0.5,
            P(99.5, flag),
            [
              [tk, P(99, flag)],
              [sc, P(86, 50)],
            ],
            tk,
          )
          .add(0.5, P(91, 50), [[sc, P(91, 50)]], sc).poses;
      }
      case 'buildSet2': {
        const tk = role(T, 'AM', rnd, undefined, [sc.key]);
        return mv
          .add(
            0.5,
            P(70, 30),
            [
              [tk, P(69, 30)],
              [sc, P(86, 50)],
            ],
            tk,
          )
          .add(0.5, P(90, 50), [[sc, P(90, 50)]], sc).poses;
      }
      default:
        return mv
          .add(0.5, P(78, 50), [[sc, P(78, 50)]], sc)
          .add(0.5, P(87, 48 + j), [[sc, P(87, 48 + j)]], sc).poses;
    }
  }

  // 골이 아닌 줄(찬스 · 선방 · 빗나감 · 코너킥). 새 장면이라 선수는 기본 자리에서 시작한다.
  const mv = new Moves(dir * 4);
  const st = role(T, 'ST', rnd);
  switch (line.say) {
    case 'chance1':
    case 'chance5': {
      const right = line.say === 'chance1';
      const w = role(T, 'W', rnd, right ? 'R' : 'L');
      const lane = right ? 88 : 12;
      const [d] = nearest(D, P(80, lane));
      if (right) {
        const [cb] = nearest(D, P(88, 46), 1, d ? [d.key] : []);
        return mv
          .add(0.5, P(80, lane), [[w, P(80, lane)], ...(d ? [[d, P(82, 80)] as Move] : [])], w)
          .add(
            0.5,
            P(88, 46 + j),
            [[st, P(87, 47 + j)], ...(cb ? [[cb, P(89, 42 + j)] as Move] : [])],
            st,
          ).poses;
      }
      return mv
        .add(0.5, P(72, lane), [[w, P(72, lane)], ...(d ? [[d, P(76, 18)] as Move] : [])], w)
        .add(0.5, P(82, 22), [[w, P(82, 22)], ...(d ? [[d, P(79, 17)] as Move] : [])], w).poses;
    }
    case 'chance2': {
      const w = role(T, 'W', rnd, rnd() < 0.5 ? 'L' : 'R', [st.key]);
      return new Moves(dir * 6).add(0.4, P(40, 50 + j), [[st, P(42, 50 + j)]], st).add(
        0.6,
        P(70, 40),
        [
          [st, P(70, 40)],
          [w, P(66, wing(w) < 50 ? 20 : 80)],
        ],
        st,
      ).poses;
    }
    case 'chance3': {
      const m = role(T, 'CM', rnd);
      const [o] = nearest(D, P(48, 50));
      return mv
        .add(
          0.45,
          P(48, 50 + j),
          [[m, P(48, 50 + j)], ...(o ? [[o, P(50, 54 + j)] as Move] : [])],
          m,
        )
        .add(0.55, P(60, 46 + j), [[m, P(60, 46 + j)]], m).poses;
    }
    case 'chance4': {
      const m1 = role(T, 'CM', rnd);
      const m2 = role(T, 'AM', rnd, undefined, [m1.key]);
      return mv
        .add(0.34, P(56, 40), [[m1, P(56, 40)]], m1)
        .add(0.33, P(62, 58), [[m2, P(62, 58)]], m2)
        .add(0.33, P(68, 44), [[m1, P(68, 44)]], m1).poses;
    }
    case 'save1': {
      const sh = role(T, 'AM', rnd);
      return mv
        .add(0.4, P(70, 50 + j), [[sh, P(70, 50 + j)]], sh)
        .add(0.6, P(98, 34), [[g, P(97, 40)]], g).poses;
    }
    case 'save2': {
      const w = role(T, 'W', rnd, undefined, [st.key]);
      return mv
        .add(
          0.4,
          P(84, wing(w)),
          [
            [w, P(84, wing(w))],
            [st, P(88, 50)],
          ],
          w,
        )
        .add(
          0.6,
          P(97, 50),
          [
            [st, P(90, 50)],
            [g, P(97, 50)],
          ],
          g,
        ).poses;
    }
    case 'save3':
    case 'chanceMiss':
    case 'crisisSave':
      return mv.add(0.4, P(80, 56), [[st, P(80, 56)]], st).add(0.6, P(97, 55), [[g, P(97, 55)]], g)
        .poses;
    case 'miss1':
    case 'miss2':
      return mv
        .add(
          0.45,
          P(line.say === 'miss1' ? 78 : 86, 48 + j),
          [[st, P(line.say === 'miss1' ? 78 : 86, 48 + j)]],
          st,
        )
        .add(0.55, P(100, line.say === 'miss1' ? 40 : 58), [], st).poses;
    case 'miss3':
      return mv
        .add(0.4, P(80, 52), [[st, P(80, 52)]], st)
        .add(0.3, P(99.5, 44.6), [], st)
        .add(0.3, P(90, 36), [], st).poses;
    case 'corner1': {
      const flag = rnd() < 0.5 ? 2 : 98;
      const tk = role(T, 'W', rnd, flag < 50 ? 'L' : 'R', [st.key]);
      const cb = role(T, 'CB', rnd);
      const [dc] = nearest(D, P(90, 50));
      return mv
        .add(0.5, P(99.5, flag), [[tk, P(99, flag)]], tk)
        .add(
          0.5,
          P(99.5, flag),
          [[cb, P(88, 46)], [st, P(89, 56)], ...(dc ? [[dc, P(91, 50)] as Move] : [])],
          tk,
        ).poses;
    }
    case 'corner2': {
      const tk = role(T, 'AM', rnd);
      const wall = nearest(D, P(80, 50), 3);
      return mv
        .add(
          0.45,
          P(72, 50),
          [[tk, P(71, 50)], ...wall.map((d, i) => [d, P(81, 46 + i * 4)] as Move)],
          tk,
        )
        .add(0.3, P(80, 52), [], tk)
        .add(0.25, P(70, 60), [], tk).poses;
    }
    default:
      return mv
        .add(0.5, P(66, 50 + j), [[st, P(66, 50 + j)]], st)
        .add(0.5, P(76, 50 + j), [[st, P(76, 50 + j)]], st).poses;
  }
}

/**
 * 장면 카드를 띄운 동안 멈춘 그라운드: 주인공(과 동료 · 상대 공격수)만 밝히고, 선택지마다 번호 붙은 화살표를 그린다. 장면은
 * 늘 경기를 건 쪽(home)의 것이다. 찬스는 골문 · 동료 쪽으로, 위기는 막는 자리 · 공 쪽으로 화살표를 긋는다.
 */
export function momentGround(
  players: readonly GroundPlayer[],
  m: TeamMoment,
  name: NameOf,
): { pose: GroundPose; arrows: GroundArrow[] } {
  const rnd = rngOf(`moment:${m.index}:${m.minute}:${m.situation}`);
  const H = players.filter((p) => p.side === 'home');
  const A = players.filter((p) => p.side === 'away');
  const actor = role(H, BASE_DETAIL[m.actor.slot], rnd, hintOf(m.actor.slot));
  const sameMate = m.mate.id !== null && m.mate.id === m.actor.id;
  const mate = sameMate
    ? null
    : role(H, BASE_DETAIL[m.mate.slot], rnd, hintOf(m.mate.slot), [actor.key]);
  const tags: Record<string, string> = { [actor.key]: name(m.actor.id, m.actor.name) };
  if (mate) tags[mate.key] = name(m.mate.id, m.mate.name);

  if (m.kind === 'chance') {
    const P = (a: number, lane: number) => at('home', a, lane);
    const me = P(84, 50);
    const matePt = mate ? P(80, mate.lane < 50 ? 22 : 78) : me;
    const cbs = nearest(A, P(84, 50), 2);
    const moves: Record<string, Pt> = { [actor.key]: me, [keeper(A).key]: P(95, 50) };
    if (mate) moves[mate.key] = matePt;
    cbs.forEach((d, i) => (moves[d.key] = P(78, i ? 62 : 40)));
    return {
      pose: {
        t: 1,
        ball: [me[0] + 1.5, me[1] + 2],
        moves,
        hl: actor.key,
        ...(mate ? { mate: mate.key } : {}),
        tags,
        dim: true,
        push: 5,
      },
      arrows: m.choices.map((c, i) => ({
        n: i + 1,
        from: me,
        to: c.mate && mate ? matePt : c.risk ? P(99.5, 54) : P(99.5, 47),
        curve: !c.mate && c.risk > 0,
      })),
    };
  }

  // 위기: 원정 공격수가 우리 골문 앞에서 공을 잡았고, 주인공(우리 수비)이 막아선다.
  const P = (a: number, lane: number) => at('away', a, lane);
  const opp = role(A, BASE_DETAIL[m.opp.slot], rnd, hintOf(m.opp.slot));
  tags[opp.key] = m.opp.name;
  const ball = P(80, 50);
  const me = P(85, 44);
  const moves: Record<string, Pt> = {
    [opp.key]: ball,
    [actor.key]: me,
    [keeper(H).key]: P(95, 50),
  };
  return {
    pose: {
      t: 1,
      ball: [ball[0] - 1.5, ball[1] + 2],
      moves,
      hl: actor.key,
      ...(mate ? { mate: mate.key } : {}),
      tags,
      dim: true,
      push: -5,
    },
    arrows: m.choices.map((c, i) => ({
      n: i + 1,
      from: me,
      to: c.gain ? ball : P(91, 50),
      curve: c.gain >= 0.15,
    })),
  };
}

/** 지금 자세에서 22명의 위치. 자세가 없으면 기본 자리에 흐름(0 = 원정이 몰아침, 1 = 홈이 몰아침)만큼 밀린 자리. */
export function groundSpots(
  players: readonly GroundPlayer[],
  pose: GroundPose | null,
  momentum: number,
): GroundSpot[] {
  const flow = (momentum - 0.5) * 10 + (pose?.push ?? 0);
  return players.map((p) => {
    const mv = pose?.moves?.[p.key];
    const shift = p.slot === 'GK' ? flow * 0.3 : flow;
    const [x, y] = mv ?? [clamp(p.x + shift, 3, 97), p.y];
    const on = pose?.hl === p.key;
    const mate = pose?.mate === p.key;
    const tag = pose?.tags?.[p.key] ?? null;
    return {
      key: p.key,
      side: p.side,
      no: p.no,
      x: clamp(x, 1, 99),
      y: clamp(y, 2, 98),
      on,
      mate,
      dim: !!pose?.dim && !on && !mate && !tag,
      tag: on || mate || pose?.dim ? tag : null,
    };
  });
}

/** 화살표의 곡선 조절점('과감'은 휘어 돌아간다, 직선이면 null)과 번호 자리(끝 조금 앞). */
export function arrowShape(a: GroundArrow): { ctrl: Pt | null; key: Pt } {
  const [x1, y1] = a.from;
  const [x2, y2] = a.to;
  const ctrl: Pt | null = a.curve
    ? [(x1 + x2) / 2 - (y2 - y1) * 0.6, (y1 + y2) / 2 - 22 + (x2 - x1) * 0.2]
    : null;
  return { ctrl, key: [x1 + (x2 - x1) * 0.62, y1 + (y2 - y1) * 0.62 - (a.curve ? 14 : 0)] };
}

/** 공 위치. 자세가 없으면 흐름이 기운 쪽 진영 가운데. */
export const groundBall = (pose: GroundPose | null, momentum: number): Pt =>
  pose?.ball ?? [50 + (momentum - 0.5) * 40, 50];

/** 그라운드를 그릴 때의 줄 대기 시간(ms) — 움직임을 볼 만큼 문자중계만 있을 때보다 조금 더 기다린다. */
export const groundLineWaitMs = (kind: LiveKind) =>
  kind === 'goal'
    ? 2200
    : kind === 'build'
      ? 1300
      : kind === 'moment'
        ? 1100
        : kind === 'kickoff' || kind === 'ht' || kind === 'ft'
          ? lineWaitMs(kind)
          : 1000;

/** 동작마다 시작 시각과 길이(ms, 합이 total). */
export function poseTimeline(poses: readonly GroundPose[], total: number) {
  let t = 0;
  return poses.map((pose) => {
    const dur = Math.round(pose.t * total);
    const step = { pose, at: t, dur };
    t += dur;
    return step;
  });
}

/**
 * 한 경기 중계의 그라운드 상태. 줄을 보여 줄 때 line()이 그 줄의 동작 순서를 주고, 골 줄이면 빌드업부터 골까지 공이 지난
 * 길(trail)을 남긴다. 다음 분으로 넘어가면 settle()이 골 뒤 자세를 풀어 킥오프 자리로 돌린다.
 */
export class GroundPlay {
  readonly players: GroundPlayer[];
  pose: GroundPose | null = null;
  trail: Pt[] = [];
  private lastKind: LiveKind | null = null;

  constructor(private readonly match: Pick<TeamMatch, 'id' | 'home' | 'away'>) {
    this.players = groundLineup(match);
  }

  line(l: LiveLine, total: number) {
    const poses = groundPoses(this.match.id, this.players, l, this.pose);
    const balls = poses.map((p) => p.ball);
    this.trail =
      l.kind === 'build'
        ? balls
        : l.kind === 'goal'
          ? [...(this.lastKind === 'build' ? this.trail : []), ...balls]
          : [];
    this.lastKind = l.kind;
    this.pose = poses.at(-1) ?? null;
    return poseTimeline(poses, total);
  }

  /** 장면 카드를 띄운 동안 멈춘 그라운드. */
  freeze(m: TeamMoment, name: NameOf) {
    const g = momentGround(this.players, m, name);
    this.pose = g.pose;
    this.trail = [];
    this.lastKind = 'moment';
    return g;
  }

  /** 골 뒤 다음 분이면 자세를 푼다(바뀌었으면 true). */
  settle(): boolean {
    if (!this.pose?.goal) return false;
    this.pose = null;
    this.trail = [];
    return true;
  }
}
