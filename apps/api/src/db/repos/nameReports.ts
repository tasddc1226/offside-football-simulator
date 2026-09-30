import type { AdminNameReport } from '@offside/contracts';
import {
  HIDDEN_MANAGER_NAME,
  HIDDEN_TEAM_NAME,
  type NameReportKind,
} from '@offside/contracts/board-limits';
import { and, count, desc, eq, inArray, isNull, max, or } from 'drizzle-orm';
import type { Db } from '../client.js';
import { insertAuditLog } from './auditLog.js';
import { runBatch } from './batch.js';
import { careers, nameReports, ownerTeams } from '../schema.js';

// 공개 이름 신고(앱스토어 UGC 정책). 명예의 전당 선수 이름과 구단 이름·감독 이름을 신고받아 운영자가 가리거나
// 기각한다. 선수 이름은 careers.name_hidden_at을 남겨 시즌·은퇴 업로드가 다시 채우지 않게 하고, 구단은 이름을
// 바꿔 둔다(구단주가 다시 고칠 수 있다).

export type NameTarget = { ownerId: string; name: string; season?: number };

/** 신고할 수 있는 대상과 지금 보이는 이름. 없거나 이름이 공개되지 않았으면 null. */
export async function getNameTarget(
  db: Db,
  kind: NameReportKind,
  id: string,
): Promise<NameTarget | null> {
  if (kind === 'career') {
    const [row] = await db
      .select({ ownerId: careers.profileId, name: careers.publicName })
      .from(careers)
      .where(eq(careers.id, id))
      .limit(1);
    return row?.name ? { ownerId: row.ownerId, name: row.name } : null;
  }
  const [row] = await db
    .select({
      ownerId: ownerTeams.profileId,
      name: ownerTeams.name,
      manager: ownerTeams.manager,
      season: ownerTeams.season,
    })
    .from(ownerTeams)
    .where(eq(ownerTeams.id, id))
    .limit(1);
  return row
    ? { ownerId: row.ownerId, name: teamLabel(row.name, row.manager), season: row.season }
    : null;
}

const teamLabel = (name: string, manager: string) => (manager ? `${name} · ${manager}` : name);

/** 한 사람이 대상 하나에 한 줄. 처리된 신고를 다시 하면 다시 열린다. */
export async function reportName(
  db: Db,
  input: { kind: NameReportKind; targetId: string; profileId: string; name: string },
  now: string,
): Promise<void> {
  await db
    .insert(nameReports)
    .values({ ...input, createdAt: now })
    .onConflictDoUpdate({
      target: [nameReports.kind, nameReports.targetId, nameReports.profileId],
      set: { name: input.name, createdAt: now, resolvedAt: null },
    });
}

const OPEN_LIMIT = 100;

/** 처리를 기다리는 신고 — 대상마다 한 줄, 최근 신고 순. */
export async function listOpenNameReports(db: Db): Promise<AdminNameReport[]> {
  const lastAt = max(nameReports.createdAt);
  const rows = await db
    .select({
      kind: nameReports.kind,
      targetId: nameReports.targetId,
      reports: count(),
      lastReportedAt: lastAt,
    })
    .from(nameReports)
    .where(isNull(nameReports.resolvedAt))
    .groupBy(nameReports.kind, nameReports.targetId)
    .orderBy(desc(lastAt))
    .limit(OPEN_LIMIT);
  const ids = (kind: NameReportKind) => rows.filter((r) => r.kind === kind).map((r) => r.targetId);
  const careerIds = ids('career');
  const teamIds = ids('team');
  const [careerNames, teamNames] = await Promise.all([
    careerIds.length
      ? db
          .select({ id: careers.id, name: careers.publicName })
          .from(careers)
          .where(inArray(careers.id, careerIds))
      : [],
    teamIds.length
      ? db
          .select({ id: ownerTeams.id, name: ownerTeams.name, manager: ownerTeams.manager })
          .from(ownerTeams)
          .where(inArray(ownerTeams.id, teamIds))
      : [],
  ]);
  const names = new Map<string, string | null>([
    ...careerNames.map((r) => [`career:${r.id}`, r.name] as const),
    ...teamNames.map((r) => [`team:${r.id}`, teamLabel(r.name, r.manager)] as const),
  ]);
  return rows.map((r) => ({
    ...r,
    name: names.get(`${r.kind}:${r.targetId}`) ?? null,
    lastReportedAt: r.lastReportedAt ?? '',
  }));
}

/** 신고를 닫는다. hide면 이름을 가린다. 열린 신고가 없으면 false. */
export async function resolveNameReports(
  db: Db,
  input: { kind: NameReportKind; id: string; action: 'hide' | 'dismiss' },
  adminProfileId: string,
  now: string,
): Promise<boolean> {
  const { kind, id, action } = input;
  const open = and(
    eq(nameReports.kind, kind),
    eq(nameReports.targetId, id),
    isNull(nameReports.resolvedAt),
  );
  const [first] = await db
    .select({ name: nameReports.name })
    .from(nameReports)
    .where(open)
    .limit(1);
  if (!first) return false;
  const hide =
    action !== 'hide'
      ? []
      : kind === 'career'
        ? [
            db
              .update(careers)
              .set({ publicName: null, nameHiddenAt: now })
              .where(eq(careers.id, id)),
          ]
        : [
            db
              .update(ownerTeams)
              .set({ name: HIDDEN_TEAM_NAME, manager: HIDDEN_MANAGER_NAME, updatedAt: now })
              .where(eq(ownerTeams.id, id)),
          ];
  await runBatch(db, [...hide, db.update(nameReports).set({ resolvedAt: now }).where(open)]);
  await insertAuditLog(db, {
    kind: 'NAME_REPORT_RESOLVED',
    profileId: adminProfileId,
    payload: { kind, id, action, name: first.name },
    createdAt: now,
  });
  return true;
}

/** 프로필 삭제 batch용 — 그 사람이 한 신고와 그 사람의 선수·구단이 받은 신고를 지운다. 커리어·팀을 지우는
 *  문장보다 먼저 넣는다(대상 id를 그 테이블에서 찾는다). */
export const deleteNameReportsStatement = (db: Db, profileId: string) =>
  db
    .delete(nameReports)
    .where(
      or(
        eq(nameReports.profileId, profileId),
        and(
          eq(nameReports.kind, 'career'),
          inArray(
            nameReports.targetId,
            db.select({ id: careers.id }).from(careers).where(eq(careers.profileId, profileId)),
          ),
        ),
        and(
          eq(nameReports.kind, 'team'),
          inArray(
            nameReports.targetId,
            db
              .select({ id: ownerTeams.id })
              .from(ownerTeams)
              .where(eq(ownerTeams.profileId, profileId)),
          ),
        ),
      ),
    );
