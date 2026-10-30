import type { AdminComment, AdminStats } from '@offside/contracts';
import { and, desc, eq, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from '../client.js';
import { DAY_MS, kstDays } from '../../time.js';
import { insertAuditLog } from './auditLog.js';
import { accountLinkedSql } from './profiles.js';
import {
  auditLog,
  boardCommentReports,
  boardComments,
  boardPosts,
  careers,
  ownerTeams,
  profiles,
  teamCommentReports,
  teamComments,
} from '../schema.js';
import { adminTeamCommentColumns } from './teamComments.js';

// T-10-016 운영 도구. 관리자만 드물게 여는 화면이라 집계는 테이블을 한 번씩 훑는다(쿼리당 한 번,
// 한 번의 D1 왕복으로 묶는다). 라우트가 결과를 60초 엣지 캐시에 둔다.
const DAILY_DAYS = 14;
const AUDIT_RECENT = 10;

const n = (v: unknown) => Number(v ?? 0);
// D1 batch는 결과 행을 컬럼 이름으로 옮긴다 — 식이 같은 텍스트면(파라미터만 다른 sum 등) 서로 덮어쓰므로
// 계산 컬럼에는 모두 별칭을 붙인다.
const count = (as: string) => sql<number>`count(*)`.as(as);
const sumOf = (cond: SQL, as: string) => sql<number>`coalesce(sum(${cond}), 0)`.as(as);
const since = (col: SQLiteColumn, iso: string, as: string) => sumOf(sql`${col} >= ${iso}`, as);
/** SQL에서 UTC ISO → KST 날짜(YYYY-MM-DD). */
const kstDaySql = (col: SQLiteColumn) =>
  sql<string>`substr(datetime(${col}, '+9 hours'), 1, 10)`.as('day');

export async function getAdminStats(db: Db, now: Date): Promise<Omit<AdminStats, 'balance'>> {
  const t24 = new Date(now.getTime() - DAY_MS).toISOString();
  const t7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const { days, startIso } = kstDays(now, DAILY_DAYS);

  const [p, cs, c7, r7, b, dailyProfiles, dailyCareers, dailyRetired, audit] = await db.batch([
    db
      .select({
        total: count('total'),
        linked: sumOf(sql`${accountLinkedSql()}`, 'linked'),
        new24h: since(profiles.createdAt, t24, 'new24h'),
        new7d: since(profiles.createdAt, t7, 'new7d'),
        active24h: since(profiles.lastSeenAt, t24, 'active24h'),
        active7d: since(profiles.lastSeenAt, t7, 'active7d'),
      })
      .from(profiles)
      .where(isNull(profiles.deletedAt)),
    // T-11-490 커리어(약 26만 행)는 표를 통째로 훑으면 1.5초 동안 D1 줄을 막는다 — 상태별 수는 상태 인덱스만,
    // 최근 7일은 생성 · 은퇴 시각 인덱스 범위로 읽는다(합 0.2초).
    db
      .select({ status: careers.status, n: count('n') })
      .from(careers)
      .groupBy(careers.status),
    db
      .select({ n: count('n') })
      .from(careers)
      .where(sql`${careers.createdAt} >= ${t7}`),
    db
      .select({ n: count('n') })
      .from(careers)
      .where(and(eq(careers.status, 'retired'), sql`${careers.retiredAt} >= ${t7}`)),
    db
      .select({
        posts: sql<number>`(SELECT count(*) FROM board_posts WHERE deleted_at IS NULL)`.as('posts'),
        comments: count('comments'),
        comments7d: since(boardComments.createdAt, t7, 'comments7d'),
      })
      .from(boardComments)
      .where(isNull(boardComments.deletedAt)),
    db
      .select({ day: kstDaySql(profiles.createdAt), n: count('n') })
      .from(profiles)
      .where(sql`${profiles.createdAt} >= ${startIso}`)
      .groupBy(sql`1`),
    db
      .select({ day: kstDaySql(careers.createdAt), n: count('n') })
      .from(careers)
      .where(sql`${careers.createdAt} >= ${startIso}`)
      .groupBy(sql`1`),
    db
      .select({ day: kstDaySql(careers.retiredAt), n: count('n') })
      .from(careers)
      .where(and(eq(careers.status, 'retired'), sql`${careers.retiredAt} >= ${startIso}`))
      .groupBy(sql`1`),
    db
      .select({ kind: auditLog.kind, createdAt: auditLog.createdAt })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(AUDIT_RECENT),
  ]);

  const byDay = (rows: { day: string; n: number }[]) => new Map(rows.map((r) => [r.day, n(r.n)]));
  const [dp, dc, dr] = [byDay(dailyProfiles), byDay(dailyCareers), byDay(dailyRetired)];
  const statusN = new Map(cs.map((r) => [r.status, n(r.n)]));
  const byStatus = { active: statusN.get('active') ?? 0, retired: statusN.get('retired') ?? 0 };
  const num = <T extends Record<string, unknown>>(row: T | undefined) =>
    Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, n(v)])) as {
      [K in keyof T]: number;
    };
  return {
    generatedAt: now.toISOString(),
    profiles: num(p[0]),
    careers: {
      total: byStatus.active + byStatus.retired,
      active: byStatus.active,
      retired: byStatus.retired,
      new7d: n(c7[0]?.n),
      retired7d: n(r7[0]?.n),
    },
    board: num(b[0]),
    daily: days.map((day) => ({
      day,
      profiles: dp.get(day) ?? 0,
      careers: dc.get(day) ?? 0,
      retired: dr.get(day) ?? 0,
    })),
    audit,
  };
}

/** 전체 게시판의 최근 댓글(지운 것 제외), 최신부터. profileId를 주면 그 작성자 것만, reported면 신고된 것만.
 *  댓글마다 받은 신고 수를 붙인다. */
export async function listRecentComments(
  db: Db,
  q: {
    limit: number;
    before?: string | undefined;
    profile?: string | undefined;
    reported?: boolean | undefined;
  },
) {
  const reports = db
    .select({ commentId: boardCommentReports.commentId, n: count('n') })
    .from(boardCommentReports)
    .groupBy(boardCommentReports.commentId)
    .as('reports');
  const teamReports = db
    .select({ commentId: teamCommentReports.commentId, n: count('n') })
    .from(teamCommentReports)
    .groupBy(teamCommentReports.commentId)
    .as('team_reports');
  // T-11-290 게시판 댓글과 팀 프로필 댓글을 한 목록으로(각각 limit+1개씩 읽어 최신순으로 합친다).
  const [boardRows, teamRows] = await Promise.all([
    db
      .select({
        id: boardComments.id,
        postId: boardComments.postId,
        postTitle: boardPosts.title,
        board: boardPosts.board,
        profileId: boardComments.profileId,
        nickname: boardComments.nickname,
        body: boardComments.body,
        admin: boardComments.admin,
        reports: sql<number>`coalesce(${reports.n}, 0)`.as('reports'),
        createdAt: boardComments.createdAt,
      })
      .from(boardComments)
      .innerJoin(boardPosts, eq(boardPosts.id, boardComments.postId))
      .leftJoin(reports, eq(reports.commentId, boardComments.id))
      .where(
        and(
          isNull(boardComments.deletedAt),
          q.before ? lt(boardComments.createdAt, q.before) : undefined,
          q.profile ? eq(boardComments.profileId, q.profile) : undefined,
          q.reported ? isNotNull(reports.commentId) : undefined,
        ),
      )
      .orderBy(desc(boardComments.createdAt))
      .limit(q.limit + 1),
    db
      .select({
        ...adminTeamCommentColumns,
        board: sql<'team'>`'team'`.as('board'),
        reports: sql<number>`coalesce(${teamReports.n}, 0)`.as('reports'),
      })
      .from(teamComments)
      .innerJoin(ownerTeams, eq(ownerTeams.id, teamComments.teamId))
      .leftJoin(teamReports, eq(teamReports.commentId, teamComments.id))
      .where(
        and(
          isNull(teamComments.deletedAt),
          q.before ? lt(teamComments.createdAt, q.before) : undefined,
          q.profile ? eq(teamComments.profileId, q.profile) : undefined,
          q.reported ? isNotNull(teamReports.commentId) : undefined,
        ),
      )
      .orderBy(desc(teamComments.createdAt))
      .limit(q.limit + 1),
  ]);
  const rows = [...boardRows, ...teamRows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { comments: rows.slice(0, q.limit) as AdminComment[], hasMore: rows.length > q.limit };
}

/** 한 작성자의 댓글을 모두 지우고(deleted_at) 감사 로그를 남긴다. 지운 개수를 돌려준다. */
export async function purgeCommentsBy(
  db: Db,
  target: string,
  adminProfileId: string,
  now: string,
): Promise<number> {
  const [res, teamRes] = await Promise.all([
    db
      .update(boardComments)
      .set({ deletedAt: now })
      .where(and(eq(boardComments.profileId, target), isNull(boardComments.deletedAt))),
    db
      .update(teamComments)
      .set({ deletedAt: now })
      .where(and(eq(teamComments.profileId, target), isNull(teamComments.deletedAt))),
  ]);
  const deleted = res.meta.changes + teamRes.meta.changes;
  if (deleted > 0) {
    await insertAuditLog(db, {
      kind: 'COMMENTS_PURGED',
      profileId: adminProfileId,
      payload: { target, deleted },
      createdAt: now,
    });
  }
  return deleted;
}
