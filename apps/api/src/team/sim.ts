import { expandDetailRoles } from '@offside/contracts/positions';
import { addLines, managerLines, type ManagerCardRules } from '@offside/contracts/manager-rules';
// T-10-092 구단주 팀 경기 시뮬레이션. 서버만 돌리는 순수 함수다 — 같은 경기 id(시드)와 같은 선발이면 결과가 늘 같다.
import {
  FORMATIONS,
  LINEUP_SIZE,
  YOUTH_NAME,
  YOUTH_OVR,
  anonName,
  lineStrength,
  presetLayout,
  slotFit,
  teamSynergy,
  slotRating,
  teamOvr,
  type DetailPos,
  type FormationId,
  type TeamLayout,
  type LineStrength,
  type PeakProfile,
  type PosGroup,
  type SynergyPlayer,
  type TeamSynergy,
  synergyApplies,
  toSynergyPlayer,
} from '@offside/contracts/owner-team';

/** 팀에 넣을 수 있는 커리어(구단주 본인의 은퇴 선수). */
export type LineupCareer = {
  id: string;
  pos: PosGroup;
  /** 세부 포지션(T-10-091). 아직 모르면 null. */
  dpos: DetailPos | null;
  peak: number;
  /** 최고 시점의 자리별 실력(T-10-092). 이 기능 전에 은퇴한 선수는 null — 최고 OVR × 적합도로 센다. */
  roles: PeakProfile['roles'] | null;
  number: number | null;
  publicName: string | null;
  /** T-11-105 시너지 — 유형 id·주발·국적·이 팀 구단주가 직접 키웠는지. */
  type?: string | null;
  foot?: string | null;
  nation?: string | null;
  raised?: boolean;
  /** T-11-114 카드 시즌(0 = 프리시즌). 팀 시즌보다 앞이면 와일드카드. */
  season?: number;
};

/** 경기 기록에 남기는 선수. 공개 이름은 담지 않는다 — 읽을 때 커리어의 지금 공개 이름을 붙인다. */
export type PlayerRef = { careerId: string | null; anon: string };

export type LineupSlot = {
  slot: DetailPos;
  careerId: string | null;
  pos: PosGroup | null;
  rating: number;
  fit: number;
  ref: PlayerRef;
  publicName: string | null;
  /** T-11-105 시너지를 따질 선수 정보(유스 선수 자리는 null). */
  syn: SynergyPlayer | null;
};

/**
 * 포메이션 11자리에 선수를 놓는다. eligible에 없는 커리어(남의 선수·아직 뛰는 선수·지워진 선수)와 빈 자리는
 * 유스 선수(YOUTH_OVR, 적합도 1)가 채운다.
 */
export function buildLineup(
  formation: FormationId,
  slotIds: readonly (string | null)[],
  eligible: ReadonlyMap<string, LineupCareer>,
  layout?: TeamLayout | null,
): LineupSlot[] {
  const xs = (layout ?? presetLayout(formation)).map((p) => p.x);
  return (layout?.map((p) => p.slot) ?? FORMATIONS[formation]).map((slot, i) => {
    const id = slotIds[i] ?? null;
    const c = id ? eligible.get(id) : undefined;
    if (!c) {
      return {
        slot,
        careerId: null,
        pos: null,
        rating: YOUTH_OVR,
        fit: 1,
        ref: { careerId: null, anon: YOUTH_NAME },
        publicName: null,
        syn: null,
      };
    }
    const rating = slotRating(slot, c);
    return {
      slot,
      careerId: c.id,
      pos: c.pos,
      rating,
      fit: slotFit(slot, c, rating),
      ref: { careerId: c.id, anon: anonName(c.pos, c.number) },
      publicName: c.publicName,
      syn: toSynergyPlayer(slot, xs[i] ?? 50, c),
    };
  });
}

export const filledCount = (lineup: readonly LineupSlot[]) =>
  lineup.filter((s) => s.careerId !== null).length;
export const lineupOvr = (lineup: readonly LineupSlot[]) => teamOvr(lineup.map((s) => s.rating));

/** 선발의 시너지(T-11-105). */
export const lineupSynergy = (lineup: readonly LineupSlot[]): TeamSynergy =>
  teamSynergy(lineup.map((s) => s.syn));

/**
 * 공격·중원·수비·골키퍼 힘 — 자리마다의 몫과 포메이션의 줄 무게(contracts owner-team.ts lineStrength). synergy를 주면
 * 시너지 보정을 더한다(반영 시즌 경기만).
 */
export const lineupLines = (
  lineup: readonly LineupSlot[],
  synergy?: TeamSynergy | null,
): LineStrength =>
  lineStrength(
    lineup.map((s) => s.slot),
    lineup.map((s) => s.rating),
    synergy,
  );

/** 기대 득점의 기준(두 팀 힘이 같을 때), 공격 − 상대 수비 10점당 배율(지수), 중원 10점당 배율, 홈 이점. */
export const SIM = {
  baseXg: 1.3,
  atkK: 0.3,
  midK: 0.1,
  homeAdv: 1.08,
  minXg: 0.2,
  maxXg: 4.5,
  maxGoals: 9,
  assistChance: 0.75,
} as const;

/** 한 팀의 기대 득점. 상대 수비는 수비 라인 70% + 골키퍼 30%. */
export function expectedGoals(att: LineStrength, opp: LineStrength, home: boolean): number {
  const wall = 0.7 * opp.def + 0.3 * opp.gk;
  const xg =
    SIM.baseXg *
    Math.exp((SIM.atkK * (att.atk - wall)) / 10 + (SIM.midK * (att.mid - opp.mid)) / 10) *
    (home ? SIM.homeAdv : 1);
  return Math.min(SIM.maxXg, Math.max(SIM.minXg, xg));
}

/** 문자열 → 32비트 시드(FNV-1a). */
export function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — [0, 1) 난수. */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = rng();
  while (p > L && k < SIM.maxGoals) {
    k++;
    p *= rng();
  }
  return k;
}

/** 득점 가중치 — 골키퍼는 넣지 않는다. */
export const SCORE_W: Record<DetailPos, number> = expandDetailRoles({
  ST: 5,
  W: 3,
  AM: 2.5,
  CM: 1.2,
  DM: 0.6,
  FB: 0.5,
  CB: 0.4,
  GK: 0,
});
/** 도움 가중치. */
const ASSIST_W: Record<DetailPos, number> = expandDetailRoles({
  AM: 3,
  W: 3,
  CM: 2,
  ST: 1.5,
  FB: 1.2,
  DM: 1,
  CB: 0.3,
  GK: 0.05,
});

/** 가중치 × 실력으로 한 명을 고른다(except는 뺀다). 고를 사람이 없으면 -1. */
export function pick(
  lineup: readonly LineupSlot[],
  w: Record<DetailPos, number>,
  rng: () => number,
  except = -1,
): number {
  const weights = lineup.map((s, i) => (i === except ? 0 : w[s.slot] * Math.max(1, s.rating)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0 && weights[i]! > 0) return i;
  }
  return weights.findLastIndex((x) => x > 0);
}

export type SimEvent = {
  minute: number;
  side: 'home' | 'away';
  /** 득점자의 자리(골키퍼는 넣지 않는다). */
  slot: DetailPos;
  scorer: PlayerRef;
  assist: PlayerRef | null;
};
export type SimResult = {
  homeGoals: number;
  awayGoals: number;
  events: SimEvent[];
  /** 반영한 시너지 id(T-11-105, 반영 시즌 경기만). 시너지별 사용률·승률 측정용 기록. */
  synergy?: { home: string[]; away: string[] };
  /** T-11-379 경기 리포트 — 골 수를 뽑은 두 팀 기대 득점과 시너지 · 감독 보정 뒤 줄 힘(이미 계산한 값, 난수를 더 쓰지 않는다). */
  report: { home: SideReport; away: SideReport };
};
/** 한 팀 쪽 기대 득점과 줄 힘. */
export type SideReport = { xg: number; lines: LineStrength };

const synergyIds = (s: TeamSynergy) => s.active.filter((a) => a.kind !== 'badge').map((a) => a.id);

/** T-11-310 그 경기 두 팀의 감독(감독 칸이 비면 null)과 팀 포메이션. */
export type MatchCoach = { card: ManagerCardRules; formation: FormationId } | null;
export type MatchCoaches = { home: MatchCoach; away: MatchCoach };

/** 감독 보정을 줄 힘에 더한다. 감독이 없으면 그대로다. */
const withCoach = (lines: LineStrength, coach: MatchCoach | undefined, syn: TeamSynergy | null) =>
  coach
    ? addLines(lines, managerLines(coach.card, coach.formation, syn ? synergyIds(syn) : []))
    : lines;

/** 경기 한 판의 두 팀 줄 힘 · 기대 득점 · 시너지(난수를 쓰지 않는다). 일반 경기와 장면 경기(moments.ts)가 같이 쓴다. */
export function matchSetup(
  home: readonly LineupSlot[],
  away: readonly LineupSlot[],
  season: number,
  opts: { neutral?: boolean; coaches?: MatchCoaches } = {},
) {
  if (home.length !== LINEUP_SIZE || away.length !== LINEUP_SIZE)
    throw new Error('선발은 11명이어야 합니다.');
  const on = synergyApplies(season);
  const hSyn = on ? lineupSynergy(home) : null;
  const aSyn = on ? lineupSynergy(away) : null;
  const hs = withCoach(lineupLines(home, hSyn), opts.coaches?.home, hSyn);
  const as = withCoach(lineupLines(away, aSyn), opts.coaches?.away, aSyn);
  // T-11-145 컵은 중립 경기 — 홈 이점을 주지 않는다.
  const homeXg = expectedGoals(hs, as, !opts.neutral);
  const awayXg = expectedGoals(as, hs, false);
  return {
    homeXg,
    awayXg,
    ...(hSyn && aSyn ? { synergy: { home: synergyIds(hSyn), away: synergyIds(aSyn) } } : {}),
    report: { home: { xg: homeXg, lines: hs }, away: { xg: awayXg, lines: as } },
  };
}

/** 골 수 분포 — poisson()과 같이 maxGoals에서 자른다(그 위 몫은 maxGoals에 모인다). */
function goalDist(lambda: number): number[] {
  const out: number[] = [];
  let p = Math.exp(-lambda);
  let left = 1;
  for (let k = 0; k < SIM.maxGoals; k++) {
    out.push(p);
    left -= p;
    p *= lambda / (k + 1);
  }
  out.push(Math.max(0, left));
  return out;
}

/** 기대 득점 두 개로 90분 승 · 무 · 패 확률(홈 쪽 기준, 합 1). */
export function oddsOfXg(homeXg: number, awayXg: number) {
  const h = goalDist(homeXg);
  const a = goalDist(awayXg);
  let win = 0;
  let draw = 0;
  for (let i = 0; i < h.length; i++)
    for (let j = 0; j < a.length; j++) {
      const p = h[i]! * a[j]!;
      if (i > j) win += p;
      else if (i === j) draw += p;
    }
  return { win, draw, loss: Math.max(0, 1 - win - draw) };
}

/**
 * T-11-405 경기 전 예상 — 경기 한 판(simulateMatch)과 같은 줄 힘 · 기대 득점으로 90분 승 · 무 · 패 확률을 계산한다.
 * 난수를 쓰지 않는다. 지금 두 팀 명단 기준이라 명단이 바뀌면 달라진다.
 */
export function matchOdds(
  home: readonly LineupSlot[],
  away: readonly LineupSlot[],
  season: number,
  opts: { neutral?: boolean; coaches?: MatchCoaches } = {},
) {
  const { homeXg, awayXg } = matchSetup(home, away, season, opts);
  return { ...oddsOfXg(homeXg, awayXg), homeXg, awayXg };
}

/** 골 n개의 분 · 득점자 · 도움을 굴려 events에 더한다. */
export function addGoalEvents(
  events: SimEvent[],
  side: 'home' | 'away',
  lineup: readonly LineupSlot[],
  n: number,
  rng: () => number,
) {
  for (let g = 0; g < n; g++) {
    const minute = 1 + Math.floor(rng() * 90);
    const si = pick(lineup, SCORE_W, rng);
    const ai = rng() < SIM.assistChance ? pick(lineup, ASSIST_W, rng, si) : -1;
    events.push({
      minute,
      side,
      slot: lineup[si]!.slot,
      scorer: lineup[si]!.ref,
      assist: ai >= 0 ? lineup[ai]!.ref : null,
    });
  }
}

/**
 * 경기 한 판. seed는 경기 id — 같은 id·같은 선발이면 같은 결과다. season이 시너지 반영 시즌(T-11-105,
 * SYNERGY_FROM_SEASON)부터면 두 팀 줄 힘에 시너지 보정을 더한다. 그 전 시즌은 지금까지와 같은 결과다. T-11-310 coaches를 주면
 * 감독 보정(contracts manager-rules managerLines)을 더한다. 감독 칸이 비면 지금과 같은 결과다.
 */
export function simulateMatch(
  seed: string,
  home: readonly LineupSlot[],
  away: readonly LineupSlot[],
  season: number,
  opts: { neutral?: boolean; coaches?: MatchCoaches } = {},
): SimResult {
  const setup = matchSetup(home, away, season, opts);
  const rng = rngOf(seedOf(seed));
  const homeGoals = poisson(setup.homeXg, rng);
  const awayGoals = poisson(setup.awayXg, rng);
  const events: SimEvent[] = [];
  addGoalEvents(events, 'home', home, homeGoals, rng);
  addGoalEvents(events, 'away', away, awayGoals, rng);
  // 같은 분이면 만든 순서(안정 정렬).
  events.sort((a, b) => a.minute - b.minute);
  return {
    homeGoals,
    awayGoals,
    events,
    ...(setup.synergy ? { synergy: setup.synergy } : {}),
    report: setup.report,
  };
}

/** 승부차기 키커 순서 가중치(골키퍼는 마지막). */
const KICK_ORDER: Record<DetailPos, number> = expandDetailRoles({
  ST: 0,
  W: 1,
  AM: 2,
  CM: 3,
  DM: 4,
  FB: 5,
  CB: 6,
  GK: 7,
});

/**
 * T-11-145 승부차기(컵 토너먼트 무승부). 키커는 공격적인 자리부터 돌아가며 차고, 성공 확률은 키커 실력 − 상대 골키퍼
 * 실력으로 75% 근처에서 오르내린다. 5명씩 찬 뒤 같으면 서든데스. seed가 같으면 같은 결과다.
 */
export function penaltyShootout(
  seed: string,
  home: readonly LineupSlot[],
  away: readonly LineupSlot[],
): { home: number; away: number } {
  const rng = rngOf(seedOf(`${seed}:pens`));
  const order = (l: readonly LineupSlot[]) =>
    [...l].sort((a, b) => KICK_ORDER[a.slot] - KICK_ORDER[b.slot] || b.rating - a.rating);
  const gk = (l: readonly LineupSlot[]) => l.find((s) => s.slot === 'GK')?.rating ?? 50;
  const kickers = { home: order(home), away: order(away) };
  const keeper = { home: gk(home), away: gk(away) };
  const score = { home: 0, away: 0 };
  const kick = (side: 'home' | 'away', n: number) => {
    const k = kickers[side][n % kickers[side].length]!;
    const p = Math.min(
      0.9,
      Math.max(0.6, 0.75 + 0.005 * (k.rating - keeper[side === 'home' ? 'away' : 'home'])),
    );
    if (rng() < p) score[side]++;
  };
  for (let n = 0; n < 5; n++) {
    kick('home', n);
    if (score.home > score.away + (5 - n)) break;
    if (score.away > score.home + (5 - n - 1)) break;
    kick('away', n);
    if (score.home > score.away + (5 - n - 1) || score.away > score.home + (5 - n - 1)) break;
  }
  for (let n = 5; score.home === score.away && n < 40; n++) {
    kick('home', n);
    kick('away', n);
  }
  // 40번째까지 같을 일은 거의 없지만 끝은 내야 한다 — 시드로 한 쪽을 고른다.
  if (score.home === score.away) score[rng() < 0.5 ? 'home' : 'away']++;
  return score;
}
