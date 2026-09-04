import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { serviceSeasons } from '../schema.js';

export type ServiceSeasonRecord = typeof serviceSeasons.$inferSelect;

/**
 * T-2-012 D-54: "현재 시즌"은 시간 창이 아니라 `ACTIVE_SERVICE_SEASON_ID` 환경변수가 가리키는
 * id다(포인터 방식 — 09 런북 "ACTIVE 포인터 원자 교체"). 그 행이 없으면 undefined.
 */
export async function getServiceSeasonById(db: Db, id: string): Promise<ServiceSeasonRecord | undefined> {
  const [row] = await db.select().from(serviceSeasons).where(eq(serviceSeasons.id, id)).limit(1);
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
  isTest?: boolean;
};

export async function upsertServiceSeason(db: Db, input: UpsertServiceSeasonInput): Promise<ServiceSeasonRecord> {
  const isTest = (input.isTest ?? false) ? 1 : 0;
  const [row] = await db
    .insert(serviceSeasons)
    .values({ ...input, isTest })
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
        isTest,
      },
    })
    .returning();
  return row!;
}
