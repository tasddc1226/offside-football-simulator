// T-11-648 감독 커리어 3 시즌 흐름. 상태 안의 시드(rng)로만 굴린다(같은 시작 · 같은 선택이면 같은 결과).
//
// 제의(offers) → 프리시즌(preseason: 이사회 목표 · 예산) → 여름 이적(window) → 구간 1~3(block → blockResult)
// → 겨울 이적(window) → 구간 4~6 → 리뷰(review: 성장 · 은퇴 · 계약 · 유스 · 이사회 · 감독 성장) → 다음 시즌 · 은퇴(done).
import type { ManagerOrigin, ManagerStyle } from '@offside/contracts/manager-rules';
import { BOARD_TARGETS, MANAGER_EVENTS, type BoardTarget } from '../manager-content.js';
import { createRng, type Rng } from '../rng.js';
import {
  M3_ATTRS,
  M3_BLOCKS,
  M3_FORMATIONS,
  M3_LICENSE_NEXT,
  M3_LICENSE_TIER,
  M3_LICENSES,
  M3_MAX_AGE,
  M3_MAX_SEASONS,
  M3_MIN_SEASONS,
  M3_SAVE_VERSION,
  M3_SQUAD_MAX,
  M3_SQUAD_MIN,
  M3_WINTER_AFTER,
  type M3Attr,
  type M3Formation,
  type M3Plan,
} from './rules.js';
import {
  attrCap,
  clamp,
  clubsOf,
  developPlayer,
  facilitiesFor,
  gauss,
  leagueOf,
  M3_LEAGUES,
  makePlayer,
  makeSquad,
  MAX_TIER,
  pickOf,
  playerValue,
  retires,
  ri,
  startAttrs,
  youthIntake,
  type R,
} from './people.js';
import {
  clubLines,
  emptyTable,
  lineupLines,
  leagueClubs,
  makeFixtures,
  matchLineup,
  playMatch,
  rankOf,
  record,
  sortTable,
  tacticLines,
  addL,
} from './match.js';
import {
  bid,
  incomingBids,
  makeTargets,
  renewalEventWage,
  settleSales,
  starterAvg,
  wageBill,
} from './market.js';
import { M3_STORIES, storyOf, type StoryFx } from './stories.js';
import type {
  M3BlockReport,
  M3Club,
  M3Event,
  M3Match,
  M3Offer,
  M3Player,
  M3SeasonRecord,
  M3State,
} from './types.js';

const UP: Record<string, string> = { k3: 'k2', k2: 'k1' };
const DOWN: Record<string, string> = { k1: 'k2', k2: 'k3' };
const zeroForm = (): Record<M3Formation, number> =>
  Object.fromEntries(M3_FORMATIONS.map((f) => [f, 0])) as Record<M3Formation, number>;

/** 상태의 시드로 난수를 굴리고 끝나면 다음 상태를 적어 둔다. */
export function withRng<T>(s: M3State, fn: (r: R) => T): T {
  const rng: Rng = createRng(0);
  rng.setState(s.rng);
  const out = fn(() => rng.next());
  s.rng = rng.getState();
  return out;
}

// ───────── 시작 ─────────

export function newManager3(input: {
  id: string;
  careerId: string;
  seed: number;
  origin: ManagerOrigin;
  name?: string | null;
}): M3State {
  const s: M3State = {
    v: M3_SAVE_VERSION,
    id: input.id,
    careerId: input.careerId,
    name: input.name ?? null,
    // 화면 상태(반응형 프록시)를 그대로 물지 않게 복사한다(세이브 · structuredClone).
    origin: { ...input.origin },
    rng: { seed: input.seed >>> 0 },
    phase: 'offers',
    season: 0,
    age: (input.origin.retireAge ?? 35) + 1,
    rep: 0,
    attrs: { atk: 0, def: 0, tac: 0, mgmt: 0, motiv: 0, youth: 0, eye: 0, disc: 0, adapt: 0 },
    license: 'C',
    points: 0,
    board: 55,
    fans: 50,
    harmony: 55,
    club: null,
    clubSeasons: 0,
    squad: [],
    nextId: 1,
    fam: zeroForm(),
    plan: {
      formation: '4-3-3',
      mentality: 'balance',
      press: 1,
      line: 1,
      tempo: 1,
      talk: 'calm',
      lineup: null,
    },
    target: 'mid',
    fixtures: [],
    table: [],
    block: 0,
    cupAlive: true,
    cupRound: 0,
    form: 0,
    window: null,
    targets: [],
    bids: [],
    lastReport: null,
    review: null,
    offers: [],
    history: [],
    clubs: [],
    titles: 0,
    cups: 0,
    promotions: 0,
    sacked: 0,
    awards: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    topLeague: 'k3',
    comeback: false,
    formUse: zeroForm(),
    blocksBy: zeroForm(),
    styleUse: { attack: 0, balance: 0, defense: 0, counter: 0 },
    famPeak: zeroForm(),
    youthDebuts: 0,
    youthStars: 0,
    seenEvents: [],
    spent: {},
  };
  withRng(s, (r) => {
    s.attrs = startAttrs(input.origin, r);
    s.rep = startRep(input.origin);
    s.age += ri(r, 0, 1);
    // 선수 시절 포지션에 맞는 포메이션은 처음부터 조금 익숙하다.
    const pos = input.origin.pos;
    const first: M3Formation = pos === 'FW' ? '4-3-3' : pos === 'MF' ? '3-5-2' : '4-4-2';
    s.fam[first] = 30;
    s.plan.formation = first;
    s.plan.mentality = startStyle(input.origin);
    s.offers = makeOffers(s, r, 'start');
  });
  return s;
}

/** 시작 명성(감독 커리어 2와 같은 공식). */
export function startRep(o: ManagerOrigin): number {
  return clamp(Math.round((o.peak - 60) * 1.2 + o.legendScore / 40), 5, 85);
}
export function startStyle(o: ManagerOrigin): ManagerStyle {
  if (o.dpos === 'LW' || o.dpos === 'RW' || o.dpos === 'W') return 'counter';
  return o.pos === 'FW' ? 'attack' : o.pos === 'MF' ? 'balance' : 'defense';
}

// ───────── 제의 ─────────

const fameTier = (rep: number) => clamp(Math.floor(rep / 11), 0, MAX_TIER);

/** 구단 제의. start는 첫 부임, offer는 좋은 시즌 뒤, rebound는 경질 · 공백 뒤 공석. 자격이 닿지 않는 리그는 빠진다. */
export function makeOffers(s: M3State, r: R, kind: 'start' | 'offer' | 'rebound'): M3Offer[] {
  const cur = s.club ? leagueOf(s.club.leagueId).tier : 0;
  const top = Math.min(fameTier(s.rep), M3_LICENSE_TIER[s.license]);
  const [lo, hi] =
    kind === 'start'
      ? [Math.max(0, top - 2), Math.max(0, top - 1)]
      : kind === 'offer'
        ? [Math.min(top, cur), Math.max(cur, top)]
        : [Math.max(0, cur - 2), Math.max(0, cur - 1)];
  const pool = M3_LEAGUES.filter(
    (l) => l.tier >= lo && l.tier <= Math.min(hi, M3_LICENSE_TIER[s.license]),
  );
  const leagues = pool.length ? pool : [M3_LEAGUES[0]!];
  const n = kind === 'offer' ? ri(r, 1, 2) : ri(r, 2, 3);
  const out: M3Offer[] = [];
  for (let tries = 0; out.length < n && tries < 30; tries++) {
    const L = pickOf(r, leagues);
    const list = clubsOf(L.id).sort((a, b) => b.str - a.str);
    if (!list.length) continue;
    const reach = clamp(0.35 + s.rep / 200, 0.35, 0.8);
    const from = Math.floor(list.length * (1 - reach));
    const c = list[ri(r, Math.min(from, list.length - 1), list.length - 1)]!;
    if (c.id === s.club?.id || out.some((o) => o.clubId === c.id)) continue;
    out.push({
      clubId: c.id,
      name: c.name,
      leagueId: L.id,
      base: c.str,
      vacancy: kind === 'rebound',
    });
  }
  return out;
}

function makeClub(o: { clubId: string; name: string; leagueId: string; base: number }): M3Club {
  const L = leagueOf(o.leagueId);
  const fac = facilitiesFor(L.tier);
  return {
    id: o.clubId,
    name: o.name,
    leagueId: o.leagueId,
    base: o.base,
    trainFac: fac,
    youthFac: fac,
    budget: 0,
    wageBudget: 0,
  };
}

/** 제의를 받아들인다. 새 구단 선수단을 만들고, 익숙함은 적응력만큼만 가져간다. */
export function acceptOffer(s: M3State, i: number): boolean {
  const o = s.offers[i];
  if (s.phase !== 'offers' || !o) return false;
  s.club = makeClub(o);
  s.clubSeasons = 0;
  s.board = 55;
  s.fans = 50;
  s.harmony = 55;
  s.plan.lineup = null;
  const keep = 0.55 + s.attrs.adapt / 250;
  for (const f of M3_FORMATIONS) s.fam[f] = Math.round(s.fam[f] * keep);
  withRng(s, (r) => {
    s.squad = makeSquad(s, s.club!, r);
  });
  if (!s.clubs.includes(o.clubId)) s.clubs.push(o.clubId);
  s.offers = [];
  prepareSeason(s);
  return true;
}

/** 제의를 거절하고 지금 구단에 남는다. */
export function stayAtClub(s: M3State): boolean {
  if (s.phase !== 'offers' || !s.club) return false;
  s.offers = [];
  prepareSeason(s);
  return true;
}

/** 맡을 구단이 없으면 한 시즌 쉰다(커리어 시즌으로 센다). */
export function restSeason(s: M3State): boolean {
  if (s.phase !== 'offers' || s.club || s.offers.length) return false;
  s.season++;
  s.age++;
  s.rep = clamp(s.rep - 2, 0, 100);
  s.history.push({ ...emptyRecord(s), outcome: 'rest' });
  if (forcedRetire(s)) {
    s.phase = 'done';
    return true;
  }
  withRng(s, (r) => (s.offers = makeOffers(s, r, 'rebound')));
  return true;
}

const emptyRecord = (s: M3State): M3SeasonRecord => ({
  n: s.season,
  age: s.age,
  clubId: null,
  club: null,
  leagueId: null,
  formation: null,
  mentality: null,
  target: null,
  rank: 0,
  teams: 0,
  w: 0,
  d: 0,
  l: 0,
  gf: 0,
  ga: 0,
  title: false,
  cup: false,
  cupRound: 0,
  promoted: false,
  relegated: false,
  met: false,
  outcome: 'rest',
  topScorer: null,
  award: false,
});

const forcedRetire = (s: M3State) => s.season >= M3_MAX_SEASONS || s.age >= M3_MAX_AGE;

// ───────── 프리시즌 ─────────

/** 새 시즌 일정 · 순위표를 만들고 프리시즌으로. 상대 구단 전력은 시즌마다 조금 흔들린다. */
function prepareSeason(s: M3State) {
  const club = s.club!;
  const L = leagueOf(club.leagueId);
  withRng(s, (r) => {
    const clubs = leagueClubs(club).map((c) => ({
      ...c,
      str: c.id === club.id ? c.str : Math.round((c.str + gauss(r) * 1.5) * 10) / 10,
    }));
    const ids = clubs.map((c) => c.id);
    // 첫 자리가 늘 같지 않게 섞는다.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    s.fixtures = makeFixtures(ids, L.matches);
    s.table = emptyTable(clubs);
  });
  s.block = 0;
  s.cupAlive = true;
  s.cupRound = 0;
  s.form = 0;
  s.window = null;
  s.targets = [];
  s.bids = [];
  s.lastReport = null;
  s.review = null;
  s.seenEvents = [];
  for (const p of s.squad) {
    p.apps = 0;
    p.goals = 0;
    p.fit = 100;
    p.listed = null;
    delete p.promised;
  }
  s.phase = 'preseason';
}

/** 예상 순위: 주전 평균을 다른 구단 전력과 견준다. */
export function expectedRank(s: M3State): { rank: number; teams: number } {
  const me = starterAvg(s);
  const others = s.table.filter((t) => t.clubId !== s.club?.id);
  return { rank: 1 + others.filter((t) => t.str > me).length, teams: others.length + 1 };
}

export function meets(t: BoardTarget, rank: number, teams: number, leagueId: string): boolean {
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
export function boardMinimum(s: M3State): BoardTarget {
  if (!s.club) return 'mid';
  const { rank, teams } = expectedRank(s);
  if (rank === 1) return 'title';
  if (rank <= Math.ceil(teams * 0.3)) return 'top';
  if (rank <= Math.ceil(teams * 0.6)) return 'mid';
  return 'survive';
}
export function targetOptions(s: M3State): BoardTarget[] {
  const min = BOARD_TARGETS.indexOf(boardMinimum(s));
  return BOARD_TARGETS.filter(
    (t, i) => i >= min && (t !== 'promote' || (!!s.club && !!UP[s.club.leagueId])),
  );
}

/** 프리시즌을 마친다: 목표를 정하고 예산을 받고 여름 이적시장을 연다. 목표를 높일수록 이적 자금을 더 받는다. */
export function startSeason(s: M3State, target: BoardTarget): boolean {
  if (s.phase !== 'preseason' || !s.club || !targetOptions(s).includes(target)) return false;
  const club = s.club;
  const L = leagueOf(club.leagueId);
  const ambition = BOARD_TARGETS.indexOf(target) - BOARD_TARGETS.indexOf(boardMinimum(s));
  s.target = target;
  const fresh =
    Math.round((L.wealth * 30000 * (0.6 + s.rep / 100) * (1 + ambition * 0.15)) / 100) * 100;
  club.budget = Math.max(Math.round(club.budget * 0.5), fresh);
  club.wageBudget = Math.round((wageBill(s) * 1.08 + L.wealth * 500) / 100) * 100;
  openWindow(s, 'summer');
  return true;
}

function openWindow(s: M3State, w: 'summer' | 'winter') {
  s.window = w;
  withRng(s, (r) => {
    s.targets = makeTargets(s, r);
    s.bids = incomingBids(s, r);
  });
  s.phase = 'window';
}

/** 이적시장을 닫는다(판매 등록 정리). 남은 제안은 거절로 친다. */
export function closeWindow(s: M3State): string[] | null {
  if (s.phase !== 'window') return null;
  for (const b of s.bids) {
    const p = s.squad.find((x) => x.id === b.player);
    if (p) p.morale = clamp(p.morale - 4, 0, 100);
  }
  s.bids = [];
  const sold = withRng(s, (r) => settleSales(s, r));
  s.targets = [];
  s.window = null;
  s.plan.lineup = s.plan.lineup?.every((id) => s.squad.some((p) => p.id === id))
    ? s.plan.lineup
    : null;
  s.phase = 'block';
  return sold;
}

// ───────── 구간 ─────────

/** 다음 구간 계획을 바꾼다(포메이션을 바꾸면 직접 고른 선발은 지운다). */
export function setPlan(s: M3State, plan: Partial<M3Plan>): boolean {
  if (s.phase !== 'block') return false;
  if (plan.formation && plan.formation !== s.plan.formation && plan.lineup === undefined)
    s.plan.lineup = null;
  s.plan = { ...s.plan, ...plan };
  return true;
}

const roundsOf = (s: M3State, b: number) => {
  const n = s.fixtures.length;
  return [Math.floor((b * n) / M3_BLOCKS), Math.floor(((b + 1) * n) / M3_BLOCKS)] as const;
};

/** 지난 구간 성적(승점 비율, 없으면 0.5). */
function lastForm(s: M3State): number {
  const ms = s.lastReport?.matches.filter((m) => !m.cup) ?? [];
  if (!ms.length) return 0.5;
  return ms.reduce((t, m) => t + (m.gf > m.ga ? 1 : m.gf === m.ga ? 0.4 : 0), 0) / ms.length;
}

/** 팀 토크 효과: 사기 변화와 이번 구간 전력 보정. 동기 부여가 높을수록 세다. */
export function talkEffect(s: M3State): { morale: number; form: number } {
  const f = lastForm(s);
  const k = 0.5 + s.attrs.motiv / 100;
  const good = f >= 0.55;
  const bad = f < 0.35;
  switch (s.plan.talk) {
    case 'praise':
      return { morale: (good ? 4 : 1) * k, form: good ? -0.2 : 0.2 };
    case 'calm':
      return { morale: 2 * k, form: 0 };
    case 'demand':
      return good ? { morale: -3 * k, form: 0.3 } : { morale: (bad ? 5 : 1) * k, form: 0.5 * k };
  }
}

const moraleAll = (s: M3State, d: number) => {
  for (const p of s.squad) p.morale = clamp(Math.round(p.morale + d), 0, 100);
};

/** 아픔은 선수 관리가 높을수록 덜 탄다. */
const hurt = (s: M3State, d: number) => (d < 0 ? d * (1.3 - s.attrs.mgmt / 100) : d);

function cupOpponent(s: M3State, r: R, round: number): { id: string; name: string; str: number } {
  const tier = leagueOf(s.club!.leagueId).tier;
  const leagues = M3_LEAGUES.filter((l) => Math.abs(l.tier - tier) <= 1 && clubsOf(l.id).length);
  const L = pickOf(r, leagues);
  const list = clubsOf(L.id)
    .filter((c) => c.id !== s.club!.id)
    .sort((a, b) => a.str - b.str);
  // 라운드가 오를수록 강한 상대.
  const lo = Math.floor(((round - 1) / 5) * list.length * 0.7);
  const c = list[ri(r, Math.min(lo, list.length - 1), list.length - 1)]!;
  return { id: c.id, name: c.name, str: c.str };
}

/** 이번 구간 경기를 모두 치른다(리그 라운드 + 컵 한 라운드). */
export function playBlock(s: M3State): M3BlockReport | null {
  if (s.phase !== 'block' || !s.club) return null;
  const club = s.club;
  const b = s.block;
  const rankBefore = rankOf(s.table, club.id);
  const talk = talkEffect(s);
  moraleAll(s, hurt(s, talk.morale));
  for (const p of s.squad) if (p.inj > 0) p.inj--;
  const matches: M3Match[] = [];
  const injuries: number[] = [];
  const startedIds = new Set<number>();
  const form = s.form + talk.form;
  const [from, to] = roundsOf(s, b);
  withRng(s, (r) => {
    const playMine = (
      opp: { id: string; name: string; str: number },
      home: boolean | null,
      round: number,
      cup: boolean,
    ) => {
      const lineup = matchLineup(s.squad, s.plan);
      const mine = addL(
        lineupLines(s.squad, lineup, s.plan.formation),
        tacticLines(s.plan, s.attrs, s.fam[s.plan.formation], form),
      );
      const [gf, ga] = playMatch(r, mine, clubLines(opp.str), home, s.plan.tempo);
      const xi = lineup
        .map((id) => s.squad.find((p) => p.id === id))
        .filter((p): p is M3Player => !!p);
      const scorers: number[] = [];
      for (let g = 0; g < gf; g++) {
        const w = xi.map(
          (p) =>
            (p.role === 'ST'
              ? 5
              : p.role === 'WG' || p.role === 'AM'
                ? 3
                : p.role === 'CM'
                  ? 1.2
                  : p.role === 'GK'
                    ? 0
                    : 0.6) *
            (p.ovr / 60),
        );
        let x = r() * w.reduce((t, v) => t + v, 0);
        const at = w.findIndex((v) => (x -= v) <= 0);
        const p = xi[at] ?? xi[0];
        if (p) {
          p.goals++;
          scorers.push(p.id);
        }
      }
      const res = gf > ga ? 1 : gf === ga ? 0 : -1;
      for (const p of s.squad) {
        if (lineup.includes(p.id)) {
          startedIds.add(p.id);
          p.apps++;
          if (p.academy && !p.debut) {
            p.debut = true;
            s.youthDebuts++;
          }
          p.fit = clamp(p.fit - (4 + s.plan.press * 1.5 + (p.age >= 31 ? 1.5 : 0)), 20, 100);
          p.morale = clamp(Math.round(p.morale + hurt(s, res * 3)), 0, 100);
          const injP =
            0.012 + s.plan.press * 0.004 + (p.age >= 31 ? 0.004 : 0) + (p.fit < 60 ? 0.01 : 0);
          if (r() < injP) {
            p.inj = ri(r, 1, 3);
            injuries.push(p.id);
          }
        } else p.fit = clamp(p.fit + 6, 0, 100);
      }
      let pens: boolean | undefined;
      if (cup && gf === ga) pens = r() < 0.5 + (mine.gk - opp.str) / 100;
      const m: M3Match = {
        round,
        cup,
        opp: opp.id,
        oppName: opp.name,
        home: home ?? false,
        gf,
        ga,
        scorers,
      };
      if (pens !== undefined) m.pens = pens;
      matches.push(m);
      return m;
    };
    for (let k = from; k < to; k++) {
      for (const fx of s.fixtures[k]!) {
        const h = s.table.find((t) => t.clubId === fx.home)!;
        const a = s.table.find((t) => t.clubId === fx.away)!;
        if (fx.home === club.id || fx.away === club.id) {
          const home = fx.home === club.id;
          const opp = home ? a : h;
          const m = playMine({ id: opp.clubId, name: opp.name, str: opp.str }, home, k + 1, false);
          if (home) record(s.table, fx.home, fx.away, m.gf, m.ga);
          else record(s.table, fx.home, fx.away, m.ga, m.gf);
        } else {
          const [hg, ag] = playMatch(r, clubLines(h.str), clubLines(a.str), true);
          record(s.table, fx.home, fx.away, hg, ag);
        }
      }
    }
    // 컵: 구간 2~6에 한 라운드씩(32강 → 결승).
    if (b >= 1 && s.cupAlive) {
      const round = b;
      const opp = cupOpponent(s, r, round);
      const m = playMine(opp, round < 5 ? r() < 0.5 : null, 0, true);
      const won = m.gf > m.ga || (m.gf === m.ga && !!m.pens);
      if (won) s.cupRound = round;
      else s.cupAlive = false;
    }
  });
  // 회복 · 익숙함 · 출전 불만.
  for (const p of s.squad) p.fit = clamp(p.fit + 15, 0, 100);
  const f = s.plan.formation;
  s.fam[f] = clamp(Math.round(s.fam[f] + (3 + s.attrs.tac / 15) * (1 - s.fam[f] / 115)), 0, 100);
  s.famPeak[f] = Math.max(s.famPeak[f], s.fam[f]);
  s.formUse[f]++;
  s.blocksBy[f]++;
  s.styleUse[s.plan.mentality]++;
  const avg = starterAvg(s);
  for (const p of s.squad) {
    if (startedIds.has(p.id) || p.inj > 0) {
      delete p.promised;
      continue;
    }
    if (p.promised) {
      p.morale = clamp(p.morale - 12, 0, 100);
      s.harmony = clamp(s.harmony - 4, 0, 100);
      delete p.promised;
    } else if (p.ovr >= avg - 1 && p.age >= 21)
      p.morale = clamp(Math.round(p.morale + hurt(s, -4)), 0, 100);
  }
  const moraleAvg = s.squad.reduce((t, p) => t + p.morale, 0) / Math.max(1, s.squad.length);
  s.harmony = clamp(Math.round(s.harmony + (moraleAvg - 60) / 10), 0, 100);
  // 이사회 · 팬: 예상 순위와 지금 순위.
  const rankAfter = rankOf(s.table, club.id);
  const exp = expectedRank(s).rank;
  const league = matches.filter((m) => !m.cup);
  const pts = league.reduce((t, m) => t + (m.gf > m.ga ? 3 : m.gf === m.ga ? 1 : 0), 0);
  const ratio = league.length ? pts / (league.length * 3) : 0.5;
  s.board = clamp(
    Math.round(s.board + clamp((exp - rankAfter) * 0.6, -4, 4) + (ratio - 0.45) * 5),
    0,
    100,
  );
  s.fans = clamp(Math.round(s.fans + (ratio - 0.45) * 14), 0, 100);
  s.form = 0;
  s.block++;
  const report: M3BlockReport = {
    block: b,
    matches,
    rankBefore,
    rankAfter,
    injuries,
    morale: Math.round(moraleAvg),
    event: withRng(s, (r) => drawEvent(s, r)),
  };
  s.lastReport = report;
  s.phase = 'blockResult';
  return report;
}

// ───────── 이야기 ─────────

/** 감독 커리어 2 이벤트를 새 상태에서 고를 수 있는지. */
function legacyOk(s: M3State, id: string): boolean {
  switch (id) {
    case 'speech':
      return s.clubSeasons === 0 && s.block <= 1;
    case 'young':
      return s.season === 0 && s.age <= 38;
    case 'friend':
      return s.origin.clubs >= 2;
    case 'vote':
      return s.board < 50;
    case 'revolt':
      return s.harmony < 50;
    case 'protest':
      return s.fans < 45;
    case 'national':
      return s.origin.caps >= 20 && s.rep >= 35;
    case 'rival':
      return s.rep >= 30 && s.clubSeasons >= 1;
    case 'sale':
      return s.squad.some((p) => p.academy && p.ovr >= leagueOf(s.club!.leagueId).avg - 4);
    default:
      return true;
  }
}

function drawEvent(s: M3State, r: R): M3Event | null {
  if (r() > 0.7) return null;
  const avg = starterAvg(s);
  const cands: M3Event[] = [];
  const benched = s.squad.filter(
    (p) => p.ovr >= avg - 2 && p.apps <= s.block && p.inj === 0 && p.morale < 60 && p.age >= 21,
  );
  if (benched.length)
    cands.push({ kind: 'playtime', id: 'playtime', player: pickOf(r, benched).id, choice: null });
  const stars = [...s.squad].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  const due = stars.filter((p) => p.contract <= 1);
  if (due.length && !s.seenEvents.includes('renewal'))
    cands.push({ kind: 'renewal', id: 'renewal', player: due[0]!.id, choice: null });
  if (stars[0] && !s.seenEvents.includes('bigbid') && r() < 0.35)
    cands.push({
      kind: 'bigbid',
      id: 'bigbid',
      player: stars[0].id,
      fee: Math.round((playerValue(stars[0]) * 1.6) / 100) * 100,
      choice: null,
    });
  const hot = s.squad.filter((p) => p.trait === 'temper');
  if (hot.length >= 2 && s.attrs.disc < 65 && !s.seenEvents.includes('fight'))
    cands.push({ kind: 'fight', id: 'fight', player: hot[0]!.id, other: hot[1]!.id, choice: null });
  const legacy = MANAGER_EVENTS.filter((e) => !s.seenEvents.includes(e.id) && legacyOk(s, e.id));
  const stories = M3_STORIES.filter((d) => !s.seenEvents.includes(d.id));
  // 선수 이야기와 감독 이야기(감독 커리어 2 이야기 · 이야기 표)가 반씩 나오게 한다.
  const pool = legacy.length + stories.length;
  let ev: M3Event | null = null;
  if (cands.length && (r() < 0.5 || !pool)) ev = pickOf(r, cands);
  else if (pool) {
    const i = Math.floor(r() * pool);
    if (i < legacy.length) ev = { kind: 'legacy', id: legacy[i]!.id, choice: null };
    else {
      // 고른 이야기의 조건이 맞지 않으면(주인공이 없는 등) 이번 구간은 쉰다.
      const d = stories[i - legacy.length]!;
      const cast = d.cast(s, r);
      if (cast) ev = { kind: 'story', id: d.id, ...cast, choice: null };
    }
  }
  if (ev) s.seenEvents.push(ev.id);
  return ev;
}

/** 이야기 선택지 수. */
export function eventChoices(ev: M3Event): number {
  if (ev.kind === 'legacy') return MANAGER_EVENTS.find((e) => e.id === ev.id)?.choices.length ?? 0;
  if (ev.kind === 'story') return storyOf(ev.id)?.choices.length ?? 0;
  return ev.kind === 'playtime' ? 3 : 2;
}

/** 이야기에 답한다. 실패할 수 있는 선택은 시드로 정한다. */
export function answerEvent(s: M3State, choice: number): boolean {
  const ev = s.lastReport?.event;
  if (
    s.phase !== 'blockResult' ||
    !ev ||
    ev.choice !== null ||
    choice < 0 ||
    choice >= eventChoices(ev)
  )
    return false;
  ev.choice = choice;
  const p = s.squad.find((x) => x.id === ev.player);
  const bump = (q: M3Player | undefined, d: number) =>
    q && (q.morale = clamp(q.morale + d, 0, 100));
  if (ev.kind === 'legacy') {
    const c = MANAGER_EVENTS.find((e) => e.id === ev.id)!.choices[choice]!;
    const ok = c.p === undefined || withRng(s, (r) => r() < c.p!);
    if (c.p !== undefined) ev.ok = ok;
    const e: typeof c.ok = ok ? c.ok : (c.fail ?? {});
    s.rep = clamp(s.rep + (e.fame ?? 0), 0, 100);
    s.board = clamp(s.board + (e.trust ?? 0), 0, 100);
    moraleAll(s, e.morale ?? 0);
    s.fans = clamp(s.fans + (e.fans ?? 0), 0, 100);
    s.harmony = clamp(s.harmony + (e.control ?? 0), 0, 100);
    s.form += (e.squad ?? 0) * 0.5;
    s.fam[s.plan.formation] = clamp(s.fam[s.plan.formation] + (e.mx ?? 0) * 3, 0, 100);
    const cap = attrCap(s.license);
    const sp: Record<string, M3Attr> = {
      wing: 'atk',
      midfield: 'tac',
      defense: 'def',
      counter: 'tac',
      youth: 'youth',
    };
    for (const [k, v] of Object.entries(e.sp ?? {})) {
      const a = sp[k]!;
      s.attrs[a] = clamp(s.attrs[a] + Math.round(v / 2), 0, cap);
    }
    for (const [k, v] of Object.entries(e.lean ?? {})) s.styleUse[k as ManagerStyle] += v;
    return true;
  }
  if (ev.kind === 'story') {
    const c = storyOf(ev.id)!.choices[choice]!;
    const ok =
      c.p === undefined || withRng(s, (r) => r() < c.p! + (c.skill ? s.attrs[c.skill] / 200 : 0));
    if (c.p !== undefined) ev.ok = ok;
    applyStory(
      s,
      ok ? c.ok : (c.fail ?? {}),
      p,
      s.squad.find((x) => x.id === ev.other),
    );
    return true;
  }
  if (ev.kind === 'playtime') {
    if (choice === 0 && p) {
      p.promised = true;
      bump(p, 8);
    } else if (choice === 1) {
      bump(p, -10);
      s.harmony = clamp(s.harmony - 3, 0, 100);
    } else if (p) {
      p.listed = playerValue(p);
      bump(p, -5);
    }
  } else if (ev.kind === 'renewal') {
    if (choice === 0 && p && s.club) {
      p.wage = renewalEventWage(p);
      p.contract = 3;
      bump(p, 6);
    } else {
      bump(p, -12);
      if (p?.trait === 'temper') s.harmony = clamp(s.harmony - 4, 0, 100);
    }
  } else if (ev.kind === 'bigbid') {
    if (choice === 0 && p && s.club && s.squad.length > M3_SQUAD_MIN) {
      s.club.budget += ev.fee ?? 0;
      s.squad = s.squad.filter((x) => x.id !== p.id);
      s.fans = clamp(s.fans - 4, 0, 100);
      s.board = clamp(s.board + 3, 0, 100);
    } else if (p && p.trait !== 'loyal') bump(p, -8);
  } else if (ev.kind === 'fight') {
    const q = s.squad.find((x) => x.id === ev.other);
    if (choice === 0) {
      const ok = withRng(s, (r) => r() < 0.4 + s.attrs.disc / 200);
      ev.ok = ok;
      s.harmony = clamp(s.harmony + (ok ? 4 : -4), 0, 100);
      bump(p, -5);
      bump(q, -5);
    } else s.harmony = clamp(s.harmony - 6, 0, 100);
  }
  return true;
}

/** 이야기 표 선택의 효과를 적용한다. */
function applyStory(s: M3State, e: StoryFx, p: M3Player | undefined, q: M3Player | undefined) {
  const c100 = (x: number) => clamp(Math.round(x), 0, 100);
  if (p) {
    if (e.morale) p.morale = c100(p.morale + e.morale);
    if (e.ovr) p.ovr = clamp(p.ovr + e.ovr, 1, p.pot);
    if (e.pot) p.pot = clamp(p.pot + e.pot, p.ovr, 99);
    if (e.fit) p.fit = c100(p.fit + e.fit);
    if (e.inj) p.inj = Math.max(0, p.inj + e.inj);
    if (e.wage) p.wage = Math.round((p.wage * e.wage) / 100) * 100;
    if (e.contract) p.contract += e.contract;
    if (e.list) p.listed = playerValue(p);
  }
  if (q) {
    if (e.otherMorale) q.morale = c100(q.morale + e.otherMorale);
    if (e.otherPot) q.pot = clamp(q.pot + e.otherPot, q.ovr, 99);
  }
  if (e.team) moraleAll(s, e.team);
  if (e.harmony) s.harmony = c100(s.harmony + e.harmony);
  if (e.board) s.board = c100(s.board + e.board);
  if (e.fans) s.fans = c100(s.fans + e.fans);
  if (e.rep) s.rep = c100(s.rep + e.rep);
  if (e.form) s.form += e.form;
  if (e.budget && s.club) s.club.budget += Math.round((s.club.wageBudget * e.budget) / 100) * 100;
  const cap = attrCap(s.license);
  for (const [k, v] of Object.entries(e.attr ?? {}))
    s.attrs[k as M3Attr] = clamp(s.attrs[k as M3Attr] + v, 0, cap);
  for (const [k, v] of Object.entries(e.lean ?? {})) s.styleUse[k as ManagerStyle] += v;
}

/** 구간 결과를 보고 넘어간다: 겨울 이적시장 · 다음 구간 · 시즌 리뷰(구간 3 뒤 이사회 신뢰가 15 아래면 경질). */
export function continueBlock(s: M3State): boolean {
  if (s.phase !== 'blockResult') return false;
  const ev = s.lastReport?.event;
  if (ev && ev.choice === null) return false;
  if (s.block >= M3_WINTER_AFTER && s.block < M3_BLOCKS && s.board < 15) {
    finishSeason(s, true);
    return true;
  }
  if (s.block >= M3_BLOCKS) finishSeason(s, false);
  else if (s.block === M3_WINTER_AFTER) openWindow(s, 'winter');
  else s.phase = 'block';
  return true;
}

// ───────── 시즌 리뷰 ─────────

function assessManagerSeason(s: M3State, sackedMid: boolean) {
  const club = s.club!;
  const L = leagueOf(club.leagueId);
  const sorted = sortTable(s.table);
  const row = sorted.find((t) => t.clubId === club.id)!;
  const rank = sorted.indexOf(row) + 1;
  const teams = sorted.length;
  const title = !sackedMid && rank === 1;
  const promoted = !sackedMid && !!UP[club.leagueId] && rank <= 2;
  const relegated = !sackedMid && !!DOWN[club.leagueId] && rank === teams;
  const cup = !sackedMid && s.cupRound >= 5;
  const minT = boardMinimum(s);
  const met = !sackedMid && meets(s.target, rank, teams, club.leagueId);
  const metMin = !sackedMid && meets(minT, rank, teams, club.leagueId);
  const ambition = BOARD_TARGETS.indexOf(s.target) - BOARD_TARGETS.indexOf(minT);
  const exp = expectedRank(s).rank;
  const award = title || (!sackedMid && rank <= 3 && exp >= rank + 5);
  const over = wageBill(s) > club.wageBudget;
  let board = met ? 12 + ambition * 5 : metMin ? -2 : -12;
  if (title) board += 8;
  if (cup) board += 5;
  if (promoted) board += 6;
  if (relegated) board -= 12;
  if (over) board -= 6;
  s.board = clamp(s.board + board, 0, 100);
  const sacked = sackedMid || s.board < 25;
  s.rep = clamp(
    s.rep +
      (title ? 6 : 0) +
      (cup ? 3 : 0) +
      (promoted ? 4 : 0) +
      (award ? 2 : 0) +
      (met ? 2 : metMin ? 0 : -3) +
      (L.tier >= 5 && met ? 2 : 0) -
      (sacked ? 4 : 0),
    0,
    100,
  );
  s.titles += title ? 1 : 0;
  s.cups += cup ? 1 : 0;
  s.promotions += promoted ? 1 : 0;
  s.awards += award ? 1 : 0;
  s.wins += row.w;
  s.draws += row.d;
  s.losses += row.l;
  if (s.sacked > 0 && (title || promoted)) s.comeback = true;
  if (L.tier > leagueOf(s.topLeague).tier) s.topLeague = L.id;
  const top = [...s.squad].sort((a, b) => b.goals - a.goals)[0];
  const formation = (Object.entries(s.formUse) as [M3Formation, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0]![0];
  const rec: M3SeasonRecord = {
    n: s.season + 1,
    age: s.age + 1,
    clubId: club.id,
    club: club.name,
    leagueId: club.leagueId,
    formation,
    mentality: s.plan.mentality,
    target: s.target,
    rank,
    teams,
    w: row.w,
    d: row.d,
    l: row.l,
    gf: row.gf,
    ga: row.ga,
    title,
    cup,
    cupRound: s.cupRound,
    promoted,
    relegated,
    met,
    outcome: sacked ? 'sacked' : 'renew',
    topScorer: top && top.goals > 0 ? { name: top.name, goals: top.goals } : null,
    award,
  };
  return { club, L, title, promoted, relegated, cup, met, award, sacked, rec };
}

function settleReviewSquad(s: M3State, { club, L }: ReturnType<typeof assessManagerSeason>) {
  // 선수: 성장 · 은퇴 · 계약 · 유스.
  const played = Math.max(1, ...s.squad.map((p) => p.apps));
  const growth: { id: number; d: number }[] = [];
  const retired: string[] = [];
  const academyApps = s.squad.filter((p) => p.academy).reduce((t, p) => t + p.apps, 0);
  const allApps = s.squad.reduce((t, p) => t + p.apps, 0) || 1;
  withRng(s, (r) => {
    for (const p of [...s.squad]) {
      const d = developPlayer(p, r, {
        trainFac: club.trainFac,
        youthAttr: s.attrs.youth,
        playRatio: p.apps / played,
      });
      if (d) growth.push({ id: p.id, d });
      if (p.academy && !p.star && p.ovr >= L.avg) {
        p.star = true;
        s.youthStars++;
      }
      if (retires(p, L.avg, r)) {
        retired.push(p.name);
        s.squad = s.squad.filter((x) => x.id !== p.id);
        continue;
      }
      p.contract = Math.max(0, p.contract - 1);
    }
  });
  const intake = withRng(s, (r) => (s.squad.length < M3_SQUAD_MAX ? youthIntake(s, r) : []));
  s.squad.push(...intake);
  const expiring = s.squad.filter((p) => p.contract === 0).map((p) => p.id);
  return { growth, retired, intake, expiring, academyApps, allApps };
}

function developReviewManager(
  s: M3State,
  { met, title, cup, award, sacked }: ReturnType<typeof assessManagerSeason>,
  { academyApps, allApps }: ReturnType<typeof settleReviewSquad>,
) {
  // 감독 성장.
  let points = 3 + (met ? 2 : 0) + (title ? 2 : 0) + (cup ? 1 : 0) + (award ? 1 : 0);
  points = sacked ? 3 : Math.min(points, 8);
  const cap = attrCap(s.license);
  const used = Math.max(...Object.values(s.formUse));
  if (used >= 4) s.attrs.tac = Math.min(cap, s.attrs.tac + 1);
  if (academyApps / allApps >= 0.15) s.attrs.youth = Math.min(cap, s.attrs.youth + 1);
  if (s.harmony >= 65) s.attrs.mgmt = Math.min(cap, s.attrs.mgmt + 1);
  s.points += points;
  for (const f of M3_FORMATIONS) s.fam[f] = Math.round(s.fam[f] * 0.9);
  s.formUse = zeroForm();
  s.season++;
  s.age++;
  s.clubSeasons++;
  let licenseUp: M3State['license'] | null = null;
  const next = M3_LICENSE_NEXT[s.license];
  if (next && s.season >= next.seasons && s.rep >= next.rep) {
    s.license = M3_LICENSES[M3_LICENSES.indexOf(s.license) + 1]!;
    licenseUp = s.license;
  }
  return { points, licenseUp };
}

function moveReviewLeague({ club, promoted, relegated }: ReturnType<typeof assessManagerSeason>) {
  // 승강: 리그만 바꾼다(선수단은 그대로라 새 리그에서 상대 전력이 달라진다).
  const nextLeague = promoted ? UP[club.leagueId] : relegated ? DOWN[club.leagueId] : undefined;
  if (nextLeague) {
    club.leagueId = nextLeague;
    club.base = leagueOf(nextLeague).avg + (promoted ? -3 : 3);
  }
}

function drawReviewOffers(
  s: M3State,
  { sacked, title, met }: ReturnType<typeof assessManagerSeason>,
) {
  withRng(s, (r) => {
    if (sacked) {
      s.sacked++;
      s.offers = r() < 0.35 + s.rep / 150 ? makeOffers(s, r, 'rebound').slice(0, 2) : [];
    } else {
      const p = clamp(s.rep / 140 + (title ? 0.3 : 0) + (met ? 0.1 : -0.1), 0, 0.85);
      s.offers = r() < p ? makeOffers(s, r, 'offer') : [];
    }
  });
  if (sacked) {
    s.club = null;
    s.clubSeasons = 0;
    s.squad = [];
  }
}

function finishSeason(s: M3State, sackedMid: boolean) {
  // Keep these calls explicit: squad development and offers consume RNG in this order.
  const assessment = assessManagerSeason(s, sackedMid);
  const squad = settleReviewSquad(s, assessment);
  const { points, licenseUp } = developReviewManager(s, assessment, squad);
  moveReviewLeague(assessment);
  drawReviewOffers(s, assessment);
  const { rec, sacked } = assessment;
  const { growth, retired, intake, expiring } = squad;
  s.history.push(rec);
  s.review = {
    record: rec,
    growth,
    retired,
    intake: intake.map((p) => p.id),
    expiring: sacked ? [] : expiring,
    board: s.board,
    sacked,
    midSeason: sackedMid,
    licenseUp,
    points,
  };
  s.phase = 'review';
}

/** 성장 점수 1을 능력치에 준다(자격 상한까지). */
export function spendPoint(s: M3State, attr: M3Attr): boolean {
  if (s.points <= 0 || !M3_ATTRS.includes(attr) || s.attrs[attr] >= attrCap(s.license))
    return false;
  s.attrs[attr]++;
  s.points--;
  s.spent[attr] = (s.spent[attr] ?? 0) + 1;
  return true;
}

/** 은퇴할 수 있는지(5시즌을 마친 뒤 리뷰 · 제의 · 프리시즌에서). */
export const canRetire = (s: M3State) =>
  s.season >= M3_MIN_SEASONS &&
  (s.phase === 'review' || s.phase === 'offers' || s.phase === 'preseason');

export function retire(s: M3State): boolean {
  if (!canRetire(s)) return false;
  const last = s.history.at(-1);
  if (last && last.outcome === 'renew') last.outcome = 'retire';
  s.phase = 'done';
  return true;
}

/** 리뷰를 마친다: 재계약하지 않은 선수는 나가고, 다음 시즌 · 제의 · 강제 은퇴로. */
export function continueReview(s: M3State): boolean {
  if (s.phase !== 'review' || !s.review) return false;
  const leaving = new Set(s.review.expiring);
  s.squad = s.squad.filter((p) => !leaving.has(p.id));
  if (s.club && s.squad.length < M3_SQUAD_MIN) {
    const club = s.club;
    const L = leagueOf(club.leagueId);
    withRng(s, (r) => {
      while (s.squad.length < M3_SQUAD_MIN) {
        const role = (['CB', 'FB', 'CM', 'WG', 'ST', 'GK', 'DM'] as const)[s.squad.length % 7]!;
        s.squad.push(
          makePlayer(s, r, {
            role,
            age: ri(r, 18, 30),
            ovr: L.avg - 8 + gauss(r) * 2,
            pot: L.avg - 4,
            leagueId: club.leagueId,
          }),
        );
      }
    });
  }
  if (forcedRetire(s)) {
    s.phase = 'done';
    return true;
  }
  if (!s.club || s.offers.length) s.phase = 'offers';
  else prepareSeason(s);
  return true;
}

/** 다음 단계로 넘어갈 수 있는 선택이 무엇인지(화면 · 시뮬레이터용). */
export const isDone = (s: M3State) => s.phase === 'done';

/** 영입 제안(시드로 수락을 정한다). */
export const signTarget = (s: M3State, i: number) => withRng(s, (r) => bid(s, i, r));
