import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { analyticsEvents } from '../schema.js';

export type InsertAnalyticsEventInput = {
  clientId: string;
  profileId: string | null;
  name: string;
  props: unknown;
  clientTs: number;
  receivedAt: string;
};

/** T-2-012 D-55: 화이트리스트 통과분만 여기 도달한다(라우트가 이미 걸러낸다). */
export async function insertAnalyticsEvents(db: Db, inputs: InsertAnalyticsEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await db.insert(analyticsEvents).values(
    inputs.map((input) => ({
      id: newId('ana'),
      clientId: input.clientId,
      profileId: input.profileId,
      name: input.name,
      propsJson: JSON.stringify(input.props ?? {}),
      clientTs: input.clientTs,
      receivedAt: input.receivedAt,
    })),
  );
}
