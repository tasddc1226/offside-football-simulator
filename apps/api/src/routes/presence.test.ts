import { successEnvelope, LivePresenceSchema, ProfileSchema } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { sha256Hex } from '../db/hash.js';
import { createSession } from '../db/repos/sessions.js';
import { sessions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function extractSessionToken(setCookie: string): string {
  const token = /offside_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error('Set-Cookie에 offside_session이 없습니다.');
  return token;
}

/** careers.test.ts와 같은 패턴: `GET /v1/profile`을 쿠키 없이 부르면 프로필·세션이 새로 발급된다. */
async function issueCookie(ctx: TestD1): Promise<{ profileId: string; cookie: string }> {
  const app = createApp();
  const res = await app.request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { profileId: body.data.id, cookie: `offside_session=${token}` };
}

/** 같은 프로필의 두 번째 세션(예: 다른 탭)을 직접 만든다 — `GET /v1/profile`은 기존 세션을 재사용한다. */
async function issueExtraSession(ctx: TestD1, profileId: string): Promise<{ sessionId: string; cookie: string }> {
  const token = crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  const record = await createSession(ctx.db, {
    profileId,
    channel: 'web',
    tokenHash,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  return { sessionId: record.id, cookie: `offside_session=${token}` };
}

function heartbeatInit(cookie?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ALLOWED_ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: '{}',
  };
}

describe('presence (API-PRES-001·002, D-78)', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('세션이 없으면 GET /v1/presence는 playingNow 0을 돌려준다', async () => {
    const app = createApp();
    const res = await app.request('/v1/presence', {}, ctx.env);
    expect(res.status).toBe(200);
    const body = successEnvelope(LivePresenceSchema).parse(await res.json());
    expect(body.data.playingNow).toBe(0);
    expect(body.data.windowMinutes).toBe(5);
  });

  it('하트비트를 보낸 세션의 프로필 수를 중복 없이 센다', async () => {
    const app = createApp();
    const profileA = await issueCookie(ctx);
    const profileAExtra = await issueExtraSession(ctx, profileA.profileId);
    const profileB = await issueCookie(ctx);

    for (const cookie of [profileA.cookie, profileAExtra.cookie, profileB.cookie]) {
      const res = await app.request('/v1/presence/heartbeat', heartbeatInit(cookie), ctx.env);
      expect(res.status).toBe(204);
    }

    const res = await app.request('/v1/presence', {}, ctx.env);
    const body = successEnvelope(LivePresenceSchema).parse(await res.json());
    expect(body.data.playingNow).toBe(2);
  });

  it('6분 전 활동한 세션은 집계에서 빠지고, 세션 없는 POST는 행을 바꾸지 않고 204를 준다', async () => {
    const app = createApp();
    const profile = await issueCookie(ctx);
    const extra = await issueExtraSession(ctx, profile.profileId);
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    await ctx.db.update(sessions).set({ lastSeenAt: sixMinAgo }).where(eq(sessions.id, extra.sessionId));

    const beforeCount = (await ctx.db.select().from(sessions)).length;

    const noSessionRes = await app.request('/v1/presence/heartbeat', heartbeatInit(), ctx.env);
    expect(noSessionRes.status).toBe(204);

    const afterCount = (await ctx.db.select().from(sessions)).length;
    expect(afterCount).toBe(beforeCount);

    const res = await app.request('/v1/presence', {}, ctx.env);
    const body = successEnvelope(LivePresenceSchema).parse(await res.json());
    // profile의 첫 세션은 issueCookie가 방금 만들어 last_seen_at이 지금이라 여전히 잡힌다.
    expect(body.data.playingNow).toBe(1);
  });
});
