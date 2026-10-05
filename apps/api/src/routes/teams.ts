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
} from '@offside/contracts';
import {
  ACH_RANK_PER_PAGE,
  TEAM_RANK_PER_PAGE,
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
  listTeamRanking,
  listTeamRecentForm,
  ratingRankOf,
  setTeamLike,
  slotIdsOf,
  layoutOf,
  logoOf,
} from '../db/repos/ownerTeams.js';
import { friendStateOf } from '../db/repos/friends.js';
import { listAchievementRanking } from '../db/repos/ownerAchievements.js';
import { edgeCached, waitUntil } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { teamBadges } from '../team/badges.js';
import { refreshAfterChange } from '../team/ownerAchievements.js';
import { queryWithoutLang, reqLang } from '../lang.js';
import { buildLineup, lineupOvr } from '../team/sim.js';
import { linesOf, recordOf, seasonOptions, slotsOf } from '../team/view.js';

// T-10-092 라이브 랭킹(팀 랭킹)과 팀 프로필. 로그인 없이 누구나 본다 — 팀 이름·감독 이름·선수의 공개 이름(없으면 익명
// 표기)만 있고 구단주 계정 정보는 없다. 랭킹은 원작처럼 5분마다 새로 센다(엣지 캐시).
const RANK_TTL = 300;
const RANK_CACHE = 'public, max-age=60';

const teamParam = (c: Context<AppEnv>) => parseWithAppError(TeamIdSchema, c.req.param('teamId'));

export function registerTeamRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/teams', async (c) => {
    const now = nowIso();
    const q = parseWithAppError(TeamRankQuerySchema, queryWithoutLang(c));
    const season = teamSeasonParam(q.season, now);
    // T-11-106 응답의 시즌 이름이 언어마다 달라 캐시 키에 언어(영어만)를 붙인다.
    const lang = reqLang(c);
    const data = await edgeCached(
      c,
      EDGE.teamRank(season, q.sort, q.page, lang),
      RANK_TTL,
      async (): Promise<TeamRankResponse> => {
        const { rows, total } = await listTeamRanking(getDb(c), season, q.sort, q.page);
        const forms = await listTeamRecentForm(
          getDb(c),
          rows.map((t) => t.id),
        );
        return {
          season,
          seasons: seasonOptions(now, lang),
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
            record: recordOf(t),
            likes: t.likes,
            createdAt: t.createdAt,
            recentForm: forms.get(t.id) ?? [],
          })),
        };
      },
    );
    return ok(c, TeamRankResponseSchema, data, 200, RANK_CACHE);
  });

  // T-11-028 업적 랭킹(기록실). 시즌 업적 점수 순 — 구단주는 공개 닉네임과 그 시즌 팀 이름으로만 보인다. 팀 랭킹처럼 5분마다.
  app.get('/v1/achievements/ranking', async (c) => {
    const now = nowIso();
    const q = parseWithAppError(AchRankQuerySchema, queryWithoutLang(c));
    const season = teamSeasonParam(q.season, now);
    const lang = reqLang(c);
    const data = await edgeCached(
      c,
      EDGE.achRank(season, q.page, lang),
      RANK_TTL,
      async (): Promise<AchRankResponse> => {
        const { rows, total } = await listAchievementRanking(getDb(c), season, q.page);
        return {
          season,
          seasons: seasonOptions(now, lang),
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
          })),
        };
      },
    );
    return ok(c, AchRankResponseSchema, data, 200, RANK_CACHE);
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
    const [rows, rank, liked, friend] = await Promise.all([
      careersByIds(
        db,
        ids.filter((x): x is string => !!x),
      ),
      ratingRankOf(db, t),
      session ? isTeamLiked(db, t.id, session.profileId) : false,
      other ? friendStateOf(db, other, t.profileId) : null,
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
          record: recordOf(t),
          goals: { for: t.goalsFor, against: t.goalsAgainst },
          likes: t.likes,
          views: t.views,
          badges: teamBadges(t, teamSeasonClosed(t.season, now) ? rank : null, seasonName, lang),
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
