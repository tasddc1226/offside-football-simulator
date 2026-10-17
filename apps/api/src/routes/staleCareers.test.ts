// T-11-354 이어 하지 않은 진행 중 커리어 정리(GET /v1/careers/mine/stale · POST /v1/careers/mine/stale/clear).
import {
  ClearStaleCareersResponseSchema,
  StaleCareersResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, putJson, seasonBody } from '../test/http.js';
import { CAREER_CLEAN_LIMIT } from './careers.js';

const OLD_1 = '11111111-1111-4111-8111-111111111111';
const OLD_2 = '22222222-2222-4222-8222-222222222222';
const RECENT = '33333333-3333-4333-8333-333333333333';
const RETIRED = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86_400_000).toISOString();

type Row = {
  id: string;
  status: string;
  abandoned_at: string | null;
  updated_at: string;
  hidden: number;
};

describe('진행 중 커리어 정리', () => {
  let ctx: TestD1;
  let owner: Awaited<ReturnType<typeof issueCookie>>;
  let other: Awaited<ReturnType<typeof issueCookie>>;

  const upload = async (cookie: string, id: string, year = 2026) => {
    const res = await putJson(ctx, cookie, `/v1/careers/${id}/seasons/${year}`, seasonBody());
    expect(res.status).toBe(200);
  };
  const age = (ids: string[]) =>
    ctx.env.DB.prepare(
      `UPDATE careers SET updated_at = ? WHERE id IN (SELECT value FROM json_each(?))`,
    )
      .bind(TWO_DAYS_AGO, JSON.stringify(ids))
      .run();
  const rows = async () =>
    new Map(
      (
        await ctx.env.DB.prepare(
          'SELECT id, status, abandoned_at, updated_at, hidden FROM careers',
        ).all<Row>()
      ).results.map((r) => [r.id, r]),
    );
  const count = async (cookie: string, keep: string[] = []) => {
    const res = await callJson(
      ctx.env,
      'GET',
      `/v1/careers/mine/stale${keep.length ? `?keep=${keep.join(',')}` : ''}`,
      { cookie },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    return successEnvelope(StaleCareersResponseSchema).parse(await res.json()).data.count;
  };
  const clear = async (cookie: string, keep: string[] = []) => {
    const res = await callJson(ctx.env, 'POST', '/v1/careers/mine/stale/clear', {
      cookie,
      body: { keep },
    });
    expect(res.status).toBe(200);
    return successEnvelope(ClearStaleCareersResponseSchema).parse(await res.json()).data;
  };

  beforeEach(async () => {
    ctx = await createTestD1();
    owner = await issueCookie(ctx);
    other = await issueCookie(ctx);
    for (const id of [OLD_1, OLD_2, RECENT, RETIRED]) await upload(owner.cookie, id);
    await upload(other.cookie, OTHER);
    await ctx.env.DB.prepare(
      `UPDATE careers SET status = 'retired', retired_at = ?, legend_score = 300, peak = 80, retire_age = 33 WHERE id = ?`,
    )
      .bind(TWO_DAYS_AGO, RETIRED)
      .run();
    await age([OLD_1, OLD_2, RETIRED, OTHER]);
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('세션이 없으면 세지도 정리하지도 않는다', async () => {
    expect((await callJson(ctx.env, 'GET', '/v1/careers/mine/stale')).status).toBe(401);
    expect(
      (await callJson(ctx.env, 'POST', '/v1/careers/mine/stale/clear', { body: { keep: [] } }))
        .status,
    ).toBe(401);
  });

  it('하루 넘게 안 올라온 내 진행 중 커리어만 세고, keep은 뺀다', async () => {
    expect(await count(owner.cookie)).toBe(2);
    expect(await count(owner.cookie, [OLD_1])).toBe(1);
    expect(await count(other.cookie)).toBe(1);
  });

  it('정리는 내 대상에만 abandoned_at을 채우고 updated_at·은퇴·남의 커리어는 그대로 둔다', async () => {
    const before = await rows();
    expect(await clear(owner.cookie, [OLD_1])).toEqual({ cleared: 1, remaining: 0 });
    const after = await rows();
    expect(after.get(OLD_2)!.abandoned_at).not.toBeNull();
    expect(after.get(OLD_2)!.updated_at).toBe(before.get(OLD_2)!.updated_at);
    expect(after.get(OLD_2)!.status).toBe('active');
    expect(after.get(OLD_2)!.hidden).toBe(0);
    for (const id of [OLD_1, RECENT, RETIRED, OTHER]) expect(after.get(id)).toEqual(before.get(id));

    // 다시 불러도 같은 행을 두 번 정리하지 않는다.
    expect(await clear(owner.cookie, [OLD_1])).toEqual({ cleared: 0, remaining: 0 });
    expect(await count(owner.cookie, [OLD_1])).toBe(0);
    expect(await count(other.cookie)).toBe(1);
  });

  it('정리한 커리어의 시즌이 다시 올라오면 정리를 푼다', async () => {
    await clear(owner.cookie);
    expect((await rows()).get(OLD_2)!.abandoned_at).not.toBeNull();
    await upload(owner.cookie, OLD_2, 2027);
    expect((await rows()).get(OLD_2)!.abandoned_at).toBeNull();
  });

  it('정리할 커리어가 없으면 0을 돌려준다', async () => {
    const fresh = await issueCookie(ctx);
    expect(await count(fresh.cookie)).toBe(0);
    expect(await clear(fresh.cookie)).toEqual({ cleared: 0, remaining: 0 });
  });

  it('keep 형식이 틀리면 400', async () => {
    const get = await callJson(ctx.env, 'GET', '/v1/careers/mine/stale?keep=nope', {
      cookie: owner.cookie,
    });
    expect(get.status).toBe(400);
    const post = await callJson(ctx.env, 'POST', '/v1/careers/mine/stale/clear', {
      cookie: owner.cookie,
      body: { keep: ['nope'] },
    });
    expect(post.status).toBe(400);
    expect((await rows()).get(OLD_2)!.abandoned_at).toBeNull();
  });

  it('시간당 한도를 넘기면 429', async () => {
    for (let i = 0; i < CAREER_CLEAN_LIMIT; i++) await clear(owner.cookie);
    const res = await callJson(ctx.env, 'POST', '/v1/careers/mine/stale/clear', {
      cookie: owner.cookie,
      body: { keep: [] },
    });
    expect(res.status).toBe(429);
  });
});
