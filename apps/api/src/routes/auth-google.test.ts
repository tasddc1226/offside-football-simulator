// T-1-013 D-21. API-AUTH-001·002·003·006. 전부 createFakeGoogleOidc(로컬 wrangler.jsonc의
// GOOGLE_FAKE=1)로 검사한다 — 실 네트워크 0.
import { ErrorEnvelopeSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Bindings } from '../env.js';
import { insertCareer } from '../db/repos/careers.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import { auditLog, careers, sessions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const SERVICE_SEASON_ID = 'svc_test';

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

async function ensureServiceSeason(ctx: TestD1): Promise<void> {
  await upsertServiceSeason(ctx.db, {
    id: SERVICE_SEASON_ID,
    name: 'Test season',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    challengeSetId: 'cs_test',
  });
}

async function addCareer(ctx: TestD1, ownerProfileId: string, careerId: string): Promise<void> {
  const now = new Date().toISOString();
  await insertCareer(ctx.db, {
    id: careerId,
    ownerProfileId,
    status: 'ACTIVE',
    revision: 1,
    createdServiceSeasonId: SERVICE_SEASON_ID,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function getProfile(ctx: TestD1, cookie: string) {
  const app = createApp();
  const res = await app.request('/v1/profile', { headers: { Cookie: cookie } }, ctx.env);
  return successEnvelope(ProfileSchema).parse(await res.json()).data;
}

/** `GET /v1/auth/google/start`를 호출해 state·oauth 쿠키를 얻는다. */
async function startGoogleFlow(ctx: TestD1, cookie: string): Promise<{ state: string; oauthCookie: string }> {
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
  const { state: startedState, oauthCookie } = await startGoogleFlow(ctx, cookie);
  const state = input.state ?? startedState;
  const cookieHeader = input.skipOauthCookie ? cookie : `${cookie}; ${oauthCookie}`;
  const app = createApp();
  const query = new URLSearchParams({ code: input.code, state });
  return app.request(`/v1/auth/google/callback?${query.toString()}`, { headers: { Cookie: cookieHeader } }, ctx.env);
}

/** 처음부터 끝까지: start → callback(`fake:<sub>`) → Location을 돌려준다. */
async function linkGoogle(ctx: TestD1, cookie: string, sub: string): Promise<URL> {
  const res = await callGoogleCallback(ctx, cookie, { code: `fake:${sub}` });
  expect(res.status).toBe(302);
  return new URL(res.headers.get('Location') ?? '');
}

function jsonInit(input: { body?: unknown; cookie?: string; origin?: string | null; idempotencyKey?: string | null }): RequestInit {
  const { body, cookie, origin = ALLOWED_ORIGIN, idempotencyKey = 'idem-key-0001' } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey;
  if (cookie) headers.Cookie = cookie;
  return { method: 'POST', headers, body: JSON.stringify(body ?? {}) };
}

describe('GET /v1/auth/google/start', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('302, offside_oauth 쿠키(HttpOnly·로컬은 Secure 없음·Path 제한), 가짜 콜백으로 리다이렉트', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request('/v1/auth/google/start', { headers: { Cookie: cookie } }, ctx.env);
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('/v1/auth/google/callback');

    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('offside_oauth=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/v1/auth/google');
    expect(setCookie).not.toContain('Secure');
  });

  it('arctic 경로에서는 PKCE code_challenge_method=S256을 낸다(로컬 fake를 끄고 clientId만 준다)', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const arcticEnv = withoutGoogleFake(ctx.env, { GOOGLE_CLIENT_ID: 'test-client-id', GOOGLE_CLIENT_SECRET: 'test-secret' });

    const res = await app.request('/v1/auth/google/start', { headers: { Cookie: cookie } }, arcticEnv);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.hostname).toBe('accounts.google.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
    expect(location.searchParams.get('scope')).toContain('email');
  });

  it('클라이언트 ID 없이 arctic 경로면 503(앱은 U-003 없이도 뜬다)', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const noClientEnv = withoutGoogleFake(ctx.env);

    const res = await app.request('/v1/auth/google/start', { headers: { Cookie: cookie } }, noClientEnv);
    expect(res.status).toBe(503);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('SERVICE_UNAVAILABLE');
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
      const res = await app.request('/v1/auth/google/start', { headers: { Cookie: cookie } }, ctx.env);
      expect(res.status).toBe(302);
    }

    const res = await app.request('/v1/auth/google/start', { headers: { Cookie: cookie } }, ctx.env);
    expect(res.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /v1/auth/google/callback', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('state 불일치면 error 리다이렉트와 쿠키 삭제', async () => {
    const { cookie } = await issueCookie(ctx);
    const res = await callGoogleCallback(ctx, cookie, { code: 'fake:sub-mismatch', state: 'wrong-state' });

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
    const res = await callGoogleCallback(ctx, cookie, { code: 'fake:sub-no-cookie', skipOauthCookie: true });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.searchParams.get('google')).toBe('error');
    expect(location.searchParams.get('reason')).toBe('state');
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

  it('같은 sub가 B에 있고 A 커리어 1개 이상 → merge_required, pending이 세션에 남는다', async () => {
    await ensureServiceSeason(ctx);
    const b = await issueCookie(ctx);
    await linkGoogle(ctx, b.cookie, 'sub-merge');

    const a = await issueCookie(ctx);
    await addCareer(ctx, a.profileId, 'car_merge_a1');

    const location = await linkGoogle(ctx, a.cookie, 'sub-merge');
    expect(location.searchParams.get('google')).toBe('merge_required');
    expect(location.searchParams.get('current')).toBe('1');
    expect(location.searchParams.get('target')).toBe('0');

    const profile = await getProfile(ctx, a.cookie);
    expect(profile.pendingMerge).toEqual({ targetCareerCount: 0 });
  });

  it('삭제된 프로필의 sub로도 재연결할 수 있다', async () => {
    await ensureServiceSeason(ctx);
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
      jsonInit({ body: { confirmToken: tokenData.confirmToken }, cookie: owner.cookie, idempotencyKey: 'idem-del-confirm' }),
      ctx.env,
    );

    const newOwner = await issueCookie(ctx);
    const location = await linkGoogle(ctx, newOwner.cookie, 'sub-deleted');
    expect(location.searchParams.get('google')).toBe('linked');
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request('/v1/auth/google/callback?code=fake:x&state=y', {}, ctx.env);
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/auth/merge', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
    await ensureServiceSeason(ctx);
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  async function setUpMergeRequired(): Promise<{ a: { cookie: string; profileId: string }; b: { cookie: string; profileId: string } }> {
    const b = await issueCookie(ctx);
    await linkGoogle(ctx, b.cookie, 'sub-merge-route');
    const a = await issueCookie(ctx);
    await addCareer(ctx, a.profileId, 'car_route_a1');
    const location = await linkGoogle(ctx, a.cookie, 'sub-merge-route');
    expect(location.searchParams.get('google')).toBe('merge_required');
    return { a, b };
  }

  it('MOVE_TO_LINKED: 커리어 이동·감사 로그·pending 삭제', async () => {
    const { a, b } = await setUpMergeRequired();
    const app = createApp();

    const res = await app.request(
      '/v1/auth/merge',
      jsonInit({ body: { mergeChoice: 'MOVE_TO_LINKED' }, cookie: a.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string; careerCount: number } };
    expect(body.data.profileId).toBe(b.profileId);
    expect(body.data.careerCount).toBe(1);

    const bCareers = await ctx.db.select().from(careers).where(eq(careers.ownerProfileId, b.profileId));
    expect(bCareers.map((row) => row.id)).toEqual(['car_route_a1']);

    const mergedLogs = await ctx.db.select().from(auditLog).where(eq(auditLog.kind, 'PROFILE_MERGED'));
    expect(mergedLogs).toHaveLength(1);

    const profile = await getProfile(ctx, a.cookie);
    expect(profile.id).toBe(b.profileId);
    expect(profile.pendingMerge).toBeNull();
  });

  it('KEEP_LINKED_ONLY: 재바인딩만, A의 커리어는 그대로 A 소유로 남는다', async () => {
    const { a, b } = await setUpMergeRequired();
    const app = createApp();

    const res = await app.request(
      '/v1/auth/merge',
      jsonInit({ body: { mergeChoice: 'KEEP_LINKED_ONLY' }, cookie: a.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string; careerCount: number } };
    expect(body.data.profileId).toBe(b.profileId);
    expect(body.data.careerCount).toBe(0);

    const aCareers = await ctx.db.select().from(careers).where(eq(careers.ownerProfileId, a.profileId));
    expect(aCareers.map((row) => row.id)).toEqual(['car_route_a1']);

    const profile = await getProfile(ctx, a.cookie);
    expect(profile.id).toBe(b.profileId);
  });

  it('대기 중인 병합이 없으면 400 VALIDATION_FAILED(NO_PENDING_MERGE)', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request('/v1/auth/merge', jsonInit({ body: { mergeChoice: 'KEEP_LINKED_ONLY' }, cookie }), ctx.env);
    expect(res.status).toBe(400);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual({ reason: 'NO_PENDING_MERGE' });
  });

  it('pending 만료 뒤에는 400 VALIDATION_FAILED(NO_PENDING_MERGE)', async () => {
    const { a } = await setUpMergeRequired();
    await ctx.db.update(sessions).set({ pendingMergeExpiresAt: '2020-01-01T00:00:00Z' }).where(eq(sessions.profileId, a.profileId));
    const app = createApp();

    const res = await app.request(
      '/v1/auth/merge',
      jsonInit({ body: { mergeChoice: 'MOVE_TO_LINKED' }, cookie: a.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.details).toEqual({ reason: 'NO_PENDING_MERGE' });
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request('/v1/auth/merge', jsonInit({ body: { mergeChoice: 'KEEP_LINKED_ONLY' } }), ctx.env);
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/auth/google/unlink', () => {
  let ctx: TestD1;

  beforeEach(async () => {
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
