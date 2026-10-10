import {
  PERMANENT_TITLES,
  TITLE_CRITERIA_VERSION,
  CAREER_FEATS,
} from '@offside/contracts/owner-title';
import type { TitleMetric } from '@offside/contracts/owner-title';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { ownerTitleAwards, ownerTitleProgress, profiles, careers } from '../schema.js';
import { accountLinkedSql } from './profiles.js';

type Metrics = Record<TitleMetric, number>;

/** Scalar aggregates use careers.profile_id, never the transferable cards.owner_id. */
export async function titleMetricsOf(db: Db, profileId: string): Promise<Metrics> {
  const row = await db.get<Metrics>(sql`
    select
      (select count(*) from careers c where c.profile_id = ${profileId}
       and c.status = 'retired' and c.service_season = 0 and c.hidden = 0) as preseason,
      count(*) as retired, coalesce(sum(peak >= ${CAREER_FEATS.peak}), 0) as elite,
      coalesce(sum(ballon >= 1), 0) as ballon,
      coalesce(sum(pos = 'MF' and peak >= ${CAREER_FEATS.peak}), 0) as midfield,
      coalesce(sum(pos = 'DF' and peak >= ${CAREER_FEATS.peak}), 0) as defense,
      coalesce(sum(pos = 'GK' and peak >= ${CAREER_FEATS.peak}), 0) as keeper,
      coalesce(sum(goals >= ${CAREER_FEATS.goals}), 0) as scorers,
      coalesce(sum(assists >= ${CAREER_FEATS.assists}), 0) as creators,
      coalesce(sum(caps >= ${CAREER_FEATS.caps}), 0) as internationals,
      (select count(*) from retired_numbers r join careers c on c.id = r.career_id
       where c.profile_id = ${profileId} and c.hidden = 0) as numbers,
      (select count(*) from owner_honors h where h.profile_id = ${profileId} and h.kind = 'first') as firsts
    from careers where profile_id = ${profileId} and status = 'retired'
      and hidden = 0 and peak is not null and retire_age >= 30`);
  return row!;
}

/** Idempotent snapshot + award ledger. Pure preview follows exactly the same criteria. */
export async function refreshOwnerTitles(db: Db, profileId: string, now: string, dryRun = false) {
  const [owner] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), accountLinkedSql(), isNull(profiles.deletedAt)));
  if (!owner) return [];
  const [metrics, held] = await Promise.all([
    titleMetricsOf(db, profileId),
    db.select().from(ownerTitleAwards).where(eq(ownerTitleAwards.profileId, profileId)),
  ]);
  const newlyEarned = PERMANENT_TITLES.filter(
    (t) => metrics[t.metric] >= t.target && !held.some((a) => a.titleId === t.id),
  );
  if (!dryRun) {
    // A batch is transactional: progress and awards commit together, including retry/concurrent requests.
    const progress = db
      .insert(ownerTitleProgress)
      .values({ profileId, ...metrics, criteriaVersion: TITLE_CRITERIA_VERSION, updatedAt: now })
      .onConflictDoUpdate({
        target: ownerTitleProgress.profileId,
        set: { ...metrics, criteriaVersion: TITLE_CRITERIA_VERSION, updatedAt: now },
        setWhere: sql`${ownerTitleProgress.updatedAt} <= ${now}`,
      });
    if (newlyEarned.length) {
      const [, granted] = await db.batch([
        progress,
        db
          .insert(ownerTitleAwards)
          .values(
            newlyEarned.map((t) => ({
              profileId,
              titleId: t.id,
              criteriaVersion: TITLE_CRITERIA_VERSION,
              evidence: metrics[t.metric],
              earnedAt: now,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: ownerTitleAwards.titleId }),
      ]);
      return granted.map((a) => a.id);
    } else await progress;
  }
  return newlyEarned.map((t) => t.id);
}

/** Read persisted progress only. Initial private hall entry seeds legacy/newly-linked accounts once. */
export async function permanentTitlesOf(db: Db, profileId: string, now: string) {
  let [progress] = await db
    .select()
    .from(ownerTitleProgress)
    .where(eq(ownerTitleProgress.profileId, profileId));
  // Indexed existence check repairs a retirement whose post-response award task was interrupted.
  const pending = progress
    ? await db
        .select({ id: careers.id })
        .from(careers)
        .where(
          and(
            eq(careers.profileId, profileId),
            eq(careers.status, 'retired'),
            gt(careers.updatedAt, progress.updatedAt),
          ),
        )
        .limit(1)
    : [];
  if (!progress || progress.criteriaVersion !== TITLE_CRITERIA_VERSION || pending.length) {
    await refreshOwnerTitles(db, profileId, now);
    [progress] = await db
      .select()
      .from(ownerTitleProgress)
      .where(eq(ownerTitleProgress.profileId, profileId));
  }
  const held = await db
    .select()
    .from(ownerTitleAwards)
    .where(eq(ownerTitleAwards.profileId, profileId));
  return PERMANENT_TITLES.map((t) => {
    const award = held.find((a) => a.titleId === t.id);
    return {
      id: t.id,
      target: t.target,
      value: Math.max(progress?.[t.metric] ?? 0, award?.evidence ?? 0),
      earnedAt: award?.earnedAt ?? null,
      isNew: !!award && !award.seenAt,
    };
  });
}

/** Bounded admin batch: no background sweep or per-screen full scan. Cursor can be reused after failure. */
export async function backfillOwnerTitles(
  db: Db,
  now: string,
  after: string,
  limit: number,
  dryRun: boolean,
) {
  const owners = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(accountLinkedSql(), isNull(profiles.deletedAt), gt(profiles.id, after)))
    .orderBy(profiles.id)
    .limit(limit);
  const counts: Record<string, number> = {};
  for (const owner of owners) {
    for (const id of await refreshOwnerTitles(db, owner.id, now, dryRun))
      counts[id] = (counts[id] ?? 0) + 1;
  }
  return {
    processed: owners.length,
    next: owners.length === limit ? owners.at(-1)!.id : null,
    counts,
    dryRun,
  };
}

/** Finalized first-record honors are already immutable; issue without per-owner queries. */
export async function grantPioneerTitles(db: Db, now: string) {
  await db.run(sql`insert or ignore into owner_title_awards
    (profile_id, title_id, criteria_version, evidence, earned_at)
    select h.profile_id, 'owner-pioneer', ${TITLE_CRITERIA_VERSION}, count(*), ${now}
    from owner_honors h join profiles p on p.id = h.profile_id
    where h.kind = 'first' and p.deleted_at is null and (p.google_sub is not null or p.apple_sub is not null)
    group by h.profile_id`);
}
