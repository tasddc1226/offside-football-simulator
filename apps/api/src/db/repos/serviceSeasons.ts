import { and, eq, lte, gte } from 'drizzle-orm';
import type { Db } from '../client.js';
import { serviceSeasons } from '../schema.js';

export type ServiceSeasonRecord = typeof serviceSeasons.$inferSelect;

/** `status = 'ACTIVE'`이고 기간 안(`startsAt <= now <= endsAt`)인 것 1개. */
export async function getCurrentServiceSeason(db: Db, now: string): Promise<ServiceSeasonRecord | undefined> {
  const [row] = await db
    .select()
    .from(serviceSeasons)
    .where(and(eq(serviceSeasons.status, 'ACTIVE'), lte(serviceSeasons.startsAt, now), gte(serviceSeasons.endsAt, now)))
    .limit(1);
  return row;
}

export type UpsertServiceSeasonInput = {
  id: string;
  name: string;
  status: ServiceSeasonRecord['status'];
  startsAt: string;
  endsAt: string;
  rulesetVersion: string;
  contentPackVersion: string;
  challengeSetId: string;
};

export async function upsertServiceSeason(db: Db, input: UpsertServiceSeasonInput): Promise<ServiceSeasonRecord> {
  const [row] = await db
    .insert(serviceSeasons)
    .values(input)
    .onConflictDoUpdate({
      target: serviceSeasons.id,
      set: {
        name: input.name,
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        rulesetVersion: input.rulesetVersion,
        contentPackVersion: input.contentPackVersion,
        challengeSetId: input.challengeSetId,
      },
    })
    .returning();
  return row!;
}
