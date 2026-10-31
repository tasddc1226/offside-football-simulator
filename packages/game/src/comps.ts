// ───────── 실제 대회 구조: 국내 컵 · 슈퍼컵 · 대륙 클럽 대회 · 시상식 · 커리어 여정 ─────────
import { ovr } from './attributes.js';
import { clamp, ri, chance, gauss, rnd } from './rng.js';
import { clubRef, CLUBS, LEAGUES, sameClub, type Club, type Pos } from './data.js';
import {
  leagueOf,
  clubsIn,
  roleOf,
  addStat,
  atkOf,
  creOf,
  rollScoring,
  START_P,
} from './engine.js';
import type { GameState, Season, SeasonComp } from './types.js';
import type { NatTourResult } from './national.js';
import { confPoty, federationPoty } from './nation.js';
import { gCompsText as M } from './i18n/ko/gComps.js';
import { tn } from './i18n/names.js';
import { leagueOpen } from './balance.js';
import { scoringTable, scoringRank } from './scoring-table.js';
import type { MomentHooks } from './moments.js';

export const CUPS: Record<string, string[]> = {
  hs: ['전국고교축구선수권'],
  uni: ['전국대학축구선수권'],
  k3: ['코리아컵'],
  k2: ['코리아컵'],
  k1: ['코리아컵'],
  j1: ['일왕배', 'J리그컵'],
  mls: ['US 오픈컵', '리그스컵'],
  ere: ['KNVB컵'],
  l1: ['쿠프 드 프랑스'],
  bl: ['DFB-포칼'],
  sa: ['코파 이탈리아'],
  ll: ['코파 델 레이'],
  pl: ['FA컵', 'EFL컵'],
  csl: ['중국 FA컵'],
  spl: ['킹스컵'],
  bra: ['코파 두 브라질'],
  por: ['타사 드 포르투갈', '타사 다 리가'],
};
const SUPERCUP: Record<string, string> = {
  pl: 'FA 커뮤니티 실드',
  ll: '수페르코파 데 에스파냐',
  sa: '수페르코파 이탈리아나',
  bl: 'DFL 슈퍼컵',
  l1: '트로페 데 샹피옹',
  ere: '요한 크라위프 스할',
  j1: '재팬 슈퍼컵',
  csl: '중국 슈퍼컵',
  spl: '사우디 슈퍼컵',
  bra: '수페르코파 두 브라질',
  por: '수페르타사 칸디두 드 올리베이라',
};
export const TOP_SCORER: Record<string, string> = {
  pl: '프리미어리그 골든부트',
  ll: '피치치 트로피',
  sa: '카포칸노니에레',
  bl: '토르예거카논',
  l1: '리그 1 득점왕',
  ere: '에레디비시 득점왕',
  j1: 'J리그 득점왕',
  mls: 'MLS 골든부트',
  k1: 'K리그1 득점왕',
  k2: 'K리그2 득점왕',
  k3: 'K3리그 득점왕',
  csl: '중국 슈퍼리그 득점왕',
  spl: '사우디 프로리그 득점왕',
  bra: '브라질레이랑 득점왕',
  por: '프리메이라 리가 득점왕',
};
export const POTY: Record<string, string> = {
  pl: 'PFA 올해의 선수',
  ll: '라리가 올해의 선수',
  sa: '세리에 A MVP',
  bl: '분데스리가 올해의 선수',
  l1: 'UNFP 올해의 선수',
  ere: '에레디비시 올해의 선수',
  j1: 'J리그 MVP',
  mls: 'MLS MVP',
  k1: 'K리그1 MVP',
  k2: 'K리그2 MVP',
  k3: 'K3리그 MVP',
  csl: '중국 슈퍼리그 MVP',
  spl: '사우디 프로리그 올해의 선수',
  bra: '브라질레이랑 올해의 선수',
  por: '프리메이라 리가 올해의 선수',
};
const YOUNG: Record<string, string> = {
  pl: 'PFA 올해의 영플레이어',
  k1: 'K리그1 영플레이어상',
  k2: 'K리그2 영플레이어상',
  j1: 'J리그 베스트 영플레이어상',
};
const youngOf = (L: { id: string; name: string }) => YOUNG[L.id] ?? `${L.name} 올해의 영플레이어`;
const YOUNG_NAMES = new Set(LEAGUES.map(youngOf));
const wonYoung = (s: GameState) => s.awards.some((a) => YOUNG_NAMES.has(a.t));
/** ko: 리그 페이즈 없이 전 라운드 녹아웃(전반기 1라운드 · 후반기 16강~결승). */
export const CONT: Record<
  string,
  { name: string; avg: number; games: number; top: number; po: number | null; ko?: boolean }
> = {
  UCL: { name: 'UEFA 챔피언스리그', avg: 80, games: 8, top: 16, po: 10 },
  UEL: { name: 'UEFA 유로파리그', avg: 74, games: 8, top: 16, po: 10 },
  UECL: { name: 'UEFA 컨퍼런스리그', avg: 69, games: 6, top: 12, po: 8 },
  ACLE: { name: 'AFC 챔피언스리그 엘리트', avg: 64, games: 8, top: 11, po: null },
  ACL2: { name: 'AFC 챔피언스리그 2', avg: 59, games: 6, top: 10, po: null },
  CCC: { name: 'CONCACAF 챔피언스컵', avg: 63, games: 0, top: 0, po: null, ko: true },
  // T-11-457 조별리그 6경기(ACL2와 같은 기준) 뒤 16강부터 홈 · 원정, 결승은 단판.
  LIB: { name: '코파 리베르타도레스', avg: 66, games: 6, top: 10, po: null },
};
/**
 * T-11-261 대륙 대회 녹아웃 상대를 고르는 구단 표(리그 id). 상대 이름은 RNG를 쓰지 않고 정한다 — 승부 결과·전력 계산은
 * 그대로고, 그 전력에 가장 가까운 구단 몇 곳 가운데 커리어·연도·대회·단계로 만든 해시로 하나를 고른다.
 */
const CONT_POOL: Record<string, string[]> = {
  UCL: ['pl', 'll', 'bl', 'sa', 'l1', 'ere', 'por'],
  UEL: ['pl', 'll', 'bl', 'sa', 'l1', 'ere', 'por'],
  UECL: ['pl', 'll', 'bl', 'sa', 'l1', 'ere', 'por'],
  ACLE: ['k1', 'j1', 'spl', 'csl'],
  ACL2: ['k1', 'j1', 'spl', 'csl'],
  CCC: ['mls'],
  LIB: ['bra'],
};
/** 첫 녹아웃 라운드(16강·PO·1라운드)는 같은 리그 구단을 피한다 — 그 뒤는 만날 수 있다. */
const FIRST_KO = new Set(['16강', '녹아웃 PO', '1라운드']); // i18n-ignore 저장값
function fnv(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
/** 대회 녹아웃 상대 한 곳. oppStr에 가까운 구단 4곳 중 해시로 고른다(RNG 소모 없음). 내 구단·이미 만난 구단은 뺀다. */
export function drawOpponent(s: GameState, c: SeasonComp, stage: string, oppStr: number): string {
  const used = new Set((c.bracket?.path ?? []).map((t) => t.opp));
  const m = s.leagueMoves ?? {};
  const leagueOfClub = (x: Club) => m[x.id] ?? x.leagueId;
  // T-11-457 새 리그는 newLeagues가 켜져야 상대로 나온다(꺼져 있으면 예전 대진과 같다).
  const leagues = (CONT_POOL[c.key ?? ''] ?? []).filter((id) => leagueOpen(leagueOf(id)));
  let pool = CLUBS.filter(
    (x) => leagues.includes(leagueOfClub(x)) && x.id !== s.club.id && !used.has(x.id),
  );
  if (FIRST_KO.has(stage)) {
    const other = pool.filter((x) => leagueOfClub(x) !== s.leagueId);
    if (other.length >= 4) pool = other;
  }
  if (!pool.length) return '';
  const near = pool.sort(
    (a, b) => Math.abs(a.str - oppStr) - Math.abs(b.str - oppStr) || (a.id < b.id ? -1 : 1),
  );
  const top = near.slice(0, Math.min(4, near.length));
  // cid는 저장마다 무작위라 쓰지 않는다 — 같은 상태(같은 시드 커리어)면 언어·실행과 무관하게 같은 상대여야 한다(골든).
  const S = s.season;
  const seed = [
    s.year,
    c.key,
    stage,
    s.club.id,
    S.apps,
    S.goals,
    S.assists,
    S.ratingSum.toFixed(2),
    c.pts ?? 0,
    c.apps,
    c.g,
  ].join('|');
  return top[fnv(seed) % top.length]!.id;
}

const BIG5: [string, number][] = [
  ['UCL', 4],
  ['UEL', 2],
  ['UECL', 1],
];
const CONT_SLOTS: Record<string, [string, number][]> = {
  pl: BIG5,
  ll: BIG5,
  bl: BIG5,
  sa: BIG5,
  l1: [
    ['UCL', 3],
    ['UEL', 1],
    ['UECL', 1],
  ],
  ere: [
    ['UCL', 2],
    ['UEL', 1],
    ['UECL', 2],
  ],
  k1: [
    ['ACLE', 3],
    ['ACL2', 1],
  ],
  j1: [
    ['ACLE', 3],
    ['ACL2', 1],
  ],
  mls: [['CCC', 6]],
  csl: [
    ['ACLE', 3],
    ['ACL2', 1],
  ],
  spl: [
    ['ACLE', 3],
    ['ACL2', 1],
  ],
  bra: [['LIB', 6]],
  por: [
    ['UCL', 2],
    ['UEL', 1],
    ['UECL', 1],
  ],
};

// 첫 시즌 예상 순위: 리그 내 전력 순위를 6단계 표(1,3,5,8,11,14)에 비례해 옮긴다 — 클럽 수가 6이면
// 예전 고정표와 같다(T-10-009에서 리그별 팀 수가 늘어도 같은 범위를 유지).
const RANK_STEPS = [1, 3, 5, 8, 11, 14];
export function expectedRank(idx: number, n: number): number {
  const p = n > 1 ? (Math.max(0, idx) * (RANK_STEPS.length - 1)) / (n - 1) : 0;
  const lo = Math.floor(p);
  return Math.round(
    RANK_STEPS[lo]! +
      (RANK_STEPS[Math.min(lo + 1, RANK_STEPS.length - 1)]! - RANK_STEPS[lo]!) * (p - lo),
  );
}

/** The competition assigned by the game's league slots. No random draws. */
export function continentalForRank(leagueId: string, rank: number): string | null {
  let acc = 0;
  for (const [key, slots] of CONT_SLOTS[leagueId] ?? []) {
    if (rank <= acc + slots) return key;
    acc += slots;
  }
  return null;
}

/** New-club entry uses a strength-based estimate, not a simulated foreign-league table. */
export function transferOutlook(s: GameState, clubId: string, leagueId: string) {
  const league = clubsIn(leagueId, s).sort((a, b) => b.str - a.str);
  const index = league.findIndex((c) => c.id === clubId);
  if (index < 0 || leagueOf(leagueId).amateur || clubId === 'sangmu') return null;
  const rank = expectedRank(index, league.length);
  const key = continentalForRank(leagueId, rank);
  return { rank, competition: key ? CONT[key]!.name : null };
}

export function seasonSetup(s: GameState, S: Season) {
  const L = leagueOf(s.leagueId);
  S.trophiesMid = [];
  S.capsStart = s.nat ? s.nat.caps : 0;
  S.comps = (CUPS[L.id] ?? []).map((name) => ({
    type: 'cup',
    name,
    alive: true,
    stage: '',
    apps: 0,
    g: 0,
    a: 0,
  }));
  if (L.amateur || s.club.id === 'sangmu') return;
  const last = s.career[s.career.length - 1];
  const stayed = last && sameClub(last, clubRef(s.club));
  const same = stayed && last.league === L.name;
  // T-10-110 구단과 함께 승격한 첫 시즌 — 지난 순위는 아래 리그의 것이라 대륙 대회에 나가지 않는다.
  if (stayed && !same) return;
  const league = clubsIn(s.leagueId, s).sort((a, b) => b.str - a.str);
  const idx = league.findIndex((c) => c.id === s.club.id);
  const rank = same ? (last!.rank as number) : expectedRank(idx, league.length);
  const key = continentalForRank(L.id, rank);
  if (key)
    S.comps.push({
      type: 'cont',
      key,
      name: CONT[key]!.name,
      alive: true,
      stage: CONT[key]!.ko ? '1라운드' : '리그 페이즈',
      pts: 0,
      played: 0,
      apps: 0,
      g: 0,
      a: 0,
    });
  if (
    SUPERCUP[L.id] &&
    same &&
    last!.honors.some(
      (h) => h === `${L.name} 우승` || (CUPS[L.id] ?? []).some((c) => h === `${c} 우승`),
    )
  )
    S.comps.push({
      type: 'super',
      name: SUPERCUP[L.id]!,
      alive: true,
      stage: '',
      apps: 0,
      g: 0,
      a: 0,
    });
}

function compMatch(s: GameState, oppStr: number, startP: number) {
  const o = ovr(s);
  let mins = 0,
    g = 0,
    a = 0,
    perf = 0;
  if (s.injury === 0) {
    if (chance(startP)) mins = chance(0.2) ? ri(60, 85) : 90;
    else if (chance(0.35)) mins = ri(10, 30);
  }
  if (mins) {
    perf = (o - oppStr) / 10 + gauss() * 0.8 + (s.cond - 70) / 60;
    ({ g, a } = rollScoring(s, { atk: atkOf(s), cre: creOf(s), o }, perf, oppStr, mins));
  }
  return { mins, g, a, edge: (s.club.str - oppStr) * 0.03 + (mins ? perf * 0.03 + g * 0.1 : 0) };
}
function startChance(s: GameState, type: 'cup' | 'cont'): number {
  const r = roleOf(s);
  return (type === 'cup' ? { 주전: 0.6, 로테이션: 0.8, 벤치: 0.45 } : START_P)[r];
}
function tally(c: SeasonComp, m: { mins: number; g: number; a: number }) {
  if (m.mins) {
    c.apps++;
    c.g += m.g;
    c.a += m.a;
  }
}
/**
 * T-11-186 대회 경기 한 판의 기록 — 화면이 구간 리포트에 경기별 줄로 그린다. 엔진이 이미 굴린 값만 담는다(상대·스코어는
 * 계산하지 않으므로 없다). stage는 저장값 한국어('16강'·'리그 페이즈'), 그릴 때 tn으로 옮긴다.
 */
export type CompGame = {
  stage: string;
  /** 두 경기 승부의 몇 번째 경기. 단판·리그 페이즈면 없다. */
  leg?: number;
  mins: number;
  g: number;
  a: number;
  /** 리그 페이즈 경기 결과. */
  res?: 'W' | 'D' | 'L';
  /** 승부가 끝난 경기(마지막 차전)에만 — 다음 단계로 갔는지. */
  won?: boolean;
  /** T-11-261 대륙 대회 녹아웃 상대 구단 id(clubNameOf로 이름). 컵·리그 페이즈엔 없다. */
  opp?: string;
};
export type CompLine = { t: string; k: string; games: CompGame[] };

function tie(
  s: GameState,
  c: SeasonComp,
  oppStr: number,
  legs: number,
  stage: string,
  out: CompGame[],
  opp?: string,
  mo?: MomentHooks,
): boolean {
  let edge = 0;
  for (let i = 0; i < legs; i++) {
    const m = compMatch(s, oppStr, startChance(s, c.type as 'cup' | 'cont'));
    tally(c, m);
    edge += m.edge;
    out.push({
      stage,
      ...(legs > 1 ? { leg: i + 1 } : {}),
      mins: m.mins,
      g: m.g,
      a: m.a,
      ...(opp ? { opp } : {}),
    });
  }
  const p = clamp(0.5 + edge / legs, 0.08, 0.92);
  const x = rnd();
  let won = x < p;
  const last = out[out.length - 1]!;
  // T-11-390 컵 · 대륙 대회 결승(내가 뛴 경기)은 승부 난수 x를 결정적 장면의 성공 기준선과 비교한다. 맡기면 기준선이 p 그대로다.
  const final = stage === '결승'; // i18n-ignore 저장값
  if (mo && final && c.type !== 'super' && last.mins > 0) {
    const m = mo.open({ comp: c.name, ...(opp ? { opp } : {}) }, p, true);
    won = m.ok = x < m.pct;
  }
  last.won = won;
  return won;
}

const CUP_PLAN: Record<number, string[]> = { 1: ['32강', '16강'], 2: ['8강', '4강', '결승'] };
const CUP_OPP: Record<string, number> = { '32강': -6, '16강': -2, '8강': 1, '4강': 3, 결승: 5 };
/** mo는 T-11-390 결정적 장면 자리(화면 진행만 넘긴다 — 시뮬레이터 · 골든은 없이 같은 결과). */
export function compsPhase(s: GameState, mo?: MomentHooks): CompLine[] {
  const S = s.season,
    L = leagueOf(s.leagueId),
    lines: CompLine[] = [];
  if (!S.comps) seasonSetup(s, S);
  for (const c of S.comps!) {
    if (!c.alive) continue;
    // 대회마다 이번 구간 결과 줄은 하나다 — 그 줄에 이번 구간 경기들을 붙인다.
    const games: CompGame[] = [];
    if (c.type === 'super' && s.phase === 0) {
      const won = tie(s, c, L.avg + 6, 1, '결승', games); // i18n-ignore 저장값
      c.alive = false;
      c.stage = won ? '우승' : '준우승';
      if (won) S.trophiesMid!.push(`${c.name} 우승`);
      lines.push({
        t: M.compLine({ name: tn(c.name), stage: won ? '우승' : '준우승' }),
        k: won ? 'good' : '',
        games,
      });
    } else if (c.type === 'cup' && CUP_PLAN[s.phase]) {
      for (const r of CUP_PLAN[s.phase]!) {
        const won = tie(s, c, L.avg + (CUP_OPP[r] ?? 0) + gauss() * 3, 1, r, games, undefined, mo);
        if (!won) {
          c.alive = false;
          c.stage = r === '결승' ? '준우승' : `${r} 탈락`;
          break;
        }
        if (r === '결승') {
          c.alive = false;
          c.stage = '우승';
          S.trophiesMid!.push(`${c.name} 우승`);
        } else c.stage = `${r} 통과`;
      }
      lines.push({
        t: M.compLine({ name: tn(c.name), stage: c.stage }),
        k: c.stage === '우승' ? 'good' : c.alive ? '' : 'bad',
        games,
      });
    } else if (c.type === 'cont' && s.phase >= 1) {
      const line = contPhase(s, c, games, mo);
      lines.push({ ...line, games });
    }
  }
  return lines;
}
/** T-11-261 녹아웃 라운드 상대 전력의 기준값(가우스 흔들림 전) — 다음 상대를 미리 추첨할 때 쓴다. */
const KO_BONUS: Record<string, number> = {
  '녹아웃 PO': 0,
  '16강': 2,
  '8강': 5,
  '4강': 8,
  결승: 10,
}; // i18n-ignore 저장값
/** 한 승부를 치르고 대진 기록에 남긴다. 미리 추첨한 다음 상대가 이 단계면 그 구단, 아니면 전력에 가까운 구단을 고른다. */
function koTie(
  s: GameState,
  c: SeasonComp,
  oppStr: number,
  legs: number,
  stage: string,
  games: CompGame[],
  mo?: MomentHooks,
): boolean {
  const b = (c.bracket ??= { path: [] });
  const opp = b.next?.stage === stage ? b.next.opp : drawOpponent(s, c, stage, oppStr);
  b.next = undefined;
  const won = tie(s, c, oppStr, legs, stage, games, opp || undefined, mo);
  b.path.push({ stage, opp, legs, won });
  return won;
}
/** 다음 라운드 상대를 미리 추첨해 둔다 — 시즌 탭이 아직 치르지 않은 승부로 보여 준다. */
function drawNext(s: GameState, c: SeasonComp, stage: string, legs: number) {
  const b = (c.bracket ??= { path: [] });
  const opp = drawOpponent(s, c, stage, CONT[c.key!]!.avg + (KO_BONUS[stage] ?? 0));
  b.next = opp ? { stage, opp, legs } : undefined;
}
function contPhase(
  s: GameState,
  c: SeasonComp,
  games: CompGame[],
  mo?: MomentHooks,
): { t: string; k: string } {
  const C = CONT[c.key!]!,
    S = s.season;
  if (s.phase === 1 && C.ko) {
    if (koTie(s, c, C.avg - 2 + gauss() * 2, 2, '1라운드', games)) {
      // i18n-ignore 저장값
      c.stage = '16강 진출';
      drawNext(s, c, '16강', 2); // i18n-ignore 저장값
      return { t: M.contKoPass({ name: tn(c.name) }), k: 'good' };
    }
    c.alive = false;
    c.stage = '1라운드 탈락';
    return { t: M.compLine({ name: tn(c.name), stage: '1라운드 탈락' }), k: 'bad' };
  }
  if (s.phase === 1) {
    for (let i = 0; i < C.games; i++) {
      const m = compMatch(s, C.avg + gauss() * 5, startChance(s, 'cont'));
      tally(c, m);
      const wp = clamp(0.4 + m.edge, 0.05, 0.9),
        x = rnd();
      const res = x < wp ? 'W' : x < wp + (1 - wp) * 0.35 ? 'D' : 'L';
      c.pts = (c.pts ?? 0) + (res === 'W' ? 3 : res === 'D' ? 1 : 0);
      c.played = (c.played ?? 0) + 1;
      games.push({ stage: '리그 페이즈', mins: m.mins, g: m.g, a: m.a, res }); // i18n-ignore 저장값
    }
    if (c.pts! >= C.top) {
      c.stage = '16강 직행';
      drawNext(s, c, '16강', 2); // i18n-ignore 저장값
      return { t: M.leagueDirect({ name: tn(c.name), pts: c.pts! }), k: 'good' };
    }
    if (C.po && c.pts! >= C.po) {
      c.stage = '녹아웃 PO';
      drawNext(s, c, '녹아웃 PO', 2); // i18n-ignore 저장값
      return { t: M.leaguePlayoff({ name: tn(c.name), pts: c.pts! }), k: '' };
    }
    c.alive = false;
    c.stage = '리그 페이즈 탈락';
    return { t: M.leagueOut({ name: tn(c.name), pts: c.pts! }), k: 'bad' };
  }
  const rounds = [...(c.stage === '녹아웃 PO' ? ['녹아웃 PO'] : []), '16강', '8강', '4강', '결승'];
  const asia = c.key!.startsWith('ACL');
  for (const r of rounds) {
    const opp = C.avg + KO_BONUS[r]! + gauss() * 2;
    const won = koTie(s, c, opp, r === '결승' || (asia && r !== '16강') ? 1 : 2, r, games, mo);
    if (!won) {
      c.alive = false;
      c.stage = r === '결승' ? '준우승' : `${r} 탈락`;
      return { t: M.compLine({ name: tn(c.name), stage: c.stage }), k: r === '결승' ? '' : 'bad' };
    }
    if (r === '결승') {
      c.alive = false;
      c.stage = '우승';
      S.trophiesMid!.push(`${c.name} 우승`);
      return { t: M.compLine({ name: tn(c.name), stage: '우승' }), k: 'good' };
    }
    c.stage = r === '16강' ? '8강 진출' : `${r} 통과`;
  }
  return { t: M.compLine({ name: tn(c.name), stage: c.stage }), k: '' };
}
export function compGoals(S: Season) {
  return (S.comps ?? []).reduce((t, c) => ({ apps: t.apps + c.apps, g: t.g + c.g, a: t.a + c.a }), {
    apps: 0,
    g: 0,
    a: 0,
  });
}

// ───────── 시즌 개인상 · 발롱도르 시상식 ─────────
// T-10-042에서 한 시즌 득점·도움 상한이 낮아진 만큼 기준도 낮춰, 수상 빈도를 그 이전(T-10-039) 수준에 맞췄다.
export const TOP_G = 0.57,
  TOP_A = 0.34,
  BALLON_BAR = 164.8;
const MULLER_BAR = 36,
  SHOE_BAR = 56.5;
/**
 * T-11-021 발롱도르 점수·FIFPRO 월드 11의 포지션 보정. atk: 골·도움 항 배수, bonus: 포지션 기본 점수, fifpro: FIFPRO
 * 월드 11 발롱도르 순위 컷. 세부 포지션 선수(시즌 1부터)는 골·도움 항이 공격수에게 쏠리지 않게 줄이고 포지션마다
 * 기본 점수를 준다. FIFPRO는 포메이션 자리(GK 1 · DF 4 · MF 3 · FW 3)를 순위 컷으로 옮긴 값이다 — 한 선수만
 * 시뮬레이션하므로 후보가 몰린 공격수는 더 높은 순위여야 한다. 프리시즌 선수는 옛 보정(DF +2 · GK +3, 전원 12위)이다.
 */
type BallonPos = Record<Pos, { atk: number; bonus: number; fifpro: number }>;
export const BALLON_POS: BallonPos = {
  FW: { atk: 0.8, bonus: 0, fifpro: 8 },
  MF: { atk: 1, bonus: 5, fifpro: 13 },
  DF: { atk: 1, bonus: 6, fifpro: 13 },
  GK: { atk: 1, bonus: 5, fifpro: 5 },
};
const BALLON_POS_PRESEASON: BallonPos = {
  FW: { atk: 1, bonus: 0, fifpro: 12 },
  MF: { atk: 1, bonus: 0, fifpro: 12 },
  DF: { atk: 1, bonus: 2, fifpro: 12 },
  GK: { atk: 1, bonus: 3, fifpro: 12 },
};
export function seasonAwards(
  s: GameState,
  ctx: { rank: number; avg: number; trophies: string[]; tours: NatTourResult[] },
) {
  const L = leagueOf(s.leagueId),
    S = s.season,
    m = L.matches,
    o = ovr(s);
  const { rank, avg, trophies, tours } = ctx,
    awards: string[] = [],
    gala: string[] = [];
  const cg = compGoals(S),
    allG = S.goals + cg.g,
    allA = S.assists + cg.a;
  const enough = S.apps >= m * 0.55,
    back = s.pos === 'DF' || s.pos === 'GK';
  const topG = m * TOP_G + gauss() * 3,
    topA = m * TOP_A + gauss() * 2;
  const scoring = scoringTable(s);
  const mine = scoring?.find((r) => r.me);
  const first = (key: 'goals' | 'assists', legacy: number) =>
    scoring && mine ? mine[key] > 0 && scoringRank(scoring, mine, key) === 1 : S[key] >= legacy;
  if (first('goals', Math.max(topG, 6))) awards.push(L.amateur ? '득점왕' : TOP_SCORER[L.id]!);
  if (first('assists', Math.max(topA, 5))) awards.push(L.amateur ? '도움왕' : `${L.name} 도움왕`);
  if (enough && avg >= 7.55 && (rank <= 3 || S.goals >= topG) && chance(0.5))
    awards.push(L.amateur ? '대회 MVP' : POTY[L.id]!);
  if (enough && avg >= (back ? 7.2 : 7.3) && chance(0.75))
    awards.push(
      L.amateur ? '대회 베스트 11' : L.tier >= 4 ? `${L.name} 올해의 팀` : `${L.name} 베스트 11`,
    );
  // 영플레이어는 23세 이하면 어느 프로 시즌에서든 받을 수 있고 커리어에 한 번이다(옛 rookieDone은 첫 프로 시즌만 봤다).
  if (!L.amateur && s.age <= 23 && !wonYoung(s) && S.apps >= m * 0.45 && avg >= 7.25)
    awards.push(youngOf(L));
  if (L.amateur) return { awards, gala };

  const big = (t: string) => (trophies.includes(t) ? 1 : 0);
  const ntBonus = (tours ?? [])
    .filter((t) => t.inSquad)
    .reduce(
      (b, t) =>
        b +
        (({ 우승: 12, 금메달: 4, 준우승: 7, '4강': 5, '8강': 3 } as Record<string, number>)[
          t.stage
        ] ?? 0) *
          (t.key === 'wc' ? 1 : 0.5),
      0,
    );
  const cont = (S.comps ?? []).find((c) => c.type === 'cont');
  const bp = (s.dpos ? BALLON_POS : BALLON_POS_PRESEASON)[s.pos];
  const score =
    o +
    (S.goals * 0.45 + S.assists * 0.28 + (cont ? cont.g * 0.7 + cont.a * 0.3 : 0)) * bp.atk +
    avg * 5 +
    L.tier * 1.2 +
    big('UEFA 챔피언스리그 우승') * 12 +
    (rank === 1 ? 6 : 0) +
    ntBonus +
    (cont && cont.key === 'UCL' && /4강|결승|준우승/.test(cont.stage) ? 4 : 0) +
    bp.bonus +
    gauss() * 3;
  const ballonRank = clamp(Math.round(1 + (BALLON_BAR - score) / 0.8), 1, 99);
  if (L.tier >= 4 && ballonRank <= 30 && enough) {
    s.ballon = (s.ballon ?? []).concat({ year: s.year, rank: ballonRank });
    gala.push(ballonRank === 1 ? M.galaWin : M.galaRank({ rank: ballonRank }));
    if (ballonRank === 1) awards.push('발롱도르');
    if (s.age <= 21) awards.push('코파 트로피');
    if (s.pos === 'GK' && ballonRank <= 25 && chance(0.6)) awards.push('야신 트로피');
    if (ballonRank <= 2 && chance(0.7)) awards.push('FIFA 더 베스트 남자 선수');
    if (ballonRank <= bp.fifpro && chance(0.8)) awards.push('FIFPRO 월드 11');
  }
  if (L.tier >= 4 && allG >= MULLER_BAR + gauss() * 3) awards.push('게르트 뮐러 트로피');
  const shoe = S.goals * (L.tier >= 5 ? 2 : 1.5);
  if (L.tier >= 4 && shoe >= SHOE_BAR + gauss() * 4) awards.push('유러피언 골든슈');
  if (s.pos === 'DF' && L.tier >= 5 && enough && avg >= 7.15 && rank <= 3 && chance(0.45))
    awards.push(`${L.name} 올해의 수비수`);
  // T-11-021 미드필더(세부 포지션 선수)도 골키퍼와 같은 조건으로 포지션 상을 받는다.
  const posAward = s.pos === 'GK' ? '골키퍼' : s.dpos && s.pos === 'MF' ? '미드필더' : null;
  if (posAward && enough && avg >= 7.1 && rank <= 4 && chance(0.45))
    awards.push(`${L.name} 올해의 ${posAward}`);
  const kfa = s.nat.caps > 0 && (ballonRank <= 30 || (o >= 80 && avg >= 7.2)) && chance(0.5);
  if (kfa) awards.push(federationPoty(s));
  // AFC 올해의 선수는 아시아 리그 소속, 국제선수상은 아시아 밖(유럽 · MLS · 브라질)에서 뛰는 선수 몫이다.
  // T-10-096 다른 연맹 국적은 같은 조건·확률로 자기 대륙 올해의 선수상을 받는다(이름만 다르다).
  const outsideAsia = L.tier >= 4 || L.id === 'mls' || L.id === 'bra';
  if (outsideAsia && o >= 80 && enough && avg >= 7.1 && chance(0.35))
    awards.push(confPoty(s, true));
  if (!outsideAsia && o >= 72 && enough && avg >= 7.3 && chance(0.25))
    awards.push(confPoty(s, false));
  return { awards, gala, allG, allA };
}

// ───────── 커리어 여정 (마일스톤) ─────────
export const SANGMU_NAME = '김천 상무 (국군체육부대)';
function mile(s: GameState, key: string, text: string, fame = 1): string | null {
  s.miles = s.miles ?? [];
  if (s.flags['m_' + key]) return null;
  s.flags['m_' + key] = 1;
  s.miles.push({ year: s.year, t: text });
  addStat(s, 'fame', fame);
  return text;
}
export function checkMilestones(
  s: GameState,
  rec: { pro?: boolean; apps: number; goals: number; club: string },
): string[] {
  const out: string[] = [];
  const add = (k: string, t: string, f?: number) => {
    const r = mile(s, k, t, f);
    if (r) out.push(r);
  };
  const pro = s.career.filter((r) => r.pro);
  const T = pro.reduce((a, r) => ({ p: a.p + r.apps, g: a.g + r.goals }), { p: 0, g: 0 });
  const L = leagueOf(s.leagueId);
  if (rec.pro && rec.apps) add('debut', `프로 데뷔 (${rec.club})`);
  if (rec.pro && rec.goals) add('debutGoal', `프로 데뷔골`);
  for (const n of [100, 200, 300, 400, 500, 600])
    if (T.p >= n) add('apps' + n, `프로 통산 ${n}경기 출전`, n / 100);
  for (const n of [50, 100, 150, 200, 300])
    if (T.g >= n) add('goals' + n, `프로 통산 ${n}골`, n / 50);
  if (L.tier >= 4) add('europe', `유럽 무대 진출 (${L.name})`, 2);
  if (L.tier >= 5) add('big5', `유럽 5대 리그 입성 (${L.name})`, 2);
  if (L.id === 'mls') add('mls', `미국 무대 진출 (${L.name})`, 2);
  if (L.id === 'bra') add('bra', `남미 무대 진출 (${L.name})`, 2);
  if (L.id === 'spl') add('spl', `중동 무대 진출 (${L.name})`, 2);
  if (L.id === 'csl') add('csl', `중국 무대 진출 (${L.name})`, 2);
  const cont = (s.season.comps ?? []).find((c) => c.type === 'cont');
  if (cont && cont.apps) add('cont_' + cont.key, `${cont.name} 데뷔`, 3);
  if (cont && cont.g) add('contG_' + cont.key, `${cont.name} 데뷔골`, 3);
  if (cont && cont.key === 'UCL' && /결승|우승|준우승/.test(cont.stage) && cont.apps)
    add('uclFinal', '챔피언스리그 결승 무대', 2);
  if (s.nat.caps) add('ntDebut', 'A매치 데뷔', 2);
  if (s.nat.goals) add('ntGoal', 'A매치 데뷔골', 2);
  for (const n of [50, 100])
    if (s.nat.caps >= n)
      add(
        'caps' + n,
        n === 100 ? '센추리 클럽 가입 (A매치 100경기)' : `A매치 ${n}경기 출전`,
        n / 20,
      );
  if (s.nat.captain) add('captain', '국가대표팀 주장 선임', 3);
  for (const t of s.nat.tours) {
    if (t.inSquad && t.name.includes('월드컵') && t.apps) add('wc', '월드컵 본선 출전', 3);
    if (t.inSquad && t.name.includes('월드컵') && t.goals) add('wcGoal', '월드컵 본선 득점', 3);
  }
  if ((s.ballon ?? []).length) add('ballonNom', '발롱도르 30인 후보 선정', 3);
  if (pro.length >= 5 && new Set(pro.map((r) => r.club)).size === 1)
    add('loyal5', `${rec.club} 한 팀에서 5시즌`, 2);
  return out;
}
export function retireMilestones(s: GameState): string[] {
  const pro = s.career.filter((r) => r.pro && !r.mil && r.club !== SANGMU_NAME);
  const out: (string | null)[] = [];
  // 구단 이름이 바뀌어도(데이터 갱신) 같은 구단이면 원클럽으로 센다 — clubId가 있으면 그것으로 비교한다.
  if (pro.length >= 8 && pro.every((r) => sameClub(r, pro[0]!)))
    // 진짜 영구결번은 서버가 심사한다(T-10-076) — 여기서는 원클럽맨 헌정 이정표만 남긴다.
    out.push(mile(s, 'oneclub', `원클럽맨 · ${s.club.name} 헌정 (No.${s.number})`, 0));
  else {
    const byClub: Record<string, number> = {};
    pro.forEach((r) => (byClub[r.club] = (byClub[r.club] ?? 0) + r.goals + r.apps * 0.2));
    const best = Object.entries(byClub).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 80) out.push(mile(s, 'legendClub', `${best[0]} 레전드 헌정`, 0));
  }
  if (s.nat.caps >= 30) out.push(mile(s, 'ntFarewell', 'A대표팀 은퇴 경기', 0));
  out.push(mile(s, 'farewell', `${s.club.name} 홈구장에서 은퇴 경기`, 0));
  return out.filter((x): x is string => !!x);
}
