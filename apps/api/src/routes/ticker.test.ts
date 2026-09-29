import { TickerResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, putJson, putSeasonsFor, seasonBody } from '../test/http.js';

const A = '0d000000-0000-4000-8000-00000000000a';
const B = '0d000000-0000-4000-8000-00000000000b';
const C = '0d000000-0000-4000-8000-00000000000c';
const D = '0d000000-0000-4000-8000-00000000000d';
const E = '0d000000-0000-4000-8000-00000000000e';

const read = async (ctx: TestD1) => {
  const res = await createApp().request('/v1/ticker', {}, ctx.env);
  expect(res.status).toBe(200);
  expect(res.headers.get('Cache-Control')).toContain('public');
  return successEnvelope(TickerResponseSchema).parse(await res.json()).data;
};

describe('홈 전광판 /v1/ticker (T-10-122)', () => {
  let ctx: TestD1;
  let cookie: string;
  const season = (id: string, year: number, over: Record<string, unknown>) =>
    putJson(
      ctx,
      cookie,
      `/v1/careers/${id}/seasons/${year}`,
      seasonBody({ age: 18 + year - 2026, ...over }),
    );

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('로그인 없이 읽고, 기록이 없으면 빈 목록이다', async () => {
    expect(await read(ctx)).toMatchObject({ transfers: [], firsts: [] });
  });

  it('직전 시즌과 클럽이 바뀐 시즌만 이적으로(선수마다 최근 한 번) — 병역·아마추어끼리 진학·모르는 클럽·id 없는 옛 기록은 뺀다', async () => {
    // E: 고교 → K리그1 입단
    await season(E, 2026, { club: '한빛고', clubId: 'hs-0' });
    await season(E, 2027, { club: '한강', clubId: 'k1-2', league: 'K리그1' });
    // B: 고교 → K리그1 입단 → 프리미어리그 이적 → 잔류(최근 이적 하나만)
    await season(B, 2026, { club: '한빛고', clubId: 'hs-0' });
    await season(B, 2027, { club: '한강', clubId: 'k1-2', league: 'K리그1' });
    await season(B, 2028, { club: '토피스', clubId: 'pl-3', league: '프리미어리그' });
    await season(B, 2029, { club: '토피스', clubId: 'pl-3', league: '프리미어리그' });
    // C: 병역으로 상무에 갔다가 돌아온다 — 둘 다 이적이 아니다.
    await season(C, 2026, { club: '한강', clubId: 'k1-1', league: 'K리그1' });
    await season(C, 2027, { club: '상무', clubId: 'k1-11', league: 'K리그1', mil: true });
    await season(C, 2028, { club: '한강', clubId: 'k1-1', league: 'K리그1' });
    // D: 고교 → 대학(진학), 대학 → 모르는 클럽, id 없는 옛 기록.
    await season(D, 2026, { club: '한빛고', clubId: 'hs-0' });
    await season(D, 2027, { club: '대학', clubId: 'uni-1' });
    await season(D, 2028, { club: '없는 클럽', clubId: 'pl-999' });
    await season(D, 2029, { club: '옛 클럽' });

    const { transfers } = await read(ctx);
    expect(transfers.map((t) => [t.fromClubId, t.toClubId, t.age]).sort()).toEqual([
      ['hs-0', 'k1-2', 19],
      ['k1-2', 'pl-3', 20],
    ]);
    expect(transfers[0]).toMatchObject({ pos: expect.any(String), name: null, number: null });
    // 최신순
    expect(transfers.map((t) => t.at)).toEqual([...transfers.map((t) => t.at)].sort().reverse());
  });

  it('달성된 서버 최초 기록·신기록을 최신순으로 담는다', async () => {
    await putSeasonsFor(ctx.env, cookie, A); // 18–33세 16시즌 — 통산·시즌 기록이 생긴다
    const { firsts } = await read(ctx);
    expect(firsts.length).toBeGreaterThan(0);
    expect(firsts.length).toBeLessThanOrEqual(6);
    expect(firsts.map((f) => f.at)).toEqual([...firsts.map((f) => f.at)].sort().reverse());
    for (const f of firsts) {
      if (f.kind === 'record') expect(f.value).not.toBeNull();
      else expect(f).toMatchObject({ value: null, unit: null });
    }
  });
});
