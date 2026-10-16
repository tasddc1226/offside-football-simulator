// ───────── T-11-310 감독 커리어 ─────────
// 은퇴한 선수 카드로 시작하는 8~10시즌짜리 감독 커리어. 선수 커리어(season.ts)와 따로 도는 모듈이라 전역 활성 RNG를 쓰지 않고
// 상태 안의 시드(rng)로만 굴린다. 같은 시작값 · 같은 선택이면 늘 같은 결과다.
//
// 시즌 흐름: 구단 고르기(offers) → 시즌 준비(setup: 포메이션 · 성향 · 이사회 목표) → 이적시장(transfer: 3지선다)
// → 이벤트 2~3개(event) → 결산(result: 순위 · 재계약 / 경질 / 제의) → 다음 시즌. 마지막 시즌 결산 뒤 done.
// 끝나면 managerResult가 감독 카드(포메이션 숙련 · 성향 · 특기 · 등급 · 엔딩)를 만든다. 서버에 올리는 값이 이것이다.
import { FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
import {
  MANAGER_SEASONS_MAX,
  MANAGER_SEASONS_MIN,
  MANAGER_SPECIALS,
  MANAGER_SPECIALS_MAX,
  MANAGER_STYLES,
  type ManagerEnding,
  type ManagerGrade,
  type ManagerOrigin,
  type ManagerSpecial,
  type ManagerStyle,
  type MasteryGrade,
} from '@offside/contracts/manager-rules';
import { CLUBS, LEAGUES, type League, type Pos } from './data.js';
import { createRng, type Rng, type RngState } from './rng.js';
import { tn } from './i18n/names.js';
import { gManagerText as T } from './i18n/ko/gManager.js';

export { FORMATION_IDS, MANAGER_STYLES };
export type { ManagerOrigin };

export const MANAGER_SAVE_KEY = 'ft_mgr_save';
export const MANAGER_SAVE_VERSION = 1;

/** 이사회 목표(낮은 것부터). 승격은 위 리그가 있는 리그에서만 고른다. */
export const BOARD_TARGETS = ['survive', 'mid', 'top', 'promote', 'title'] as const;
export type BoardTarget = (typeof BOARD_TARGETS)[number];

export type ManagerPhase = 'offers' | 'setup' | 'transfer' | 'event' | 'result' | 'done';
export type TransferKind = 'star' | 'youth' | 'veteran' | 'sell';

export interface MgrClub {
  id: string;
  name: string;
  leagueId: string;
  /** 그 리그에서의 기본 전력(CLUBS str, 승격 · 강등하면 새 리그에 맞춰 다시 잡는다). */
  base: number;
}
export interface MgrOffer {
  clubId: string;
  name: string;
  leagueId: string;
  base: number;
}
export interface MgrTransfer {
  kind: TransferKind;
  pos: Pos;
  ovr: number;
  age: number;
}
export interface MgrEvent {
  id: string;
  /** 고른 선택지(아직이면 null)와 결과 문장. */
  choice: number | null;
  result: string | null;
}
export interface MgrSeason {
  n: number;
  age: number;
  clubId: string | null;
  club: string | null;
  leagueId: string | null;
  formation: FormationId | null;
  style: ManagerStyle | null;
  target: BoardTarget | null;
  rank: number;
  teams: number;
  w: number;
  d: number;
  l: number;
  title: boolean;
  cup: boolean;
  promoted: boolean;
  relegated: boolean;
  met: boolean;
  outcome: 'renew' | 'sacked' | 'rest' | 'end';
  /** 결산 문장(합니다체). */
  lines: string[];
}

export interface ManagerState {
  v: typeof MANAGER_SAVE_VERSION;
  /** 서버 감독 커리어 id(mgr_…). */
  id: string;
  careerId: string;
  /** 선수 시절 이름(이 기기에만 있다). 모르면 null. */
  name: string | null;
  origin: ManagerOrigin;
  rng: RngState;
  seasonsTotal: number;
  /** 끝낸 시즌 수(쉰 시즌 포함). */
  season: number;
  age: number;
  fame: number;
  trust: number;
  morale: number;
  fans: number;
  control: number;
  adapt: number;
  /** 이적 · 이벤트로 바뀐 전력(그 구단에 있는 동안 쌓인다). */
  squad: number;
  club: MgrClub | null;
  clubSeasons: number;
  formation: FormationId;
  style: ManagerStyle;
  target: BoardTarget;
  masteryXp: Record<FormationId, number>;
  styleUse: Record<ManagerStyle, number>;
  specialXp: Record<ManagerSpecial, number>;
  phase: ManagerPhase;
  offers: MgrOffer[];
  transfers: MgrTransfer[];
  events: MgrEvent[];
  seen: string[];
  history: MgrSeason[];
  clubs: string[];
  titles: number;
  cups: number;
  promotions: number;
  sacked: number;
  wins: number;
  draws: number;
  losses: number;
  topLeague: string;
  /** 경질된 뒤 우승 · 승격을 해냈는지(엔딩 '경질 뒤 재기'). */
  comeback: boolean;
  log: string[];
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const PRO_LEAGUES: League[] = LEAGUES.filter((l) => !l.amateur);
const leagueById = (id: string) => PRO_LEAGUES.find((l) => l.id === id)!;
const clubsIn = (leagueId: string) => CLUBS.filter((c) => c.leagueId === leagueId);
/** 한 단계 위 · 아래 리그(한국 리그만 승강이 있다). */
const UP: Record<string, string> = { k3: 'k2', k2: 'k1' };
const DOWN: Record<string, string> = { k1: 'k2', k2: 'k3' };
const MAX_TIER = Math.max(...PRO_LEAGUES.map((l) => l.tier));

function gauss(r: () => number): number {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 상태의 시드로 rng를 만들고, fn이 끝나면 다음 상태를 적어 둔다. */
function withRng<R>(s: ManagerState, fn: (r: Rng) => R): R {
  const r = createRng(0);
  r.setState(s.rng);
  const out = fn(r);
  s.rng = r.getState();
  return out;
}
const ri = (r: Rng, a: number, b: number) => Math.floor(a + r.next() * (b - a + 1));
const pickOf = <T>(r: Rng, a: readonly T[]): T => a[Math.floor(r.next() * a.length)]!;

// ───────── 시작 ─────────

/** 선수 시절이 주는 시작값(경험 중심 · 명성만 반영). 짧은 커리어 · 옛 기록도 기본값으로 시작한다. */
export function managerStart(o: ManagerOrigin) {
  const fame = clamp(Math.round((o.peak - 60) * 1.2 + o.legendScore / 40), 5, 85);
  const style: ManagerStyle =
    o.dpos === 'LW' || o.dpos === 'RW' || o.dpos === 'W'
      ? 'counter'
      : o.pos === 'FW'
        ? 'attack'
        : o.pos === 'MF'
          ? 'balance'
          : 'defense';
  const masteryXp: Record<FormationId, number> = { '4-3-3': 0, '4-4-2': 0, '3-5-2': 0 };
  if (o.pos === 'FW') masteryXp['4-3-3'] += 2;
  else if (o.pos === 'MF') {
    masteryXp['4-4-2'] += 1;
    masteryXp['3-5-2'] += 1;
  } else masteryXp['4-4-2'] += 2;
  return {
    fame,
    control: clamp(Math.round(25 + o.seasons * 2.5 + o.apps / 40), 20, 80),
    adapt: clamp(Math.round(25 + o.clubs * 8), 20, 80),
    trust: clamp(Math.round(45 + o.trophies * 2), 45, 70),
    style,
    masteryXp,
  };
}

export function newManagerCareer(input: {
  id: string;
  careerId: string;
  seed: number;
  origin: ManagerOrigin;
  name?: string | null;
}): ManagerState {
  const st = managerStart(input.origin);
  const s: ManagerState = {
    v: MANAGER_SAVE_VERSION,
    id: input.id,
    careerId: input.careerId,
    name: input.name ?? null,
    origin: input.origin,
    rng: { seed: input.seed >>> 0 },
    seasonsTotal: MANAGER_SEASONS_MIN,
    season: 0,
    age: (input.origin.retireAge ?? 35) + 1,
    fame: st.fame,
    trust: st.trust,
    morale: 55,
    fans: 50,
    control: st.control,
    adapt: st.adapt,
    squad: 0,
    club: null,
    clubSeasons: 0,
    formation: FORMATION_IDS.reduce((a, f) => (st.masteryXp[f] > st.masteryXp[a] ? f : a)),
    style: st.style,
    target: 'mid',
    masteryXp: st.masteryXp,
    styleUse: { attack: 0, balance: 0, defense: 0, counter: 0 },
    specialXp: { wing: 0, midfield: 0, defense: 0, counter: 0, youth: 0 },
    phase: 'offers',
    offers: [],
    transfers: [],
    events: [],
    seen: [],
    history: [],
    clubs: [],
    titles: 0,
    cups: 0,
    promotions: 0,
    sacked: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    topLeague: 'k3',
    comeback: false,
    log: [],
  };
  withRng(s, (r) => {
    s.seasonsTotal = ri(r, MANAGER_SEASONS_MIN, MANAGER_SEASONS_MAX);
    s.age += ri(r, 0, 1);
    s.offers = makeOffers(s, r, 'start');
  });
  s.log = [T.log_start({ age: s.age })];
  return s;
}

/** 명성으로 닿는 가장 높은 리그 등급. */
const fameTier = (fame: number) => clamp(Math.floor(fame / 11), 0, MAX_TIER);

/**
 * 구단 제의. start는 첫 부임(명성 아래 등급 리그의 중하위 구단 둘 · 셋), offer는 좋은 시즌 뒤의 이적 제의(지금 등급부터
 * 명성 등급까지), rebound는 경질 · 공백 뒤(한두 등급 아래).
 */
function makeOffers(s: ManagerState, r: Rng, kind: 'start' | 'offer' | 'rebound'): MgrOffer[] {
  const cur = s.club ? leagueById(s.club.leagueId).tier : 0;
  const top = fameTier(s.fame);
  const [lo, hi] =
    kind === 'start'
      ? [Math.max(0, top - 2), Math.max(0, top - 1)]
      : kind === 'offer'
        ? [Math.min(top, cur), Math.max(cur, top)]
        : [Math.max(0, cur - 2), Math.max(0, cur - 1)];
  const leagues = PRO_LEAGUES.filter((l) => l.tier >= lo && l.tier <= hi);
  const pool = leagues.length ? leagues : [PRO_LEAGUES[0]!];
  const n = kind === 'offer' ? ri(r, 1, 2) : ri(r, 2, 3);
  const out: MgrOffer[] = [];
  for (let tries = 0; out.length < n && tries < 30; tries++) {
    const L = pickOf(r, pool);
    const list = clubsIn(L.id).sort((a, b) => b.str - a.str);
    if (!list.length) continue;
    // 감독 자리는 대개 약한 팀에서 난다 — 명성이 높을수록 위쪽 구단도 연락해 온다.
    const reach = clamp(0.35 + s.fame / 200, 0.35, 0.8);
    const from = Math.floor(list.length * (1 - reach));
    const c = list[ri(r, Math.min(from, list.length - 1), list.length - 1)]!;
    if (c.id === s.club?.id || out.some((o) => o.clubId === c.id)) continue;
    out.push({ clubId: c.id, name: c.name, leagueId: L.id, base: c.str });
  }
  return out;
}

// ───────── 구단 고르기 ─────────

/** 제의를 받아들인다. 새 구단은 전력 보정 · 선수단 사기를 새로 시작한다. */
export function acceptOffer(s: ManagerState, i: number): boolean {
  const o = s.offers[i];
  if (s.phase !== 'offers' || !o) return false;
  s.club = { id: o.clubId, name: o.name, leagueId: o.leagueId, base: o.base };
  s.clubSeasons = 0;
  s.squad = 0;
  s.morale = 55;
  s.fans = 50;
  s.trust = clamp(Math.max(s.trust, 50), 50, 70);
  if (!s.clubs.includes(o.clubId)) s.clubs.push(o.clubId);
  s.offers = [];
  s.phase = 'setup';
  s.log = [T.log_join({ club: tn(o.name) })];
  return true;
}

/** 지금 구단에 남는다(제의를 받았지만 거절). */
export function stayAtClub(s: ManagerState): boolean {
  if (s.phase !== 'offers' || !s.club) return false;
  s.offers = [];
  s.phase = 'setup';
  s.log = [T.log_stay({ club: tn(s.club.name) })];
  return true;
}

/** 맡을 구단이 없으면 한 시즌 쉰다. 쉰 시즌도 커리어 시즌으로 센다. */
export function restSeason(s: ManagerState): boolean {
  if (s.phase !== 'offers' || s.club || s.offers.length) return false;
  s.season++;
  s.age++;
  s.fame = clamp(s.fame - 2, 0, 100);
  s.trust = 55;
  s.history.push({
    ...emptySeason(s),
    outcome: s.season >= s.seasonsTotal ? 'end' : 'rest',
    lines: [T.log_rest],
  });
  if (s.season >= s.seasonsTotal) {
    s.phase = 'done';
    return true;
  }
  withRng(s, (r) => (s.offers = makeOffers(s, r, 'rebound')));
  s.log = [T.log_rest];
  return true;
}

const emptySeason = (s: ManagerState): MgrSeason => ({
  n: s.season,
  age: s.age,
  clubId: null,
  club: null,
  leagueId: null,
  formation: null,
  style: null,
  target: null,
  rank: 0,
  teams: 0,
  w: 0,
  d: 0,
  l: 0,
  title: false,
  cup: false,
  promoted: false,
  relegated: false,
  met: false,
  outcome: 'rest',
  lines: [],
});

// ───────── 시즌 준비 ─────────

/** 그 구단 전력으로 본 예상 순위(1 = 1위). */
function expectedRank(club: MgrClub, squad: number): { rank: number; teams: number } {
  const others = clubsIn(club.leagueId).filter((c) => c.id !== club.id);
  const me = club.base + squad;
  return { rank: 1 + others.filter((c) => c.str > me).length, teams: others.length + 1 };
}

/** 그 순위가 목표를 채웠는지. */
function meets(t: BoardTarget, rank: number, teams: number, leagueId: string): boolean {
  switch (t) {
    case 'title':
      return rank === 1;
    case 'promote':
      return !!UP[leagueId] && rank <= 2;
    case 'top':
      return rank <= Math.max(1, Math.ceil(teams * 0.3));
    case 'mid':
      return rank <= Math.ceil(teams * 0.6);
    case 'survive':
      return rank < teams;
  }
}

/** 이사회가 바라는 최소 목표. */
export function boardMinimum(s: ManagerState): BoardTarget {
  if (!s.club) return 'mid';
  const { rank, teams } = expectedRank(s.club, s.squad);
  if (rank === 1) return 'title';
  if (rank <= Math.ceil(teams * 0.3)) return 'top';
  if (rank <= Math.ceil(teams * 0.6)) return 'mid';
  return 'survive';
}

/** 고를 수 있는 목표: 이사회 최소 목표와 그보다 높은 목표(승격은 승강이 있는 리그에서만). */
export function targetOptions(s: ManagerState): BoardTarget[] {
  const min = BOARD_TARGETS.indexOf(boardMinimum(s));
  return BOARD_TARGETS.filter(
    (t, i) => i >= min && (t !== 'promote' || (!!s.club && !!UP[s.club.leagueId])),
  );
}

/** 이적시장 후보 셋(종류 넷 중 셋). 영입 선수 OVR은 그 리그 평균 근처다. */
function makeTransfers(s: ManagerState, r: Rng): MgrTransfer[] {
  const avg = leagueById(s.club!.leagueId).avg;
  const kinds: TransferKind[] = ['star', 'youth', 'veteran', 'sell'];
  const drop = ri(r, 0, kinds.length - 1);
  return kinds
    .filter((_, i) => i !== drop)
    .map((kind) => ({
      kind,
      pos: pickOf(r, ['FW', 'MF', 'DF', 'GK'] as const),
      ovr: Math.round(
        avg +
          (kind === 'star' ? 8 : kind === 'veteran' ? 4 : kind === 'youth' ? -2 : 3) +
          gauss(r.next) * 2,
      ),
      age: kind === 'youth' ? ri(r, 17, 20) : kind === 'veteran' ? ri(r, 31, 34) : ri(r, 23, 29),
    }));
}

/** 시즌 준비를 마친다(포메이션 · 성향 · 목표). */
export function setupSeason(
  s: ManagerState,
  pick: { formation: FormationId; style: ManagerStyle; target: BoardTarget },
): boolean {
  if (s.phase !== 'setup' || !s.club) return false;
  if (!FORMATION_IDS.includes(pick.formation) || !MANAGER_STYLES.includes(pick.style)) return false;
  if (!targetOptions(s).includes(pick.target)) return false;
  s.formation = pick.formation;
  s.style = pick.style;
  s.target = pick.target;
  withRng(s, (r) => (s.transfers = makeTransfers(s, r)));
  s.phase = 'transfer';
  return true;
}

/** 이적시장에서 하나를 고른다(-1이면 넘긴다). */
export function pickTransfer(s: ManagerState, i: number): boolean {
  if (s.phase !== 'transfer') return false;
  const t = i >= 0 ? s.transfers[i] : undefined;
  if (i >= 0 && !t) return false;
  if (t) {
    if (t.kind === 'star') {
      s.squad += 3;
      s.trust -= 5;
      s.fans += 3;
    } else if (t.kind === 'youth') {
      s.squad += 1;
      s.specialXp.youth += 2;
    } else if (t.kind === 'veteran') {
      s.squad += 2;
      s.control += 2;
    } else {
      s.squad -= 2;
      s.trust += 6;
      s.fans -= 2;
    }
    s.log.push(T.log_signed({ what: transferName(t.kind) }));
  } else s.log.push(T.log_noSign);
  s.transfers = [];
  withRng(s, (r) => (s.events = drawEvents(s, r)));
  s.phase = s.events.length ? 'event' : 'result';
  if (s.phase === 'result') finishSeason(s);
  return true;
}

// ───────── 이벤트 ─────────

/** 이벤트 효과. sp는 특기 진척, lean은 성향 기울기(성향을 쓴 시즌 수에 더한다), mx는 지금 포메이션 숙련. */
type Effect = Partial<
  Record<'fame' | 'trust' | 'morale' | 'fans' | 'control' | 'squad' | 'mx', number>
> & { sp?: Partial<Record<ManagerSpecial, number>>; lean?: Partial<Record<ManagerStyle, number>> };
type Choice = { ok: Effect; fail?: Effect; p?: number };
type EventDef = { id: string; when?: (s: ManagerState) => boolean; choices: readonly Choice[] };

const firstAtClub = (s: ManagerState) => s.clubSeasons === 0;

/** 감독 이벤트(기획 manager-career-events.md의 장면을 가상 인물로 옮겼다). 문구는 gManager ev_<id>_*. */
export const MANAGER_EVENTS: readonly EventDef[] = [
  {
    id: 'speech',
    when: firstAtClub,
    choices: [{ ok: { fans: 6, trust: -3, fame: 1 } }, { ok: { trust: 4 } }],
  },
  {
    id: 'young',
    when: (s) => s.season === 0 && s.age <= 38,
    choices: [{ ok: { morale: 5, control: 3 } }, { ok: { control: 6, morale: -4 } }],
  },
  {
    id: 'friend',
    when: (s) => s.origin.clubs >= 2,
    choices: [{ ok: { morale: 4, trust: -2 } }, { ok: { control: 3 } }],
  },
  { id: 'owner', choices: [{ ok: { squad: 2, trust: -6 } }, { ok: { trust: -3, morale: 2 } }] },
  { id: 'stadium', choices: [{ ok: { trust: 6, squad: -1 } }, { ok: { squad: 1, trust: -6 } }] },
  { id: 'data', choices: [{ ok: { trust: -3, mx: 2 } }, { ok: { control: 2 } }] },
  {
    id: 'vote',
    when: (s) => s.trust < 50,
    choices: [{ ok: { trust: 3 } }, { ok: { morale: 4 } }],
  },
  {
    id: 'star',
    choices: [{ ok: { squad: -2, control: 6, fans: -4 } }, { ok: { morale: 5, control: -4 } }],
  },
  {
    id: 'legend',
    choices: [{ ok: { squad: 1, fans: -5 } }, { ok: { fans: 5, squad: -1 } }],
  },
  {
    id: 'revolt',
    when: (s) => s.morale < 50,
    choices: [
      { p: 0.5, ok: { control: 5, morale: 6 }, fail: { trust: -8, morale: -4 } },
      { ok: { morale: 6, trust: -3 } },
    ],
  },
  {
    id: 'injury',
    choices: [
      { ok: { squad: -1, sp: { youth: 3 } } },
      { ok: { trust: -4 } },
      { ok: { squad: -1, lean: { defense: 1 }, sp: { defense: 2 } } },
    ],
  },
  { id: 'rotation', choices: [{ ok: { morale: 3, fans: -2 } }, { ok: { squad: 1, morale: -3 } }] },
  { id: 'system', choices: [{ ok: { mx: 3, squad: -1 } }, { ok: { morale: 2 } }] },
  {
    id: 'press',
    choices: [
      { ok: { morale: -2, lean: { attack: 1 }, sp: { counter: 2 } } },
      { ok: { lean: { defense: 1 }, sp: { defense: 2 } } },
    ],
  },
  { id: 'wing', choices: [{ ok: { sp: { wing: 3 } } }, { ok: { sp: { midfield: 3 } } }] },
  {
    id: 'bus',
    choices: [
      { ok: { trust: 3, fans: -3, lean: { defense: 1 } } },
      { p: 0.4, ok: { fans: 6, fame: 3, morale: 4 }, fail: { morale: -5, fans: -2 } },
    ],
  },
  { id: 'analyst', choices: [{ ok: { mx: 2 } }, { ok: { control: 2, morale: 2 } }] },
  {
    id: 'gem',
    choices: [{ ok: { fans: 3, sp: { youth: 3 } } }, { ok: { sp: { youth: 1 }, trust: 2 } }],
  },
  {
    id: 'sale',
    when: (s) => s.specialXp.youth >= 2,
    choices: [{ ok: { trust: 6, fans: -4 } }, { ok: { trust: -3, sp: { youth: 2 } } }],
  },
  { id: 'media', choices: [{ ok: { fans: 5, fame: 2, trust: -2 } }, { ok: { control: 2 } }] },
  {
    id: 'protest',
    when: (s) => s.fans < 45,
    choices: [{ ok: { fans: 8, control: -2 } }, { ok: { trust: 2, fans: -2 } }],
  },
  {
    id: 'derby',
    choices: [
      { p: 0.5, ok: { fans: 6, morale: 4 }, fail: { fans: -4, trust: -2 } },
      { ok: { control: 1 } },
    ],
  },
  {
    id: 'national',
    when: (s) => s.origin.caps >= 20 && s.fame >= 35,
    choices: [{ ok: { fame: 8, trust: -4, morale: -2 } }, { ok: { trust: 4 } }],
  },
  {
    id: 'rival',
    when: (s) => s.fame >= 30 && s.clubSeasons >= 1,
    choices: [{ ok: { fame: 3, trust: -6 } }, { ok: { trust: 4, fans: 3 } }],
  },
  { id: 'mentor', choices: [{ ok: { control: 3, mx: 1 } }, { ok: { fame: 1, morale: 1 } }] },
  { id: 'cut', choices: [{ ok: { trust: 4, squad: -1 } }, { ok: { trust: -5, morale: 3 } }] },
];
const EVENT_BY_ID = new Map(MANAGER_EVENTS.map((e) => [e.id, e]));

function drawEvents(s: ManagerState, r: Rng): MgrEvent[] {
  const n = r.next() < 0.4 ? 3 : 2;
  let pool = MANAGER_EVENTS.filter((e) => !s.seen.includes(e.id) && (e.when?.(s) ?? true));
  const out: MgrEvent[] = [];
  while (out.length < n && pool.length) {
    const e = pickOf(r, pool);
    pool = pool.filter((x) => x !== e);
    out.push({ id: e.id, choice: null, result: null });
    s.seen.push(e.id);
  }
  return out;
}

type EvText = { t: string; b: string; choices: string[] };
const evStr = (id: string, part: string): string => {
  const v = (T as unknown as Record<string, unknown>)[`ev_${id}_${part}`];
  return typeof v === 'string' ? v : '';
};

/** 이벤트 문구(지금 언어). */
export function managerEventText(id: string): EvText {
  const def = EVENT_BY_ID.get(id);
  return {
    t: evStr(id, 't'),
    b: evStr(id, 'b'),
    choices: (def?.choices ?? []).map((_, i) => evStr(id, `c${i}`)),
  };
}

/** 지금 답할 이벤트(없으면 null). */
export const currentEvent = (s: ManagerState): MgrEvent | null =>
  s.phase === 'event' ? (s.events.find((e) => e.choice === null) ?? null) : null;

function applyEffect(s: ManagerState, e: Effect) {
  s.fame = clamp(s.fame + (e.fame ?? 0), 0, 100);
  s.trust = clamp(s.trust + (e.trust ?? 0), 0, 100);
  s.morale = clamp(s.morale + (e.morale ?? 0), 0, 100);
  s.fans = clamp(s.fans + (e.fans ?? 0), 0, 100);
  s.control = clamp(s.control + (e.control ?? 0), 0, 100);
  s.squad = clamp(s.squad + (e.squad ?? 0), -8, 10);
  s.masteryXp[s.formation] += e.mx ?? 0;
  for (const [k, v] of Object.entries(e.sp ?? {})) s.specialXp[k as ManagerSpecial] += v;
  for (const [k, v] of Object.entries(e.lean ?? {})) s.styleUse[k as ManagerStyle] += v;
}

/** 지금 이벤트에 답한다. 결과 문장을 돌려준다(실패 가능성이 있는 선택은 시드로 정한다). */
export function answerEvent(s: ManagerState, choice: number): string | null {
  const ev = currentEvent(s);
  const def = ev && EVENT_BY_ID.get(ev.id);
  const c = def?.choices[choice];
  if (!ev || !c) return null;
  const ok = c.p === undefined || withRng(s, (r) => r.next() < c.p!);
  applyEffect(s, ok ? c.ok : (c.fail ?? {}));
  ev.choice = choice;
  ev.result =
    (ok ? evStr(ev.id, `r${choice}`) : evStr(ev.id, `f${choice}`)) || evStr(ev.id, `r${choice}`);
  return ev.result;
}

/** 이벤트를 다 보고 결산으로 넘어간다. */
export function closeEvents(s: ManagerState): boolean {
  if (s.phase !== 'event' || currentEvent(s)) return false;
  finishSeason(s);
  return true;
}

// ───────── 결산 ─────────

export const masteryGrade = (xp: number): MasteryGrade =>
  xp >= 18 ? 'S' : xp >= 10 ? 'A' : xp >= 4 ? 'B' : 'C';
const MASTERY_STR: Record<MasteryGrade, number> = { C: 0, B: 1, A: 2, S: 3 };

/** 이번 시즌 팀 힘(전력 · 사기 · 장악력 · 숙련). */
export function teamPower(s: ManagerState): number {
  if (!s.club) return 0;
  return (
    s.club.base +
    s.squad +
    (s.morale - 50) / 12 +
    (s.control - 50) / 25 +
    MASTERY_STR[masteryGrade(s.masteryXp[s.formation])]
  );
}

function finishSeason(s: ManagerState) {
  const club = s.club!;
  const league = leagueById(club.leagueId);
  const others = clubsIn(club.leagueId).filter((c) => c.id !== club.id);
  const power = teamPower(s);
  const rec = withRng(s, (r) => {
    const mine = power + gauss(r.next) * league.spread * 0.8;
    const rank = 1 + others.filter((c) => c.str + gauss(r.next) * league.spread > mine).length;
    const teams = others.length + 1;
    const frac = teams > 1 ? (teams - rank) / (teams - 1) : 1;
    const m = league.matches;
    const w = clamp(Math.round(m * (0.18 + 0.5 * frac) * (0.9 + 0.2 * r.next())), 0, m);
    const d = clamp(Math.round(m * (0.22 + 0.06 * r.next())), 0, m - w);
    const cupP = clamp(0.06 + (power - league.avg) / 80, 0.02, 0.3);
    return { rank, teams, w, d, l: m - w - d, cup: r.next() < cupP };
  });
  const title = rec.rank === 1;
  const promoted = !!UP[club.leagueId] && rec.rank <= 2;
  const relegated = !!DOWN[club.leagueId] && rec.rank === rec.teams;
  const met = meets(s.target, rec.rank, rec.teams, club.leagueId);
  const minT = boardMinimum(s);
  const metMin = meets(minT, rec.rank, rec.teams, club.leagueId);
  const ambition = BOARD_TARGETS.indexOf(s.target) - BOARD_TARGETS.indexOf(minT);
  let trust = met ? 10 + ambition * 6 : metMin ? -4 : -14;
  if (title) trust += 8;
  if (rec.cup) trust += 4;
  if (s.fans < 30) trust -= 4;
  s.trust = clamp(s.trust + trust, 0, 100);
  s.fame = clamp(
    s.fame +
      (title ? 7 : 0) +
      (rec.cup ? 3 : 0) +
      (promoted ? 4 : 0) +
      (met ? 2 : metMin ? 0 : -3) +
      (league.tier >= 5 && met ? 2 : 0),
    0,
    100,
  );
  s.masteryXp[s.formation] += 3 + (met ? 1 : 0);
  s.styleUse[s.style] += 1;
  if (s.formation === '4-3-3') s.specialXp.wing += 1;
  if (s.formation === '3-5-2') s.specialXp.midfield += 1;
  if (s.style === 'defense') s.specialXp.defense += 1;
  if (s.style === 'counter') s.specialXp.counter += 1;
  s.titles += title ? 1 : 0;
  s.cups += rec.cup ? 1 : 0;
  s.promotions += promoted ? 1 : 0;
  s.wins += rec.w;
  s.draws += rec.d;
  s.losses += rec.l;
  if (s.sacked > 0 && (title || promoted)) s.comeback = true;
  if (league.tier > leagueById(s.topLeague).tier) s.topLeague = league.id;

  const lines = [T.res_rank({ club: tn(club.name), rank: rec.rank, teams: rec.teams })];
  if (title) lines.push(T.res_title);
  if (rec.cup) lines.push(T.res_cup);
  if (promoted) lines.push(T.res_promoted);
  if (relegated) lines.push(T.res_relegated);
  lines.push(met ? T.res_met : T.res_missed);

  s.season++;
  s.age++;
  s.clubSeasons++;
  const last = s.season >= s.seasonsTotal;
  const sacked = !last && s.trust < 25;
  const outcome: MgrSeason['outcome'] = last ? 'end' : sacked ? 'sacked' : 'renew';
  lines.push(last ? T.out_end : sacked ? T.out_sacked({ club: tn(club.name) }) : T.out_renew);

  s.history.push({
    n: s.season,
    age: s.age,
    clubId: club.id,
    club: club.name,
    leagueId: club.leagueId,
    formation: s.formation,
    style: s.style,
    target: s.target,
    rank: rec.rank,
    teams: rec.teams,
    w: rec.w,
    d: rec.d,
    l: rec.l,
    title,
    cup: rec.cup,
    promoted,
    relegated,
    met,
    outcome,
    lines,
  });

  // 다음 시즌 구단: 승격 · 강등은 리그만 바꾼다(전력은 새 리그 안쪽에서 다시 시작).
  const next = promoted ? UP[club.leagueId] : relegated ? DOWN[club.leagueId] : undefined;
  if (next) {
    const avg = leagueById(next).avg;
    s.club = { ...club, leagueId: next, base: avg + (promoted ? -4 : 4) };
  }
  s.squad = Math.round(s.squad * 0.6);
  s.morale = clamp(Math.round(50 + (s.morale - 50) * 0.5 + (met ? 5 : -5)), 20, 90);
  s.phase = 'result';
  if (last) return;
  withRng(s, (r) => {
    if (sacked) {
      s.sacked++;
      s.club = null;
      s.clubSeasons = 0;
      s.fame = clamp(s.fame - 4, 0, 100);
      s.offers = r.next() < 0.35 + s.fame / 150 ? makeOffers(s, r, 'rebound').slice(0, 1) : [];
    } else {
      const p = clamp(s.fame / 140 + (title ? 0.3 : 0) + (met ? 0.1 : -0.1), 0, 0.85);
      s.offers = r.next() < p ? makeOffers(s, r, 'offer') : [];
    }
  });
  if (sacked) lines.push(s.offers.length ? T.out_offers({ n: s.offers.length }) : T.out_none);
  else if (s.offers.length) lines.push(T.out_offers({ n: s.offers.length }));
}

/** 결산을 보고 다음으로 넘어간다: 마지막 시즌이면 done, 제의 · 경질이면 offers, 아니면 새 시즌 준비. */
export function continueAfterResult(s: ManagerState): boolean {
  if (s.phase !== 'result') return false;
  s.events = [];
  if (s.season >= s.seasonsTotal) s.phase = 'done';
  else if (!s.club || s.offers.length) s.phase = 'offers';
  else s.phase = 'setup';
  s.log = [];
  return true;
}

// ───────── 감독 카드 ─────────

/** 표시용 감독 등급. */
export function managerGrade(s: ManagerState): ManagerGrade {
  const score = s.fame + s.titles * 6 + s.cups * 3 + s.promotions * 4 - s.sacked * 4;
  return score >= 85 ? 'S' : score >= 60 ? 'A' : score >= 38 ? 'B' : 'C';
}

/** 가장 많이 쓴 성향(같으면 마지막 성향). */
function mainStyle(s: ManagerState): ManagerStyle {
  return MANAGER_STYLES.reduce((a, b) =>
    s.styleUse[b] > s.styleUse[a] || (s.styleUse[b] === s.styleUse[a] && b === s.style) ? b : a,
  );
}

/** 특기: 진척 6 이상 중 위 둘. */
export function managerSpecials(s: ManagerState): ManagerSpecial[] {
  return MANAGER_SPECIALS.filter((k) => s.specialXp[k] >= 6)
    .sort((a, b) => s.specialXp[b] - s.specialXp[a])
    .slice(0, MANAGER_SPECIALS_MAX);
}

export function managerEnding(s: ManagerState, grade = managerGrade(s)): ManagerEnding {
  const coached = s.history.filter((h) => h.clubId).length;
  if (grade === 'S' && s.titles >= 3) return 'legend';
  if (s.comeback) return 'comeback';
  if (s.promotions >= 2) return 'promoter';
  if (managerSpecials(s)[0] === 'youth' && s.specialXp.youth >= 12) return 'youth';
  if (s.clubs.length === 1 && coached >= 6) return 'oneclub';
  if (s.clubs.length >= 4) return 'journeyman';
  return 'steady';
}

/** 끝낸 감독 커리어의 결과(서버 FinishManagerBody.result). 끝나기 전이면 null. */
export function managerResult(s: ManagerState) {
  if (s.phase !== 'done') return null;
  const grade = managerGrade(s);
  return {
    mastery: Object.fromEntries(
      FORMATION_IDS.map((f) => [f, masteryGrade(s.masteryXp[f])]),
    ) as Record<FormationId, MasteryGrade>,
    style: mainStyle(s),
    specials: managerSpecials(s),
    grade,
    ending: managerEnding(s, grade),
    seasons: clamp(s.season, 1, MANAGER_SEASONS_MAX),
    titles: s.titles,
    cups: s.cups,
    promotions: s.promotions,
    sacked: s.sacked,
    clubs: clamp(s.clubs.length, 1, MANAGER_SEASONS_MAX + 2),
    topLeague: s.topLeague,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
  };
}
export type ManagerCareerResult = NonNullable<ReturnType<typeof managerResult>>;

// ───────── 이름 · 세이브 ─────────

export const styleName = (k: ManagerStyle) => T[`style_${k}`];
export const styleDesc = (k: ManagerStyle) => T[`styleDesc_${k}`];
export const targetName = (k: BoardTarget) => T[`target_${k}`];
export const specialName = (k: ManagerSpecial) => T[`special_${k}`];
export const specialDesc = (k: ManagerSpecial) => T[`specialDesc_${k}`];
export const endingName = (k: ManagerEnding) => T[`ending_${k}`];
export const endingDesc = (k: ManagerEnding) => T[`endingDesc_${k}`];
export const transferName = (k: TransferKind) => T[`tr_${k}`];
export const transferDesc = (k: TransferKind) => T[`trDesc_${k}`];
export const leagueName = (id: string) => tn(PRO_LEAGUES.find((l) => l.id === id)?.name ?? id);

/** 저장된 감독 세이브를 읽는다. 모양이 다르거나 버전이 다르면 null(새로 시작한다). */
export function migrateManagerSave(raw: unknown): ManagerState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<ManagerState>;
  if (s.v !== MANAGER_SAVE_VERSION || typeof s.id !== 'string' || typeof s.careerId !== 'string')
    return null;
  if (!s.rng || typeof s.rng.seed !== 'number' || !s.origin || !Array.isArray(s.history))
    return null;
  return s as ManagerState;
}
