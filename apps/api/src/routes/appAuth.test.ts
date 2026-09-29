// T-11-003 네이티브 앱 로그인 — 앱 세션 발급, 구글(시스템 브라우저 + 티켓 교환), 애플(identityToken).
// 구글은 로컬 GOOGLE_FAKE=1(`code=fake:<sub>`), 애플은 APPLE_FAKE=1(`fake:<sub>`)로 실 네트워크 없이 검사한다.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { appAuthTickets, sessions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { extractCookie } from '../test/http.js';

const VERIFIER = 'v'.repeat(43) + '-verifier';
const NONCE = 'nonce-0123456789abcdef';

async function s256(verifier: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  return btoa(String.fromCharCode(...digest))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 네이티브 앱처럼: Origin 없이, Bearer로. */
function appCall(ctx: TestD1, path: string, body: unknown, token?: string) {
  return createApp().request(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
    ctx.env,
  );
}

async function newAppSession(ctx: TestD1): Promise<string> {
  const res = await appCall(ctx, '/v1/app/session', {});
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { token: string } }).data.token;
}

async function profileOf(ctx: TestD1, token: string) {
  const res = await createApp().request(
    '/v1/profile',
    { headers: { Authorization: `Bearer ${token}` } },
    ctx.env,
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { id: string; linked: Record<string, boolean> } }).data;
}

/** 앱의 구글 로그인 전 과정: 시작 → (시스템 브라우저) start → callback → 앱 스킴 주소. */
async function googleViaBrowser(ctx: TestD1, token: string, sub: string, verifier = VERIFIER) {
  const startRes = await appCall(
    ctx,
    '/v1/auth/app/google',
    { challenge: await s256(verifier) },
    token,
  );
  expect(startRes.status).toBe(200);
  const { url } = ((await startRes.json()) as { data: { url: string } }).data;
  const ticket = new URL(url).searchParams.get('ticket')!;

  const app = createApp();
  const start = await app.request(url, {}, ctx.env);
  expect(start.status).toBe(302);
  const state = new URL(start.headers.get('Location')!).searchParams.get('state')!;
  const oauth = `offside_oauth=${extractCookie(start.headers.get('Set-Cookie')!, 'offside_oauth')}`;
  const cb = await app.request(
    `/v1/auth/google/callback?${new URLSearchParams({ code: `fake:${sub}`, state })}`,
    { headers: { Cookie: oauth } },
    ctx.env,
  );
  expect(cb.status).toBe(302);
  expect(cb.headers.get('Set-Cookie') ?? '').not.toContain('offside_session=');
  return { ticket, location: new URL(cb.headers.get('Location')!) };
}

describe('앱 로그인 (T-11-003)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('POST /v1/app/session은 Origin 없이 app 채널 익명 세션을 준다', async () => {
    const token = await newAppSession(ctx);
    const me = await profileOf(ctx, token);
    expect(me.linked).toEqual({ google: false, toss: false, apple: false });
    const [row] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, me.id));
    expect(row?.channel).toBe('app');
  });

  it('Bearer가 있으면 Origin 없이도 상태 변경 요청이 통과한다', async () => {
    const token = await newAppSession(ctx);
    const res = await createApp().request(
      '/v1/profile/settings',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-app-0001',
        },
        body: JSON.stringify({}),
      },
      ctx.env,
    );
    expect(res.status).toBe(200);
  });

  it('구글: 티켓을 교환하면 연결되고 옛 토큰은 폐기된다', async () => {
    const token = await newAppSession(ctx);
    const before = await profileOf(ctx, token);
    const { ticket, location } = await googleViaBrowser(ctx, token, 'g-app-1');
    expect(`${location.protocol}//${location.host}`).toBe('offside://auth');
    expect(location.searchParams.get('google')).toBe('linked');
    expect(location.searchParams.get('ticket')).toBe(ticket);

    const ex = await appCall(ctx, '/v1/auth/app/exchange', { ticket, verifier: VERIFIER }, token);
    expect(ex.status).toBe(200);
    const { data } = (await ex.json()) as { data: { token: string; result: string } };
    expect(data.result).toBe('linked');
    const after = await profileOf(ctx, data.token);
    expect(after.id).toBe(before.id);
    expect(after.linked.google).toBe(true);
    const old = await createApp().request(
      '/v1/profile',
      { headers: { Authorization: `Bearer ${token}` } },
      ctx.env,
    );
    expect(old.status).toBe(401);

    // 같은 티켓은 두 번 못 쓴다.
    const again = await appCall(
      ctx,
      '/v1/auth/app/exchange',
      { ticket, verifier: VERIFIER },
      data.token,
    );
    expect(again.status).toBe(400);
  });

  it('구글: 이미 연결된 계정이면 그 프로필로 전환한다', async () => {
    const first = await newAppSession(ctx);
    const { ticket: t1 } = await googleViaBrowser(ctx, first, 'g-app-2');
    const ex1 = await appCall(
      ctx,
      '/v1/auth/app/exchange',
      { ticket: t1, verifier: VERIFIER },
      first,
    );
    const owner = await profileOf(
      ctx,
      ((await ex1.json()) as { data: { token: string } }).data.token,
    );

    const second = await newAppSession(ctx);
    const { ticket, location } = await googleViaBrowser(ctx, second, 'g-app-2');
    expect(location.searchParams.get('google')).toBe('switched');
    const ex = await appCall(ctx, '/v1/auth/app/exchange', { ticket, verifier: VERIFIER }, second);
    const { data } = (await ex.json()) as { data: { token: string; result: string } };
    expect(data.result).toBe('switched');
    expect((await profileOf(ctx, data.token)).id).toBe(owner.id);
  });

  it('구글: verifier가 다르거나 다른 세션이면 교환을 거절한다', async () => {
    const token = await newAppSession(ctx);
    const { ticket } = await googleViaBrowser(ctx, token, 'g-app-3');
    const wrong = await appCall(
      ctx,
      '/v1/auth/app/exchange',
      { ticket, verifier: 'w'.repeat(43) },
      token,
    );
    expect(wrong.status).toBe(400);
    const other = await newAppSession(ctx);
    const stolen = await appCall(
      ctx,
      '/v1/auth/app/exchange',
      { ticket, verifier: VERIFIER },
      other,
    );
    expect(stolen.status).toBe(400);
    // 거절 뒤에도 원래 세션은 그대로 교환할 수 있다.
    const ok = await appCall(ctx, '/v1/auth/app/exchange', { ticket, verifier: VERIFIER }, token);
    expect(ok.status).toBe(200);
  });

  it('구글: 없는 티켓으로 시작하면 앱 스킴으로 오류를 돌려준다', async () => {
    const res = await createApp().request('/v1/auth/google/start?ticket=nope', {}, ctx.env);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('Location')!);
    expect(`${loc.protocol}//${loc.host}`).toBe('offside://auth');
    expect(loc.searchParams.get('google')).toBe('error');
    expect(loc.searchParams.get('reason')).toBe('session');
  });

  it('구글: 만료된 티켓은 교환할 수 없다', async () => {
    const token = await newAppSession(ctx);
    const { ticket } = await googleViaBrowser(ctx, token, 'g-app-4');
    await ctx.db
      .update(appAuthTickets)
      .set({ expiresAt: '2000-01-01T00:00:00.000Z' })
      .where(eq(appAuthTickets.id, ticket));
    const ex = await appCall(ctx, '/v1/auth/app/exchange', { ticket, verifier: VERIFIER }, token);
    expect(ex.status).toBe(400);
  });

  it('웹(쿠키) 세션은 앱 로그인 경로를 쓸 수 없다', async () => {
    const web = await createApp().request('/v1/profile', {}, ctx.env);
    const cookie = `offside_session=${extractCookie(web.headers.get('Set-Cookie')!, 'offside_session')}`;
    const res = await createApp().request(
      '/v1/auth/apple',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie,
        },
        body: JSON.stringify({ identityToken: 'fake:a', nonce: NONCE }),
      },
      ctx.env,
    );
    expect(res.status).toBe(403);
  });

  it('애플: 처음이면 연결, 다른 기기에서 같은 Apple ID면 전환', async () => {
    const a = await newAppSession(ctx);
    const meA = await profileOf(ctx, a);
    const r1 = await appCall(
      ctx,
      '/v1/auth/apple',
      { identityToken: 'fake:apple-1', nonce: NONCE },
      a,
    );
    expect(r1.status).toBe(200);
    const d1 = ((await r1.json()) as { data: { token: string; result: string } }).data;
    expect(d1.result).toBe('linked');
    const linked = await profileOf(ctx, d1.token);
    expect(linked.id).toBe(meA.id);
    expect(linked.linked.apple).toBe(true);
    // Apple 로그인도 구글과 같은 계정 자격(댓글·닉네임·내 팀)이다.
    const viewer = await createApp().request(
      '/v1/boards/viewer',
      { headers: { Authorization: `Bearer ${d1.token}` } },
      ctx.env,
    );
    expect(
      ((await viewer.json()) as { data: { google: boolean; admin: boolean } }).data,
    ).toMatchObject({ google: true, admin: false });

    const b = await newAppSession(ctx);
    const r2 = await appCall(
      ctx,
      '/v1/auth/apple',
      { identityToken: 'fake:apple-1', nonce: NONCE },
      b,
    );
    const d2 = ((await r2.json()) as { data: { token: string; result: string } }).data;
    expect(d2.result).toBe('switched');
    expect((await profileOf(ctx, d2.token)).id).toBe(meA.id);
  });

  it('애플: 검증에 실패하면 400이고 세션은 그대로다', async () => {
    const token = await newAppSession(ctx);
    const res = await appCall(
      ctx,
      '/v1/auth/apple',
      { identityToken: 'garbage', nonce: NONCE },
      token,
    );
    expect(res.status).toBe(400);
    expect((await profileOf(ctx, token)).linked.apple).toBe(false);
  });
});
