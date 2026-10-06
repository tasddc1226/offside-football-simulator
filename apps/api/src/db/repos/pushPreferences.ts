import {
  DEFAULT_PUSH_PREFERENCES,
  PushPreferencesSchema,
  type PushPreferences,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { pushPreferences } from '../schema.js';
const columns = {
  notice: pushPreferences.notice,
  release: pushPreferences.release,
  team: pushPreferences.team,
  market: pushPreferences.market,
  social: pushPreferences.social,
};

export async function getPushPreferences(db: Db, profileId: string) {
  const [row] = await db
    .select(columns)
    .from(pushPreferences)
    .where(eq(pushPreferences.profileId, profileId));
  return PushPreferencesSchema.parse(row ?? DEFAULT_PUSH_PREFERENCES);
}
export async function putPushPreferences(
  db: Db,
  profileId: string,
  change: { [K in keyof PushPreferences]?: boolean | undefined },
) {
  const [row] = await db
    .insert(pushPreferences)
    .values({ profileId, ...change })
    .onConflictDoUpdate({ target: pushPreferences.profileId, set: change })
    .returning(columns);
  return PushPreferencesSchema.parse(row);
}
