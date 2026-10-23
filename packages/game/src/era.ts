// ───────── T-11-475 시대의 라이벌 ─────────
// 같은 시대에 떠오른 또래 라이벌 한 명을 커리어 내내 따로 시뮬레이션한다. 게임 RNG와 따로 노는 난수원(커리어 시드 · 연도)만
// 써서 내 선수의 능력치 · 수상 · RNG 순서는 라이벌이 있든 없든 같다. 한 명만 받는 상은 내 결과를 먼저 두고 라이벌을 맞춘다.
import { CLUBS, LEAGUES, type Club, type DetailPos, type Pos } from './data.js';
import { createRng, clamp, gauss, hashStr } from './rng.js';
import { BAL, leagueOpen } from './balance.js';
import { BALLON_BAR, BALLON_POS, POTY, TOP_A, TOP_G, TOP_SCORER } from './comps.js';
import { leagueOf, clubsIn } from './engine.js';
import { RIVAL_COUNTRY, poolRivalName, rivalCountryOf } from './rival-names.js';
import type { GameState } from './types.js';

export interface EraSeason {
  year: number;
  age: number;
  club: string;
  clubId: string;
  league: string;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  rating: number;
  ovr: number;
  rank: number;
  /** 수상(한국어 저장값). */
  honors: string[];
  /** 발롱도르 30인 후보 순위. */
  ballon?: number;
}

export interface EraRival {
  /** 한국어 저장값(rival-names 풀). */
  name: string;
  /** 이름 풀 나라(KR · JP · US · NL · FR · DE · IT · ES · GB). */
  country: string;
  pos: Pos;
  dpos?: DetailPos | undefined;
  born: number;
  /** 지금 능력(소수 둘째 자리). 시즌 기록의 ovr은 반올림한 값이다. */
  ovr: number;
  pot: number;
  /** 성장 곡선: 0 조기 성장 · 1 보통 · 2 대기만성. */
  curve: 0 | 1 | 2;
  clubId: string;
  club: string;
  leagueId: string;
  since: number;
  retireAge: number;
  seasons: EraSeason[];
  /** 은퇴한 시즌(그 시즌까지 뛰었다). */
  retired?: number;
  /** 내 OVR이 라이벌보다 크게 앞선 연속 시즌 수(세대교체 판정). */
  behind?: number;
}

export interface EraState {
  cur: EraRival;
  /** 세대교체로 지나간 라이벌(오래된 순). */
  past?: EraRival[];
}

/** 결산 시트가 그리는 이번 시즌 라이벌 소식. 저장(pending.res)에 남으므로 순수 데이터다. */
export interface EraNote {
  /** new: 처음 등장 · next: 세대교체로 새 라이벌 · season: 이어지는 시즌 · retired: 이번 시즌을 끝으로 은퇴. */
  kind: 'new' | 'next' | 'season' | 'retired';
  name: string;
  country: string;
  pos: Pos;
  dpos?: DetailPos | undefined;
  age: number;
  rival: EraSeason;
  /** 지난 라이벌 이름(세대교체일 때). */
  prev?: string | undefined;
}

/** 등장 나이 상한 · 한 커리어 최대 라이벌 수 · 세대교체 OVR 차이 · 그 차이가 이어져야 하는 시즌 수. */
export const ERA_MAX_AGE = 25,
  ERA_MAX_RIVALS = 3,
  ERA_BEHIND_GAP = 8,
  ERA_BEHIND_SEASONS = 2;
/** 계기를 만족한 시즌에 처음 나타날 확률. */
const ERA_APPEAR_P = 0.6;
const COUNTRY_LEAGUE: Record<string, string> = Object.fromEntries([
  ['KR', 'k1'],
  ...Object.entries(RIVAL_COUNTRY).map(([lg, c]) => [c, lg]),
]);

type R = () => number;
const eraRng = (s: GameState, year: number, salt = ''): R =>
  createRng(hashStr(`${s.origin?.seed ?? hashStr(s.name)}:era:${year}${salt}`)).next;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** 같은 나이 선수에게 기대하는 OVR(이보다 높으면 라이벌이 붙을 만큼 눈에 띈다). */
const standout = (age: number) => 68 + Math.max(0, age - 20) * 1.5;

/** OVR에 맞는 구단. 우선 리그 안에서 찾고, 그 리그 최강 구단보다 한참 세면 더 큰 리그로 간다. */
function pickClub(s: GameState, r: R, ovr: number, prefer: string | null): Club {
  const target = ovr - 2 + gauss(r) * 1.5;
  const near = (cs: Club[]) =>
    cs.slice().sort((a, b) => Math.abs(a.str - target) - Math.abs(b.str - target))[
      Math.floor(r() * Math.min(3, cs.length))
    ]!;
  if (prefer) {
    const home = clubsIn(prefer, s);
    if (home.length && Math.max(...home.map((c) => c.str)) >= ovr - 4) return near(home);
  }
  const open = new Set(
    LEAGUES.filter((l) => !l.amateur && l.tier >= 2 && leagueOpen(l)).map((l) => l.id),
  );
  return near(CLUBS.filter((c) => open.has(clubLeague(s, c))));
}
const clubLeague = (s: GameState, c: Club) => s.leagueMoves?.[c.id] ?? c.leagueId;

function spawn(s: GameState, o: number, r: R, next: boolean, prevName?: string): EraRival {
  const country = next
    ? (RIVAL_COUNTRY[s.leagueId] ?? 'KR')
    : typeof s.flags.rivalName === 'string'
      ? rivalCountryOf(s.flags.rivalName)
      : (RIVAL_COUNTRY[s.leagueId] ?? 'KR');
  let name =
    !next && typeof s.flags.rivalName === 'string' ? s.flags.rivalName : poolRivalName(r, country);
  for (let i = 0; i < 8 && (name === s.name || name === prevName); i++)
    name = poolRivalName(r, country);
  const born = s.year - s.age + (next ? 3 + Math.floor(r() * 3) : Math.floor(r() * 3) - 1);
  const ovr = next
    ? clamp(o - 7 + gauss(r) * 2, 60, 92)
    : clamp(o + gauss(r) * 1.5 + (r() < 0.6 ? 1 : 0), 55, 95);
  const pot = clamp(
    Math.round(next ? Math.max(o + 1, s.pot) + gauss(r) * 2 : s.pot + gauss(r) * 3),
    Math.ceil(ovr) + 1,
    99,
  );
  const club = pickClub(s, r, ovr, COUNTRY_LEAGUE[country] ?? null);
  const curve = r() < 0.25 ? 0 : r() < 0.75 ? 1 : 2;
  return {
    name,
    country,
    pos: s.pos,
    ...(s.dpos ? { dpos: s.dpos } : {}),
    born,
    ovr: round2(ovr),
    pot,
    curve: curve as EraRival['curve'],
    clubId: club.id,
    club: club.name,
    leagueId: clubLeague(s, club),
    since: s.year,
    retireAge: clamp(Math.round(34 + r() * 4 + (s.pos === 'GK' ? 2 : 0)), 33, 40),
    seasons: [],
  };
}

/** 라이벌의 한 시즌(이적 → 출전 · 기록 → 순위 → 수상). 내 수상과 겹치는 단독 상은 라이벌이 받지 않는다. */
function playSeason(
  s: GameState,
  v: EraRival,
  r: R,
  mine: { awards: string[]; ballon: number | null },
): EraSeason {
  let club = CLUBS.find((c) => c.id === v.clubId);
  const str = (c: Club | undefined) =>
    c ? (clubsIn(clubLeague(s, c), s).find((x) => x.id === c.id)?.str ?? c.str) : 0;
  if (!club || (v.ovr >= str(club) + 5 && r() < 0.7) || v.ovr <= str(club) - 6) {
    club = pickClub(s, r, v.ovr, club && v.ovr <= str(club) - 6 ? clubLeague(s, club) : null);
  }
  v.clubId = club.id;
  v.club = club.name;
  v.leagueId = clubLeague(s, club);
  const L = leagueOf(v.leagueId);
  const d = v.ovr - str(club);
  const m = L.matches;
  const apps = Math.round(m * clamp(0.6 + d * 0.04 + gauss(r) * 0.08, 0.15, 0.97));
  const rating = round2(
    clamp(
      6.65 + (v.pos === 'DF' || v.pos === 'GK' ? 0.15 : 0) + d * 0.06 + gauss(r) * 0.32,
      5.8,
      8.8,
    ),
  );
  const rate = {
    FW: [0.3 + d * 0.035, 0.12 + d * 0.012],
    MF: [0.1 + d * 0.012, 0.16 + d * 0.02],
    DF: [0.03 + d * 0.004, 0.05 + d * 0.006],
    GK: [0, 0.003],
  }[v.pos];
  const cnt = (p: number) => Math.max(0, Math.round(apps * Math.max(0, p) * (1 + gauss(r) * 0.15)));
  const goals = cnt(rate[0]!);
  const assists = cnt(rate[1]!);
  const cs = v.pos === 'DF' || v.pos === 'GK' ? cnt(0.25 + d * 0.02) : 0;
  const table = clubsIn(v.leagueId, s).sort((a, b) => b.str - a.str);
  const rank = clamp(
    table.findIndex((c) => c.id === club!.id) + 1 + Math.round(gauss(r) * 2),
    1,
    Math.max(1, table.length),
  );
  const sameLeague = v.leagueId === s.leagueId;
  const honors: string[] = [];
  const mineHas = (x: string | undefined) => !!x && sameLeague && mine.awards.includes(x);
  // 한 명만 받는 상은 내가 같은 리그에서 받았으면 라이벌은 못 받는다. 기준은 seasonAwards와 같은 결이다.
  const only = (x: string | undefined, ok: boolean) => {
    if (x && ok && !mineHas(x)) honors.push(x);
  };
  const enough = apps >= m * 0.55,
    back = v.pos === 'DF' || v.pos === 'GK';
  const topG = m * TOP_G + gauss(r) * 3;
  only(TOP_SCORER[L.id], goals >= Math.max(topG, 6));
  only(`${L.name} 도움왕`, assists >= Math.max(m * TOP_A + gauss(r) * 2, 5)); // i18n-ignore 저장값
  only(POTY[L.id], enough && rating >= 7.55 && (rank <= 3 || goals >= topG) && r() < 0.5);
  if (enough && rating >= (back ? 7.2 : 7.3) && r() < 0.75)
    honors.push(L.tier >= 4 ? `${L.name} 올해의 팀` : `${L.name} 베스트 11`); // i18n-ignore 저장값
  if (v.pos === 'DF')
    only(
      `${L.name} 올해의 수비수`, // i18n-ignore 저장값
      L.tier >= 5 && enough && rating >= 7.15 && rank <= 3 && r() < 0.45,
    );
  const posAward = v.pos === 'GK' ? '골키퍼' : v.dpos && v.pos === 'MF' ? '미드필더' : null; // i18n-ignore 저장값
  if (posAward)
    only(`${L.name} 올해의 ${posAward}`, enough && rating >= 7.1 && rank <= 4 && r() < 0.45); // i18n-ignore 저장값
  let ballon: number | undefined;
  if (L.tier >= 4 && enough) {
    const bp = BALLON_POS[v.pos];
    const score =
      v.ovr +
      (goals * 0.45 + assists * 0.28) * bp.atk +
      rating * 5 +
      L.tier * 1.2 +
      (rank === 1 ? 6 : 0) +
      (L.tier >= 5 && rank <= 4 ? 6 : 0) +
      bp.bonus +
      gauss(r) * 3;
    let br = clamp(Math.round(1 + (BALLON_BAR - score) / 0.8), 1, 99);
    const p = mine.ballon;
    if (p != null && br === p) br = p === 1 || r() < 0.5 ? p + 1 : p - 1;
    if (br <= 30) {
      ballon = br;
      if (br === 1) honors.push('발롱도르'); // i18n-ignore 저장값
      const yashin = '야신 트로피'; // i18n-ignore 저장값
      if (v.pos === 'GK' && br <= 25 && r() < 0.6 && !mine.awards.includes(yashin))
        honors.push(yashin);
      if (br <= bp.fifpro && r() < 0.8) honors.push('FIFPRO 월드 11'); // i18n-ignore 저장값
    }
  }
  return {
    year: s.year,
    age: s.year - v.born,
    club: club.name,
    clubId: club.id,
    league: L.name,
    apps,
    goals,
    assists,
    cs,
    rating,
    ovr: Math.round(v.ovr),
    rank,
    honors,
    ...(ballon ? { ballon } : {}),
  };
}

/** 한 해 성장 · 노쇠. 정점 나이는 내 선수 성장 특성과 같은 결(조기 성장 일찍 · 대기만성 늦게). */
function grow(v: EraRival, age: number, r: R) {
  const peakEnd = [28, 30, 31][v.curve]! + (v.pos === 'GK' ? 3 : 0);
  if (age < peakEnd) {
    const k = clamp((v.curve === 2 && age < 23 ? 0.12 : 0.2) + gauss(r) * 0.05, 0.04, 0.35);
    v.ovr = round2(Math.min(v.pot, v.ovr + Math.max(0, v.pot - v.ovr) * k));
  } else v.ovr = round2(Math.max(50, v.ovr - (age - peakEnd + 1) * 0.7 - r() * 0.8));
}

const myBallon = (s: GameState) => s.ballon?.find((b) => b.year === s.year)?.rank ?? null;

/**
 * 시즌 결산(endSeason)에서 내 수상이 정해진 뒤, 한 해를 넘기기 전에 부른다(s.year · s.age가 이번 시즌 값).
 * 라이벌이 없으면 등장 조건을 보고, 있으면 그 시즌을 뛰게 한다. 게임 RNG는 쓰지 않는다.
 */
export function eraSeasonEnd(s: GameState, o: number, awards: string[]): EraNote | null {
  if (BAL.eraRival < 1) return null;
  const L = leagueOf(s.leagueId);
  const r = eraRng(s, s.year);
  const mine = { awards, ballon: myBallon(s) };
  let kind: EraNote['kind'] = 'season';
  let prev: string | undefined;
  let v = s.era?.cur;
  if (!v) {
    const trigger = awards.length > 0 || mine.ballon != null || o >= standout(s.age);
    if (L.amateur || L.tier < 2 || s.age > ERA_MAX_AGE || !trigger || r() >= ERA_APPEAR_P)
      return null;
    v = spawn(s, o, r, false);
    s.era = { cur: v };
    kind = 'new';
  } else if (v.retired != null || (v.behind ?? 0) >= ERA_BEHIND_SEASONS) {
    // 세대교체: 라이벌이 은퇴했거나 크게 처졌다. 아직 한창이고 더 받을 자리가 있으면 어린 새 라이벌이 나타난다.
    const n = 1 + (s.era!.past?.length ?? 0);
    const next =
      n < ERA_MAX_RIVALS && s.age >= 26 && s.age <= 33 && o >= 75 && L.tier >= 2 && r() < 0.5;
    if (next) {
      prev = v.name;
      s.era = { cur: spawn(s, o, r, true, v.name), past: [...(s.era!.past ?? []), v] };
      v = s.era.cur;
      kind = 'next';
    } else if (v.retired != null) return null;
  }
  const rec = playSeason(s, v, r, mine);
  v.seasons.push(rec);
  const age = s.year - v.born;
  if (age >= v.retireAge) {
    v.retired = s.year;
    if (kind === 'season') kind = 'retired';
  } else grow(v, age, r);
  v.behind = o - rec.ovr >= ERA_BEHIND_GAP ? (v.behind ?? 0) + 1 : 0;
  return {
    kind,
    name: v.name,
    country: v.country,
    pos: v.pos,
    ...(v.dpos ? { dpos: v.dpos } : {}),
    age,
    rival: rec,
    ...(prev ? { prev } : {}),
  };
}

/** 커리어 합계(프로 시즌만). */
export function eraTotals(
  seasons: readonly Pick<EraSeason, 'apps' | 'goals' | 'assists' | 'cs' | 'honors' | 'ballon'>[],
) {
  return seasons.reduce(
    (t, x) => ({
      apps: t.apps + x.apps,
      goals: t.goals + x.goals,
      assists: t.assists + x.assists,
      cs: t.cs + x.cs,
      awards: t.awards + x.honors.length,
      ballonWins: t.ballonWins + (x.ballon === 1 ? 1 : 0),
    }),
    { apps: 0, goals: 0, assists: 0, cs: 0, awards: 0, ballonWins: 0 },
  );
}
