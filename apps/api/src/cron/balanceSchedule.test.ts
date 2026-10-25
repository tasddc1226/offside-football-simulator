// T-11-488 밸런스 개막 예약 — 시즌 중에 예약하면 다음 시즌 개막 뒤 첫 cron이 켠다.
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../db/client.js';
import { auditLog } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueCookie } from '../test/http.js';
import { runScheduledBalance } from './balanceSchedule.js';

const S1_END = '2026-10-30T15:00:00.000Z';
const IN_S1 = '2026-10-25T03:00:00.000Z';

describe('T-11-488 밸런스 개막 예약', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);
  const data = async <T>(res: Response) => ((await res.json()) as { data: T }).data;
  const at = (iso: string) => vi.setSystemTime(new Date(iso));
  const tick = (iso: string) => runScheduledBalance(createDb(env.DB), iso);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    await saveSeasonSchedule(env.DB, closeSeasonSchedule(1, S1_END, false));
    at(IN_S1);
  });
  afterEach(async () => {
    vi.useRealTimers();
    forgetSeasonSchedule();
    applySeasonSchedule([]);
    await ctx.dispose();
  });

  async function draft(cookie: string, values: Record<string, unknown>) {
    const res = await call('POST', '/v1/admin/balance', { cookie, body: { note: '', values } });
    return data<{ version: number }>(res);
  }

  it('시즌 1 중에 예약하면 시즌 2 개막 뒤 첫 실행에서 켜고 예약을 지운다', async () => {
    const admin = await issueAdminCookie(ctx);
    const v = await draft(admin.cookie, { potMean: 77, newLeagues: 1 });
    const res = await call('POST', `/v1/admin/balance/${v.version}/schedule`, {
      cookie: admin.cookie,
    });
    expect(res.status).toBe(200);
    expect(await data(res)).toEqual({ version: v.version, season: 2, scheduledAt: IN_S1 });
    const list = await data<{ scheduled: unknown }>(
      await call('GET', '/v1/admin/balance', { cookie: admin.cookie }),
    );
    expect(list.scheduled).toMatchObject({ version: v.version, season: 2 });

    // 마감 직전에는 그대로 — 공개 설정은 기본값.
    expect(await tick('2026-10-30T14:55:00.000Z')).toBeNull();
    expect((await data<{ version: number }>(await call('GET', '/v1/balance'))).version).toBe(0);

    expect(await tick(S1_END)).toEqual({ version: v.version, season: 2, activated: true });
    at(S1_END);
    const pub = await data<{ version: number; values: Record<string, number> }>(
      await call('GET', '/v1/balance'),
    );
    expect(pub).toMatchObject({ version: v.version, values: { potMean: 77, newLeagues: 1 } });
    const [log] = await ctx.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.kind, 'BALANCE_ACTIVATED'));
    expect(JSON.parse(log!.payloadJson)).toMatchObject({ version: v.version, scheduledSeason: 2 });
    expect(log!.profileId).toBe(admin.profileId);

    // 예약은 지워져 다음 실행은 읽기 하나로 끝난다.
    expect(await tick('2026-10-30T15:05:00.000Z')).toBeNull();
    const after = await data<{ scheduled: unknown }>(
      await call('GET', '/v1/admin/balance', { cookie: admin.cookie }),
    );
    expect(after.scheduled).toBeNull();
  });

  it('취소하면 개막에도 켜지 않고, 지운 초안 예약은 버린다', async () => {
    const admin = await issueAdminCookie(ctx);
    const v = await draft(admin.cookie, { potMean: 77 });
    await call('POST', `/v1/admin/balance/${v.version}/schedule`, { cookie: admin.cookie });
    expect(
      (await call('DELETE', '/v1/admin/balance-schedule', { cookie: admin.cookie })).status,
    ).toBe(204);
    expect(await tick(S1_END)).toBeNull();

    await call('POST', `/v1/admin/balance/${v.version}/schedule`, { cookie: admin.cookie });
    await call('DELETE', `/v1/admin/balance/${v.version}`, { cookie: admin.cookie });
    expect(await tick(S1_END)).toEqual({ version: v.version, season: 2, activated: false });
    at(S1_END);
    expect((await data<{ version: number }>(await call('GET', '/v1/balance'))).version).toBe(0);
  });

  it('적용 중인 버전은 예약하지 않고, 관리자만 예약 · 취소한다', async () => {
    const admin = await issueAdminCookie(ctx);
    const user = await issueCookie(ctx);
    const v = await draft(admin.cookie, { potMean: 77 });
    await call('POST', `/v1/admin/balance/${v.version}/activate?override=season`, {
      cookie: admin.cookie,
    });
    expect(
      (await call('POST', `/v1/admin/balance/${v.version}/schedule`, { cookie: admin.cookie }))
        .status,
    ).toBe(409);
    expect(
      (await call('POST', `/v1/admin/balance/${v.version}/schedule`, { cookie: user.cookie }))
        .status,
    ).toBe(403);
    expect(
      (await call('DELETE', '/v1/admin/balance-schedule', { cookie: user.cookie })).status,
    ).toBe(403);
  });
});
