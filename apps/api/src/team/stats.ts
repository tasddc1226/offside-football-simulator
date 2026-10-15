import type { TeamStatsResponse } from '@offside/contracts';
import { TEAM_STATS_OPPONENTS_MAX } from '@offside/contracts';
import { kstDay } from '@offside/contracts/kst';
import type { Db } from '../db/client.js';
import { publicNamesOf, teamLogosByIds, type MatchDetail } from '../db/repos/ownerTeams.js';
import type { Lang } from '../lang.js';
import { anonText } from './anon.js';

// T-11-269 시즌 통계 — 저장된 랭크 경기(team_matches)에서 그 자리에서 센다. 따로 쌓는 집계 테이블이 없어 경기마다
// 쓰기가 늘지 않고, 지난 경기도 그대로 들어간다. 통계 화면을 열 때만 부른다.

type Row = {
  homeTeamId: string;
  homeGoals: number;
  awayGoals: number;
  detailJson: string;
  createdAt: string;
};
const NAMES_CHUNK = 90;
type Wdl = { w: number; d: number; l: number; gf: number; ga: number };

const zero = (): Wdl => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0 });
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
  const players = new Map<
    string,
    { careerId: string | null; anon: string; goals: number; assists: number }
  >();
  const days = new Map<string, Wdl>();
  const opponents = new Map<string, Wdl & { name: string; owner: string; at: string; n: number }>();
  const player = (ref: { careerId: string | null; anon: string }) => {
    const key = ref.careerId ?? `anon:${ref.anon}`;
    let p = players.get(key);
    if (!p)
      players.set(key, (p = { careerId: ref.careerId, anon: ref.anon, goals: 0, assists: 0 }));
    return p;
  };
  for (const r of rows) {
    const mine = r.homeTeamId === teamId ? 'home' : 'away';
    const theirs = mine === 'home' ? 'away' : 'home';
    const gf = mine === 'home' ? r.homeGoals : r.awayGoals;
    const ga = mine === 'home' ? r.awayGoals : r.homeGoals;
    const d = JSON.parse(r.detailJson) as MatchDetail;
    add(total, gf, ga);
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
    for (const e of d.events) {
      if (e.side !== mine) continue;
      player(e.scorer).goals++;
      if (e.assist) player(e.assist).assists++;
    }
  }
  return {
    total,
    players: [...players.values()].sort(
      (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals,
    ),
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
): Promise<TeamStatsResponse> {
  const t = tallyTeamStats(rows, teamId);
  const ids = t.players.flatMap((p) => (p.careerId ? [p.careerId] : []));
  // D1 한 문장의 바인딩 상한(100)을 넘지 않게 나눠 읽는다. 한 시즌 골·도움 선수는 보통 수십 명이다.
  const chunks = Array.from({ length: Math.ceil(ids.length / NAMES_CHUNK) }, (_, i) =>
    ids.slice(i * NAMES_CHUNK, (i + 1) * NAMES_CHUNK),
  );
  const [nameMaps, logos] = await Promise.all([
    Promise.all(chunks.map((c) => publicNamesOf(db, c))),
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
      name: (p.careerId && names.get(p.careerId)) || anonText(p.anon, lang),
      goals: p.goals,
      assists: p.assists,
    })),
    days: t.days,
    opponents: t.opponents.map((o) => ({ ...o, logo: logos.get(o.teamId) ?? null })),
  };
}
