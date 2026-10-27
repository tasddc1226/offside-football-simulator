import type { TeamStatsResponse } from '@offside/contracts';
import { TEAM_STATS_FORM_MAX, TEAM_STATS_OPPONENTS_MAX } from '@offside/contracts';
import type { TeamForm, TeamStatsMatch, TeamStatsReport } from '@offside/contracts';
import {
  lineEdges,
  REPORT_LINES,
  YOUTH_NAME,
  type FormationId,
} from '@offside/contracts/owner-team';
import type { DetailPos } from '@offside/contracts/positions';
import { kstDay } from '@offside/contracts/kst';
import type { Db } from '../db/client.js';
import {
  statsNamesOf,
  teamLogosByIds,
  type KindTotals,
  type MatchDetail,
} from '../db/repos/ownerTeams.js';
import type { Lang } from '../lang.js';
import { anonText } from './anon.js';

// T-11-269 시즌 통계 — 저장된 랭크 경기(team_matches)에서 그 자리에서 센다. 따로 쌓는 집계 테이블이 없어 경기마다
// 쓰기가 늘지 않고, 지난 경기도 그대로 들어간다. 통계 화면을 열 때만 부른다.
// T-11-358 같은 행에서 최근 흐름 · 연속 기록 · 홈/원정 · 가장 큰 승패를 더 센다(친선전 · 컵은 SQL 합계로 따로).

type Row = {
  homeTeamId: string;
  homeGoals: number;
  awayGoals: number;
  detailJson: string;
  createdAt: string;
};
const NAMES_CHUNK = 90;
/** 선발 자리 수(유스 선수 자리가 있었는지 셀 때). */
const XI_SIZE = 11;
type Wdl = { w: number; d: number; l: number; gf: number; ga: number };

const zero = (): Wdl => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0 });
const formOf = (gf: number, ga: number): TeamForm => (gf > ga ? 'w' : gf === ga ? 'd' : 'l');
function add(t: Wdl, gf: number, ga: number) {
  if (gf > ga) t.w++;
  else if (gf === ga) t.d++;
  else t.l++;
  t.gf += gf;
  t.ga += ga;
}

/** 경기들을 우리 팀 쪽에서 센다. 선수 이름 · 상대 로고는 붙이지 않은 중간 결과(테스트하기 쉽게 DB 없이). */
export function tallyTeamStats(rows: readonly Row[], teamId: string) {
  const total = zero();
  const venue = { home: zero(), away: zero() };
  /** 시간순(오래된 것부터) 결과 — 연속 기록용. */
  const timeline: { at: string; r: TeamForm }[] = [];
  let biggestWin: (TeamStatsMatch & { m: number }) | null = null;
  let biggestLoss: (TeamStatsMatch & { m: number }) | null = null;
  /** 차이가 크고, 같으면 골이 많고, 그래도 같으면 최근 경기. */
  const bigger = (a: TeamStatsMatch & { m: number }, b: (TeamStatsMatch & { m: number }) | null) =>
    !b ||
    a.m > b.m ||
    (a.m === b.m && (a.gf + a.ga > b.gf + b.ga || (a.gf + a.ga === b.gf + b.ga && a.at > b.at)));
  const players = new Map<
    string,
    {
      careerId: string | null;
      anon: string;
      goals: number;
      assists: number;
      apps: number;
      /** T-11-518 자리별 출전 수(가장 많이 선 자리를 보여 준다). */
      slots: Map<DetailPos, number>;
    }
  >();
  /** T-11-518 선발 명단이 남은 경기 수(그 전 경기는 출전을 셀 수 없다). */
  let xiMatches = 0;
  const days = new Map<string, Wdl>();
  const opponents = new Map<string, Wdl & { name: string; owner: string; at: string; n: number }>();
  // T-11-379 경기 리포트 — 기대 득점이 남은 경기만 센다(그 전 경기는 다시 계산할 수 없다).
  const rep = {
    matches: 0,
    xgFor: 0,
    xgAgainst: 0,
    gf: 0,
    ga: 0,
    edges: { atk: 0, mid: 0, def: 0 },
    behind: { atk: 0, mid: 0, def: 0 },
  };
  const formations = new Map<FormationId, Wdl & { xgFor: number; xgAgainst: number }>();
  const player = (ref: { careerId: string | null; anon: string }) => {
    const key = ref.careerId ?? `anon:${ref.anon}`;
    let p = players.get(key);
    if (!p)
      players.set(
        key,
        (p = {
          careerId: ref.careerId,
          anon: ref.anon,
          goals: 0,
          assists: 0,
          apps: 0,
          slots: new Map(),
        }),
      );
    // 출전으로 먼저 든 선수는 익명 표기가 비어 있다 — 골 · 도움 기록의 표기로 채운다.
    if (!p.anon && ref.anon) p.anon = ref.anon;
    return p;
  };
  for (const r of rows) {
    const mine = r.homeTeamId === teamId ? 'home' : 'away';
    const theirs = mine === 'home' ? 'away' : 'home';
    const gf = mine === 'home' ? r.homeGoals : r.awayGoals;
    const ga = mine === 'home' ? r.awayGoals : r.homeGoals;
    const d = JSON.parse(r.detailJson) as MatchDetail;
    add(total, gf, ga);
    add(venue[mine], gf, ga);
    timeline.push({ at: r.createdAt, r: formOf(gf, ga) });
    const day = kstDay(r.createdAt);
    let dt = days.get(day);
    if (!dt) days.set(day, (dt = zero()));
    add(dt, gf, ga);
    const opp = d[theirs];
    let o = opponents.get(opp.teamId);
    if (!o)
      opponents.set(
        opp.teamId,
        (o = { ...zero(), name: opp.name, owner: opp.owner, at: '', n: 0 }),
      );
    add(o, gf, ga);
    o.n++;
    if (r.createdAt > o.at) Object.assign(o, { name: opp.name, owner: opp.owner, at: r.createdAt });
    const big = { opponent: opp.name, gf, ga, at: r.createdAt, m: Math.abs(gf - ga) };
    if (gf > ga && bigger(big, biggestWin)) biggestWin = big;
    if (gf < ga && bigger(big, biggestLoss)) biggestLoss = big;
    const me = d[mine];
    if (me.xg !== undefined && me.lines && opp.xg !== undefined && opp.lines) {
      rep.matches++;
      rep.xgFor += me.xg;
      rep.xgAgainst += opp.xg;
      rep.gf += gf;
      rep.ga += ga;
      const e = lineEdges(me.lines, opp.lines);
      for (const l of REPORT_LINES) {
        rep.edges[l] += e[l];
        if (e[l] < 0) rep.behind[l]++;
      }
      let f = formations.get(me.formation);
      if (!f) formations.set(me.formation, (f = { ...zero(), xgFor: 0, xgAgainst: 0 }));
      add(f, gf, ga);
      f.xgFor += me.xg;
      f.xgAgainst += opp.xg;
    }
    if (me.xi) {
      xiMatches++;
      const xi = Object.entries(me.xi);
      for (const [careerId, slot] of xi) {
        // 익명 표기는 골 · 도움 기록에서 붙는다(출전만 한 선수는 화면이 이 기기에 남은 이름이나 공개 이름을 쓴다).
        const p = player({ careerId, anon: '' });
        p.apps++;
        p.slots.set(slot, (p.slots.get(slot) ?? 0) + 1);
      }
      if (xi.length < XI_SIZE) player({ careerId: null, anon: YOUTH_NAME }).apps++;
    }
    for (const e of d.events) {
      if (e.side !== mine) continue;
      player(e.scorer).goals++;
      if (e.assist) player(e.assist).assists++;
    }
  }
  timeline.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let best = 0;
  let run = 0;
  for (const t of timeline) {
    run = t.r === 'w' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const last = timeline.at(-1);
  let streak: { kind: TeamForm; n: number } | null = null;
  if (last) {
    let k = 0;
    while (k < timeline.length && timeline[timeline.length - 1 - k]!.r === last.r) k++;
    streak = { kind: last.r, n: k };
  }
  const one = (x: number) => Math.round(x * 10) / 10;
  const avg = (x: number) => (rep.matches ? one(x / rep.matches) : 0);
  const report: TeamStatsReport = {
    matches: rep.matches,
    xgFor: one(rep.xgFor),
    xgAgainst: one(rep.xgAgainst),
    gf: rep.gf,
    ga: rep.ga,
    edges: { atk: avg(rep.edges.atk), mid: avg(rep.edges.mid), def: avg(rep.edges.def) },
    behind: rep.behind,
    formations: [...formations]
      .sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l))
      .map(([formation, f]) => ({
        formation,
        ...f,
        xgFor: one(f.xgFor),
        xgAgainst: one(f.xgAgainst),
      })),
  };
  const strip = (b: (TeamStatsMatch & { m: number }) | null): TeamStatsMatch | null =>
    b && { opponent: b.opponent, gf: b.gf, ga: b.ga, at: b.at };
  return {
    total,
    report,
    flow: {
      form: timeline
        .slice(-TEAM_STATS_FORM_MAX)
        .reverse()
        .map((t) => t.r),
      streak,
      bestWinStreak: best,
      home: venue.home,
      away: venue.away,
      biggestWin: strip(biggestWin),
      biggestLoss: strip(biggestLoss),
    },
    xiMatches,
    players: [...players.values()]
      .sort(
        (a, b) =>
          b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || b.apps - a.apps,
      )
      .map(({ slots, ...p }) => ({
        ...p,
        pos: [...slots].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      })),
    days: [...days].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, t]) => ({ day, ...t })),
    opponents: [...opponents]
      .sort((a, b) => b[1].n - a[1].n || (a[1].at < b[1].at ? 1 : -1))
      .slice(0, TEAM_STATS_OPPONENTS_MAX)
      .map(([teamId, { name, owner, w, d, l, gf, ga }]) => ({
        teamId,
        name,
        owner,
        w,
        d,
        l,
        gf,
        ga,
      })),
  };
}

/** 화면 모양으로. 선수 이름은 지금 공개 이름(없으면 익명 표기), 상대 로고는 지금 로고. 쿼리 2번(병렬). */
export async function teamStatsView(
  db: Db,
  season: number,
  teamId: string,
  rows: readonly Row[],
  capped: boolean,
  lang: Lang,
  kinds: KindTotals,
): Promise<TeamStatsResponse> {
  const t = tallyTeamStats(rows, teamId);
  const ids = t.players.flatMap((p) => (p.careerId ? [p.careerId] : []));
  // D1 한 문장의 바인딩 상한(100)을 넘지 않게 나눠 읽는다. 한 시즌 출전 · 골 · 도움 선수는 보통 수십 명이다.
  const chunks = Array.from({ length: Math.ceil(ids.length / NAMES_CHUNK) }, (_, i) =>
    ids.slice(i * NAMES_CHUNK, (i + 1) * NAMES_CHUNK),
  );
  const [nameMaps, logos] = await Promise.all([
    Promise.all(chunks.map((c) => statsNamesOf(db, c))),
    teamLogosByIds(
      db,
      t.opponents.map((o) => o.teamId),
    ),
  ]);
  const names = new Map(nameMaps.flatMap((m) => [...m]));
  return {
    season,
    matches: rows.length,
    capped,
    total: t.total,
    players: t.players.map((p) => ({
      careerId: p.careerId,
      name:
        names.get(p.careerId ?? '')?.publicName ||
        anonText(p.anon || names.get(p.careerId ?? '')?.anon || '', lang),
      goals: p.goals,
      assists: p.assists,
      apps: p.apps,
      ...(p.pos ? { pos: p.pos } : {}),
    })),
    xiMatches: t.xiMatches,
    days: t.days,
    opponents: t.opponents.map((o) => ({ ...o, logo: logos.get(o.teamId) ?? null })),
    summary: { ...t.flow, ...kinds },
    report: t.report,
  };
}
