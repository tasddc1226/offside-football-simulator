// T-11-128 구단주 티어 — 가장 최근에 끝난 시즌 마감 때 굳힌 업적 점수(owner_season_records.ach_score)의 업적 등급(ownerTierOf).
// 프로필 · 댓글 · 채팅이 같이 쓴다. 그 시즌을 아직 굳히는 중이면 티어가 없다(굳히면 바로 붙는다).
import type { OwnerTierTag } from '@offside/contracts';
import { ownerTierOf } from '@offside/contracts/owner-tier';
import { lastClosedSeason } from '@offside/contracts/service-seasons';
import { and, eq, inArray, desc, lte, sql } from 'drizzle-orm';
import { closeStateOf } from '../../team/seasonClose.js';
import type { Db } from '../client.js';
import { appMeta, ownerSeasonRecords as r } from '../schema.js';

/** 프로필마다 지난 시즌 티어. 결산 기록이 없는 프로필은 빠진다. */
export async function ownerTiersOf(
  db: Db,
  profileIds: readonly string[],
  now: string,
): Promise<Map<string, OwnerTierTag>> {
  const season = lastClosedSeason(now);
  const ids = [...new Set(profileIds)];
  const out = new Map<string, OwnerTierTag>();
  if (season === null || ids.length === 0) return out;
  const state = await closeStateOf(db, season);
  if (state?.step !== 'done') return out;
  // D1 바인딩 한도(100) 안에서 나눠 읽는다(댓글은 한 글에 200개까지).
  const chunks = Array.from({ length: Math.ceil(ids.length / 90) }, (_, i) =>
    ids.slice(i * 90, i * 90 + 90),
  );
  const rows = (
    await Promise.all(
      chunks.map((chunk) =>
        db
          .select({ profileId: r.profileId, achScore: r.achScore })
          .from(r)
          .where(and(inArray(r.profileId, chunk), eq(r.season, season))),
      ),
    )
  ).flat();
  for (const row of rows) out.set(row.profileId, { tier: ownerTierOf(row.achScore), season });
  return out;
}

export const ownerTierOfProfile = async (db: Db, profileId: string, now: string) =>
  (await ownerTiersOf(db, [profileId], now)).get(profileId) ?? null;

/** Indexed owner+season read with close-state join; no per-season request or query loop. */
export async function ownerTierHistoryOfProfile(
  db: Db,
  profileId: string,
  now: string,
): Promise<OwnerTierTag[]> {
  const last = lastClosedSeason(now);
  if (last === null) return [];
  const rows = await db
    .select({ season: r.season, achScore: r.achScore, state: appMeta.value })
    .from(r)
    .innerJoin(appMeta, eq(appMeta.key, sql`'season-close:' || ${r.season}`))
    .where(and(eq(r.profileId, profileId), lte(r.season, last)))
    .orderBy(desc(r.season));
  return rows.flatMap((row) => {
    try {
      const state: unknown = JSON.parse(row.state);
      if (!state || typeof state !== 'object' || !('step' in state) || state.step !== 'done')
        return [];
      return [{ season: row.season, tier: ownerTierOf(row.achScore) }];
    } catch {
      return [];
    }
  });
}
