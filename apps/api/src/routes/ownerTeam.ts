import {
  ADMIN_NICKNAME,
  ClubAchievementsQuerySchema,
  ClubAchievementsResponseSchema,
  OwnerTeamResponseSchema,
  PlayTeamMatchBodySchema,
  PlayTeamMatchResponseSchema,
  PutOwnerTeamBodySchema,
  PutOwnerTeamResponseSchema,
  TeamMatchesResponseSchema,
  TeamOpponentsResponseSchema,
  type OwnerTeam,
  type TeamMatch,
  type TeamLines,
  type TeamOpponent,
  type TeamRecord,
} from '@offside/contracts';
import { isAcceptablePublicName, isReservedNickname } from '@offside/contracts/content-filter';
import { TEAM_MATCHES_PER_DAY, TEAM_SLOTS, type FormationId } from '@offside/contracts/owner-team';
import { SERVICE_SEASONS, activeSeason, serviceSeason } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { nowIso, ok, readBody } from './shared.js';
import { isAdminEmail } from '../auth/admin.js';
import { newId } from '../db/ids.js';
import { kstDays } from '../db/repos/admin.js';
import { runBatch } from '../db/repos/batch.js';
import {
  careersByIds,
  countMatchesSince,
  countTeamWins,
  dposOf,
  eligibleMap,
  getTeamWithOwner,
  listEligibleCareers,
  peakOf,
  listMyTeams,
  listOpponentCandidates,
  listRecentMatches,
  publicNamesOf,
  seasonCareersOf,
  recordMatchStatements,
  slotIdsOf,
  teamCareerFacts,
  type MatchDetail,
  type OwnerTeamRow,
  type TeamMatchRow,
} from '../db/repos/ownerTeams.js';
import { getProfile, type ProfileRecord } from '../db/repos/profiles.js';
import { ownerTeams } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import {
  buildLineup,
  filledCount,
  lineStrength,
  lineupOvr,
  simulateMatch,
  type LineStrength,
  type LineupCareer,
  type LineupSlot,
  type PlayerRef,
} from '../team/sim.js';
import { clubAchievements } from '../team/achievements.js';
import { eq } from 'drizzle-orm';

// T-10-092 구단주 팀(팀 슬롯). 구글 로그인한 구단주만 쓴다 — 사람마다 다른 응답이라 엣지 캐시하지 않는다.
const NO_STORE = 'private, no-store';
/** 상대 목록에 보여 줄 팀 수. */
const OPPONENTS_SHOWN = 5;
const ANON_OWNER = '익명 구단주';

const teamNotFound = () =>
  new AppError({
    code: 'VALIDATION_FAILED',
    status: 404,
    message: '팀을 찾을 수 없어요.',
    details: { reason: 'TEAM_NOT_FOUND' },
  });
const teamRequired = () =>
  new AppError({
    code: 'VALIDATION_FAILED',
    status: 409,
    message: '먼저 팀을 만들어 주세요.',
    details: { reason: 'TEAM_REQUIRED' },
  });

/** 구글 로그인한(삭제되지 않은) 프로필만 구단주다. 익명 프로필은 403 GOOGLE_LOGIN_REQUIRED — 웹이 로그인 안내를 띄운다. */
async function requireOwner(c: Context<AppEnv>): Promise<ProfileRecord> {
  const profile = await getProfile(getDb(c), getSessionOrThrow(c).profileId);
  if (!profile || !profile.googleSub || profile.deletedAt) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: '구글로 로그인한 구단주만 팀을 만들 수 있어요.',
      details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
    });
  }
  return profile;
}

/** 구단주 표기 — 댓글 닉네임(운영자는 '운영자'), 없으면 '익명 구단주'. 구글 연결한 구단주만 들어온다. */
const ownerLabel = (
  p: { nickname: string | null; email: string | null },
  adminEmails: string | undefined,
) => (isAdminEmail(adminEmails, p.email) ? ADMIN_NICKNAME : (p.nickname ?? ANON_OWNER));

/** 오늘(한국 시각 자정부터)의 시작 UTC ISO. */
const kstTodayStart = (now: string) => kstDays(new Date(now), 1).startIso;

const recordOf = (t: Pick<OwnerTeamRow, 'wins' | 'draws' | 'losses'>): TeamRecord => ({
  w: t.wins,
  d: t.draws,
  l: t.losses,
});

const nameOf = (s: LineupSlot) => s.publicName ?? s.ref.anon;

const roundLines = (l: LineStrength): TeamLines => ({
  atk: Math.round(l.atk),
  mid: Math.round(l.mid),
  def: Math.round(l.def),
  gk: Math.round(l.gk),
});

function toOwnerTeam(row: OwnerTeamRow, lineup: LineupSlot[]): OwnerTeam {
  return {
    id: row.id,
    name: row.name,
    formation: row.formation as FormationId,
    slots: lineup.map((s) => ({
      slot: s.slot,
      careerId: s.careerId,
      name: nameOf(s),
      pos: s.pos,
      rating: s.rating,
      fit: s.fit,
    })),
    ovr: lineupOvr(lineup),
    lines: roundLines(lineStrength(lineup)),
    record: recordOf(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMatch(
  row: TeamMatchRow,
  myTeamIds: ReadonlySet<string>,
  names: ReadonlyMap<string, string>,
): TeamMatch {
  const d = JSON.parse(row.detailJson) as MatchDetail;
  const label = (p: PlayerRef) => (p.careerId ? (names.get(p.careerId) ?? p.anon) : p.anon);
  const mine = myTeamIds.has(row.homeTeamId) ? 'home' : 'away';
  return {
    id: row.id,
    home: { ...d.home, goals: row.homeGoals },
    away: { ...d.away, goals: row.awayGoals },
    events: d.events.map((e) => ({
      minute: e.minute,
      side: e.side,
      scorer: label(e.scorer),
      assist: e.assist ? label(e.assist) : null,
      scorerId: e.side === mine ? e.scorer.careerId : null,
      assistId: e.side === mine ? (e.assist?.careerId ?? null) : null,
    })),
    mine,
    createdAt: row.createdAt,
  };
}

const careerIdsIn = (rows: readonly TeamMatchRow[]) => [
  ...new Set(
    rows.flatMap((r) =>
      (JSON.parse(r.detailJson) as MatchDetail).events.flatMap((e) =>
        [e.scorer.careerId, e.assist?.careerId].filter((x): x is string => !!x),
      ),
    ),
  ),
];

export function registerOwnerTeamRoutes(app: Hono<AppEnv>): void {
  // 내 팀 + 넣을 수 있는 은퇴 선수 + 오늘 남은 경기 수. 화면을 열 때 한 번 부른다(웹 메모 1분).
  app.get('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [teams, players, [played]] = await db.batch([
      listMyTeams(db, me.id),
      listEligibleCareers(db, me.id),
      countMatchesSince(db, me.id, kstTodayStart(nowIso())),
    ]);
    const peaks = new Map(players.map((p) => [p.id, peakOf(p.peakProfile)]));
    const eligible = new Map<string, LineupCareer>(
      players.map((p) => [
        p.id,
        {
          id: p.id,
          pos: p.pos,
          dpos: dposOf(p.dpos),
          peak: p.peak!,
          roles: peaks.get(p.id)?.roles ?? null,
          number: p.number,
          publicName: p.publicName,
        },
      ]),
    );
    // 은퇴 선수가 목록 상한보다 많으면 선발에 든 선수가 목록 밖에 있을 수 있다 — 그 선수만 따로 읽는다.
    const missing = teams
      .flatMap(slotIdsOf)
      .filter((id): id is string => !!id && !eligible.has(id));
    if (missing.length) {
      for (const [id, career] of eligibleMap(await careersByIds(db, missing), me.id))
        eligible.set(id, career);
    }
    return ok(
      c,
      OwnerTeamResponseSchema,
      {
        teams: teams.map((t) =>
          toOwnerTeam(t, buildLineup(t.formation as FormationId, slotIdsOf(t), eligible)),
        ),
        slotsMax: TEAM_SLOTS,
        players: players.map((p) => ({
          careerId: p.id,
          pos: p.pos,
          dpos: dposOf(p.dpos),
          peak: p.peak!,
          roles: peaks.get(p.id)?.roles ?? null,
          attrs: peaks.get(p.id)?.attrs ?? null,
          number: p.number,
          publicName: p.publicName,
          legendScore: p.legendScore,
        })),
        matchesLeft: Math.max(0, TEAM_MATCHES_PER_DAY - Number(played?.n ?? 0)),
        matchesPerDay: TEAM_MATCHES_PER_DAY,
      },
      200,
      NO_STORE,
    );
  });

  // 팀 만들기·고치기(전체 교체라 자연 멱등). teamId가 없으면 새 팀 — 팀 슬롯(TEAM_SLOTS)이 남아 있을 때만.
  app.put('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, PutOwnerTeamBodySchema);
    if (isReservedNickname(input.name)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: `'운영자'처럼 운영진으로 보이는 이름은 쓸 수 없어요.`,
        details: { reason: 'RESERVED_NAME' },
      });
    }
    if (!isAcceptablePublicName(input.name)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '쓸 수 없는 팀 이름이에요.',
        details: { reason: 'BLOCKED_WORD' },
      });
    }
    const ids = input.slots.filter((x): x is string => x !== null);
    if (new Set(ids).size !== ids.length) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '한 선수는 한 자리에만 넣을 수 있어요.',
        details: { reason: 'DUPLICATE_PLAYER' },
      });
    }
    const [teams, owned] = await Promise.all([listMyTeams(db, me.id), careersByIds(db, ids)]);
    const eligible = eligibleMap(owned, me.id);
    if (ids.some((id) => !eligible.has(id))) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '내 은퇴 선수만 팀에 넣을 수 있어요.',
        details: { reason: 'PLAYER_NOT_ELIGIBLE' },
      });
    }
    const lineup = buildLineup(input.formation, input.slots, eligible);
    const now = nowIso();
    const values = {
      name: input.name,
      formation: input.formation,
      slotsJson: JSON.stringify(input.slots),
      filled: filledCount(lineup),
      ovr: lineupOvr(lineup),
      updatedAt: now,
    };
    let row: OwnerTeamRow | undefined;
    if (input.teamId) {
      if (!teams.some((t) => t.id === input.teamId)) throw teamNotFound();
      [row] = await db
        .update(ownerTeams)
        .set(values)
        .where(eq(ownerTeams.id, input.teamId))
        .returning();
    } else {
      if (teams.length >= TEAM_SLOTS) {
        throw new AppError({
          code: 'VALIDATION_FAILED',
          status: 409,
          message: `팀은 ${TEAM_SLOTS}개까지 만들 수 있어요.`,
          details: { reason: 'TEAM_SLOTS_FULL' },
        });
      }
      [row] = await db
        .insert(ownerTeams)
        .values({ id: newId('tem'), profileId: me.id, createdAt: now, ...values })
        .returning();
    }
    return ok(c, PutOwnerTeamResponseSchema, { team: toOwnerTeam(row!, lineup) });
  });

  // 경기 상대 후보: 내 팀 OVR에 가까운 다른 구단주의 팀 몇 개를 섞어서.
  app.get('/v1/owner-team/opponents', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [mine] = await listMyTeams(db, me.id);
    if (!mine) throw teamRequired();
    const candidates = await listOpponentCandidates(db, me.id, mine.ovr);
    // 가까운 팀 중에서 무작위로(매번 같은 상대만 나오지 않게).
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    const items: TeamOpponent[] = candidates
      .slice(0, OPPONENTS_SHOWN)
      .sort((a, b) => b.team.ovr - a.team.ovr)
      .map(({ team, nickname, email }) => ({
        teamId: team.id,
        name: team.name,
        owner: ownerLabel({ nickname, email }, c.env.ADMIN_EMAILS),
        formation: team.formation as FormationId,
        ovr: team.ovr,
        record: recordOf(team),
      }));
    return ok(c, TeamOpponentsResponseSchema, { items }, 200, NO_STORE);
  });

  // 경기 한 판. 서버가 두 팀 선발을 읽어 시뮬레이션하고 결과·전적을 남긴다. 재시도가 경기를 두 번 치르지 않게 멱등 키를 쓴다.
  app.post('/v1/owner-team/matches', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, PlayTeamMatchBodySchema);
    const now = nowIso();
    const [teams, [played]] = await db.batch([
      listMyTeams(db, me.id),
      countMatchesSince(db, me.id, kstTodayStart(now)),
    ]);
    const mine = input.teamId ? teams.find((t) => t.id === input.teamId) : teams[0];
    if (!mine) throw input.teamId ? teamNotFound() : teamRequired();
    const usedToday = Number(played?.n ?? 0);
    if (usedToday >= TEAM_MATCHES_PER_DAY) {
      throw new AppError({
        code: 'RATE_LIMITED',
        message: `오늘 경기는 모두 치렀어요(하루 ${TEAM_MATCHES_PER_DAY}경기). 한국 시각 자정에 다시 열려요.`,
        details: { reason: 'TEAM_MATCH_DAILY_LIMIT' },
      });
    }
    const opp = await getTeamWithOwner(db, input.opponentTeamId);
    if (!opp || opp.team.profileId === me.id) throw teamNotFound();

    const mySlots = slotIdsOf(mine);
    const oppSlots = slotIdsOf(opp.team);
    const rows = await careersByIds(db, [
      ...new Set([...mySlots, ...oppSlots].filter((x): x is string => x !== null)),
    ]);
    const home = buildLineup(mine.formation as FormationId, mySlots, eligibleMap(rows, me.id));
    const away = buildLineup(
      opp.team.formation as FormationId,
      oppSlots,
      eligibleMap(rows, opp.team.profileId),
    );
    if (filledCount(home) === 0) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        status: 409,
        message: '은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.',
        details: { reason: 'TEAM_EMPTY' },
      });
    }
    if (filledCount(away) === 0) throw teamNotFound();

    const id = newId('mat');
    const result = simulateMatch(id, home, away);
    const homeSide = { teamId: mine.id, filled: filledCount(home), ovr: lineupOvr(home) };
    const awaySide = { teamId: opp.team.id, filled: filledCount(away), ovr: lineupOvr(away) };
    const detail: MatchDetail = {
      home: {
        teamId: mine.id,
        name: mine.name,
        owner: ownerLabel(me, c.env.ADMIN_EMAILS),
        formation: mine.formation as FormationId,
        ovr: homeSide.ovr,
      },
      away: {
        teamId: opp.team.id,
        name: opp.team.name,
        owner: ownerLabel(opp, c.env.ADMIN_EMAILS),
        formation: opp.team.formation as FormationId,
        ovr: awaySide.ovr,
      },
      events: result.events.map((e) => ({
        minute: e.minute,
        side: e.side,
        scorer: e.scorer,
        assist: e.assist,
      })),
    };
    await runBatch(db, [
      ...recordMatchStatements(db, {
        id,
        profileId: me.id,
        home: homeSide,
        away: awaySide,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        detail,
        now,
      }),
    ]);
    const names = new Map<string, string>();
    for (const s of [...home, ...away])
      if (s.careerId && s.publicName) names.set(s.careerId, s.publicName);
    const row: TeamMatchRow = {
      id,
      profileId: me.id,
      homeTeamId: mine.id,
      awayTeamId: opp.team.id,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      detailJson: JSON.stringify(detail),
      createdAt: now,
    };
    const won = result.homeGoals > result.awayGoals;
    const drew = result.homeGoals === result.awayGoals;
    return ok(
      c,
      PlayTeamMatchResponseSchema,
      {
        match: toMatch(row, new Set([mine.id]), names),
        record: {
          w: mine.wins + (won ? 1 : 0),
          d: mine.draws + (drew ? 1 : 0),
          l: mine.losses + (!won && !drew ? 1 : 0),
        },
        matchesLeft: Math.max(0, TEAM_MATCHES_PER_DAY - usedToday - 1),
      },
      201,
    );
  });

  // 구단 시즌 업적(클럽하우스). season 없으면 지금 시즌(개막 전이면 프리시즌), 0이면 프리시즌. 팀 업적은 지금 시즌을 볼
  // 때만 지금 팀으로 판정한다.
  app.get('/v1/owner-team/achievements', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const current = activeSeason(now)?.id ?? null;
    const q = parseWithAppError(ClubAchievementsQuerySchema, c.req.query());
    const season = q.season === undefined ? current : q.season === 0 ? null : q.season;
    const def = season === null ? undefined : serviceSeason(season);
    if (season !== null && (!def || def.startsAt > now)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '아직 열리지 않은 시즌이에요.',
        details: { reason: 'SEASON_NOT_OPEN' },
      });
    }
    const first = SERVICE_SEASONS[0]!;
    const window = def
      ? { from: def.startsAt, to: def.endsAt }
      : { from: null, to: first.startsAt };
    const [careersIn, teams] = await Promise.all([
      seasonCareersOf(db, me.id, season),
      season === current ? listMyTeams(db, me.id) : Promise.resolve([]),
    ]);
    const team = teams[0];
    let slots = null;
    if (team) {
      const ids = slotIdsOf(team);
      const picked = ids.filter((x): x is string => !!x);
      const [rows, facts] = await Promise.all([
        careersByIds(db, picked),
        teamCareerFacts(db, picked),
      ]);
      slots = buildLineup(team.formation as FormationId, ids, eligibleMap(rows, me.id)).map(
        (s) => ({
          careerId: s.careerId,
          fit: s.fit,
          lastClubId: (s.careerId && facts.get(s.careerId)?.lastClubId) || null,
          caps: (s.careerId && facts.get(s.careerId)?.caps) || 0,
          retiredNumber: !!(s.careerId && facts.get(s.careerId)?.retiredNumber),
        }),
      );
    }
    const teamWins = await countTeamWins(
      db,
      teams.map((t) => t.id),
      window,
    );
    return ok(
      c,
      ClubAchievementsResponseSchema,
      {
        season,
        seasons: [
          { id: null, name: '프리시즌' },
          ...SERVICE_SEASONS.filter((s) => s.startsAt <= now).map((s) => ({
            id: s.id,
            name: s.name,
          })),
        ],
        players: careersIn.length,
        groups: clubAchievements({
          careers: careersIn,
          team: season === current ? (slots ?? []) : null,
          teamWins,
          detail: season !== null,
        }),
      },
      200,
      NO_STORE,
    );
  });

  // 최근 경기(내가 건 경기 + 내 팀이 상대였던 경기). 선수 이름은 지금 공개 이름으로 붙인다.
  app.get('/v1/owner-team/matches', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const teams = await listMyTeams(db, me.id);
    const ids = teams.map((t) => t.id);
    const rows = await listRecentMatches(db, me.id, ids);
    const names = await publicNamesOf(db, careerIdsIn(rows));
    const myIds = new Set(ids);
    return ok(
      c,
      TeamMatchesResponseSchema,
      { items: rows.map((r) => toMatch(r, myIds, names)) },
      200,
      NO_STORE,
    );
  });
}
