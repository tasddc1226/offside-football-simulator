import type { Hono } from 'hono';
import {
  StrengthHistoryBeforeSchema,
  ClubStrengthSnapshotSchema,
  StrengthHistorySchema,
} from '@offside/contracts/club-strength';
import { requireAdmin, isAdminEmail } from '../auth/admin.js';
import { getProfile } from '../db/repos/profiles.js';
import { edgeCached } from '../edgeCache.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getDb, type AppEnv } from '../env.js';
import { STRENGTH_PATH, readStrengthState, readStrengthHistory } from '../clubStrength/store.js';
import { ok } from './shared.js';
import { reqLang } from '../lang.js';
import { strengthOwnerOnly as ko } from '../i18n/ko/clubStrength.js';
import { strengthOwnerOnly as en } from '../i18n/en/clubStrength.js';
import { strengthOwnerOnly as ja } from '../i18n/ja/clubStrength.js';

export function registerClubStrengthRoutes(app: Hono<AppEnv>): void {
  app.get(STRENGTH_PATH, async (c) => {
    const snapshot = await edgeCached(
      c,
      STRENGTH_PATH,
      60,
      async () => (await readStrengthState(c.env.DB)).snapshot,
    );
    return ok(c, ClubStrengthSnapshotSchema, snapshot);
  });
  app.get('/v1/admin/club-strength', async (c) => {
    const viewer = await requireAdmin(c);
    const emails = (c.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const owner = c.env.CLUB_STRENGTH_OWNER_EMAIL ?? (emails.length === 1 ? emails[0] : undefined);
    const profile = await getProfile(getDb(c), viewer.profileId!);
    if (!owner || owner.includes(',') || !isAdminEmail(owner, profile?.email ?? null))
      throw new AppError({ code: 'FORBIDDEN', message: { ko, en, ja }[reqLang(c)] });
    const before = parseWithAppError(StrengthHistoryBeforeSchema, c.req.query('before'));
    return ok(
      c,
      StrengthHistorySchema,
      await readStrengthHistory(c.env.DB, before),
      200,
      'private, no-store',
    );
  });
}
