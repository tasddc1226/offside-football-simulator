// T-11-418 오프사이드 리그. 시즌마다 신청한 구단을 8팀 리그로 나눠 시즌 마감 전날까지 매일 한 라운드씩 치르고(T-11-540,
// 홈 · 원정 두 바퀴 14라운드를 되풀이), 순위로 다음 시즌 부(1부 · 2부 …)가 오르내린다. 기획은 docs/tracking/offside-league-plan.md. 시각은 모두 UTC ISO.
// zod 없는 서브패스(`@offside/contracts/league`) — API 모양은 league-api.ts.
import { DAY_MS, KST_MS, kstDay } from './kst.js';
import { gaugeRules } from './season-gauge.js';
import { SERVICE_SEASONS, type ServiceSeason } from './service-seasons.js';

/** 리그를 여는 첫 시즌. */
export const LEAGUE_FROM_SEASON = 2;
/** 리그 하나의 팀 수. */
export const LEAGUE_SIZE = 8;
/** 한 바퀴 일정의 라운드 수(같은 리그 7팀과 홈 · 원정 한 번씩). T-11-540부터 시즌 마감까지 이 일정을 되풀이한다. */
export const LEAGUE_CYCLE = (LEAGUE_SIZE - 1) * 2;

/**
 * 시즌 일정의 기본값: 개막 7일 전(앞 시즌 막바지)부터 사전 신청을 받고, 개막 뒤 5일은 새 시즌 팀을 꾸리며 계속 받는다.
 * 마감일 09:00에 그때 팀으로 자격을 보고 배치, 그날부터 매일 13:00(KST)에 한 라운드. 새 시즌 팀은 지난 시즌 선수를
 * 제한(와일드카드 · 급여 예산) 안에서만 쓰고 나머지는 그 시즌 카드로 채워야 해서, 개막 바로 경기하지 않고 팀을 꾸릴 날을 둔다.
 */
export const LEAGUE_PLAN_DEFAULTS = {
  presignDays: 7,
  entryDays: 5,
  drawHour: 9,
  matchHour: 13,
  /** 참가 자격: 선발에 든 실제 선수 수. */
  minFilled: 8,
} as const;

export interface LeagueDef {
  /** 서비스 시즌(이 시즌 팀만 참가). 시즌마다 리그 일정 하나. */
  season: number;
  /** 그 시즌 개막. 이보다 앞선 신청은 사전 신청이다. */
  startsAt: string;
  opensAt: string;
  closesAt: string;
  /** 배치 · 대진 발표. */
  drawAt: string;
  /** 라운드별 경기 시각(1라운드부터). */
  rounds: readonly string[];
  minFilled: number;
}

/**
 * 개막 시각 하나로 리그 일정을 만든다. 접수는 개막 presignDays일 전 00:00(KST)부터 개막 entryDays일 뒤 00:00까지, 배치는
 * 그날 drawHour시, 라운드는 그날부터 시즌 마감 전날까지 하루 한 라운드 matchHour시(T-11-540). 마감이 아직 정해지지 않았으면
 * 최대 기간 끝을 마감으로 보고, 게이지가 마감을 당기면 그 뒤 라운드는 빠진다(cron이 치르지 않은 경기를 지운다).
 * 시즌 2(10/31 00:00 개막) = 접수 10/24~11/4, 배치 11/5 09:00, 경기 11/5 13:00부터 마감 전날까지.
 */
export function planLeague(season: number, startsAt: string, endsAt?: string | null): LeagueDef {
  const d = LEAGUE_PLAN_DEFAULTS;
  // 개막한 날(KST) 00:00을 기준으로 날짜를 센다.
  const base = Date.parse(`${kstDay(startsAt)}T00:00:00.000Z`) - KST_MS;
  const at = (day: number, hour: number) =>
    new Date(base + day * DAY_MS + hour * 3_600_000).toISOString();
  const end = endsAt ? Date.parse(endsAt) : base + gaugeRules(season).maxDays * DAY_MS;
  // 마감(00:00 KST) 전날까지의 날 수. 마감이 배치 날보다 이르면(짧은 시즌) 한 라운드는 둔다.
  const lastDay = Math.ceil((end - base) / DAY_MS) - 1;
  const count = Math.max(1, lastDay - d.entryDays + 1);
  return {
    season,
    startsAt,
    opensAt: at(-d.presignDays, 0),
    closesAt: at(d.entryDays, 0),
    drawAt: at(d.entryDays, d.drawHour),
    rounds: Array.from({ length: count }, (_, i) => at(d.entryDays + i, d.matchHour)),
    minFilled: d.minFilled,
  };
}

/**
 * T-11-418c 아직 시즌 일정에 오르지 않은 다음 시즌(잠정). 다음 시즌은 지금 시즌 게이지가 마감을 확정해야 일정에 오르는데,
 * 사전 신청은 그 전에 열어야 한다 — 마감이 아직 없으면 지금 시즌의 최대 기간 끝(개막 + maxDays)을 잠정 개막으로 쓴다.
 * 게이지가 먼저 차 마감이 당겨지면 일정에 오른 실제 개막으로 리그 일정도 함께 당겨진다(신청은 시즌 번호로 남는다).
 */
export function provisionalNextSeason(started: ServiceSeason | undefined): ServiceSeason | null {
  if (!started) return null;
  const startsAt =
    started.endsAt ??
    new Date(Date.parse(started.startsAt) + gaugeRules(started.id).maxDays * DAY_MS).toISOString();
  // 이름은 화면에 쓰지 않는다(리그 일정 계산에만 쓴다).
  return { ...started, id: started.id + 1, name: '', startsAt, endsAt: null };
}

/**
 * now에 보여 줄 리그의 시즌: 개막한 시즌 중 가장 최근(리그를 여는 시즌부터)의 리그가 아직 끝나지 않았으면 그 시즌, 아니면
 * 다음 시즌(일정에 없으면 잠정 다음 시즌). 리그를 여는 시즌이 아직 없으면 null.
 */
export function leagueSeasonAt(
  now: string,
  seasons: readonly ServiceSeason[] = SERVICE_SEASONS,
): ServiceSeason | null {
  const started = seasons.filter((s) => s.startsAt <= now).at(-1);
  const next = seasons.find((s) => s.startsAt > now) ?? provisionalNextSeason(started);
  const cur = started && started.id >= LEAGUE_FROM_SEASON ? started : null;
  const upcoming = next && next.id >= LEAGUE_FROM_SEASON ? next : null;
  if (
    cur &&
    (!upcoming || leaguePhase(planLeague(cur.id, cur.startsAt, cur.endsAt), now) !== 'done')
  )
    return cur;
  return upcoming;
}

export const leagueFinalAt = (l: LeagueDef) => l.rounds.at(-1)!;

/** 끝난 리그를 '지난 시즌 리그'로 보여 주는 동안(마지막 라운드 뒤 하루)은 'running'으로 둔다 — 결산이 그 안에 끝난다. */
export const LEAGUE_AFTERGLOW_MS = DAY_MS;

export type LeaguePhase = 'soon' | 'open' | 'closed' | 'running' | 'done';

/** 접수 전 · 접수 중 · 배치 기다림 · 라운드 진행 · 끝. */
export function leaguePhase(l: LeagueDef, now: string): LeaguePhase {
  if (now < l.opensAt) return 'soon';
  if (now < l.closesAt) return 'open';
  if (now < l.drawAt) return 'closed';
  if (Date.parse(now) < Date.parse(leagueFinalAt(l)) + LEAGUE_AFTERGLOW_MS) return 'running';
  return 'done';
}

// ───────── 2차: 배치 · 대진 (T-11-418b) ─────────

/** 한 리그의 가장 적은 팀 수. 7팀 리그는 라운드마다 한 팀이 쉰다(한 바퀴 14라운드에 12경기). */
export const LEAGUE_MIN_SIZE = LEAGUE_SIZE - 1;
/** 기권이 이만큼 쌓이면 남은 경기는 모두 0:3 패로 친다. */
export const LEAGUE_FORFEIT_LIMIT = 3;
/** 기권 경기 스코어. */
export const LEAGUE_FORFEIT_GOALS = 3;

/**
 * 참가 팀 수 → 부별 리그 수와 팀 수. 리그는 7~8팀이고, 1부 1개 · 2부 2개 · 3부 4개 … 위 부부터 채운다(8팀 리그를 위로).
 * 7~8팀으로 나눌 수 없는 적은 수(42팀 미만의 일부)면 리그 수를 줄이고 남는 팀(OVR 낮은 쪽)을 dropped로 센다. 7팀 미만이면 리그 없음.
 */
export function leaguePyramid(n: number): {
  tiers: { tier: number; leagues: number; teams: number }[];
  dropped: number;
} {
  let k = Math.ceil(n / LEAGUE_SIZE);
  if (k * LEAGUE_MIN_SIZE > n) k = Math.floor(n / LEAGUE_SIZE);
  if (k <= 0) return { tiers: [], dropped: n };
  const used = Math.min(n, k * LEAGUE_SIZE);
  const eights = used - k * LEAGUE_MIN_SIZE;
  // 리그 순서(1부 1리그, 2부 1 · 2리그 …)대로 앞의 eights개가 8팀.
  const tiers: { tier: number; leagues: number; teams: number }[] = [];
  let i = 0;
  for (let tier = 1; i < k; tier++) {
    const leagues = Math.min(2 ** (tier - 1), k - i);
    let teams = 0;
    for (let j = 0; j < leagues; j++, i++) teams += i < eights ? LEAGUE_SIZE : LEAGUE_MIN_SIZE;
    tiers.push({ tier, leagues, teams });
  }
  return { tiers, dropped: n - used };
}

/**
 * 한 리그의 홈 · 원정 두 바퀴 일정(LEAGUE_CYCLE라운드). 시즌이 길면 이 일정을 되풀이한다(leagueRoundPairs). 원형 방식: 첫 팀을 고정하고 나머지를 돌린다. 7팀이면 빈 자리와 짝이 된
 * 팀이 그 라운드에 쉰다. 둘째 바퀴는 첫 바퀴를 홈 · 원정만 바꿔 되풀이한다. 돌려주는 값: 라운드 0..13별 [홈, 원정] 쌍.
 */
export function leagueFixtures<T>(ids: readonly T[]): [T, T][][] {
  const slots: (T | null)[] = [...ids];
  while (slots.length < LEAGUE_SIZE) slots.push(null);
  const n = slots.length;
  const first: [T, T][][] = [];
  let rot = slots.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const ring = [slots[0]!, ...rot];
    const pairs: [T, T][] = [];
    for (let p = 0; p < n / 2; p++) {
      const a = ring[p]!;
      const b = ring[n - 1 - p]!;
      if (a === null || b === null) continue;
      // 고정 팀은 라운드마다 홈 · 원정을 번갈아, 나머지는 자리 순으로 번갈아 홈이 몰리지 않게.
      const swap = p === 0 ? r % 2 === 1 : (r + p) % 2 === 1;
      pairs.push(swap ? [b, a] : [a, b]);
    }
    first.push(pairs);
    rot = [rot.at(-1)!, ...rot.slice(0, -1)];
  }
  return [...first, ...first.map((pairs) => pairs.map(([h, a]) => [a, h] as [T, T]))];
}

/** T-11-540 r번째 라운드(0부터)의 [홈, 원정] 쌍: 한 바퀴 일정을 되풀이한다. */
export const leagueRoundPairs = <T>(cycle: readonly (readonly [T, T])[][], r: number) =>
  cycle[r % cycle.length]!;

// ───────── 4차: 결산 · 승강 (T-11-418e) ─────────

/** 결산 결과. 우승(1부 1위) · 승격(아래 부 1위) · 잔류 · 강등(7위 아래, 맨 아래 부 빼고) · 기권 퇴출. 저장값. */
export const LEAGUE_OUTCOMES = [
  'champion',
  'promoted',
  'stayed',
  'relegated',
  'forfeited',
] as const;
export type LeagueOutcome = (typeof LEAGUE_OUTCOMES)[number];
/** 이 순위부터 강등(8팀 리그 7 · 8위, 7팀 리그 7위). */
export const LEAGUE_RELEGATE_FROM = LEAGUE_SIZE - 1;

/** 최종 순위 → 결과. bottomTier: 그 시즌 맨 아래 부(내려갈 곳이 없다). */
export function leagueOutcome(
  tier: number,
  rank: number,
  bottomTier: number,
  forfeited: boolean,
): LeagueOutcome {
  if (forfeited) return 'forfeited';
  if (rank === 1) return tier === 1 ? 'champion' : 'promoted';
  return rank >= LEAGUE_RELEGATE_FROM && tier < bottomTier ? 'relegated' : 'stayed';
}

/** 결과 → 다음 시즌에 신청하면 시작하는 부(기권 퇴출은 맨 아래 부라 null). 빈자리가 나면 배치 때 더 오를 수 있다. */
export function leagueNextTier(tier: number, outcome: LeagueOutcome): number | null {
  if (outcome === 'forfeited') return null;
  if (outcome === 'champion') return 1;
  return outcome === 'promoted' ? tier - 1 : outcome === 'relegated' ? tier + 1 : tier;
}

export interface LeagueReward {
  rerolls: number;
  scouts: number;
  boosts: number;
}
const reward = (rerolls: number, scouts = 0, boosts = 0): LeagueReward => ({
  rerolls,
  scouts,
  boosts,
});
const NONE = reward(0);
const add = (a: LeagueReward, b: LeagueReward): LeagueReward => ({
  rerolls: a.rerolls + b.rerolls,
  scouts: a.scouts + b.scouts,
  boosts: a.boosts + b.boosts,
});

/**
 * 결산 보상(2026-10-21 결정, 구단 자금은 주지 않는다). 1부 1 ~ 3위는 컵(제2회부터) 우승 · 준우승 · 4강과 같은 묶음이고,
 * 아래 부는 힘이 비슷한 8팀끼리 겨루므로 부와 상관없이 같다. 승격(아래 부 1위)은 언제나 프리미엄 스카우트권을 받는다.
 * 기권 없이 14라운드를 다 치르면(완주) 순위 보상에 더해 리롤권을 받는다. 기권 퇴출이면 없다.
 */
export const LEAGUE_REWARDS = {
  top: [reward(15, 3, 3), reward(10, 2, 2), reward(7, 1, 1)],
  promoted: reward(7, 1, 1),
  second: reward(3),
  finish: reward(2),
} as const;
/** 다음 시즌 배치에서 빈자리를 채우며 위 부로 올라간 팀(1위가 아닌 승격)에게 주는 프리미엄 스카우트권. */
export const LEAGUE_FILL_PROMOTE_SCOUTS = 1;

export function leagueReward(
  tier: number,
  rank: number,
  forfeits: number,
  outcome: LeagueOutcome,
): LeagueReward {
  if (outcome === 'forfeited') return NONE;
  const place =
    tier === 1
      ? (LEAGUE_REWARDS.top[rank - 1] ?? NONE)
      : rank === 1
        ? LEAGUE_REWARDS.promoted
        : rank === 2
          ? LEAGUE_REWARDS.second
          : NONE;
  return forfeits === 0 ? add(place, LEAGUE_REWARDS.finish) : place;
}

/** 지난 시즌에 처음 들어온 팀이 시드로 들어갈 수 있는 가장 높은 부(1 · 2부는 지난 시즌 성적으로만). */
export const LEAGUE_NEW_TOP_TIER = 3;

export interface LeagueSeedTeam {
  id: string;
  ovr: number;
  /** 같은 구단주의 지난 시즌 리그 결산(없으면 새 팀). */
  prev?: { tier: number; rank: number; outcome: LeagueOutcome } | null;
}

/**
 * 다음 시즌 배치 순서(위 부부터 채울 순서). 지난 시즌 팀은 결과대로 갈 부(승격 한 부 위 · 강등 한 부 아래 · 기권 퇴출은 맨
 * 아래)를 정하고, 새 팀은 모든 팀을 OVR로 줄 세웠을 때의 부로 가되 LEAGUE_NEW_TOP_TIER보다 위로는 가지 않는다. 같은 부
 * 안에서는 그 부에 남은 팀(순위 순) → 올라온 팀 → 내려온 팀 → 새 팀(OVR 순) 순서라, 위 부가 모자라면 아래 부 2위부터
 * 올라가고 넘치면 새 팀부터 내려간다. 부 크기는 leaguePyramid가 참가 수로 정한다.
 */
export function leagueSeedOrder<T extends LeagueSeedTeam>(teams: readonly T[]): T[] {
  const { tiers } = leaguePyramid(teams.length);
  // OVR로만 줄 세웠을 때 i번째 팀의 부.
  const bounds: number[] = [];
  let acc = 0;
  for (const t of tiers) bounds.push((acc += t.teams));
  const ovrTier = (i: number) => {
    const k = bounds.findIndex((b) => i < b);
    return k < 0 ? Infinity : k + 1;
  };
  const byOvr = [...teams].sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id));
  const ovrIndex = new Map(byOvr.map((t, i) => [t.id, i]));
  const KIND = { stayed: 0, champion: 0, promoted: 1, relegated: 2, forfeited: 3 } as const;
  const keyOf = (t: T) => {
    const p = t.prev;
    if (!p) {
      const tier = Math.max(LEAGUE_NEW_TOP_TIER, ovrTier(ovrIndex.get(t.id)!));
      return { tier, kind: 4, rank: 0 };
    }
    const tier =
      p.outcome === 'forfeited'
        ? Infinity
        : p.outcome === 'promoted'
          ? p.tier - 1
          : p.outcome === 'relegated'
            ? p.tier + 1
            : p.tier;
    return { tier, kind: KIND[p.outcome], rank: p.rank };
  };
  const keys = new Map(teams.map((t) => [t.id, keyOf(t)]));
  return [...teams].sort((a, b) => {
    const x = keys.get(a.id)!;
    const y = keys.get(b.id)!;
    return (
      (x.tier === y.tier ? 0 : x.tier < y.tier ? -1 : 1) ||
      x.kind - y.kind ||
      x.rank - y.rank ||
      b.ovr - a.ovr ||
      a.id.localeCompare(b.id)
    );
  });
}
