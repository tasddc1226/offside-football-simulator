// T-11-128 구단주 티어(시즌 휘장) — 가장 최근에 끝난 시즌의 결산(owner_season_records) 순위로 정한다(ownerTierOf).
// 프로필 · 댓글 · 채팅이 같이 쓴다. 그 시즌을 아직 굳히는 중이면 티어가 없다(굳히면 바로 붙는다).
import type { OwnerTierTag } from '@offside/contracts';
import { ownerTierOf } from '@offside/contracts/owner-tier';
import { lastClosedSeason } from '@offside/contracts/service-seasons';
import { and, eq, inArray } from 'drizzle-orm';
import { closeStateOf } from '../../team/seasonClose.js';
import type { Db } from '../client.js';
import { ownerSeasonRecords as r } from '../schema.js';

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
  if (state?.step !== 'done' || !state.ranked) return out;
  const { ranked } = state;
  // D1 바인딩 한도(100) 안에서 나눠 읽는다(댓글은 한 글에 200개까지).
  const chunks = Array.from({ length: Math.ceil(ids.length / 90) }, (_, i) =>
    ids.slice(i * 90, i * 90 + 90),
  );
  const rows = (
    await Promise.all(
      chunks.map((chunk) =>
        db
          .select({
            profileId: r.profileId,
            achRank: r.achRank,
            teamRank: r.teamRank,
            hofRank: r.hofRank,
            retired: r.retired,
            retiredNumbers: r.retiredNumbers,
            wallOfHonor: r.wallOfHonor,
            firsts: r.firsts,
          })
          .from(r)
          .where(and(inArray(r.profileId, chunk), eq(r.season, season))),
      ),
    )
  ).flat();
  for (const row of rows) {
    const tier = ownerTierOf({
      ranks: [
        { rank: row.achRank, ranked: ranked.ach },
        { rank: row.teamRank, ranked: ranked.team },
        { rank: row.hofRank, ranked: ranked.hof },
      ],
      retired: row.retired,
      legacy: row.retiredNumbers + row.wallOfHonor + row.firsts,
    });
    out.set(row.profileId, { tier, season });
  }
  return out;
}

export const ownerTierOfProfile = async (db: Db, profileId: string, now: string) =>
  (await ownerTiersOf(db, [profileId], now)).get(profileId) ?? null;
