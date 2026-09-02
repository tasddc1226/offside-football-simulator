import { ErrorEnvelopeSchema, ProfileSchema, REQUEST_BODY_MAX_BYTES, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '../auth/session.js';
import { createApp } from '../app.js';
import { sha256Hex } from '../db/hash.js';
import { createProfile } from '../db/repos/profiles.js';
import { createSession } from '../db/repos/sessions.js';
import { idempotency, profiles, sessions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function extractSessionToken(setCookie: string): string {
  const token = /offside_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error('Set-Cookie에 offside_session이 없습니다.');
  return token;
}

async function issueCookie(ctx: TestD1): Promise<{ token: string; profileId: string }> {
  const app = createApp();
  const res = await app.request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { token, profileId: body.data.id };
}

describe('GET /v1/profile', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('쿠키가 없으면 새 프로필과 세션을 발급한다', async () => {
    const app = createApp();
    const res = await app.request('/v1/profile', {}, ctx.env);

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('offside_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=31536000');

    const body = successEnvelope(ProfileSchema).parse(await res.json());
    expect(body.data.linked).toEqual({ google: false, toss: false });

    const profileRows = await ctx.db.select().from(profiles);
    const sessionRows = await ctx.db.select().from(sessions);
    expect(profileRows).toHaveLength(1);
    expect(sessionRows).toHaveLength(1);
  });

  it('같은 쿠키로 재요청하면 같은 프로필을 돌려주고 새 세션을 만들지 않는다', async () => {
    const { token, profileId } = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request('/v1/profile', { headers: { Cookie: `offside_session=${token}` } }, ctx.env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    const body = successEnvelope(ProfileSchema).parse(await res.json());
    expect(body.data.id).toBe(profileId);

    const sessionRows = await ctx.db.select().from(sessions);
    expect(sessionRows).toHaveLength(1);
  });

  it('위조된 쿠키는 새 프로필을 발급한다', async () => {
    const app = createApp();
    const res = await app.request('/v1/profile', { headers: { Cookie: 'offside_session=not-a-real-token' } }, ctx.env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('offside_session=');
  });

  it('만료된 세션은 새 프로필을 발급한다', async () => {
    const profile = await createProfile(ctx.db);
    const rawToken = 'expired-raw-token-0123456789';
    const tokenHash = await sha256Hex(rawToken);
    await createSession(ctx.db, {
      profileId: profile.id,
      channel: 'web',
      tokenHash,
      expiresAt: '2020-01-01T00:00:00Z',
    });

    const app = createApp();
    const res = await app.request('/v1/profile', { headers: { Cookie: `offside_session=${rawToken}` } }, ctx.env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('offside_session=');
    const body = successEnvelope(ProfileSchema).parse(await res.json());
    expect(body.data.id).not.toBe(profile.id);
  });

  it('Bearer 세션(toss)이 있으면 같은 프로필을 돌려준다', async () => {
    const profile = await createProfile(ctx.db);
    const { token } = await issueSession(ctx.db, { profileId: profile.id, channel: 'toss', now: new Date().toISOString() });

    const app = createApp();
    const res = await app.request('/v1/profile', { headers: { Authorization: `Bearer ${token}` } }, ctx.env);

    expect(res.status).toBe(200);
    const body = successEnvelope(ProfileSchema).parse(await res.json());
    expect(body.data.id).toBe(profile.id);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('무효한 Bearer는 유효한 쿠키가 있어도 401이고 폴백하지 않는다', async () => {
    const { token: cookieToken } = await issueCookie(ctx);

    const app = createApp();
    const res = await app.request(
      '/v1/profile',
      { headers: { Authorization: 'Bearer invalid-token-000000', Cookie: `offside_session=${cookieToken}` } },
      ctx.env,
    );

    expect(res.status).toBe(401);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('PROFILE_REQUIRED');
  });

  it('유효한 Bearer와 다른 프로필 쿠키가 함께 오면 Bearer의 프로필을 돌려준다', async () => {
    const bearerProfile = await createProfile(ctx.db);
    const { token: bearerToken } = await issueSession(ctx.db, {
      profileId: bearerProfile.id,
      channel: 'toss',
      now: new Date().toISOString(),
    });
    const { token: cookieToken } = await issueCookie(ctx);

    const app = createApp();
    const res = await app.request(
      '/v1/profile',
      { headers: { Authorization: `Bearer ${bearerToken}`, Cookie: `offside_session=${cookieToken}` } },
      ctx.env,
    );

    expect(res.status).toBe(200);
    const body = successEnvelope(ProfileSchema).parse(await res.json());
    expect(body.data.id).toBe(bearerProfile.id);
  });
});

describe('PATCH /v1/profile/settings', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  function patchInit(overrides: {
    body?: unknown;
    rawBody?: string;
    origin?: string | null;
    contentType?: string | null;
    idempotencyKey?: string | null;
    cookie?: string;
  }): RequestInit {
    const headers: Record<string, string> = {};
    if (overrides.origin !== null) headers.Origin = overrides.origin ?? ALLOWED_ORIGIN;
    if (overrides.contentType !== null) headers['Content-Type'] = overrides.contentType ?? 'application/json';
    if (overrides.idempotencyKey !== null) headers['Idempotency-Key'] = overrides.idempotencyKey ?? 'idem-key-0001';
    if (overrides.cookie) headers.Cookie = overrides.cookie;

    return {
      method: 'PATCH',
      headers,
      body: overrides.rawBody ?? JSON.stringify(overrides.body ?? { theme: 'DARK' }),
    };
  }

  it('세션이 없으면 401이다', async () => {
    const app = createApp();
    const res = await app.request('/v1/profile/settings', patchInit({}), ctx.env);
    expect(res.status).toBe(401);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('PROFILE_REQUIRED');
  });

  it('Origin이 없으면 403 ORIGIN_NOT_ALLOWED다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ origin: null, cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(res.status).toBe(403);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('허용되지 않은 Origin은 403이다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ origin: 'https://evil.example', cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(res.status).toBe(403);
  });

  it('Content-Type이 JSON이 아니면 400 JSON_BODY_REQUIRED다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ contentType: 'text/plain', cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('JSON_BODY_REQUIRED');
  });

  it('본문이 1MB를 넘으면 400 BODY_TOO_LARGE다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ rawBody: 'a'.repeat(REQUEST_BODY_MAX_BYTES + 1), cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('BODY_TOO_LARGE');
  });

  it('Idempotency-Key가 없으면 400 IDEMPOTENCY_KEY_REQUIRED다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ idempotencyKey: null, cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('textScale에 없는 값을 보내면 400 VALIDATION_FAILED, issues path가 textScale이다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ body: { textScale: 110 }, cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    const issues = (body.error.details as { issues?: { path?: unknown[] }[] } | undefined)?.issues ?? [];
    expect(issues.some((issue) => JSON.stringify(issue.path) === JSON.stringify(['textScale']))).toBe(true);
  });

  it('정상 요청은 200이고 DB에 반영된다', async () => {
    const { token, profileId } = await issueCookie(ctx);
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      patchInit({ body: { theme: 'DARK' }, cookie: `offside_session=${token}` }),
      ctx.env,
    );

    expect(res.status).toBe(200);
    const body = successEnvelope(ProfileSchema).parse(await res.json());
    expect(body.data.settings.theme).toBe('DARK');

    const [row] = await ctx.db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(row && JSON.parse(row.settingsJson).theme).toBe('DARK');
  });

  it('같은 키·같은 본문 재요청은 저장된 응답을 그대로 재생한다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const init = patchInit({ body: { theme: 'DARK' }, idempotencyKey: 'idem-replay-1', cookie: `offside_session=${token}` });

    const first = await app.request('/v1/profile/settings', init, ctx.env);
    expect(first.status).toBe(200);
    expect(first.headers.get('Idempotent-Replayed')).toBeNull();
    const firstBody = await first.json();

    const second = await app.request(
      '/v1/profile/settings',
      patchInit({ body: { theme: 'DARK' }, idempotencyKey: 'idem-replay-1', cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(second.status).toBe(200);
    expect(second.headers.get('Idempotent-Replayed')).toBe('true');
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody);

    const idempotencyRows = await ctx.db.select().from(idempotency).where(eq(idempotency.key, 'idem-replay-1'));
    expect(idempotencyRows).toHaveLength(1);
  });

  it('같은 키·다른 본문 재요청은 400 IDEMPOTENCY_KEY_REUSED다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const key = 'idem-reuse-1';

    const first = await app.request(
      '/v1/profile/settings',
      patchInit({ body: { theme: 'DARK' }, idempotencyKey: key, cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      '/v1/profile/settings',
      patchInit({ body: { theme: 'LIGHT' }, idempotencyKey: key, cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(second.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await second.json());
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('같은 키·같은 본문 동시 요청 2개는 둘 다 200이고 idempotency 행은 1개만 남는다', async () => {
    const { token } = await issueCookie(ctx);
    const app = createApp();
    const key = 'idem-concurrent-1';

    const [first, second] = await Promise.all([
      app.request(
        '/v1/profile/settings',
        patchInit({ body: { theme: 'DARK' }, idempotencyKey: key, cookie: `offside_session=${token}` }),
        ctx.env,
      ),
      app.request(
        '/v1/profile/settings',
        patchInit({ body: { theme: 'DARK' }, idempotencyKey: key, cookie: `offside_session=${token}` }),
        ctx.env,
      ),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const idempotencyRows = await ctx.db.select().from(idempotency).where(eq(idempotency.key, key));
    expect(idempotencyRows).toHaveLength(1);

    const third = await app.request(
      '/v1/profile/settings',
      patchInit({ body: { theme: 'DARK' }, idempotencyKey: key, cookie: `offside_session=${token}` }),
      ctx.env,
    );
    expect(third.status).toBe(200);
    expect(third.headers.get('Idempotent-Replayed')).toBe('true');
  });
});
