// T-11-652 오프사이드 데일리: 서버가 고른 기사 재료(경기 · 팀 · 순위)를 지금 언어 문장으로 만들고, 경기 상세 기사 · 빅매치
// 예측 비율 · 내 리그 라이벌 · 더비를 정한다. 웹 · 앱이 같은 규칙을 쓴다.
import type { TeamMatch } from '@offside/contracts';
import type {
  LeagueNewsItem,
  LeagueNewsMatch,
  LeagueNewsResponse,
  LeaguePredictionCounts,
  LeaguePredictionPick,
  LeagueTableResponse,
} from './api/league.js';
import { leagueNewsText as N } from './i18n/ko/leagueNews.js';

/** 이변 · 한 수 위 상대로 보는 OVR 차(서버 NEWS_UPSET_GAP와 같다). */
export const ARTICLE_UPSET_GAP = 3;
/** 기대 득점이 이만큼 밀리고 이기면 '밀리고도 이긴' 경기다. */
export const ARTICLE_LUCKY_XG = 0.8;
/** 결승골이 이 분 뒤면 '승부를 가른 골' 문장을 싣는다. */
export const ARTICLE_LATE_MINUTE = 75;
/** 더비: 순위가 붙어 있고 승점 차가 이 안(서버 NEWS_DERBY_POINTS와 같다). */
export const DERBY_POINTS = 3;

export type NewsCard = {
  key: string;
  kind: LeagueNewsItem['kind'];
  tag: string;
  head: string;
  body: string;
  where: string;
  /** 기사 경기(눌러서 경기 상세 · 공유). 선두 · 연승 기사는 null. */
  match: LeagueNewsMatch | null;
  tier: number;
  league: number;
};

const score = (m: { homeGoals: number; awayGoals: number }) => `${m.homeGoals}:${m.awayGoals}`;
/** 이긴 팀을 주어로 쓰는 문장의 스코어(이긴 쪽 골을 앞에). */
const winScore = (m: { homeGoals: number; awayGoals: number }) =>
  `${Math.max(m.homeGoals, m.awayGoals)}:${Math.min(m.homeGoals, m.awayGoals)}`;
const xgText = (hx: number | undefined, ax: number | undefined) =>
  hx !== undefined && ax !== undefined ? N.xgLine({ hx: hx.toFixed(1), ax: ax.toFixed(1) }) : '';
const join = (...parts: string[]) => parts.filter(Boolean).join(' ');
const sides = (m: LeagueNewsMatch) => {
  const homeWon = m.homeGoals > m.awayGoals;
  return homeWon
    ? { winner: m.home.name, loser: m.away.name }
    : { winner: m.away.name, loser: m.home.name };
};

const TAG: Record<LeagueNewsItem['kind'], () => string> = {
  upset: () => N.tagUpset,
  goalfest: () => N.tagGoalfest,
  derby: () => N.tagDerby,
  teamOfRound: () => N.tagTeamOfRound,
  leader: () => N.tagLeader,
  streak: () => N.tagStreak,
};

function cardOf(item: LeagueNewsItem, round: number): NewsCard {
  const base = { key: `${item.kind}`, kind: item.kind, tag: TAG[item.kind]() };
  if (item.kind === 'leader' || item.kind === 'streak') {
    const where = N.where({ tier: item.tier, league: item.league, round });
    const t = { team: item.team.name, tier: item.tier };
    return {
      ...base,
      where,
      match: null,
      tier: item.tier,
      league: item.league,
      ...(item.kind === 'leader'
        ? item.changed
          ? { head: N.leaderNewHead(t), body: N.leaderNewBody({ ...t, points: item.points }) }
          : {
              head: N.leaderKeepHead(t),
              body: N.leaderKeepBody({ ...t, points: item.points }),
            }
        : {
            head: N.streakHead({ team: item.team.name, n: item.n }),
            body: N.streakBody({ team: item.team.name, n: item.n }),
          }),
    };
  }
  const m = item.match;
  const where = N.where({ tier: m.tier, league: m.league, round: m.round });
  const common = {
    ...base,
    key: `${item.kind}-${m.id}`,
    where,
    match: m,
    tier: m.tier,
    league: m.league,
  };
  const s = score(m);
  const xg = xgText(m.homeXg, m.awayXg);
  const pair = { home: m.home.name, away: m.away.name };
  switch (item.kind) {
    case 'upset':
      return {
        ...common,
        head: N.upsetHead({ ...sides(m), gap: item.gap }),
        body: join(N.upsetBody({ ...sides(m), score: winScore(m), gap: item.gap }), xg),
      };
    case 'goalfest': {
      const goals = m.homeGoals + m.awayGoals;
      return {
        ...common,
        head: N.goalfestHead({ ...pair, goals }),
        body: join(N.goalfestBody({ ...pair, score: s, goals }), xg),
      };
    }
    case 'derby':
      return {
        ...common,
        head: N.derbyHead({ homeRank: item.homeRank, awayRank: item.awayRank }),
        body: join(
          m.homeGoals === m.awayGoals
            ? N.derbyDraw({ ...pair, score: s })
            : N.derbyWin({ ...sides(m), score: winScore(m) }),
          xg,
        ),
      };
    case 'teamOfRound': {
      const team = item.side === 'home' ? m.home.name : m.away.name;
      return {
        ...common,
        head: N.teamOfRoundHead({ team, margin: Math.abs(m.homeGoals - m.awayGoals) }),
        body: join(N.teamOfRoundBody({ ...sides(m), score: winScore(m) }), xg),
      };
    }
  }
}

/** 신문 꼭지(서버가 보낸 순서 그대로). */
export const newsCards = (news: LeagueNewsResponse): NewsCard[] =>
  news.items.map((item) => cardOf(item, news.round));

/** 지난 빅매치 한 줄. */
export const lastBigLine = (news: LeagueNewsResponse) =>
  news.lastBig
    ? N.lastBig({
        home: news.lastBig.home.name,
        away: news.lastBig.away.name,
        score: score(news.lastBig),
      })
    : null;

/** 경기 상세의 기사: 헤드라인과 본문 문장들. 선수 이름은 서버가 준 공개 이름 · 익명 표기 그대로다. */
export function matchArticle(match: TeamMatch): { head: string; body: string[] } {
  const h = match.home;
  const a = match.away;
  const s = `${h.goals}:${a.goals}`;
  const xg = xgText(h.xg, a.xg);
  const events = [...match.events].sort((x, y) => x.minute - y.minute);
  const first = events[0];
  const firstLine = first ? N.articleFirst({ minute: first.minute, name: first.scorer }) : '';
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.scorer, (counts.get(e.scorer) ?? 0) + 1);
  const [topName, topGoals] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0] ?? ['', 0];
  const brace = topGoals >= 2 ? N.articleBrace({ name: topName, n: topGoals }) : '';
  if (h.goals === a.goals) {
    const pair = { home: h.name, away: a.name, score: s };
    return {
      head: N.articleDraw(pair),
      body: [
        N.articleDrawBody(pair),
        events.length ? firstLine : N.articleGoalless,
        brace,
        xg,
      ].filter(Boolean),
    };
  }
  const homeWon = h.goals > a.goals;
  const [w, l] = homeWon ? [h, a] : [a, h];
  const wl = { winner: w.name, loser: l.name };
  const margin = w.goals - l.goals;
  const ws = `${w.goals}:${l.goals}`;
  const lucky = w.xg !== undefined && l.xg !== undefined && l.xg - w.xg >= ARTICLE_LUCKY_XG;
  const head = lucky
    ? N.articleLucky(wl)
    : margin >= 3
      ? N.articleRout({ winner: w.name, margin })
      : l.ovr - w.ovr >= ARTICLE_UPSET_GAP
        ? N.articleUpset(wl)
        : margin === 1
          ? N.articleNarrow(wl)
          : N.articleWin({ ...wl, score: ws });
  const lead = lucky
    ? N.articleLuckyBody({ ...wl, score: ws, lx: l.xg!.toFixed(1), wx: w.xg!.toFixed(1) })
    : join(N.articleWinBody({ ...wl, score: ws }), xg);
  // 결승골: 이긴 쪽이 마지막으로 앞서 나간 골.
  const winSide = homeWon ? 'home' : 'away';
  let hg = 0;
  let ag = 0;
  let decider: (typeof events)[number] | null = null;
  for (const e of events) {
    const tied = hg === ag;
    if (e.side === 'home') hg++;
    else ag++;
    if (tied && e.side === winSide) decider = e;
  }
  const late =
    decider && decider !== first && decider.minute >= ARTICLE_LATE_MINUTE
      ? N.articleLate({ minute: decider.minute, name: decider.scorer })
      : '';
  return { head, body: [lead, firstLine, late, brace].filter(Boolean) };
}

export const pickLabel = (p: LeaguePredictionPick) =>
  p === 'home' ? N.pickHome : p === 'away' ? N.pickAway : N.pickDraw;

/** 예측 비율(정수 %, 합 100). 아무도 고르지 않았으면 null. */
export function predictionSplit(c: LeaguePredictionCounts) {
  const n = c.home + c.draw + c.away;
  if (!n) return null;
  const home = Math.round((c.home / n) * 100);
  const away = Math.round((c.away / n) * 100);
  const draw = Math.max(0, 100 - home - away);
  return { home, draw, away, n, line: N.pickSplit({ home, draw, away, n }) };
}

/**
 * 내 리그 라이벌: 순위표에서 바로 위 · 아래 팀 중 승점 차가 작은 팀(같으면 위 팀). 맞대결 전적(기권 경기 뺀)을 함께 센다.
 */
export function leagueRival(table: LeagueTableResponse, mineId: string | null) {
  if (!mineId) return null;
  const rows = [...table.standings].sort((x, y) => x.rank - y.rank);
  const at = rows.findIndex((r) => r.teamId === mineId);
  if (at < 0) return null;
  const me = rows[at]!;
  const near = [rows[at - 1], rows[at + 1]].filter((r): r is (typeof rows)[number] => !!r);
  const rival = near.sort((x, y) => Math.abs(x.pts - me.pts) - Math.abs(y.pts - me.pts))[0];
  if (!rival) return null;
  let w = 0;
  let d = 0;
  let l = 0;
  for (const m of table.matches) {
    if (!m.played || m.forfeit) continue;
    const home = m.homeTeamId === mineId && m.awayTeamId === rival.teamId;
    const away = m.awayTeamId === mineId && m.homeTeamId === rival.teamId;
    if (!home && !away) continue;
    const mine = (home ? m.homeGoals : m.awayGoals) ?? 0;
    const theirs = (home ? m.awayGoals : m.homeGoals) ?? 0;
    if (mine > theirs) w++;
    else if (mine < theirs) l++;
    else d++;
  }
  const name = table.teams.find((t) => t.teamId === rival.teamId)?.name ?? '-';
  const gap = Math.abs(rival.pts - me.pts);
  return {
    teamId: rival.teamId,
    name,
    gap,
    w,
    d,
    l,
    line: N.rivalLine({ team: name, gap, w, d, l }),
  };
}

/**
 * 지금 순위로 본 다음 더비 경기 id: 아직 치르지 않은 경기 중 순위가 붙어 있고 승점 차가 작은 두 팀의 경기. 1라운드 전(아무도
 * 안 뛰었을 때)은 없다. 끝난 라운드의 더비는 신문이 라운드 전 순위로 고른다.
 */
export function derbyIds(table: LeagueTableResponse): Set<string> {
  const by = new Map(table.standings.map((s) => [s.teamId, s]));
  if (!table.standings.some((s) => s.p > 0)) return new Set();
  return new Set(
    table.matches
      .filter((m) => {
        if (m.played) return false;
        const h = by.get(m.homeTeamId);
        const a = by.get(m.awayTeamId);
        return (
          !!h && !!a && Math.abs(h.rank - a.rank) === 1 && Math.abs(h.pts - a.pts) <= DERBY_POINTS
        );
      })
      .map((m) => m.id),
  );
}
