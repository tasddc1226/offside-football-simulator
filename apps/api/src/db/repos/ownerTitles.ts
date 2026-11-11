import {
  PERMANENT_TITLES,
  TITLE_CRITERIA_VERSION,
  CAREER_FEATS,
} from '@offside/contracts/owner-title';
import { DEFAULT_NATION } from '@offside/contracts/nations';
import type { PermanentTitleId, TitleMetric } from '@offside/contracts/owner-title';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { ownerTitleAwards, ownerTitleProgress, profiles, careers } from '../schema.js';
import { enhanceRules } from './cardEnhance.js';
import { accountLinkedSql } from './profiles.js';

type Metrics = Record<TitleMetric, number>;
type EnhanceMetric =
  'enhanceTries' | 'enhanceKeeps' | 'enhanceDowns' | 'enhanceNear' | 'enhanceSpent';
type ManagerMetric = 'mgrDone' | 'mgrTitles' | 'mgrPro' | 'mgrLegends';

/** Scalar aggregates use careers.profile_id, never the transferable cards.owner_id.
 * Pin the owner index: the global HOF peak index can otherwise scan every owner's retirees.
 * T-11-556 subqueries read only owner-prefixed indexes (cup_entries_profile_idx, owner_season_records · owner_honors PK).
 * Korean players are stored with a NULL nation, so they count as DEFAULT_NATION.
 * T-11-692 The preseason subquery is pinned too: unpinned, production chose the all-owner careers_hof_count_idx
 * (about 40k rows per call, D1 overload on 2026-11-09). */
export async function titleMetricsOf(db: Db, profileId: string): Promise<Metrics> {
  const [row, enhance, manager] = await Promise.all([
    careerTitleMetricsOf(db, profileId),
    enhanceTitleMetricsOf(db, profileId),
    managerTitleMetricsOf(db, profileId),
  ]);
  return { ...row, ...enhance, ...manager };
}

/** T-11-648 감독 칭호의 재료: 끝낸 감독 결과(manager_careers_profile_idx). 옛 결과에는 v3가 없어 P 자격은 감독 키우기만 센다. */
async function managerTitleMetricsOf(db: Db, profileId: string) {
  const row = await db.get<Record<ManagerMetric, number>>(sql`
    select count(*) as mgrDone,
      coalesce(sum(json_extract(result_json, '$.titles')), 0) as mgrTitles,
      coalesce(sum(json_extract(result_json, '$.v3.license') = 'P'), 0) as mgrPro,
      coalesce(sum(json_extract(result_json, '$.ending') = 'legend'), 0) as mgrLegends
    from manager_careers where profile_id = ${profileId} and status = 'done'
      and result_json is not null`);
  return row!;
}

const MANAGER_TITLES = PERMANENT_TITLES.filter((t) => t.category === 'manager');

/** T-11-648 감독 커리어를 끝낸 뒤 새로 닿은 감독 칭호를 준다(강화 칭호와 같은 방식, 실패해도 감독 결과는 그대로). */
export async function managerTitlesAfter(db: Db, profileId: string, now: string) {
  try {
    const m = await managerTitleMetricsOf(db, profileId);
    const reached = MANAGER_TITLES.filter((t) => m[t.metric as ManagerMetric] >= t.target);
    if (!reached.length) return [];
    const held = await db
      .select({ id: ownerTitleAwards.titleId })
      .from(ownerTitleAwards)
      .where(eq(ownerTitleAwards.profileId, profileId));
    if (reached.every((t) => held.some((a) => a.id === t.id))) return [];
    return await refreshOwnerTitles(db, profileId, now);
  } catch {
    return [];
  }
}

/** T-11-373 카드 강화 칭호의 재료(card_enhance_log_profile_idx). 카드를 팔아도 내가 시도한 기록은 그대로 센다. */
async function enhanceTitleMetricsOf(db: Db, profileId: string) {
  const row = await db.get<Record<EnhanceMetric, number>>(sql`
    select count(*) as enhanceTries,
      coalesce(sum(success = 0 and to_level = from_level), 0) as enhanceKeeps,
      coalesce(sum(to_level < from_level), 0) as enhanceDowns,
      coalesce(sum(from_level = 9 and to_level = 8), 0) as enhanceNear,
      coalesce(sum(cost), 0) / 10000 as enhanceSpent
    from card_enhance_log where profile_id = ${profileId}`);
  return row!;
}

const ENHANCE_TITLES = PERMANENT_TITLES.filter((t) => t.category === 'enhance');

/**
 * 강화 시도 뒤 새로 닿은 칭호를 준다. 대개는 집계 한 번으로 끝나고, 목표를 넘은 칭호가 있을 때만 받은 기록을 읽는다. 칭호가
 * 실패해도 시도 결과는 돌려준다 — 하루 한 번 명예관 재집계(TITLE_PROGRESS_TTL_MS)가 놓친 칭호를 준다.
 */
export async function enhanceTitlesAfter(db: Db, profileId: string, now: string) {
  try {
    const m = await enhanceTitleMetricsOf(db, profileId);
    const reached = ENHANCE_TITLES.filter((t) => m[t.metric as EnhanceMetric] >= t.target);
    if (!reached.length) return [];
    const held = await db
      .select({ id: ownerTitleAwards.titleId })
      .from(ownerTitleAwards)
      .where(eq(ownerTitleAwards.profileId, profileId));
    if (reached.every((t) => held.some((a) => a.id === t.id))) return [];
    return await refreshOwnerTitles(db, profileId, now);
  } catch {
    return [];
  }
}

async function careerTitleMetricsOf(db: Db, profileId: string) {
  const row = await db.get<Omit<Metrics, EnhanceMetric | ManagerMetric>>(sql`
    select
      (select count(*) from careers c INDEXED BY careers_profile_status_season_idx
       where c.profile_id = ${profileId}
       and c.status = 'retired' and c.service_season = 0 and c.hidden = 0) as preseason,
      count(*) as retired, coalesce(sum(peak >= ${CAREER_FEATS.peak}), 0) as elite,
      coalesce(sum(ballon >= 1), 0) as ballon,
      coalesce(sum(pos = 'MF' and peak >= ${CAREER_FEATS.peak}), 0) as midfield,
      coalesce(sum(pos = 'DF' and peak >= ${CAREER_FEATS.peak}), 0) as defense,
      coalesce(sum(pos = 'GK' and peak >= ${CAREER_FEATS.peak}), 0) as keeper,
      coalesce(sum(pos = 'FW' and peak >= ${CAREER_FEATS.peak}), 0) as forwards,
      count(distinct case when peak >= ${CAREER_FEATS.peak} then pos end) as positions,
      count(distinct coalesce(nullif(nation, ''), ${DEFAULT_NATION})) as nations,
      coalesce(sum(goals >= ${CAREER_FEATS.goals}), 0) as scorers,
      coalesce(sum(assists >= ${CAREER_FEATS.assists}), 0) as creators,
      coalesce(sum(caps >= ${CAREER_FEATS.caps}), 0) as internationals,
      (select count(*) from retired_numbers r join careers c on c.id = r.career_id
       where c.profile_id = ${profileId} and c.hidden = 0) as numbers,
      (select count(*) from owner_honors h where h.profile_id = ${profileId} and h.kind = 'first') as firsts,
      (select count(*) from card_exchange_claims x
       where x.profile_id = ${profileId} and x.reward_json <> '') as exchanges,
      (select count(*) from cup_entries e where e.profile_id = ${profileId}
       and e.stage is not null) as cups,
      (select count(*) from cup_entries e where e.profile_id = ${profileId}
       and e.stage in ('champion', 'runnerup', 'sf')) as podiums,
      (select count(*) from owner_season_records s where s.profile_id = ${profileId}
       and s.retired > 0) as seasons,
      (select coalesce(max(h.value), 0) from owner_honors h where h.profile_id = ${profileId}
       and h.kind = 'division') as division
    from careers INDEXED BY careers_profile_status_season_idx
    where profile_id = ${profileId} and status = 'retired'
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
      .values({
        profileId,
        metricsJson: JSON.stringify(metrics),
        criteriaVersion: TITLE_CRITERIA_VERSION,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: ownerTitleProgress.profileId,
        set: {
          metricsJson: JSON.stringify(metrics),
          criteriaVersion: TITLE_CRITERIA_VERSION,
          updatedAt: now,
        },
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

/** T-11-556 Team metrics (cups, seasons, division) change without a career write; recount at most once a day on hall open. */
export const TITLE_PROGRESS_TTL_MS = 24 * 60 * 60 * 1000;

/** T-11-661 저장된 진행도(조건별 값). 읽지 못하면 빈 값(모두 0으로 본다). */
export function metricsOf(json: string | null | undefined): Partial<Metrics> {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' ? (v as Partial<Metrics>) : {};
  } catch {
    return {};
  }
}

/** Read persisted progress only. Initial private hall entry seeds legacy/newly-linked accounts once. */
export async function permanentTitlesOf(db: Db, profileId: string, now: string) {
  let [progress] = await db
    .select()
    .from(ownerTitleProgress)
    .where(eq(ownerTitleProgress.profileId, profileId));
  const stale =
    !progress ||
    progress.criteriaVersion !== TITLE_CRITERIA_VERSION ||
    Date.parse(now) - Date.parse(progress.updatedAt) > TITLE_PROGRESS_TTL_MS;
  // Indexed existence check repairs a retirement whose post-response award task was interrupted.
  const pending =
    progress && !stale
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
  if (stale || pending.length) {
    await refreshOwnerTitles(db, profileId, now);
    [progress] = await db
      .select()
      .from(ownerTitleProgress)
      .where(eq(ownerTitleProgress.profileId, profileId));
  }
  const saved = metricsOf(progress?.metricsJson);
  const [held, rules] = await Promise.all([
    db.select().from(ownerTitleAwards).where(eq(ownerTitleAwards.profileId, profileId)),
    enhanceRules(db),
  ]);
  // T-11-373 강화가 닫혀 있으면 아직 받지 않은 강화 칭호는 목표로 보이지 않는다.
  const shown = PERMANENT_TITLES.filter(
    (t) =>
      t.category !== 'enhance' ||
      rules.open ||
      (saved.enhanceTries ?? 0) > 0 ||
      held.some((a) => a.titleId === t.id),
  );
  return shown.map((t) => {
    const award = held.find((a) => a.titleId === t.id);
    return {
      id: t.id,
      target: t.target,
      value: Math.max(saved[t.metric] ?? 0, award?.evidence ?? 0),
      earnedAt: award?.earnedAt ?? null,
      isNew: !!award && !award.seenAt,
    };
  });
}

/** T-11-618 남의 명예관용 받은 칭호(목록 순서). permanentTitlesOf와 달리 진행도를 다시 세지 않아 읽기만 한다. */
export async function earnedPermanentTitleIds(
  db: Db,
  profileId: string,
): Promise<PermanentTitleId[]> {
  const held = await db
    .select({ id: ownerTitleAwards.titleId })
    .from(ownerTitleAwards)
    .where(eq(ownerTitleAwards.profileId, profileId));
  const ids = new Set(held.map((a) => a.id));
  return PERMANENT_TITLES.filter((t) => ids.has(t.id)).map((t) => t.id);
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
