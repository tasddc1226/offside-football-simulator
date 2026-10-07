import {
  type AdminCup,
  type AdminCupList,
  CupResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueCookie } from '../test/http.js';
import { cupStateOf, runCup } from '../team/cup.js';

const NOW = '2026-10-07T03:00:00.000Z';
const CupRes = successEnvelope(CupResponseSchema);

describe('/v1/admin/cups (T-11-145 컵 열기)', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);
  const data = async <T>(res: Response) => ((await res.json()) as { data: T }).data;
  const reason = async (res: Response) =>
    ((await res.json()) as { error: { details?: { reason?: string } } }).error.details?.reason;

  beforeEach(async () => {
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  it('관리자만 쓸 수 있다', async () => {
    const user = await issueCookie(ctx);
    for (const [method, path] of [
      ['GET', '/v1/admin/cups'],
      ['POST', '/v1/admin/cups'],
      ['DELETE', '/v1/admin/cups/s1-1'],
    ] as const) {
      expect((await call(method, path)).status, path).toBe(401);
      expect((await call(method, path, { cookie: user.cookie, body: {} })).status, path).toBe(403);
    }
  });

  it('제1회는 마이그레이션으로 들어 있고, 시작일만 주면 다음 회차를 연다', async () => {
    const { cookie } = await issueAdminCookie(ctx);
    const list = await data<AdminCupList>(await call('GET', '/v1/admin/cups', { cookie }));
    expect(list.items.map((x) => [x.cup.id, x.status])).toEqual([['s1-1', 'scheduled']]);

    const res = await call('POST', '/v1/admin/cups', {
      cookie,
      body: { opensOn: '2026-10-22', capacity: 32 },
    });
    expect(res.status).toBe(201);
    const made = await data<AdminCup>(res);
    expect(made).toMatchObject({
      status: 'scheduled',
      entries: 0,
      cup: {
        id: 's1-2',
        season: 1,
        edition: 2,
        opensAt: '2026-10-21T15:00:00.000Z',
        drawAt: '2026-10-26T03:00:00.000Z',
        capacity: 32,
        minFilled: 8,
      },
    });
    expect(made.cup.rounds.at(-1)!.at).toBe('2026-11-02T12:00:00.000Z');
    const after = await data<AdminCupList>(await call('GET', '/v1/admin/cups', { cookie }));
    expect(after.items.map((x) => x.cup.id)).toEqual(['s1-2', 's1-1']);
  });

  it('기간이 겹치거나 지난 날짜면 열지 않는다', async () => {
    const { cookie } = await issueAdminCookie(ctx);
    const post = (body: object) => call('POST', '/v1/admin/cups', { cookie, body });
    // 제1회는 10/20 결승 + 하루까지 — 10/21 접수 시작은 겹친다.
    expect(await reason(await post({ opensOn: '2026-10-21' }))).toBe('CUP_OVERLAP');
    expect(await reason(await post({ opensOn: '2026-10-01' }))).toBe('CUP_PAST');
    expect((await post({ opensOn: '2026-10-22', drawHour: 20 })).status).toBe(400);
    expect((await post({ opensOn: '2026-10-22', capacity: 65 })).status).toBe(400);
  });

  it('새 회차는 다음 대회로 보이고 크론이 그대로 치른다', async () => {
    const { cookie } = await issueAdminCookie(ctx);
    await call('POST', '/v1/admin/cups', { cookie, body: { opensOn: '2026-10-22' } });
    vi.setSystemTime(new Date('2026-10-22T03:00:00.000Z'));
    const cur = CupRes.parse(await (await call('GET', '/v1/cups/current')).json()).data;
    expect(cur.cup).toMatchObject({ id: 's1-2', edition: 2 });
    expect(cur.phase).toBe('open');
    // 아무도 신청하지 않으면 추첨 때 취소로 끝난다.
    await runCup(ctx.db, '2026-10-26T03:00:00.000Z');
    expect((await cupStateOf(ctx.db, 's1-2'))[0]).toBeDefined();
  });

  it('접수 전 대회만 지운다', async () => {
    const { cookie } = await issueAdminCookie(ctx);
    await call('POST', '/v1/admin/cups', { cookie, body: { opensOn: '2026-10-22' } });
    expect((await call('DELETE', '/v1/admin/cups/s1-9', { cookie })).status).toBe(404);
    expect((await call('DELETE', '/v1/admin/cups/s1-2', { cookie })).status).toBe(204);
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    expect(await reason(await call('DELETE', '/v1/admin/cups/s1-1', { cookie }))).toBe(
      'CUP_STARTED',
    );
    const list = await data<AdminCupList>(await call('GET', '/v1/admin/cups', { cookie }));
    expect(list.items.map((x) => [x.cup.id, x.status])).toEqual([['s1-1', 'entry']]);
  });
});
