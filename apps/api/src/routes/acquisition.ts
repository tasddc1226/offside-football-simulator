import type { Hono } from 'hono';
import {
  ACQUISITION_CONSENT_VERSION,
  ACQUISITION_SESSION_MS,
  campaignQuery,
} from '@offside/contracts/acquisition';
import { requireAdmin } from '../auth/admin.js';
import { getDb, type AppEnv } from '../env.js';
import { requireProfile, getSessionOrThrow } from '../middleware/requireProfile.js';
import { enforceLimit, clientIp, nowIso } from './shared.js';
import { acquisitionReport } from '../db/repos/acquisition.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function registerAcquisitionRoutes(app: Hono<AppEnv>) {
  app.get('/v1/acquisition/consent', requireProfile, async (c) => {
    c.header('Cache-Control', 'private, no-store');
    const profileId = getSessionOrThrow(c).profileId;
    const row = await c.env.DB.prepare(
      'SELECT version FROM acquisition_consents WHERE profile_id=?',
    )
      .bind(profileId)
      .first<{ version: string }>();
    return c.json({
      data: { profileId, granted: row?.version === ACQUISITION_CONSENT_VERSION },
      meta: { requestId: c.get('requestId') },
    });
  });
  app.post('/v1/acquisition', requireProfile, async (c) => {
    c.header('Cache-Control', 'private, no-store');
    let body: Record<string, unknown> | null;
    try {
      body = JSON.parse(c.get('rawBody') || 'null') as Record<string, unknown> | null;
    } catch {
      return c.body(null, 400);
    }
    if (!body || typeof body !== 'object') return c.body(null, 400);
    const profileId = getSessionOrThrow(c).profileId;
    const db = c.env.DB;
    const now = nowIso();
    if (body.action === 'revoke') {
      // A queued withdrawal may never delete another account's records after a switch.
      if (body.profileId !== profileId) return c.body(null, 409);
      await db.batch([
        db.prepare('DELETE FROM acquisition_consents WHERE profile_id=?').bind(profileId),
        db.prepare('DELETE FROM acquisition_sessions WHERE profile_id=?').bind(profileId),
      ]);
      return c.body(null, 204);
    }
    if (c.env.ACQUISITION_ENABLED !== '1') return c.body(null, 503);
    if (body.version !== ACQUISITION_CONSENT_VERSION) return c.body(null, 400);
    if (body.profileId !== undefined && body.profileId !== profileId) return c.body(null, 409);
    if (body.action === 'grant') {
      await db
        .prepare(
          'INSERT INTO acquisition_consents (profile_id, version, granted_at) VALUES (?,?,?) ON CONFLICT (profile_id) DO UPDATE SET version=excluded.version, granted_at=excluded.granted_at',
        )
        .bind(profileId, ACQUISITION_CONSENT_VERSION, now)
        .run();
      return c.json({ profileId, granted: true });
    }
    if (
      !['session', 'start', 'store_click'].includes(String(body.action)) ||
      typeof body.sessionId !== 'string' ||
      !uuid.test(body.sessionId) ||
      typeof body.campaign !== 'string' ||
      body.campaign.length > 256
    )
      return c.body(null, 400);
    const campaign = campaignQuery(`https://offside.invalid/${body.campaign}`);
    if (body.campaign !== campaign) return c.body(null, 400);
    await enforceLimit(getDb(c), 'ACQUISITION', clientIp(c), 120, now, 'RATE_LIMITED');
    const cutoff = new Date(Date.parse(now) - ACQUISITION_SESSION_MS).toISOString();
    // Grant and insert share a transaction; withdrawal cannot race an already-authorized read.
    // Existing session ownership/campaign/time are immutable. Account switches must start a new session.
    const result = await db
      .prepare(
        `INSERT INTO acquisition_sessions (id, profile_id, campaign, received_at, linked_at, started_at, store_clicked_at)
      SELECT ?1, p.id, ?2, ?3, CASE WHEN p.google_sub IS NOT NULL OR p.apple_sub IS NOT NULL THEN ?3 END,
        CASE WHEN ?4='start' THEN ?3 END, CASE WHEN ?4='store_click' THEN ?3 END
      FROM profiles p JOIN acquisition_consents c ON c.profile_id=p.id WHERE p.id=?5 AND c.version=?6
      ON CONFLICT(id) DO UPDATE SET
        linked_at=coalesce(acquisition_sessions.linked_at, excluded.linked_at),
        started_at=coalesce(acquisition_sessions.started_at, excluded.started_at),
        store_clicked_at=coalesce(acquisition_sessions.store_clicked_at, excluded.store_clicked_at)
      WHERE acquisition_sessions.profile_id=excluded.profile_id AND acquisition_sessions.campaign=excluded.campaign
        AND acquisition_sessions.received_at>=?7
        AND EXISTS(SELECT 1 FROM acquisition_consents WHERE profile_id=?5 AND version=?6)
      RETURNING id`,
      )
      .bind(
        body.sessionId,
        campaign,
        now,
        body.action,
        profileId,
        ACQUISITION_CONSENT_VERSION,
        cutoff,
      )
      .first();
    return c.body(null, result ? 204 : 409);
  });
  app.get('/v1/admin/acquisition', async (c) => {
    await requireAdmin(c);
    c.header('Cache-Control', 'private, no-store');
    const start = c.req.query('start') ?? '';
    const end = c.req.query('end') ?? '';
    const iso = (s: string) =>
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString() === s;
    if (
      !iso(start) ||
      !iso(end) ||
      start >= end ||
      Date.parse(end) - Date.parse(start) > 93 * 86400_000
    )
      return c.body(null, 400);
    const model = c.req.query('model') ?? 'last';
    if (model !== 'last' && model !== 'first') return c.body(null, 400);
    return c.json(await acquisitionReport(c.env.DB, start, end, model));
  });
}
