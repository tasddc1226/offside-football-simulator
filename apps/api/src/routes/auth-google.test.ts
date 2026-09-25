// T-1-013 D-21. API-AUTH-001·002·003·006. 전부 createFakeGoogleOidc(로컬 wrangler.jsonc의
// GOOGLE_FAKE=1)로 검사한다 — 실 네트워크 0.
import { ErrorEnvelopeSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Bindings } from '../env.js';
import { auditLog, careers, profiles, sessions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const rotatedCookies = new Map<string, string>();

function currentCookie(cookie: string): string {
  let current = cookie;
  while (rotatedCookies.has(current)) current = rotatedCookies.get(current)!;
  return current;
}

function recordRotation(cookie: string, response: Response): string | null {
  const activeCookie = currentCookie(cookie);
  const setCookie = response.headers.get('Set-Cookie') ?? '';
  if (!setCookie.includes('offside_session=')) return null;
  const rotated = extractCookiePair(setCookie, 'offside_session');
  rotatedCookies.set(cookie, rotated);
  rotatedCookies.set(activeCookie, rotated);
  return rotated;
}

/** `GOOGLE_FAKE`를 값 자체로 지운다(로컬 wrangler.jsonc 기본값 '1'을 끄고 arctic 경로를 강제한다). */
function withoutGoogleFake(env: Bindings, overrides: Partial<Bindings> = {}): Bindings {
  const clone: Bindings = { ...env, ...overrides };
  delete clone.GOOGLE_FAKE;
  return clone;
}

function extractCookiePair(setCookie: string, name: string): string {
  const match = new RegExp(`${name}=([^;]*)`).exec(setCookie);
  if (!match) throw new Error(`Set-Cookie에 ${name}이 없습니다.`);
  return `${name}=${match[1] ?? ''}`;
}

async function issueCookie(ctx: TestD1): Promise<{ cookie: string; profileId: string }> {
  const app = createApp();
  const res = await app.request('/v1/profile', {}, ctx.env);
  const cookie = extractCookiePair(res.headers.get('Set-Cookie') ?? '', 'offside_session');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { cookie, profileId: body.data.id };
}

async function getProfile(ctx: TestD1, cookie: string) {
  const app = createApp();
  const res = await app.request(
    '/v1/profile',
    { headers: { Cookie: currentCookie(cookie) } },
    ctx.env,
  );
  return successEnvelope(ProfileSchema).parse(await res.json()).data;
}

/** `GET /v1/auth/google/start`를 호출해 state·oauth 쿠키를 얻는다. */
async function startGoogleFlow(
  ctx: TestD1,
  cookie: string,
): Promise<{ state: string; oauthCookie: string }> {
  const app = createApp();
  const res = await app.request('/v1/auth/google/start', { headers: { Cookie: cookie } }, ctx.env);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get('Location') ?? '');
  const state = location.searchParams.get('state');
  if (!state) throw new Error('start 응답 Location에 state가 없다');
  const oauthCookie = extractCookiePair(res.headers.get('Set-Cookie') ?? '', 'offside_oauth');
  return { state, oauthCookie };
}

/** start로 얻은 state·쿠키로 `code=fake:<sub>`를 콜백에 보낸다. */
async function callGoogleCallback(
  ctx: TestD1,
  cookie: string,
  input: { code: string; state?: string; skipOauthCookie?: boolean },
): Promise<Response> {
  const activeCookie = currentCookie(cookie);
  const { state: startedState, oauthCookie } = await startGoogleFlow(ctx, activeCookie);
  const state = input.state ?? startedState;
  const cookieHeader = input.skipOauthCookie ? activeCookie : `${activeCookie}; ${oauthCookie}`;
  const app = createApp();
  const query = new URLSearchParams({ code: input.code, state });
  const response = await app.request(
    `/v1/auth/google/callback?${query.toString()}`,
    { headers: { Cookie: cookieHeader } },
    ctx.env,
  );
  recordRotation(cookie, response);
  return response;
}

/** 처음부터 끝까지: start → callback(`fake:<sub>`) → Location을 돌려준다. */
async function linkGoogle(ctx: TestD1, cookie: string, sub: string): Promise<URL> {
  const res = await callGoogleCallback(ctx, cookie, { code: `fake:${sub}` });
  expect(res.status).toBe(302);
  return new URL(res.headers.get('Location') ?? '');
}

function jsonInit(input: {
  body?: unknown;
  cookie?: string;
  origin?: string | null;
  idempotencyKey?: string | null;
}): RequestInit {
  const { body, cookie, origin = ALLOWED_ORIGIN, idempotencyKey = 'idem-key-0001' } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey;
  if (cookie) headers.Cookie = currentCookie(cookie);
  return { method: 'POST', headers, body: JSON.stringify(body ?? {}) };
}

describe('GET /v1/auth/google/start', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    rotatedCookies.clear();
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it.each([
    ['https://api.offside-lab.com', 'https://offside-lab.com'],
    ['https://offside-api.tasddc1569.workers.dev', 'https://offside-web.tasddc1569.workers.dev'],
  ])('production callback on %s returns only to its paired web origin', async (apiOrigin, webOrigin) => {
    const app = createApp();
    const env = { ...ctx.env, ENVIRONMENT: 'production' };
    const res = await app.request(`${apiOrigin}/v1/auth/google/callback`, {}, env);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('Location') ?? '').origin).toBe(webOrigin);
  });

  it('302, offside_oauth 쿠키(HttpOnly·로컬은 Secure 없음·Path 제한), 가짜 콜백으로 리다이렉트', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request(
      '/v1/auth/google/start',
      { headers: { Cookie: cookie } },
      ctx.env,
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('/v1/auth/google/callback');

    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('offside_oauth=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/v1/auth/google');
    expect(setCookie).not.toContain('Secure');
  });

  it('arctic 경로에서는 PKCE code_challenge_method=S256을 낸다', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const arcticEnv = withoutGoogleFake(ctx.env, {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-secret',
    });

    const res = await app.request(
      '/v1/auth/google/start',
      { headers: { Cookie: cookie } },
      arcticEnv,
    );
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.hostname).toBe('accounts.google.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
    expect(location.searchParams.get('scope')).toContain('email');
  });

  it.each([
    ['https://api.offside-lab.com', 'https://api.offside-lab.com/v1/auth/google/callback'],
    ['https://offside-api.tasddc1569.workers.dev', 'https://offside-api.tasddc1569.workers.dev/v1/auth/google/callback'],
  ])('production host %s uses only its paired Google callback', async (apiOrigin, redirectUri) => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const env = withoutGoogleFake(ctx.env, {
      ENVIRONMENT: 'production',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-secret',
    });
    const res = await app.request(`${apiOrigin}/v1/auth/google/start`, { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('Location') ?? '').searchParams.get('redirect_uri')).toBe(redirectUri);
  });

  it('rejects Google auth on an unknown production API hostname', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const env = withoutGoogleFake(ctx.env, { ENVIRONMENT: 'production', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    const res = await app.request('https://unknown.example/v1/auth/google/start', { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(503);
  });

  it('클라이언트 ID 없이 arctic 경로면 503(앱은 U-003 없이도 뜬다)', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const noClientEnv = withoutGoogleFake(ctx.env);

    const res = await app.request(
      '/v1/auth/google/start',
      { headers: { Cookie: cookie } },
      noClientEnv,
    );
    expect(res.status).toBe(503);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('클라이언트 secret 없이 arctic 경로면 교환 전에 503', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const noSecretEnv = withoutGoogleFake(ctx.env, { GOOGLE_CLIENT_ID: 'test-client-id' });
    delete noSecretEnv.GOOGLE_CLIENT_SECRET;

    const res = await app.request(
      '/v1/auth/google/start',
      { headers: { Cookie: cookie } },
      noSecretEnv,
    );
    expect(res.status).toBe(503);
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request('/v1/auth/google/start', {}, ctx.env);
    expect(res.status).toBe(401);
  });

  it('시간당 30회 초과(31번째)는 429', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();

    for (let i = 1; i <= 30; i++) {
      const res = await app.request(
        '/v1/auth/google/start',
        { headers: { Cookie: cookie } },
        ctx.env,
      );
      expect(res.status).toBe(302);
    }

    const res = await app.request(
      '/v1/auth/google/start',
      { headers: { Cookie: cookie } },
      ctx.env,
    );
    expect(res.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('RATE_LIMITED');
  }, // 워크트리가 테스트·빌드를 돌리는 공유 머신에서 특히). 로직 자체의 타임아웃이 아니라 // 순차 요청 31회 × 로컬 D1 왕복이라 vitest 기본 5000ms로는 부족할 때가 있다(동시에 여러
  // 테스트 예산만 넉넉히 잡는다.
  20_000);
});

describe('GET /v1/auth/google/callback', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    rotatedCookies.clear();
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('state 불일치면 error 리다이렉트와 쿠키 삭제', async () => {
    const { cookie } = await issueCookie(ctx);
    const res = await callGoogleCallback(ctx, cookie, {
      code: 'fake:sub-mismatch',
      state: 'wrong-state',
    });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('google')).toBe('error');
    expect(location.searchParams.get('reason')).toBe('state');
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('offside_oauth=;');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('oauth 쿠키가 없으면 error(state) 리다이렉트', async () => {
    const { cookie } = await issueCookie(ctx);
    const res = await callGoogleCallback(ctx, cookie, {
      code: 'fake:sub-no-cookie',
      skipOauthCookie: true,
    });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.searchParams.get('google')).toBe('error');
    expect(location.searchParams.get('reason')).toBe('state');
  });

  it('OAuth를 시작한 세션과 callback 세션이 다르면 거부한다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const { state, oauthCookie } = await startGoogleFlow(ctx, a.cookie);
    const app = createApp();
    const res = await app.request(
      `/v1/auth/google/callback?code=fake:sub-session-mismatch&state=${state}`,
      { headers: { Cookie: `${b.cookie}; ${oauthCookie}` } },
      ctx.env,
    );
    expect(new URL(res.headers.get('Location') ?? '').searchParams.get('reason')).toBe('state');
  });

  it('state와 세션이 맞는 Google 동의 취소는 cancelled로 구분한다', async () => {
    const owner = await issueCookie(ctx);
    const { state, oauthCookie } = await startGoogleFlow(ctx, owner.cookie);
    const app = createApp();
    const res = await app.request(
      `/v1/auth/google/callback?error=access_denied&state=${state}`,
      { headers: { Cookie: `${owner.cookie}; ${oauthCookie}` } },
      ctx.env,
    );
    expect(new URL(res.headers.get('Location') ?? '').searchParams.get('reason')).toBe('cancelled');
  });

  it('교환 실패(가짜 코드 형식 아님)는 error(exchange) 리다이렉트', async () => {
    const { cookie } = await issueCookie(ctx);
    const res = await callGoogleCallback(ctx, cookie, { code: 'not-a-fake-code' });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.searchParams.get('google')).toBe('error');
    expect(location.searchParams.get('reason')).toBe('exchange');
  });

  it('처음 보는 sub → 현재 프로필에 연결되고 감사 로그·마스킹 이메일', async () => {
    const { cookie, profileId } = await issueCookie(ctx);

    const location = await linkGoogle(ctx, cookie, 'sub-first-time');
    expect(location.searchParams.get('google')).toBe('linked');

    const profile = await getProfile(ctx, cookie);
    expect(profile.linked.google).toBe(true);
    expect(profile.googleEmailMasked).toBe('s***@example.com');

    const logs = await ctx.db.select().from(auditLog).where(eq(auditLog.profileId, profileId));
    const linkedLogs = logs.filter((row) => row.kind === 'GOOGLE_LINKED');
    expect(linkedLogs).toHaveLength(1);
    expect(JSON.parse(linkedLogs[0]!.payloadJson)).toEqual({ emailDomain: 'example.com' });
    // 이메일 원문·sub는 감사 로그에 없다.
    expect(linkedLogs[0]!.payloadJson).not.toContain('@example.com');

    const profileSessions = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.profileId, profileId));
    expect(profileSessions.filter((row) => row.revokedAt !== null)).toHaveLength(1);
    expect(profileSessions.filter((row) => row.revokedAt === null)).toHaveLength(1);
    const app = createApp();
    expect(
      (await app.request('/v1/profile', { headers: { Cookie: currentCookie(cookie) } }, ctx.env))
        .status,
    ).toBe(200);
  });

  it('같은 sub로 다시 연결해도 감사 로그가 쌓이기만 하고 값은 그대로다', async () => {
    const { cookie } = await issueCookie(ctx);
    await linkGoogle(ctx, cookie, 'sub-repeat');
    const location = await linkGoogle(ctx, cookie, 'sub-repeat');
    expect(location.searchParams.get('google')).toBe('linked');

    const profile = await getProfile(ctx, cookie);
    expect(profile.googleEmailMasked).toBe('s***@example.com');
  });

  it('같은 sub가 B에 있고 A 커리어 0개 → switched, 세션이 B로 재바인딩된다', async () => {
    const b = await issueCookie(ctx);
    await linkGoogle(ctx, b.cookie, 'sub-switch');

    const a = await issueCookie(ctx);
    const location = await linkGoogle(ctx, a.cookie, 'sub-switch');
    expect(location.searchParams.get('google')).toBe('switched');

    const profileViaA = await getProfile(ctx, a.cookie);
    expect(profileViaA.id).toBe(b.profileId);
  });

  async function insertCareer(id: string, profileId: string) {
    const now = new Date().toISOString();
    await ctx.db.insert(careers).values({
      id, profileId, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late', startYear: 2026, status: 'active', appVersion: '1.0.0', createdAt: now, updatedAt: now,
    });
  }
  const ownerOf = async (id: string) => (await ctx.db.select().from(careers).where(eq(careers.id, id)))[0]?.profileId;

  it('T-10-013: 익명 프로필에서 기존 계정으로 전환하면 익명 때 커리어를 그 계정으로 옮긴다', async () => {
    const b = await issueCookie(ctx);
    await linkGoogle(ctx, b.cookie, 'sub-merge');
    const a = await issueCookie(ctx);
    await insertCareer('c-anon', a.profileId);
    await insertCareer('c-b', b.profileId);

    const location = await linkGoogle(ctx, a.cookie, 'sub-merge');
    expect(location.searchParams.get('google')).toBe('switched');
    expect(await ownerOf('c-anon')).toBe(b.profileId);
    expect(await ownerOf('c-b')).toBe(b.profileId);
    const merged = (await ctx.db.select().from(auditLog).where(eq(auditLog.profileId, b.profileId))).filter((r) => r.kind === 'CAREERS_MERGED');
    expect(merged.map((r) => JSON.parse(r.payloadJson))).toEqual([{ fromProfileId: a.profileId, count: 1 }]);
  });

  it('T-10-013: 복구 코드가 있는 프로필의 커리어는 옮기지 않는다(그 코드로 다시 찾아갈 수 있다)', async () => {
    const b = await issueCookie(ctx);
    await linkGoogle(ctx, b.cookie, 'sub-keep');
    const a = await issueCookie(ctx);
    await ctx.db.update(profiles).set({ recoveryCodeHash: 'hash' }).where(eq(profiles.id, a.profileId));
    await insertCareer('c-kept', a.profileId);

    expect((await linkGoogle(ctx, a.cookie, 'sub-keep')).searchParams.get('google')).toBe('switched');
    expect(await ownerOf('c-kept')).toBe(a.profileId);
  });

  it('삭제된 프로필의 sub로도 재연결할 수 있다', async () => {
    const owner = await issueCookie(ctx);
    await linkGoogle(ctx, owner.cookie, 'sub-deleted');

    const app = createApp();
    const tokenRes = await app.request(
      '/v1/profile/delete',
      jsonInit({ cookie: owner.cookie, idempotencyKey: 'idem-del-token' }),
      ctx.env,
    );
    const { data: tokenData } = (await tokenRes.json()) as { data: { confirmToken: string } };
    await app.request(
      '/v1/profile/delete',
      jsonInit({
        body: { confirmToken: tokenData.confirmToken },
        cookie: owner.cookie,
        idempotencyKey: 'idem-del-confirm',
      }),
      ctx.env,
    );

    const newOwner = await issueCookie(ctx);
    const location = await linkGoogle(ctx, newOwner.cookie, 'sub-deleted');
    expect(location.searchParams.get('google')).toBe('linked');
  });

  it('세션이 없으면 OAuth 쿠키를 지우고 settings state 오류로 복귀한다', async () => {
    const app = createApp();
    const res = await app.request('/v1/auth/google/callback?code=fake:x&state=y', {}, ctx.env);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('reason')).toBe('state');
    expect(res.headers.get('Set-Cookie')).toContain('offside_oauth=;');
  });
});

describe('POST /v1/auth/google/unlink', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    rotatedCookies.clear();
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('204, google_sub·email·linked_at을 비우고 감사 로그를 남긴다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    await linkGoogle(ctx, cookie, 'sub-unlink');
    const app = createApp();

    const res = await app.request('/v1/auth/google/unlink', jsonInit({ cookie }), ctx.env);
    expect(res.status).toBe(204);

    const profile = await getProfile(ctx, cookie);
    expect(profile.linked.google).toBe(false);
    expect(profile.googleEmailMasked).toBeNull();

    const logs = await ctx.db.select().from(auditLog).where(eq(auditLog.profileId, profileId));
    expect(logs.filter((row) => row.kind === 'GOOGLE_UNLINKED')).toHaveLength(1);
  });

  it('연결 해제 뒤 같은 sub로 다른 프로필이 연결할 수 있다', async () => {
    const first = await issueCookie(ctx);
    await linkGoogle(ctx, first.cookie, 'sub-reuse');
    const app = createApp();
    await app.request('/v1/auth/google/unlink', jsonInit({ cookie: first.cookie }), ctx.env);

    const second = await issueCookie(ctx);
    const location = await linkGoogle(ctx, second.cookie, 'sub-reuse');
    expect(location.searchParams.get('google')).toBe('linked');
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request('/v1/auth/google/unlink', jsonInit({}), ctx.env);
    expect(res.status).toBe(401);
  });
});
