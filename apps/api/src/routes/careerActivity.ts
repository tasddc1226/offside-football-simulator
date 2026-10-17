import { reqLang } from '../lang.js';
import { recordCareerReminderOutcome } from '../db/repos/careerReminderOutcome.js';
import { activityErrorText } from '../i18n/ko/careerReminder.js';
import { CareerActivitySchema } from '@offside/contracts';
import type { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { getDb } from '../env.js';
import { requireProfile, getSessionOrThrow } from '../middleware/requireProfile.js';
import { careerOwnerMismatch, enforceLimit, nowIso, readBody } from './shared.js';
import { retryTransientRead, retryTransientWrite } from '../db/retry.js';

export function registerCareerActivityRoutes(app: Hono<AppEnv>) {
  app.put('/v1/career-activity', requireProfile, async (c) => {
    const input = readBody(c, CareerActivitySchema);
    const { profileId } = getSessionOrThrow(c);
    const now = nowIso();
    await enforceLimit(getDb(c), 'CAREER_ACTIVITY', profileId, 60, now, activityErrorText);
    if (input.careerId) {
      const query = c.env.DB.prepare('SELECT profile_id FROM careers WHERE id = ?').bind(
        input.careerId,
      );
      const owner = await retryTransientRead(() => query.first<{ profile_id: string }>());
      if (owner && owner.profile_id !== profileId) throw careerOwnerMismatch();
    }
    const write = c.env.DB.prepare(
      `INSERT INTO career_activity (profile_id,career_id,state,last_active_at,retired_at,lang)
      VALUES (?,?,?,?,CASE WHEN ? = 'retired' THEN ? ELSE NULL END,?)
      ON CONFLICT(profile_id) DO UPDATE SET
        career_id=CASE WHEN career_activity.last_active_at<=excluded.last_active_at THEN excluded.career_id ELSE career_activity.career_id END,
        state=CASE WHEN career_activity.last_active_at<=excluded.last_active_at THEN excluded.state ELSE career_activity.state END,
        lang=CASE WHEN career_activity.last_active_at<=excluded.last_active_at THEN excluded.lang ELSE career_activity.lang END,
        last_active_at=max(career_activity.last_active_at,excluded.last_active_at),
        retired_at=COALESCE(career_activity.retired_at,excluded.retired_at)`,
    ).bind(profileId, input.careerId, input.state, now, input.state, now, reqLang(c));
    await retryTransientWrite(() => write.run());
    if (input.state !== 'none')
      await recordCareerReminderOutcome(c.env.DB, profileId, input.state === 'retired', now);
    // Do not reset the lifetime reminder stage when returning, replacing a player, or reinstalling.
    return c.body(null, 204);
  });
}
