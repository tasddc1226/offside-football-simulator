import type { AdminVoiceList } from '@offside/contracts';
import type { VoiceKind } from '@offside/contracts/voice';
import { and, count, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { profiles, userVoices } from '../schema.js';
import { accountLinkedSql } from './profiles.js';

// T-11-802 게임 안 '의견 보내기'(routes/voices.ts). 본문은 저장 전에 voice/clean.ts가 다듬고 가린 것이다.

export type NewVoice = Omit<typeof userVoices.$inferInsert, 'id' | 'resolvedAt'>;

/**
 * 같은 프로필의 같은 글(body_key)은 한 번만 남긴다(응답은 늘 204). 열린 의견이면 아무것도 하지 않는다. 이미 처리한 의견이면
 * 문제가 다시 생긴 것으로 보고 다시 열며, 받은 시각을 지금으로 옮겨 목록 맨 위 · 아침 건수 · 180일 보관이 새로 센다. 문장 하나라
 * 쿼리 수는 그대로다.
 */
export async function insertVoice(db: Db, voice: NewVoice): Promise<void> {
  await db
    .insert(userVoices)
    .values({ id: newId('vox'), ...voice })
    .onConflictDoUpdate({
      target: [userVoices.profileId, userVoices.bodyKey],
      set: { resolvedAt: null, createdAt: sql`excluded.created_at` },
      setWhere: isNotNull(userVoices.resolvedAt),
    });
}

export type VoiceListQuery = {
  status: 'open' | 'all';
  kind?: VoiceKind | undefined;
  profile?: string | undefined;
  before?: string | undefined;
  limit: number;
};

/**
 * 운영 목록 한 쪽(최신순 limit+1개로 더 보기를 판단). linked는 구글 · 애플 로그인 구단주인지다. 쿼리 계획 테스트도 이것을 본다.
 * 더 보기 커서는 created_at 하나다. 같은 밀리초에 받은 두 건이 쪽 경계에 걸리면 뒤 건이 빠질 수 있지만, 들어오는 양(프로필당
 * 시간 5건)으로는 드물어 인덱스를 늘리지 않고 둔다.
 */
export const voiceListQuery = (db: Db, q: VoiceListQuery) =>
  db
    .select({
      id: userVoices.id,
      kind: userVoices.kind,
      body: userVoices.body,
      screen: userVoices.screen,
      platform: userVoices.platform,
      version: userVoices.appVersion,
      device: userVoices.device,
      lang: userVoices.lang,
      createdAt: userVoices.createdAt,
      resolvedAt: userVoices.resolvedAt,
      profileId: userVoices.profileId,
      linked: sql<number>`CASE WHEN ${accountLinkedSql()} THEN 1 ELSE 0 END`,
    })
    .from(userVoices)
    .leftJoin(profiles, eq(profiles.id, userVoices.profileId))
    .where(
      and(
        q.status === 'open' ? isNull(userVoices.resolvedAt) : undefined,
        q.kind ? eq(userVoices.kind, q.kind) : undefined,
        q.profile ? eq(userVoices.profileId, q.profile) : undefined,
        q.before ? lt(userVoices.createdAt, q.before) : undefined,
      ),
    )
    .orderBy(desc(userVoices.createdAt))
    .limit(q.limit + 1);

/** 필터와 상관없는 전체 열린 건수. */
export const openVoiceCountQuery = (db: Db) =>
  db.select({ n: count() }).from(userVoices).where(isNull(userVoices.resolvedAt));

/**
 * 운영 목록과 열린 건수를 한 번의 batch로 읽는다. 열린 목록 · 열린 건수는 user_voices_open_idx, 전체 목록은
 * user_voices_created_idx를 쓴다.
 */
export async function listVoices(db: Db, q: VoiceListQuery): Promise<AdminVoiceList> {
  const [rows, [open]] = await db.batch([voiceListQuery(db, q), openVoiceCountQuery(db)]);
  return {
    items: rows.slice(0, q.limit).map((r) => ({ ...r, linked: r.linked === 1 })),
    hasMore: rows.length > q.limit,
    open: open?.n ?? 0,
  };
}

/**
 * 처리(resolved) 또는 다시 열기. 상태가 실제로 바뀌는 의견만 고치고(처리한 시각을 덮지 않는다) 그 수를 돌려준다. 없는 id는
 * 건너뛴다. ids는 VOICE_RESOLVE_MAX(50)개까지라 D1 바인딩 100개 한도 안이다.
 */
export async function resolveVoices(
  db: Db,
  ids: string[],
  resolved: boolean,
  now: string,
): Promise<number> {
  const res = await db
    .update(userVoices)
    .set({ resolvedAt: resolved ? now : null })
    .where(
      and(
        inArray(userVoices.id, ids),
        resolved ? isNull(userVoices.resolvedAt) : isNotNull(userVoices.resolvedAt),
      ),
    );
  return res.meta.changes;
}

/** 계정 삭제 batch(profile/delete-profile.ts)에 넣는다. 고유 인덱스(profile_id, body_key)로 찾는다. */
export const deleteVoicesStatement = (db: Db, profileId: string) =>
  db.delete(userVoices).where(eq(userVoices.profileId, profileId));
