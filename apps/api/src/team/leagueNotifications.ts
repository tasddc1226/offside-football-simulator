import { leagueKo } from './leagueCopy.js';
// Pure notification planning. Persistence keeps cursor advancement and notification writes in one batch.
import type { LeagueNewsResponse } from '@offside/contracts';
import {
  LEAGUE_FORFEIT_LIMIT,
  leagueNextTier,
  leagueTeamSeason,
  leagueReward,
  type LeagueDef,
  type LeagueOutcome,
} from '@offside/contracts/league';
import { leagueTitleOf } from '@offside/contracts/league-names';
import { cupKo } from '../cupText.js';
import { kstHm } from '../time.js';
import {
  leagueTable,
  tiersOf,
  type LeagueEntryRow,
  type LeagueMatchRow,
  type LeagueStateRow,
} from './leagueRead.js';
import { pushHeadline } from './leagueNews.js';

const leagueTitleKo = (tier: number, no: number) => leagueTitleOf('ko', tier, no) ?? String(no);
/** 마지막 라운드 알림 본문: 최종 순위 · 받은 보상 · 다음 시즌 부. */
function endBody(e: LeagueEntryRow, rank: number, league: LeagueDef) {
  const where = { tier: e.tier!, title: leagueTitleKo(e.tier!, e.leagueNo!), rank };
  const outcome = e.outcome as LeagueOutcome | null;
  if (!outcome) return cupKo('leagueEndBody', where);
  if (outcome === 'forfeited') return cupKo('leagueEndBodyForfeited', where);
  const { rerolls: n, scouts: s, boosts: b } = leagueReward(e.tier!, rank, e.forfeits, outcome);
  if (outcome === 'champion')
    return leagueKo(league, 'leagueEndBodyChampion', { season: e.season, n, s, b });
  const next = leagueNextTier(e.tier!, outcome)!;
  return s > 0
    ? cupKo('leagueEndBodyAll', { ...where, n, s, b, next })
    : n > 0
      ? cupKo('leagueEndBodyReroll', { ...where, n, next })
      : cupKo('leagueEndBodyNext', { ...where, next });
}

type NoticeContext = {
  league: LeagueDef;
  state: LeagueStateRow;
  entries: readonly LeagueEntryRow[];
  pending: readonly LeagueEntryRow[];
  all: readonly LeagueMatchRow[];
  news: LeagueNewsResponse | null;
  played: number;
  last: number;
};
export function planLeagueNotifications({
  league,
  state,
  entries,
  pending,
  all,
  news,
  played,
  last,
}: NoticeContext) {
  const cancelled = !tiersOf(state).length;
  const roundOf = new Map<string, LeagueMatchRow[]>();
  const tables = new Map<string, ReturnType<typeof leagueTable>>();
  for (const m of all) {
    const k = `${m.tier}:${m.leagueNo}`;
    roundOf.set(k, [...(roundOf.get(k) ?? []), m]);
  }
  const tableOf = (tier: number, no: number) => {
    const k = `${tier}:${no}`;
    let t = tables.get(k);
    if (!t) tables.set(k, (t = leagueTable(entries, roundOf.get(k) ?? [], state.seed, tier, no)));
    return t;
  };
  const nameOf = new Map(entries.map((e) => [e.teamId, e.name]));
  const withDaily = (line: string, teamId: string | null) => {
    const h = news ? pushHeadline(news, teamId) : null;
    return h
      ? cupKo(h.mine ? 'leagueRoundMineBody' : 'leagueRoundDailyBody', { line, head: h.head })
      : line;
  };
  const leftOver = entries.filter((x) => x.status === 'dropped' && x.teamId).length;
  const season = league.season;
  const plans = [];
  for (const e of pending) {
    let target = 0;
    let title: string;
    let body: string;
    let key: string;
    // T-11-564 첫 배치 뒤에 신청(다시 신청)한 늦은 참가.
    const late = e.createdAt > state.drawnAt;
    if (e.status === 'dropped' && late) {
      key = `league:${season}:late-dropped`;
      title = leagueKo(league, 'leagueDroppedTitle', { season });
      body = e.teamId
        ? cupKo('leagueLateLeftBody')
        : cupKo('leagueLateDroppedBody', { season: leagueTeamSeason(league), n: league.minFilled });
    } else if (e.status === 'dropped') {
      key = `league:${season}:dropped`;
      title = cancelled
        ? leagueKo(league, 'leagueCancelledTitle', { season })
        : leagueKo(league, 'leagueDroppedTitle', { season });
      body = cancelled
        ? cupKo('cancelledBody')
        : e.teamId
          ? cupKo('leagueLeftBody', { n: leftOver })
          : cupKo('leagueDroppedBody', { season: leagueTeamSeason(league), n: league.minFilled });
    } else if (e.notifiedRound < 0 || played === 0) {
      key = `league:${season}:placed`;
      title = leagueKo(league, 'leaguePlacedTitle', { season });
      body = cupKo(late ? 'leagueLatePlacedBody' : 'leaguePlacedBody', {
        team: e.name ?? '-',
        tier: e.tier!,
        title: leagueTitleKo(e.tier!, e.leagueNo!),
        time: kstHm(league.rounds[0]!),
      });
      // 늦은 참가는 이미 끝난 라운드 결과를 보내지 않는다(그 리그는 다음 라운드부터 치른다).
      if (late) target = played;
    } else {
      target = played;
      const table = tableOf(e.tier!, e.leagueNo!);
      const rank = table.find((s) => s.teamId === e.teamId)?.rank ?? table.length;
      if (played === last) {
        key = `league:${season}:end`;
        // 결산(settleLeague)이 저장한 순위 · 결과를 쓴다. 결산 전 줄이면(옛 데이터) 순위표 순위만.
        const final = e.finalRank ?? rank;
        title =
          final === 1
            ? leagueKo(league, 'leagueChampionTitle', {
                season,
                tier: e.tier!,
                title: leagueTitleKo(e.tier!, e.leagueNo!),
              })
            : leagueKo(league, 'leagueEndTitle', { season });
        body = endBody(e, final, league);
      } else {
        key = `league:${season}:r${played}`;
        const m = (roundOf.get(`${e.tier}:${e.leagueNo}`) ?? []).find(
          (x) => x.round === played && (x.homeTeamId === e.teamId || x.awayTeamId === e.teamId),
        );
        if (!m) {
          // 7팀 리그의 쉬는 라운드.
          title = cupKo('leagueRoundTitle', { round: played, result: cupKo('leagueRest') });
          body = withDaily(cupKo('leagueRestBody', { rank }), e.teamId);
        } else {
          const home = m.homeTeamId === e.teamId;
          const mine = home ? m.homeGoals! : m.awayGoals!;
          const theirs = home ? m.awayGoals! : m.homeGoals!;
          const lost = m.forfeit === 3 || mine < theirs;
          const result = cupKo(lost ? 'loss' : mine > theirs ? 'win' : 'draw');
          title = cupKo('leagueRoundTitle', { round: played, result });
          const score = `${nameOf.get(m.homeTeamId) ?? '-'} ${m.homeGoals ?? 0} : ${m.awayGoals ?? 0} ${nameOf.get(m.awayTeamId) ?? '-'}`;
          // T-11-430 내가 기권한 경기면 쌓인 기권 수와 남은 횟수를 알린다(3번째는 기권 퇴출 알림이 따로 간다).
          const forfeited = !!(m.forfeit & (home ? 1 : 2));
          body =
            forfeited && e.status === 'active' && e.forfeits < LEAGUE_FORFEIT_LIMIT
              ? cupKo('leagueRoundForfeitBody', {
                  score,
                  n: e.forfeits,
                  limit: LEAGUE_FORFEIT_LIMIT,
                  left: LEAGUE_FORFEIT_LIMIT - e.forfeits,
                })
              : withDaily(cupKo('leagueRoundBody', { score, rank }), e.teamId);
        }
      }
    }
    plans.push({ entry: e, target, title, body, key });
  }
  return plans;
}
