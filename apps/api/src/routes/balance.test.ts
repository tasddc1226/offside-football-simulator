import { ErrorEnvelopeSchema } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { auditLog, balanceVersions } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, issueAdminCookie, issueCookie } from '../test/http.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';

const ORIGIN = 'http://localhost:5173';

type Version = { version: number; status: string; note: string; values: Record<string, unknown>; activatedAt: string | null };

describe('밸런스 설정 /v1/balance · /v1/admin/balance (T-10-016)', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const app = createApp();

  const call = (method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) =>
    app.request(
      path,
      {
        method,
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
        ...(method === 'GET' ? {} : { body: JSON.stringify(opts.body ?? {}) }),
      },
      env,
    );
  const data = async <T>(res: Response) => ((await res.json()) as { data: T }).data;

  const makeAdmin = () => issueAdminCookie(ctx);
  async function draft(cookie: string, values: Record<string, unknown>, note = '') {
    const res = await call('POST', '/v1/admin/balance', { cookie, body: { note, values } });
    expect(res.status).toBe(201);
    return data<Version>(res);
  }

  beforeEach(async () => {
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('활성 버전이 없으면 누구나 version 0(코드 기본값)을 받는다', async () => {
    const res = await call('GET', '/v1/balance');
    expect(res.status).toBe(200);
    expect(await data(res)).toEqual({ version: 0, values: {}, activatedAt: null });
  });

  it('관리자만 초안을 만들고 목록을 본다 — 세션 없음 401, 일반 프로필 403', async () => {
    expect((await call('GET', '/v1/admin/balance')).status).toBe(401);
    const user = await issueCookie(ctx);
    const res = await call('POST', '/v1/admin/balance', { cookie: user.cookie, body: { values: {} } });
    expect(res.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('FORBIDDEN');
    expect((await call('GET', '/v1/admin/balance', { cookie: user.cookie })).status).toBe(403);
  });

  it('범위 밖 값·모르는 키·잘못된 이벤트 키는 거절한다', async () => {
    const admin = await makeAdmin();
    for (const values of [{ injuryRate: 0.9 }, { unknownKnob: 1 }, { eventWeight: { 'Bad Id': 1 } }, { choiceBonus: { knock: 0.1 } }]) {
      const res = await call('POST', '/v1/admin/balance', { cookie: admin.cookie, body: { values } });
      expect(res.status, JSON.stringify(values)).toBe(400);
    }
  });

  it('초안 → 수정 → 활성화하면 공개 설정이 바뀌고, 이전 활성은 archived, 감사 로그가 남는다', async () => {
    const admin = await makeAdmin();
    const v1 = await draft(admin.cookie, { growthScale: 1.1 }, '성장 소폭 상향');
    expect(v1).toMatchObject({ status: 'draft', note: '성장 소폭 상향', values: { growthScale: 1.1 } });

    const put = await call('PUT', `/v1/admin/balance/${v1.version}`, {
      cookie: admin.cookie,
      body: { note: '성장 상향', values: { growthScale: 1.2, eventWeight: { knock: 2 }, choiceBonus: { 'knock:0': -0.1 } } },
    });
    expect(put.status).toBe(200);
    expect((await data<Version>(put)).values).toEqual({ growthScale: 1.2, eventWeight: { knock: 2 }, choiceBonus: { 'knock:0': -0.1 } });

    const act = await call('POST', `/v1/admin/balance/${v1.version}/activate`, { cookie: admin.cookie });
    expect(act.status).toBe(200);
    expect(await data<Version>(act)).toMatchObject({ status: 'active' });
    expect(await data(await call('GET', '/v1/balance'))).toMatchObject({ version: v1.version, values: { growthScale: 1.2 } });

    const v2 = await draft(admin.cookie, { koreaStr: 80 });
    await call('POST', `/v1/admin/balance/${v2.version}/activate`, { cookie: admin.cookie });
    const list = await data<{ versions: Version[] }>(await call('GET', '/v1/admin/balance', { cookie: admin.cookie }));
    expect(list.versions.map((v) => [v.version, v.status])).toEqual([
      [v2.version, 'active'],
      [v1.version, 'archived'],
    ]);

    // 되돌리기 = 옛 버전 재활성화.
    await call('POST', `/v1/admin/balance/${v1.version}/activate`, { cookie: admin.cookie });
    expect(await data(await call('GET', '/v1/balance'))).toMatchObject({ version: v1.version });
    const logs = await ctx.db.select().from(auditLog).where(eq(auditLog.kind, 'BALANCE_ACTIVATED'));
    expect(logs.map((l) => JSON.parse(l.payloadJson))).toEqual([
      { version: v1.version, previous: null },
      { version: v2.version, previous: v1.version },
      { version: v1.version, previous: v2.version },
    ]);
  });

  it('활성·보관된 버전은 고치거나 지울 수 없고(409), 초안은 지운다', async () => {
    const admin = await makeAdmin();
    const v1 = await draft(admin.cookie, {});
    await call('POST', `/v1/admin/balance/${v1.version}/activate`, { cookie: admin.cookie });
    expect((await call('PUT', `/v1/admin/balance/${v1.version}`, { cookie: admin.cookie, body: { values: {} } })).status).toBe(409);
    expect((await call('DELETE', `/v1/admin/balance/${v1.version}`, { cookie: admin.cookie })).status).toBe(409);

    const v2 = await draft(admin.cookie, { wcQual: 0.8 });
    expect((await call('DELETE', `/v1/admin/balance/${v2.version}`, { cookie: admin.cookie })).status).toBe(204);
    expect((await call('DELETE', `/v1/admin/balance/${v2.version}`, { cookie: admin.cookie })).status).toBe(404);
    expect((await call('POST', '/v1/admin/balance/999/activate', { cookie: admin.cookie })).status).toBe(404);
  });

  it('저장된 값이 나중에 좁아진 범위를 벗어나거나 사라진 키면 읽을 때 걸러 낸다', async () => {
    const admin = await makeAdmin();
    const v1 = await draft(admin.cookie, {});
    await ctx.db.update(balanceVersions).set({ valuesJson: JSON.stringify({ injuryRate: 0.4, retiredKnob: 3 }) }).where(eq(balanceVersions.version, v1.version));
    await call('POST', `/v1/admin/balance/${v1.version}/activate`, { cookie: admin.cookie });
    expect((await data<Version>(await call('GET', '/v1/balance'))).values).toEqual({ injuryRate: 0.05 });
  });

  it('T-10-045: 활성화하면 공개 설정과 운영 대시보드(활성 버전을 담는다)의 엣지 캐시를 함께 지운다', async () => {
    const edge = installFakeEdgeCache();
    try {
      const admin = await makeAdmin();
      const stats = async () => (await data<{ balance: { version: number } | null }>(await call('GET', '/v1/admin/stats', { cookie: admin.cookie }))).balance;
      expect(await stats()).toBeNull();
      await flushEdge();
      const v1 = await draft(admin.cookie, {});
      await call('POST', `/v1/admin/balance/${v1.version}/activate`, { cookie: admin.cookie });
      await flushEdge();
      expect(await stats()).toMatchObject({ version: v1.version });
    } finally {
      edge.uninstall();
    }
  });
});
