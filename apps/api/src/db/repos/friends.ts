import { FRIEND_CODE_CHARS, FRIEND_CODE_LENGTH, FRIENDS_MAX } from '@offside/contracts/owner-team';
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { boardBlocks, friendMatches, friends, ownerTeams, profiles } from '../schema.js';
import type { MatchDetail } from './ownerTeams.js';
import { accountLinkedSql } from './profiles.js';

// T-11-098 친구 · 친선전. 친구 한 쌍은 두 줄(내 쪽·상대 쪽)이라 내 목록은 profile_id(PK 앞자리) 하나로 읽는다.

export type FriendRow = typeof friends.$inferSelect;
export type FriendMatchRow = typeof friendMatches.$inferSelect;

/** 친구로 보일 수 있는 구단주: 계정(구글·애플)이 연결돼 있고 삭제되지 않았다. */
const liveOwner = () => and(accountLinkedSql(), isNull(profiles.deletedAt));

/** 새 친구 코드(무작위 8자). 겹치면 부르는 쪽이 다시 만든다. */
export function newFriendCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FRIEND_CODE_LENGTH));
  let code = '';
  for (const b of bytes) code += FRIEND_CODE_CHARS[b % FRIEND_CODE_CHARS.length];
  return code;
}

/**
 * 내 친구 코드. 없으면 만들어 적는다 — 이미 있으면 덮어쓰지 않는다(동시에 두 번 열어도 코드가 하나). 겹치면 몇 번 다시 뽑는다.
 */
export async function ensureFriendCode(
  db: Db,
  profileId: string,
  current: string | null,
): Promise<string> {
  if (current) return current;
  for (let i = 0; i < 5; i++) {
    try {
      await db
        .update(profiles)
        .set({ friendCode: newFriendCode() })
        .where(and(eq(profiles.id, profileId), isNull(profiles.friendCode)));
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
      continue;
    }
    const [row] = await db
      .select({ code: profiles.friendCode })
      .from(profiles)
      .where(eq(profiles.id, profileId));
    if (row?.code) return row.code;
  }
  throw new Error('friend code allocation failed');
}

/** 친구 코드로 구단주를 찾는다(계정이 살아 있는 사람만). */
export async function ownerByCode(db: Db, code: string) {
  const [row] = await db
    .select({ id: profiles.id, code: profiles.friendCode })
    .from(profiles)
    .where(and(eq(profiles.friendCode, code), liveOwner()));
  return row ?? null;
}

/** 내 친구·신청 줄 전부(상대가 계정을 끊었거나 지웠으면 빼고) + 상대의 코드·닉네임. FRIENDS_MAX개를 넘지 않는다. */
export function listFriendRows(db: Db, profileId: string) {
  return (
    db
      .select({
        row: friends,
        code: profiles.friendCode,
        nickname: profiles.nickname,
      })
      .from(friends)
      .innerJoin(profiles, eq(profiles.id, friends.friendId))
      .where(and(eq(friends.profileId, profileId), liveOwner()))
      .orderBy(desc(friends.updatedAt))
      // 신청을 보낼 때 두 사람 모두 상한을 확인하지만, 동시에 들어온 신청이 조금 넘칠 수 있어 여유를 둔다.
      .limit(FRIENDS_MAX * 2)
  );
}

/** 나와 그 사람 사이의 내 쪽 줄(batch에 넣을 수 있게 쿼리로). */
export const friendRowOf = (db: Db, profileId: string, friendId: string) =>
  db
    .select()
    .from(friends)
    .where(and(eq(friends.profileId, profileId), eq(friends.friendId, friendId)));

/** 내 줄 수(신청 포함). 상한을 센다. */
export const friendCountOf = (db: Db, profileId: string) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(friends)
    .where(eq(friends.profileId, profileId));

/** 둘 중 한 사람이라도 상대를 게시판·채팅에서 차단했는가. */
export const blockBetween = (db: Db, a: string, b: string) =>
  db
    .select({ id: boardBlocks.id })
    .from(boardBlocks)
    .where(
      or(
        and(eq(boardBlocks.profileId, a), eq(boardBlocks.blockedProfileId, b)),
        and(eq(boardBlocks.profileId, b), eq(boardBlocks.blockedProfileId, a)),
      ),
    )
    .limit(1);

/** 신청: 내 줄 'sent' · 상대 줄 'received'. 이미 줄이 있으면 건드리지 않는다. */
export const requestStatements = (db: Db, from: string, to: string, now: string) =>
  [
    db
      .insert(friends)
      .values({ profileId: from, friendId: to, state: 'sent', createdAt: now, updatedAt: now })
      .onConflictDoNothing(),
    db
      .insert(friends)
      .values({ profileId: to, friendId: from, state: 'received', createdAt: now, updatedAt: now })
      .onConflictDoNothing(),
  ] as const;

/** 수락: 두 줄을 'accepted'로. 받은 신청이 있을 때만 부른다. */
export const acceptStatements = (db: Db, me: string, them: string, now: string) =>
  [
    db
      .update(friends)
      .set({ state: 'accepted', updatedAt: now })
      .where(and(eq(friends.profileId, me), eq(friends.friendId, them))),
    db
      .update(friends)
      .set({ state: 'accepted', updatedAt: now })
      .where(and(eq(friends.profileId, them), eq(friends.friendId, me))),
  ] as const;

/** 거절·취소·친구 끊기: 두 줄을 지운다. 지운 내 줄 수를 returning으로 알 수 있다. */
export const unfriendStatements = (db: Db, me: string, them: string) =>
  [
    db
      .delete(friends)
      .where(and(eq(friends.profileId, me), eq(friends.friendId, them)))
      .returning({ state: friends.state }),
    db.delete(friends).where(and(eq(friends.profileId, them), eq(friends.friendId, me))),
  ] as const;

/** 프로필 삭제 batch용: 내 줄과 나를 가리키는 상대 줄, 친구 코드. 친선전은 팀 FK CASCADE로 함께 지워진다. */
export const deleteFriendsStatements = (db: Db, profileId: string) =>
  [
    db.delete(friends).where(or(eq(friends.profileId, profileId), eq(friends.friendId, profileId))),
  ] as const;

/** 그 시즌 여러 구단주의 팀(친구 목록에 붙인다). */
export function teamsOfOwners(db: Db, profileIds: readonly string[], season: number) {
  return db
    .select()
    .from(ownerTeams)
    .where(and(inArray(ownerTeams.profileId, [...profileIds]), eq(ownerTeams.season, season)));
}

/** 여러 구단주의 가장 최근 감독 이름(닉네임이 없는 친구의 표시 이름). */
export async function latestManagersOf(db: Db, profileIds: readonly string[]) {
  if (profileIds.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ profileId: ownerTeams.profileId, manager: ownerTeams.manager })
    .from(ownerTeams)
    .where(inArray(ownerTeams.profileId, [...profileIds]))
    .orderBy(desc(ownerTeams.season));
  const map = new Map<string, string>();
  for (const r of rows) if (r.manager && !map.has(r.profileId)) map.set(r.profileId, r.manager);
  return map;
}

/** 오늘(sinceIso 이후) 내가 건 친선전 수. */
export const countFriendliesSince = (db: Db, profileId: string, sinceIso: string) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(friendMatches)
    .where(and(eq(friendMatches.profileId, profileId), gte(friendMatches.createdAt, sinceIso)));

/** 내가 치른 최근 친선전(건 경기 + 받은 경기), 최근 limit개. */
export async function listRecentFriendlies(
  db: Db,
  profileId: string,
  limit = 10,
): Promise<FriendMatchRow[]> {
  const [mine, theirs] = await db.batch([
    db
      .select()
      .from(friendMatches)
      .where(eq(friendMatches.profileId, profileId))
      .orderBy(desc(friendMatches.createdAt))
      .limit(limit),
    db
      .select()
      .from(friendMatches)
      .where(eq(friendMatches.opponentId, profileId))
      .orderBy(desc(friendMatches.createdAt))
      .limit(limit),
  ]);
  return [...mine, ...theirs]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}

/** 친선전 한 판을 남기고 두 사람의 상대 전적 줄을 고친다(친구가 아니면 줄이 없어 전적만 빠진다). */
export function recordFriendlyStatements(
  db: Db,
  input: {
    id: string;
    profileId: string;
    opponentId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeGoals: number;
    awayGoals: number;
    detail: MatchDetail;
    now: string;
  },
) {
  const bump = (me: string, them: string, gf: number, ga: number) =>
    db
      .update(friends)
      .set({
        wins: sql`${friends.wins} + ${gf > ga ? 1 : 0}`,
        draws: sql`${friends.draws} + ${gf === ga ? 1 : 0}`,
        losses: sql`${friends.losses} + ${gf < ga ? 1 : 0}`,
      })
      .where(
        and(eq(friends.profileId, me), eq(friends.friendId, them), eq(friends.state, 'accepted')),
      );
  return [
    db.insert(friendMatches).values({
      id: input.id,
      profileId: input.profileId,
      opponentId: input.opponentId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      detailJson: JSON.stringify(input.detail),
      createdAt: input.now,
    }),
    bump(input.profileId, input.opponentId, input.homeGoals, input.awayGoals),
    bump(input.opponentId, input.profileId, input.awayGoals, input.homeGoals),
  ] as const;
}

/**
 * 팀 프로필의 친구 버튼: 보는 사람(viewer)이 계정 있는 구단주면 그 팀 구단주와의 상태, 아니면 null(버튼을 숨긴다). 쿼리 1번.
 */
export async function friendStateOf(
  db: Db,
  viewerId: string,
  ownerId: string,
): Promise<'none' | FriendRow['state'] | null> {
  const [row] = await db
    .select({ state: friends.state })
    .from(profiles)
    .leftJoin(friends, and(eq(friends.profileId, profiles.id), eq(friends.friendId, ownerId)))
    .where(and(eq(profiles.id, viewerId), liveOwner()));
  if (!row) return null;
  return row.state ?? 'none';
}
