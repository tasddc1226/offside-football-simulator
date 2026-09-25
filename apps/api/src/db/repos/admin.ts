import type { AdminComment, AdminStats } from '@offside/contracts';
import { and, desc, eq, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { auditLog, boardComments, boardPosts, careers, profiles } from '../schema.js';

// T-10-016 운영 도구. 관리자만 드물게 여는 화면이라 집계는 테이블을 한 번씩 훑는다(쿼리당 한 번,
// 한 번의 D1 왕복으로 묶는다). 라우트가 결과를 60초 엣지 캐시에 둔다.
const DAY_MS = 86_400_000;
const DAILY_DAYS = 14;
const AUDIT_RECENT = 10;
const KST_MS = 9 * 3_600_000;

const n = (v: unknown) => Number(v ?? 0);
// D1 batch는 결과 행을 컬럼 이름으로 옮긴다 — 식이 같은 텍스트면(파라미터만 다른 sum 등) 서로 덮어쓰므로
// 계산 컬럼에는 모두 별칭을 붙인다.
const count = (as: string) => sql<number>`count(*)`.as(as);
const sumOf = (cond: SQL, as: string) => sql<number>`coalesce(sum(${cond}), 0)`.as(as);
const since = (col: SQLiteColumn, iso: string, as: string) => sumOf(sql`${col} >= ${iso}`, as);
/** SQL에서 UTC ISO → KST 날짜(YYYY-MM-DD). */
const kstDay = (col: SQLiteColumn) => sql<string>`substr(datetime(${col}, '+9 hours'), 1, 10)`.as('day');

/** now 기준 최근 days일의 KST 날짜(오래된 날부터)와 그 첫날 0시(KST)의 UTC ISO. */
export function kstDays(now: Date, days: number): { days: string[]; startIso: string } {
  const today = new Date(now.getTime() + KST_MS);
  today.setUTCHours(0, 0, 0, 0);
  const list = Array.from({ length: days }, (_, i) => new Date(today.getTime() - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
  return { days: list, startIso: new Date(today.getTime() - (days - 1) * DAY_MS - KST_MS).toISOString() };
}

export async function getAdminStats(db: Db, now: Date): Promise<Omit<AdminStats, 'balance'>> {
  const t24 = new Date(now.getTime() - DAY_MS).toISOString();
  const t7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const { days, startIso } = kstDays(now, DAILY_DAYS);

  const [p, c, b, dailyProfiles, dailyCareers, dailyRetired, audit] = await db.batch([
    db
      .select({
        total: count('total'),
        linked: sumOf(sql`${profiles.googleSub} is not null`, 'linked'),
        new24h: since(profiles.createdAt, t24, 'new24h'),
        new7d: since(profiles.createdAt, t7, 'new7d'),
        active24h: since(profiles.lastSeenAt, t24, 'active24h'),
        active7d: since(profiles.lastSeenAt, t7, 'active7d'),
      })
      .from(profiles)
      .where(isNull(profiles.deletedAt)),
    db
      .select({
        total: count('total'),
        active: sumOf(sql`${careers.status} = 'active'`, 'active'),
        retired: sumOf(sql`${careers.status} = 'retired'`, 'retired'),
        new7d: since(careers.createdAt, t7, 'new7d'),
        retired7d: since(careers.retiredAt, t7, 'retired7d'),
      })
      .from(careers),
    db
      .select({
        posts: sql<number>`(SELECT count(*) FROM board_posts WHERE deleted_at IS NULL)`.as('posts'),
        comments: count('comments'),
        comments7d: since(boardComments.createdAt, t7, 'comments7d'),
      })
      .from(boardComments)
      .where(isNull(boardComments.deletedAt)),
    db
      .select({ day: kstDay(profiles.createdAt), n: count('n') })
      .from(profiles)
      .where(sql`${profiles.createdAt} >= ${startIso}`)
      .groupBy(sql`1`),
    db
      .select({ day: kstDay(careers.createdAt), n: count('n') })
      .from(careers)
      .where(sql`${careers.createdAt} >= ${startIso}`)
      .groupBy(sql`1`),
    db
      .select({ day: kstDay(careers.retiredAt), n: count('n') })
      .from(careers)
      .where(sql`${careers.retiredAt} >= ${startIso}`)
      .groupBy(sql`1`),
    db.select({ kind: auditLog.kind, createdAt: auditLog.createdAt }).from(auditLog).orderBy(desc(auditLog.createdAt)).limit(AUDIT_RECENT),
  ]);

  const byDay = (rows: { day: string; n: number }[]) => new Map(rows.map((r) => [r.day, n(r.n)]));
  const [dp, dc, dr] = [byDay(dailyProfiles), byDay(dailyCareers), byDay(dailyRetired)];
  const num = <T extends Record<string, unknown>>(row: T | undefined) =>
    Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, n(v)])) as { [K in keyof T]: number };
  return {
    generatedAt: now.toISOString(),
    profiles: num(p[0]),
    careers: num(c[0]),
    board: num(b[0]),
    daily: days.map((day) => ({ day, profiles: dp.get(day) ?? 0, careers: dc.get(day) ?? 0, retired: dr.get(day) ?? 0 })),
    audit,
  };
}

/** 전체 게시판의 최근 댓글(지운 것 제외), 최신부터. profileId를 주면 그 작성자 것만. */
export async function listRecentComments(db: Db, q: { limit: number; before?: string | undefined; profile?: string | undefined }) {
  const rows = await db
    .select({
      id: boardComments.id,
      postId: boardComments.postId,
      postTitle: boardPosts.title,
      board: boardPosts.board,
      profileId: boardComments.profileId,
      nickname: boardComments.nickname,
      body: boardComments.body,
      admin: boardComments.admin,
      createdAt: boardComments.createdAt,
    })
    .from(boardComments)
    .innerJoin(boardPosts, eq(boardPosts.id, boardComments.postId))
    .where(
      and(
        isNull(boardComments.deletedAt),
        q.before ? lt(boardComments.createdAt, q.before) : undefined,
        q.profile ? eq(boardComments.profileId, q.profile) : undefined,
      ),
    )
    .orderBy(desc(boardComments.createdAt))
    .limit(q.limit + 1);
  return { comments: rows.slice(0, q.limit) as AdminComment[], hasMore: rows.length > q.limit };
}

/** 한 작성자의 댓글을 모두 지우고(deleted_at) 감사 로그를 남긴다. 지운 개수를 돌려준다. */
export async function purgeCommentsBy(db: Db, target: string, adminProfileId: string, now: string): Promise<number> {
  const res = await db
    .update(boardComments)
    .set({ deletedAt: now })
    .where(and(eq(boardComments.profileId, target), isNull(boardComments.deletedAt)));
  const deleted = res.meta.changes;
  if (deleted > 0) {
    await db.insert(auditLog).values({
      id: newId('aud'),
      kind: 'COMMENTS_PURGED',
      profileId: adminProfileId,
      payloadJson: JSON.stringify({ target, deleted }),
      createdAt: now,
    });
  }
  return deleted;
}
