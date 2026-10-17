import { teamCoachOf } from '../db/repos/managers.js';
import { cupHonorsOf } from '../team/cup.js';
import {
  AchRankQuerySchema,
  AchRankResponseSchema,
  type AchRankResponse,
  TeamIdSchema,
  TeamLikeResponseSchema,
  TeamProfileResponseSchema,
  TeamRankQuerySchema,
  TeamRankResponseSchema,
  type TeamRankResponse,
  TeamStatsResponseSchema,
  TeamDivisionsQuerySchema,
  TeamDivisionsResponseSchema,
  type TeamDivisionsResponse,
} from '@offside/contracts';
import { resolveBalance } from '@offside/contracts/balance';
import { divisionRules, type DivisionRules } from '@offside/contracts/team-division';
import { getActiveBalance } from '../db/repos/balance.js';
import {
  ACH_RANK_PER_PAGE,
  TEAM_RANK_PER_PAGE,
  TEAM_STATS_MATCHES_MAX,
  type FormationId,
} from '@offside/contracts/owner-team';
import { teamSeasonAt, teamSeasonClosed, teamSeasonName } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { NO_STORE, nowIso, ok, teamNotFound, teamSeasonParam, conflictError } from './shared.js';
import {
  addTeamView,
  careersByIds,
  eligibleMap,
  isTeamLiked,
  liveTeam,
  countTeamsByDivision,
  listTeamRanking,
  listTeamRecentForm,
  type RatingRange,
  listStatsMatches,
  otherKindTotals,
  ratingRankOf,
  setTeamLike,
  slotIdsOf,
  layoutOf,
  logoOf,
  teamPlayerCard,
} from '../db/repos/ownerTeams.js';
import { friendStateOf } from '../db/repos/friends.js';
import { listAchievementRanking } from '../db/repos/ownerAchievements.js';
import { edgeCached, waitUntil } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import type { Db } from '../db/client.js';
import { parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { teamBadges } from '../team/badges.js';
import { refreshAfterChange } from '../team/ownerAchievements.js';
import { queryWithoutLang, reqLang, type Lang } from '../lang.js';
import { buildLineup, lineupOvr, lineupSynergy } from '../team/sim.js';
import { linesOf, recordOf, seasonOptions, slotsOf } from '../team/view.js';
import { anonText } from '../team/anon.js';
import { teamStatsView } from '../team/stats.js';

// T-10-092 라이브 랭킹(팀 랭킹)과 팀 프로필. 로그인 없이 누구나 본다 — 팀 이름·감독 이름·선수의 공개 이름(없으면 익명
// 표기)만 있고 구단주 계정 정보는 없다. 랭킹은 원작처럼 5분마다 새로 센다(엣지 캐시).
const RANK_TTL = 300;
/** T-11-268 가치순은 팀마다 선발 카드 가치를 모두 더해 정렬한다(운영 1회 약 5.6만 행) — 편성 저장 때도 지우지 않는
 * 목록이라 30분 동안 담는다. 평점·OVR순은 그대로 5분. */
const RANK_VALUE_TTL = 1800;
const RANK_CACHE = 'public, max-age=60';
/** T-11-358 남의 팀 경기 통계. 랭크 경기 · 친선전을 치르면 지우고, 컵 경기는 이 TTL로만 새로 읽는다. */
const TEAM_STATS_TTL = 300;

/** T-11-375 활성 밸런스의 디비전 경계(엣지 캐시가 빈 때만 읽는다). */
const activeDivisionRules = async (db: Db): Promise<DivisionRules> =>
  divisionRules(resolveBalance((await getActiveBalance(db))?.values));
/** 디비전 d의 레이팅 구간 [bounds[d-1], bounds[d]). */
const divisionRange = (rules: DivisionRules, d: number): RatingRange => ({
  min: d > 0 ? rules.bounds[d - 1]! : null,
  max: d < rules.bounds.length ? rules.bounds[d]! : null,
});

const teamParam = (c: Context<AppEnv>) => parseWithAppError(TeamIdSchema, c.req.param('teamId'));

/** 시즌 목록은 시계와 언어로만 정해진다 — 엣지에 담지 않고(키·퍼지·D1 읽기를 언어마다 늘리지 않고, 개막 직후 TTL만큼
 * 낡지도 않게) 캐시에서 꺼낸 뒤 붙인다. */
const withSeasons = <T extends object>(data: T, now: string, lang: Lang) => ({
  ...data,
  seasons: seasonOptions(now, lang),
});

export function registerTeamRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/teams', async (c) => {
    const now = nowIso();
    const q = parseWithAppError(TeamRankQuerySchema, queryWithoutLang(c));
    const season = teamSeasonParam(q.season, now);
    // T-11-375 디비전 탭은 레이팅순에만 있다(다른 정렬에 붙으면 무시해 캐시 키를 늘리지 않는다).
    const division = q.sort === 'rating' ? q.division : undefined;
    const data = await edgeCached(
      c,
      EDGE.teamRank(season, q.sort, q.page, division),
      q.sort === 'value' ? RANK_VALUE_TTL : RANK_TTL,
      async (): Promise<Omit<TeamRankResponse, 'seasons'>> => {
        const range =
          division === undefined
            ? undefined
            : divisionRange(await activeDivisionRules(getDb(c)), division);
        const { rows, total } = await listTeamRanking(getDb(c), season, q.sort, q.page, now, range);
        const forms = await listTeamRecentForm(
          getDb(c),
          rows.map((t) => t.id),
        );
        return {
          season,
          sort: q.sort,
          page: q.page,
          total,
          items: rows.map((t, i) => ({
            rank: (q.page - 1) * TEAM_RANK_PER_PAGE + i + 1,
            teamId: t.id,
            name: t.name,
            logo: logoOf(t),
            manager: t.manager,
            formation: t.formation as FormationId,
            ovr: t.ovr,
            rating: t.rating,
            division: t.division,
            record: recordOf(t),
            likes: t.likes,
            value: t.value,
            createdAt: t.createdAt,
            recentForm: forms.get(t.id) ?? [],
            title: t.title,
          })),
        };
      },
    );
    return ok(c, TeamRankResponseSchema, withSeasons(data, now, reqLang(c)), 200, RANK_CACHE);
  });

  // T-11-375 디비전별 팀 수와 지금 경계(랭킹 디비전 탭 · 내 위치). 모두에게 같아 5분 엣지 캐시, 경기마다 지우지 않는다.
  app.get('/v1/teams/divisions', async (c) => {
    const now = nowIso();
    const q = parseWithAppError(TeamDivisionsQuerySchema, queryWithoutLang(c));
    const season = teamSeasonParam(q.season, now);
    const data = await edgeCached(
      c,
      EDGE.teamDivisions(season),
      RANK_TTL,
      async (): Promise<TeamDivisionsResponse> => {
        const db = getDb(c);
        const rules = await activeDivisionRules(db);
        const counts = await countTeamsByDivision(db, season, rules.bounds);
        return {
          season,
          bounds: rules.bounds,
          guard: rules.guard,
          counts,
          total: counts.reduce((a, b) => a + b, 0),
        };
      },
    );
    return ok(c, TeamDivisionsResponseSchema, data, 200, RANK_CACHE);
  });

  // T-11-028 업적 랭킹(기록실). 시즌 업적 점수 순 — 구단주는 공개 닉네임과 그 시즌 팀 이름으로만 보인다. 팀 랭킹처럼 5분마다.
  app.get('/v1/achievements/ranking', async (c) => {
    const now = nowIso();
    const q = parseWithAppError(AchRankQuerySchema, queryWithoutLang(c));
    const season = teamSeasonParam(q.season, now);
    const data = await edgeCached(
      c,
      EDGE.achRank(season, q.page),
      RANK_TTL,
      async (): Promise<Omit<AchRankResponse, 'seasons'>> => {
        const { rows, total } = await listAchievementRanking(getDb(c), season, q.page);
        return {
          season,
          page: q.page,
          total,
          items: rows.map((r, i) => ({
            rank: (q.page - 1) * ACH_RANK_PER_PAGE + i + 1,
            nickname: r.nickname,
            team:
              r.teamId && r.teamName
                ? { id: r.teamId, name: r.teamName, logo: logoOf({ logoJson: r.logoJson }) }
                : null,
            score: r.score,
            done: r.done,
            players: r.players,
            title: r.title,
          })),
        };
      },
    );
    return ok(c, AchRankResponseSchema, withSeasons(data, now, reqLang(c)), 200, RANK_CACHE);
  });

  // 팀 프로필. 좋아요 여부가 사람마다 달라 캐시하지 않는다.
  app.get('/v1/teams/:teamId', async (c) => {
    const id = teamParam(c);
    const db = getDb(c);
    const [[found], session] = await Promise.all([liveTeam(db, id), resolveSession(c)]);
    if (!found) throw teamNotFound();
    const t = found.team;
    const ids = slotIdsOf(t);
    const other = session && session.profileId !== t.profileId ? session.profileId : null;
    const { ownerNickname } = found;
    const [rows, rank, liked, friend, cupHonors, coach] = await Promise.all([
      careersByIds(
        db,
        ids.filter((x): x is string => !!x),
      ),
      ratingRankOf(db, t),
      session ? isTeamLiked(db, t.id, session.profileId) : false,
      other ? friendStateOf(db, other, t.profileId) : null,
      cupHonorsOf(db, t.profileId),
      // T-11-335 감독 칸에 앉힌 감독(카드 id 고유 인덱스 한 줄).
      teamCoachOf(db, t),
    ]);
    const now = nowIso();
    const eligible = eligibleMap(rows, t.profileId, t.season, t.season === teamSeasonAt(now));
    const lineup = buildLineup(t.formation as FormationId, ids, eligible, layoutOf(t));
    const lang = reqLang(c);
    const seasonName = teamSeasonName(t.season, lang);
    return ok(
      c,
      TeamProfileResponseSchema,
      {
        team: {
          id: t.id,
          season: t.season,
          seasonName,
          rank,
          name: t.name,
          manager: t.manager,
          formation: t.formation as FormationId,
          slots: slotsOf(lineup, eligible, lang),
          layout: layoutOf(t),
          logo: logoOf(t),
          ovr: lineupOvr(lineup),
          lines: linesOf(lineup, t.season),
          rating: t.rating,
          division: t.division,
          record: recordOf(t),
          goals: { for: t.goalsFor, against: t.goalsAgainst },
          likes: t.likes,
          views: t.views,
          badges: teamBadges(t, teamSeasonClosed(t.season, now) ? rank : null, seasonName, lang),
          cupHonors,
          ownerTitle: found.title,
          ownerNickname,
          // T-11-165 선발에 실제로 든 선수만(숨김·지난 주인 카드는 eligible에서 이미 빠졌다).
          players: rows.filter((r) => eligible.has(r.id)).map((r) => teamPlayerCard(r)),
          // T-11-290 선발 시너지 — 내 팀 화면과 같은 표를 남의 팀 프로필에도(경기 계산과 같은 입력).
          synergy: lineupSynergy(lineup),
          coach,
          createdAt: t.createdAt,
        },
        liked,
        mine: session?.profileId === t.profileId,
        friend,
      },
      200,
      NO_STORE,
    );
  });

  // T-11-358 팀 경기 통계 — 팀 프로필에서 '경기 통계'를 열 때만 부른다. 누구에게나 같아 엣지에 담고(세션 · 프로필 조회
  // 없음), 선수 익명 표기만 꺼낸 뒤 요청 언어로 옮긴다. 없는 팀(404)은 담지 않는다.
  app.get('/v1/teams/:teamId/stats', async (c) => {
    const id = teamParam(c);
    const db = getDb(c);
    const data = await edgeCached(c, EDGE.teamStats(id), TEAM_STATS_TTL, async () => {
      const [found] = await liveTeam(db, id);
      if (!found) return undefined;
      const [{ rows, capped }, kinds] = await Promise.all([
        listStatsMatches(db, id, TEAM_STATS_MATCHES_MAX),
        otherKindTotals(db, id),
      ]);
      return teamStatsView(db, found.team.season, id, rows, capped, 'ko', kinds);
    });
    if (!data) throw teamNotFound();
    const lang = reqLang(c);
    const view =
      lang === 'ko'
        ? data
        : { ...data, players: data.players.map((p) => ({ ...p, name: anonText(p.name, lang) })) };
    return ok(c, TeamStatsResponseSchema, view, 200, RANK_CACHE);
  });

  // 조회수 — 웹이 남의 팀 프로필을 열 때 한 번 부른다(게시판 글과 같은 방식).
  app.post('/v1/teams/:teamId/views', async (c) => {
    if (!(await addTeamView(getDb(c), teamParam(c)))) throw teamNotFound();
    return c.body(null, 204);
  });

  for (const [method, like] of [
    ['put', true],
    ['delete', false],
  ] as const) {
    app[method]('/v1/teams/:teamId/like', requireProfile, async (c) => {
      const id = teamParam(c);
      const { profileId } = getSessionOrThrow(c);
      const db = getDb(c);
      const [found] = await liveTeam(db, id);
      if (!found) throw teamNotFound();
      if (found.team.profileId === profileId) {
        throw conflictError('내 팀에는 좋아요를 누를 수 없어요.', 'OWN_TEAM');
      }
      // T-11-029 닫힌 시즌 팀의 좋아요는 굳는다 — 누르기도 거두기도 막아 끝난 시즌의 순위가 흔들리지 않게 한다.
      if (teamSeasonClosed(found.team.season, nowIso())) {
        throw conflictError('끝난 시즌의 팀에는 좋아요를 바꿀 수 없어요.', 'SEASON_CLOSED');
      }
      const likes = await setTeamLike(db, id, profileId, like, nowIso());
      if (likes === undefined) throw teamNotFound();
      // T-11-028 받은 좋아요(팀 업적)와 누른 좋아요(구단주 업적) — 두 구단주 점수를 응답 뒤에 다시 센다.
      waitUntil(
        c,
        Promise.all([
          refreshAfterChange(db, found.team.profileId, found.team.season),
          refreshAfterChange(db, profileId, found.team.season),
        ]),
      );
      return ok(c, TeamLikeResponseSchema, { liked: like, likes });
    });
  }
}
