import { ErrorEnvelopeSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '../auth/session.js';
import { createApp } from '../app.js';
import { getProfile } from '../db/repos/profiles.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { extractSessionToken, issueCookie, ORIGIN } from '../test/http.js';

function postInit(input: {
  idempotencyKey?: string | null;
  cookie?: string;
  origin?: string | null;
}): RequestInit {
  const { idempotencyKey = 'idem-key-0001', cookie, origin = ORIGIN } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey;
  if (cookie) headers.Cookie = cookie;
  return { method: 'POST', headers, body: '{}' };
}

describe('POST /v1/auth/logout', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('204와 쿠키 제거 헤더, 이후 요청은 401', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request('/v1/auth/logout', postInit({ cookie }), ctx.env);
    expect(res.status).toBe(204);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('offside_session=');
    expect(setCookie).toContain('Max-Age=0');

    const after = await app.request(
      '/v1/profile/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
        body: '{}',
      },
      ctx.env,
    );
    expect(after.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(await after.json()).error.code).toBe('PROFILE_REQUIRED');
  });

  it('Bearer(toss) 채널은 Set-Cookie를 보내지 않는다', async () => {
    const app = createApp();
    const cookieRes = await app.request('/v1/profile', {}, ctx.env);
    const webToken = extractSessionToken(cookieRes.headers.get('Set-Cookie') ?? '');

    const cookieBody = successEnvelope(ProfileSchema).parse(await cookieRes.json());
    const profile = await getProfile(ctx.db, cookieBody.data.id);
    const { token: bearerToken } = await issueSession(ctx.db, {
      profileId: profile!.id,
      channel: 'toss',
      now: new Date().toISOString(),
    });

    const res = await app.request(
      '/v1/auth/logout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ORIGIN,
          'Idempotency-Key': 'idem-toss-logout',
          Authorization: `Bearer ${bearerToken}`,
        },
        body: '{}',
      },
      ctx.env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Set-Cookie')).toBeNull();

    // web 쿠키 세션은 영향받지 않는다.
    const stillWorks = await app.request(
      '/v1/profile',
      { headers: { Cookie: `offside_session=${webToken}` } },
      ctx.env,
    );
    expect(stillWorks.status).toBe(200);
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request('/v1/auth/logout', postInit({}), ctx.env);
    expect(res.status).toBe(401);
  });
});
