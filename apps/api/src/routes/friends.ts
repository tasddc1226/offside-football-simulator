import {
  FriendPendingResponseSchema,
  FriendRemoveResponseSchema,
  FriendRequestBodySchema,
  FriendRequestResponseSchema,
  FriendsResponseSchema,
  PlayFriendlyResponseSchema,
  type FriendPerson,
  type TeamRecord,
} from '@offside/contracts';
import {
  FRIENDLY_MATCHES_PER_DAY,
  FRIENDS_MAX,
  INVITE_REROLLS,
  INVITE_REWARD_MAX,
  normalizeFriendCode,
} from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { eq } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import {
  NO_STORE,
  conflictError,
  enforceLimit,
  notFoundError,
  nowIso,
  ok,
  rateLimited,
  readBody,
  teamNotFound,
} from './shared.js';
import { currentSeasonOrThrow, kstTodayStart, requireOwner } from './ownerTeam.js';
import { newId } from '../db/ids.js';
import { runBatch } from '../db/repos/batch.js';
import { commitNotifiedEvent } from '../push/events.js';
import {
  acceptStatements,
  blockBetween,
  countFriendliesSince,
  ensureFriendCode,
  friendCountOf,
  friendRowOf,
  latestManagersOf,
  listFriendRows,
  listRecentFriendlies,
  ownerByCode,
  receivedCountOf,
  recordFriendlyStatements,
  requestStatements,
  teamsOfOwners,
  unfriendStatements,
  type FriendRow,
} from '../db/repos/friends.js';
import {
  foundersOf,
  friendlyTeamOf,
  liveTeam,
  logoOf,
  myTeamIn,
  type OwnerTeamRow,
} from '../db/repos/ownerTeams.js';
import { claimReferral, inviteCountsOf } from '../db/repos/referrals.js';
import type { Db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { lineupsOf, matchDetailOf, matchViews, playedMatch } from '../team/match.js';
import { filledCount, simulateMatch } from '../team/sim.js';
import { reqLang, type Lang } from '../lang.js';

// T-11-098 친구 · 친선전. 로그인한 구단주끼리 친구 코드(초대 링크)나 팀 프로필에서 신청하고 수락하면 친구가 된다. 친선전은
// 랭크 경기와 따로 센다 — 레이팅·전적·업적·랭킹에 들어가지 않고 두 사람의 상대 전적만 남는다. 사람마다 다른 응답이라
// 엣지 캐시하지 않는다.

/** 한 구단주가 한 시간에 보낼 수 있는 친구 신청(틀린 코드 포함 — 코드 추측을 막는다). */
const FRIEND_REQUESTS_PER_HOUR = 20;

const friendNotFound = () =>
  notFoundError('친구 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요.', 'FRIEND_NOT_FOUND');

/** 사람이 넣은 친구 코드 → 계정이 살아 있는 구단주(id · 코드 · 닉네임). */
async function ownerOfCode(db: Db, raw: string) {
  const code = normalizeFriendCode(raw);
  const owner = code ? await ownerByCode(db, code) : null;
  if (!owner) throw friendNotFound();
  return owner;
}

const ownerOfCodeParam = (c: Context<AppEnv>) => ownerOfCode(getDb(c), c.req.param('code') ?? '');

const h2hOf = (row: Pick<FriendRow, 'wins' | 'draws' | 'losses'> | undefined): TeamRecord => ({
  w: row?.wins ?? 0,
  d: row?.draws ?? 0,
  l: row?.losses ?? 0,
});

type PersonInput = {
  profileId: string;
  code: string;
  nickname: string | null;
  /** 내 쪽 줄(상대 전적). 아직 줄이 없으면(방금 보낸 신청) undefined. */
  row: Pick<FriendRow, 'wins' | 'draws' | 'losses'> | undefined;
};

const OWNER_NAME: Record<Lang, string> = { ko: '구단주', en: 'Owner', ja: 'オーナー' };

/**
 * 친구 줄들에 지금 시즌 팀 · 프리시즌 팀(개막 뒤 친선전용, T-11-113) · 창단 멤버 여부와 표시 이름(닉네임 → 최근 감독 이름 →
 * '구단주')을 붙인다. profileId → 사람. 쿼리 2~4번.
 */
async function peopleOf(
  db: Db,
  inputs: readonly PersonInput[],
  season: number | null,
  lang: Lang = 'ko',
): Promise<Map<string, FriendPerson>> {
  const ids = inputs.map((p) => p.profileId);
  // 개막 뒤(휴식기 포함)엔 프리시즌 팀도 함께 읽는다(친선전용 편성으로).
  const legacy = season !== 0;
  const seasons = [...(season === null ? [] : [season]), ...(legacy ? [0] : [])];
  const [[teams, founders], managers] = await Promise.all([
    ids.length === 0 ? [[], []] : db.batch([teamsOfOwners(db, ids, seasons), foundersOf(db, ids)]),
    latestManagersOf(
      db,
      inputs.filter((p) => !p.nickname).map((p) => p.profileId),
    ),
  ]);
  const teamOf = new Map(teams.filter((t) => t.season === season).map((t) => [t.profileId, t]));
  const legacyOf = new Map(
    legacy ? teams.filter((t) => t.season === 0).map((t) => [t.profileId, friendlyTeamOf(t)]) : [],
  );
  const founder = new Set(founders.map((f) => f.profileId));
  return new Map(
    inputs.map((p) => {
      const t = teamOf.get(p.profileId);
      const lt = legacyOf.get(p.profileId);
      return [
        p.profileId,
        {
          code: p.code,
          name: p.nickname ?? managers.get(p.profileId) ?? OWNER_NAME[lang],
          team: t ? teamSummary(t) : null,
          h2h: h2hOf(p.row),
          ...(legacy ? { preseasonTeam: lt ? teamSummary(lt) : null } : {}),
          founder: founder.has(p.profileId),
        },
      ];
    }),
  );
}

/** 한 사람(신청·수락 응답). */
const personOf = async (db: Db, input: PersonInput, now: string, lang: Lang) =>
  (await peopleOf(db, [input], teamSeasonAt(now), lang)).get(input.profileId)!;

const teamSummary = (t: OwnerTeamRow) => ({
  id: t.id,
  name: t.name,
  logo: logoOf(t),
  ovr: t.ovr,
  filled: t.filled,
});

export function registerFriendRoutes(app: Hono<AppEnv>): void {
  // 친구 화면: 내 코드 · 친구 · 받은/보낸 신청 · 최근 친선전 · 오늘 남은 친선전. 화면(친구 탭)을 열 때 한 번 부른다(웹 메모 1분).
  app.get('/v1/friends', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = teamSeasonAt(now);
    const [code, [rows, [played], myTeams], recentRows, invites] = await Promise.all([
      ensureFriendCode(db, me.id, me.friendCode ?? null),
      db.batch([
        listFriendRows(db, me.id),
        countFriendliesSince(db, me.id, kstTodayStart(now)),
        teamsOfOwners(db, [me.id], [season ?? 0, 0]),
      ]),
      listRecentFriendlies(db, me.id),
      inviteCountsOf(db, me.id),
    ]);
    const myTeam = season === null ? undefined : myTeams.find((t) => t.season === season);
    const myLegacy = season === 0 ? undefined : myTeams.find((t) => t.season === 0);
    const live = rows.filter((r): r is typeof r & { code: string } => !!r.code);
    const [people, recent, inviterNames] = await Promise.all([
      peopleOf(
        db,
        live.map((r) => ({
          profileId: r.row.friendId,
          code: r.code,
          nickname: r.nickname,
          row: r.row,
        })),
        season,
        reqLang(c),
      ),
      matchViews(
        db,
        recentRows,
        (r) => (r.profileId === me.id ? r.homeTeamId : r.awayTeamId),
        reqLang(c),
      ),
      invites.invitedBy && !invites.invitedBy.nickname
        ? latestManagersOf(db, [invites.invitedBy.inviterId])
        : null,
    ]);
    const by = invites.invitedBy;
    const byState = (s: FriendRow['state']) =>
      live.filter((r) => r.row.state === s).map((r) => people.get(r.row.friendId)!);
    return ok(
      c,
      FriendsResponseSchema,
      {
        code,
        friends: byState('accepted'),
        received: byState('received'),
        sent: byState('sent'),
        recent: recent.map((m) => ({ ...m, friendly: true })),
        matchesLeft: Math.max(0, FRIENDLY_MATCHES_PER_DAY - Number(played?.n ?? 0)),
        matchesPerDay: FRIENDLY_MATCHES_PER_DAY,
        max: FRIENDS_MAX,
        canPlay: !!myTeam && myTeam.filled > 0,
        ...(season !== 0
          ? { canPlayPreseason: !!myLegacy && friendlyTeamOf(myLegacy).filled > 0 }
          : {}),
        invite: {
          pending: invites.pending,
          done: invites.done,
          rewarded: invites.rewarded,
          rewardMax: INVITE_REWARD_MAX,
          rerolls: INVITE_REROLLS,
          invitedBy: by
            ? {
                name: by.nickname ?? inviterNames?.get(by.inviterId) ?? OWNER_NAME[reqLang(c)],
                done: by.doneAt !== null,
              }
            : null,
        },
      },
      200,
      NO_STORE,
    );
  });

  // T-11-142 받은 신청 수(하단 메뉴 점). 구단주 화면을 연 적 있는 기기가 시작·복귀할 때(메모 5분) 부른다. 신청 줄은
  // 구단주에게만 생기니 계정 확인 없이 센다(세션 + 쿼리 한 번).
  app.get('/v1/friends/pending', requireProfile, async (c) => {
    const [row] = await receivedCountOf(getDb(c), getSessionOrThrow(c).profileId);
    return ok(c, FriendPendingResponseSchema, { received: Number(row?.n ?? 0) }, 200, NO_STORE);
  });

  // 친구 신청(친구 코드 또는 팀 프로필의 팀). 상대가 이미 나에게 신청했으면 곧바로 친구가 된다. 이미 신청했거나 친구면 그대로
  // 돌려준다(자연 멱등).
  app.post('/v1/friends/requests', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, FriendRequestBodySchema);
    const now = nowIso();
    await enforceLimit(
      db,
      'FRIEND_REQUEST',
      me.id,
      FRIEND_REQUESTS_PER_HOUR,
      now,
      '친구 신청을 너무 자주 보냈어요. 잠시 뒤에 다시 해 주세요.',
    );
    const targetId =
      'code' in input
        ? (await ownerOfCode(db, input.code)).id
        : (await liveTeam(db, input.teamId))[0]?.team.profileId;
    if (!targetId) throw teamNotFound();
    if (targetId === me.id) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '내 코드예요. 친구의 코드를 넣어 주세요.',
        details: { reason: 'FRIEND_SELF' },
      });
    }
    const [[mine], blocked, [myCount], [theirCount], [target]] = await db.batch([
      friendRowOf(db, me.id, targetId),
      blockBetween(db, me.id, targetId),
      friendCountOf(db, me.id),
      friendCountOf(db, targetId),
      // 응답에 붙일 상대의 코드·닉네임.
      db
        .select({ friendCode: profiles.friendCode, nickname: profiles.nickname })
        .from(profiles)
        .where(eq(profiles.id, targetId)),
    ]);
    let state: 'sent' | 'accepted';
    if (mine?.state === 'received') {
      await commitNotifiedEvent(db, [...acceptStatements(db, me.id, targetId, now)], {
        profileId: targetId,
        sourceKey: `friend-accepted:${me.id}:${crypto.randomUUID()}`,
        now,
        content: {
          kind: 'social',
          title: '친구 신청이 수락됐어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          body: '친구 목록에서 새 친구와 친선전을 즐겨요.', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          target: { type: 'screen', screen: 'team' },
        },
      });
      state = 'accepted';
    } else if (mine) {
      state = mine.state;
    } else {
      if (blocked.length > 0) {
        throw new AppError({
          code: 'FORBIDDEN',
          message: '이 구단주에게는 친구 신청을 보낼 수 없어요.',
          details: { reason: 'FRIEND_UNAVAILABLE' },
        });
      }
      if (Number(myCount?.n ?? 0) >= FRIENDS_MAX) {
        throw conflictError(
          `친구는 신청 중인 사람을 포함해 ${FRIENDS_MAX}명까지예요.`,
          'FRIEND_LIMIT',
        );
      }
      if (Number(theirCount?.n ?? 0) >= FRIENDS_MAX) {
        throw conflictError('상대의 친구 목록이 가득 찼어요.', 'FRIEND_LIMIT_OTHER');
      }
      await commitNotifiedEvent(db, [...requestStatements(db, me.id, targetId, now)], {
        profileId: targetId,
        sourceKey: `friend-request:${me.id}:${crypto.randomUUID()}`,
        now,
        content: {
          kind: 'social',
          title: '새 친구 신청이 왔어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          body: '친구 목록에서 받은 신청을 확인해 주세요.', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          target: { type: 'screen', screen: 'team' },
        },
      });
      state = 'sent';
    }
    // T-11-171 친구 코드(초대 링크)로 신청한 새 구단주는 그 코드 주인의 초대로 적는다(아직 은퇴 선수가 없을 때 한 번).
    const invited = 'code' in input && (await claimReferral(db, me.id, targetId, now));
    // 친구 목록은 사람을 코드로 가리키므로 코드가 없는 쪽(팀 프로필에서만 신청하고 친구 화면은 안 열어 본 사람)은 지금 만든다.
    // 신청자 코드가 없으면 받은 쪽 목록에 신청이 보이지 않는다.
    const [code] = await Promise.all([
      ensureFriendCode(db, targetId, target?.friendCode ?? null),
      ensureFriendCode(db, me.id, me.friendCode ?? null),
    ]);
    const friend = await personOf(
      db,
      { profileId: targetId, code, nickname: target?.nickname ?? null, row: mine },
      now,
      reqLang(c),
    );
    return ok(c, FriendRequestResponseSchema, { state, friend, invited }, 201);
  });

  // 받은 신청 수락.
  app.post('/v1/friends/:code/accept', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const target = await ownerOfCodeParam(c);
    const now = nowIso();
    const [mine] = await friendRowOf(db, me.id, target.id);
    if (!mine || mine.state === 'sent') {
      throw notFoundError('받은 친구 신청이 없어요.', 'FRIEND_REQUEST_NOT_FOUND');
    }
    if (mine.state === 'received')
      await commitNotifiedEvent(db, [...acceptStatements(db, me.id, target.id, now)], {
        profileId: target.id,
        sourceKey: `friend-accepted:${me.id}:${crypto.randomUUID()}`,
        now,
        content: {
          kind: 'social',
          title: '친구 신청이 수락됐어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          body: '친구 목록에서 새 친구와 친선전을 즐겨요.', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          target: { type: 'screen', screen: 'team' },
        },
      });
    const friend = await personOf(
      db,
      { profileId: target.id, code: target.code, nickname: target.nickname, row: mine },
      now,
      reqLang(c),
    );
    return ok(c, FriendRequestResponseSchema, { state: 'accepted', friend });
  });

  // 거절 · 신청 취소 · 친구 끊기(두 줄을 지운다). 상대 전적도 함께 사라진다.
  app.delete('/v1/friends/:code', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const target = await ownerOfCodeParam(c);
    const [removed] = (await runBatch(db, [...unfriendStatements(db, me.id, target.id)])) as [
      { state: string }[],
      unknown,
    ];
    return ok(c, FriendRemoveResponseSchema, { removed: removed.length > 0 });
  });

  // 친선전 한 판(지금 시즌 두 팀). 랭크 경기와 같은 시뮬레이션을 쓰지만 레이팅·전적·업적은 그대로 두고 상대 전적만 남긴다.
  // 재시도가 경기를 두 번 치르지 않게 멱등 키를 쓴다. T-11-113 ?season=0이면 두 사람의 프리시즌 팀끼리(지금 가진 선수만)
  // 겨룬다 — 휴식기에도 된다. 하루 친선전 수는 함께 센다.
  app.post('/v1/friends/:code/matches', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const target = await ownerOfCodeParam(c);
    const now = nowIso();
    const preseason = c.req.query('season') === '0';
    const season = preseason ? 0 : currentSeasonOrThrow(now);
    const teamWord = preseason ? '프리시즌 팀' : '이번 시즌 팀';
    const [[link], [myRow], [theirRow], [played]] = await db.batch([
      friendRowOf(db, me.id, target.id),
      myTeamIn(db, me.id, season),
      myTeamIn(db, target.id, season),
      countFriendliesSince(db, me.id, kstTodayStart(now)),
    ]);
    // 프리시즌 친선전은 친선전용 편성으로 겨룬다.
    const asPlayed = (t: OwnerTeamRow | undefined) => (t && preseason ? friendlyTeamOf(t) : t);
    const mine = asPlayed(myRow);
    const theirs = asPlayed(theirRow);
    if (link?.state !== 'accepted') {
      throw notFoundError('친구에게만 친선전을 걸 수 있어요.', 'FRIEND_NOT_FOUND');
    }
    const usedToday = Number(played?.n ?? 0);
    if (usedToday >= FRIENDLY_MATCHES_PER_DAY) {
      throw rateLimited(
        `오늘 친선전은 모두 치렀어요(하루 ${FRIENDLY_MATCHES_PER_DAY}경기). 한국 시각 자정에 다시 열려요.`,
        'FRIENDLY_DAILY_LIMIT',
      );
    }
    if (!mine) throw conflictError(`먼저 ${teamWord}을 만들어 주세요.`, 'TEAM_REQUIRED');
    if (!theirs || theirs.filled === 0) {
      throw conflictError(`친구가 아직 ${teamWord}을 꾸리지 않았어요.`, 'FRIEND_TEAM_REQUIRED');
    }

    const lineups = await lineupsOf(db, season, mine, theirs);
    if (filledCount(lineups.home) === 0) {
      throw conflictError('은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.', 'TEAM_EMPTY');
    }
    if (filledCount(lineups.away) === 0) {
      throw conflictError(`친구가 아직 ${teamWord}을 꾸리지 않았어요.`, 'FRIEND_TEAM_REQUIRED');
    }

    const id = newId('fmt');
    const result = simulateMatch(id, lineups.home, lineups.away, season);
    const detail = matchDetailOf(mine, theirs, lineups, result);
    await commitNotifiedEvent(
      db,
      [
        ...recordFriendlyStatements(db, {
          id,
          profileId: me.id,
          opponentId: target.id,
          homeTeamId: mine.id,
          awayTeamId: theirs.id,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          detail,
          now,
        }),
      ],
      {
        profileId: target.id,
        sourceKey: `friendly:${id}`,
        now,
        content: {
          kind: 'social',
          title: '친선전 결과가 도착했어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          body: `${theirs.name} ${result.awayGoals} : ${result.homeGoals} ${mine.name}. 친구 목록에서 경기 결과를 확인해 주세요.`, // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          target: { type: 'screen', screen: 'team' },
        },
      },
    );
    const gf = result.homeGoals;
    const ga = result.awayGoals;
    const before = h2hOf(link);
    const head = { id, homeTeamId: mine.id, homeGoals: gf, awayGoals: ga, createdAt: now };
    return ok(
      c,
      PlayFriendlyResponseSchema,
      {
        match: { ...playedMatch(head, detail, lineups, mine, theirs, reqLang(c)), friendly: true },
        h2h: {
          w: before.w + (gf > ga ? 1 : 0),
          d: before.d + (gf === ga ? 1 : 0),
          l: before.l + (gf < ga ? 1 : 0),
        },
        matchesLeft: Math.max(0, FRIENDLY_MATCHES_PER_DAY - usedToday - 1),
      },
      201,
    );
  });
}
