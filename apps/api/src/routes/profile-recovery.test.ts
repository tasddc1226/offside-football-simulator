import { ErrorEnvelopeSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signConfirmToken } from '../auth/confirm-token.js';
import { createApp } from '../app.js';
import { sha256Hex } from '../db/hash.js';
import { auditLog, sessions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, ORIGIN } from '../test/http.js';

function jsonInit(input: {
  method: 'POST' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string | null;
  cookie?: string;
  origin?: string | null;
  ip?: string;
}): RequestInit {
  const { method, body, idempotencyKey = 'idem-key-0001', cookie, origin = ORIGIN, ip } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey;
  if (cookie) headers.Cookie = cookie;
  if (ip) headers['CF-Connecting-IP'] = ip;
  return { method, headers, body: JSON.stringify(body ?? {}) };
}

describe('POST /v1/profile/recovery-code', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('발급하면 200과 코드·발급 시각을 돌려주고 감사 로그를 남긴다', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request(
      '/v1/profile/recovery-code',
      jsonInit({ method: 'POST', cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { code: string; issuedAt: string } };
    expect(body.data.code).toMatch(/^OFS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(body.data.issuedAt).toBeTruthy();

    const rows = await ctx.db.select().from(auditLog).where(eq(auditLog.profileId, profileId));
    expect(rows.filter((row) => row.kind === 'RECOVERY_CODE_ISSUED')).toHaveLength(1);
  });

  it('재발급하면 이전 코드는 더 이상 유효하지 않다', async () => {
    const { cookie } = await issueCookie(ctx);
    const other = await issueCookie(ctx);
    const app = createApp();

    const first = await app.request(
      '/v1/profile/recovery-code',
      jsonInit({ method: 'POST', cookie, idempotencyKey: 'idem-issue-1' }),
      ctx.env,
    );
    const firstBody = (await first.json()) as { data: { code: string } };

    await app.request(
      '/v1/profile/recovery-code',
      jsonInit({ method: 'POST', cookie, idempotencyKey: 'idem-issue-2' }),
      ctx.env,
    );

    const recoverRes = await app.request(
      '/v1/profile/recover',
      jsonInit({ method: 'POST', body: { code: firstBody.data.code }, cookie: other.cookie }),
      ctx.env,
    );
    expect(recoverRes.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await recoverRes.json()).error.code).toBe(
      'RECOVERY_CODE_INVALID',
    );
  });

  it('시간당 5회 초과(6번째 호출)는 429 RATE_LIMITED', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();

    for (let i = 1; i <= 5; i++) {
      const res = await app.request(
        '/v1/profile/recovery-code',
        jsonInit({ method: 'POST', cookie, idempotencyKey: `idem-issue-limit-${i}` }),
        ctx.env,
      );
      expect(res.status).toBe(200);
    }

    const sixth = await app.request(
      '/v1/profile/recovery-code',
      jsonInit({ method: 'POST', cookie, idempotencyKey: 'idem-issue-limit-6' }),
      ctx.env,
    );
    expect(sixth.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await sixth.json()).error.code).toBe('RATE_LIMITED');
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/profile/recovery-code',
      jsonInit({ method: 'POST' }),
      ctx.env,
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/profile/recover', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  async function issueRecoveryCode(cookie: string): Promise<string> {
    const app = createApp();
    const res = await app.request(
      '/v1/profile/recovery-code',
      jsonInit({ method: 'POST', cookie, idempotencyKey: `idem-code-${crypto.randomUUID()}` }),
      ctx.env,
    );
    const body = (await res.json()) as { data: { code: string } };
    return body.data.code;
  }

  it('발급 → 새 세션에서 복구하면 200이고 세션이 발급 프로필로 재바인딩된다', async () => {
    const owner = await issueCookie(ctx);
    const code = await issueRecoveryCode(owner.cookie);
    const other = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request(
      '/v1/profile/recover',
      jsonInit({ method: 'POST', body: { code }, cookie: other.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string } };
    expect(body.data.profileId).toBe(owner.profileId);

    // 재바인딩 확인: 같은 쿠키로 /v1/profile을 부르면 이제 owner 프로필이다.
    const profileRes = await app.request(
      '/v1/profile',
      { headers: { Cookie: other.cookie } },
      ctx.env,
    );
    const profileBody = successEnvelope(ProfileSchema).parse(await profileRes.json());
    expect(profileBody.data.id).toBe(owner.profileId);
  });

  it('소문자·공백·ofs 접두가 섞인 코드도 받아들인다(contracts RecoveryCodeInputSchema 정규화)', async () => {
    const owner = await issueCookie(ctx);
    const code = await issueRecoveryCode(owner.cookie);
    const messyCode = `ofs ${code.slice(4).toLowerCase().replace(/-/g, ' ')}`;
    const other = await issueCookie(ctx);
    const app = createApp();

    const res = await app.request(
      '/v1/profile/recover',
      jsonInit({ method: 'POST', body: { code: messyCode }, cookie: other.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string } };
    expect(body.data.profileId).toBe(owner.profileId);
  });

  it('현재 프로필과 같은 코드면 그대로 200', async () => {
    const owner = await issueCookie(ctx);
    const code = await issueRecoveryCode(owner.cookie);
    const app = createApp();

    const res = await app.request(
      '/v1/profile/recover',
      jsonInit({ method: 'POST', body: { code }, cookie: owner.cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string } };
    expect(body.data.profileId).toBe(owner.profileId);
  });

  it('존재하지 않는 코드와 삭제된 프로필의 코드는 같은 오류 응답 본문(존재 구분 없음)', async () => {
    const app = createApp();
    const currentA = await issueCookie(ctx);
    const currentB = await issueCookie(ctx);

    const notFoundRes = await app.request(
      '/v1/profile/recover',
      jsonInit({
        method: 'POST',
        body: { code: 'OFS-ZZZZ-ZZZZ-ZZZZ' },
        cookie: currentA.cookie,
        idempotencyKey: 'idem-not-found',
      }),
      ctx.env,
    );
    expect(notFoundRes.status).toBe(400);
    const notFoundBody = ErrorEnvelopeSchema.parse(await notFoundRes.json());
    expect(notFoundBody.error.code).toBe('RECOVERY_CODE_INVALID');

    // 삭제된 프로필의 코드
    const deletedOwner = await issueCookie(ctx);
    const deletedCode = await issueRecoveryCode(deletedOwner.cookie);
    const tokenRes = await app.request(
      '/v1/profile/delete',
      jsonInit({ method: 'POST', cookie: deletedOwner.cookie, idempotencyKey: 'idem-del-token' }),
      ctx.env,
    );
    const { data: tokenData } = (await tokenRes.json()) as { data: { confirmToken: string } };
    await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        body: { confirmToken: tokenData.confirmToken },
        cookie: deletedOwner.cookie,
        idempotencyKey: 'idem-del-confirm',
      }),
      ctx.env,
    );

    const deletedRes = await app.request(
      '/v1/profile/recover',
      jsonInit({
        method: 'POST',
        body: { code: deletedCode },
        cookie: currentB.cookie,
        idempotencyKey: 'idem-del-recover',
      }),
      ctx.env,
    );
    expect(deletedRes.status).toBe(400);
    const deletedBody = ErrorEnvelopeSchema.parse(await deletedRes.json());
    expect(deletedBody.error).toEqual(notFoundBody.error);
  });

  it('실패 시도 6번째(IP+세션 기준)는 429, 다른 IP는 영향 없음', async () => {
    const current = await issueCookie(ctx);
    const app = createApp();
    const badCode = 'OFS-ZZZZ-ZZZZ-ZZZY';

    for (let i = 1; i <= 5; i++) {
      const res = await app.request(
        '/v1/profile/recover',
        jsonInit({
          method: 'POST',
          body: { code: badCode },
          cookie: current.cookie,
          ip: 'ip-1',
          idempotencyKey: `idem-redeem-${i}`,
        }),
        ctx.env,
      );
      expect(res.status).toBe(400);
    }

    const sixth = await app.request(
      '/v1/profile/recover',
      jsonInit({
        method: 'POST',
        body: { code: badCode },
        cookie: current.cookie,
        ip: 'ip-1',
        idempotencyKey: 'idem-redeem-6',
      }),
      ctx.env,
    );
    expect(sixth.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await sixth.json()).error.code).toBe('RATE_LIMITED');

    const otherIp = await app.request(
      '/v1/profile/recover',
      jsonInit({
        method: 'POST',
        body: { code: badCode },
        cookie: current.cookie,
        ip: 'ip-2',
        idempotencyKey: 'idem-redeem-other-ip',
      }),
      ctx.env,
    );
    expect(otherIp.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await otherIp.json()).error.code).toBe(
      'RECOVERY_CODE_INVALID',
    );
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/profile/recover',
      jsonInit({ method: 'POST', body: { code: 'OFS-0000-0000-0000' } }),
      ctx.env,
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/profile/delete', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('본문 없음 → confirmToken 발급, 본문 confirmToken → 204이고 이후 세션은 401', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();

    const tokenRes = await app.request(
      '/v1/profile/delete',
      jsonInit({ method: 'POST', cookie: owner.cookie, idempotencyKey: 'idem-delete-token' }),
      ctx.env,
    );
    expect(tokenRes.status).toBe(200);
    const { data: tokenData } = (await tokenRes.json()) as {
      data: { confirmToken: string; expiresAt: string };
    };
    expect(tokenData.confirmToken).toBeTruthy();
    expect(tokenData.expiresAt).toBeTruthy();

    const confirmRes = await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        body: { confirmToken: tokenData.confirmToken },
        cookie: owner.cookie,
        idempotencyKey: 'idem-delete-confirm',
      }),
      ctx.env,
    );
    expect(confirmRes.status).toBe(204);

    const settingsRes = await app.request(
      '/v1/profile/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: owner.cookie },
        body: '{}',
      },
      ctx.env,
    );
    expect(settingsRes.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(await settingsRes.json()).error.code).toBe('PROFILE_REQUIRED');

    const deletedLogs = await ctx.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.kind, 'PROFILE_DELETED'));
    expect(deletedLogs.some((row) => row.profileId === owner.profileId)).toBe(true);
  });

  it('만료된 토큰은 400', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();
    const tokenHash = await sha256Hex(owner.token);

    // owner의 세션 id를 알아야 서명을 만들 수 있다: /v1/profile/delete로 정상 발급받아 세션 id를 역산하는
    // 대신, 이미 만료된 시각으로 직접 서명한다(브리프: now 주입 방식. 시각은 issuedAt이 아니라 토큰 자체에
    // 담긴 expiresAt으로 검증되므로 과거 expiresAt을 만들면 결정적으로 재현된다).
    const expiredExpiresAt = '2020-01-01T00:00:00.000Z';
    // 실제 세션 id는 응답에 노출되지 않으므로, 정상 발급 흐름에서 만든 토큰을 그대로 만료시켜 검증한다:
    // signConfirmToken은 sessionId를 그대로 서명에 넣으므로, 발급받은 토큰의 sessionId 부분을 재사용할 수
    // 없다(서명이 expiresAt에 묶여 있다). 대신 같은 sessionTokenHash로 과거 expiresAt 토큰을 새로 서명한다.
    const issued = await app.request(
      '/v1/profile/delete',
      jsonInit({ method: 'POST', cookie: owner.cookie, idempotencyKey: 'idem-expire-setup' }),
      ctx.env,
    );
    expect(issued.status).toBe(200);

    // 위 발급 호출과 같은 세션에 대해, 과거 expiresAt으로 직접 서명한 토큰을 만든다.
    // sessionId는 응답에 없지만 signConfirmToken(위조 아님, 같은 세션의 tokenHash를 그대로 쓴다)로
    // 만들려면 sessionId가 필요하다. 세션 id는 DB에서 tokenHash로 조회한다.
    const [sessionRow] = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    const expiredToken = await signConfirmToken({
      sessionId: sessionRow!.id,
      sessionTokenHash: tokenHash,
      expiresAt: expiredExpiresAt,
    });

    const confirmRes = await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        body: { confirmToken: expiredToken },
        cookie: owner.cookie,
        idempotencyKey: 'idem-expired-confirm',
      }),
      ctx.env,
    );
    expect(confirmRes.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await confirmRes.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('다른 세션에서 발급된 토큰을 쓰면 400', async () => {
    const owner = await issueCookie(ctx);
    const stranger = await issueCookie(ctx);
    const app = createApp();

    const tokenRes = await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        cookie: owner.cookie,
        idempotencyKey: 'idem-other-session-token',
      }),
      ctx.env,
    );
    const { data: tokenData } = (await tokenRes.json()) as { data: { confirmToken: string } };

    const res = await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        body: { confirmToken: tokenData.confirmToken },
        cookie: stranger.cookie,
        idempotencyKey: 'idem-other-session-confirm',
      }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('이미 소비된(다른 세션의) 토큰을 재사용하면 400', async () => {
    const owner = await issueCookie(ctx);
    const app = createApp();

    const tokenRes = await app.request(
      '/v1/profile/delete',
      jsonInit({ method: 'POST', cookie: owner.cookie, idempotencyKey: 'idem-reuse-token' }),
      ctx.env,
    );
    const { data: tokenData } = (await tokenRes.json()) as { data: { confirmToken: string } };

    const confirmRes = await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        body: { confirmToken: tokenData.confirmToken },
        cookie: owner.cookie,
        idempotencyKey: 'idem-reuse-confirm-1',
      }),
      ctx.env,
    );
    expect(confirmRes.status).toBe(204);

    // owner 세션은 이제 폐기됐다. 새 프로필(세션)에서 같은 토큰을 재사용하면 sessionId가 달라 400이다.
    const fresh = await issueCookie(ctx);
    const reuseRes = await app.request(
      '/v1/profile/delete',
      jsonInit({
        method: 'POST',
        body: { confirmToken: tokenData.confirmToken },
        cookie: fresh.cookie,
        idempotencyKey: 'idem-reuse-confirm-2',
      }),
      ctx.env,
    );
    expect(reuseRes.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await reuseRes.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('세션이 없으면 401', async () => {
    const app = createApp();
    const res = await app.request('/v1/profile/delete', jsonInit({ method: 'POST' }), ctx.env);
    expect(res.status).toBe(401);
  });
});
