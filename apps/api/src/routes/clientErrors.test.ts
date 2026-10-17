import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PENDING,
  flushClientErrors,
  normalizeMessage,
  recordClientErrors,
  resetClientErrorsForTest,
  scrub,
  takeClientErrors,
  topFrame,
} from '../status/clientErrors.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie } from '../test/http.js';

const T0 = Date.parse('2026-10-17T15:30:00.000Z'); // KST 10-18 00:30

const report = (message: string, stack?: string) => ({
  platform: 'ios' as const,
  version: '1.1.3 (18)',
  items: [{ kind: 'fatal' as const, message, ...(stack ? { stack } : {}), where: 'play' }],
});

describe('앱·웹 오류 모으기 (T-11-331)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    resetClientErrorsForTest();
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('메일 · 복구 코드 · 긴 숫자 · 주소 쿼리를 지운다', () => {
    expect(
      scrub('a@example.com https://x.com/p?token=1 ABCD-EFGH-IJKL id 12345678 short 123'),
    ).toBe('<email> https://x.com/p <code> id <n> short 123');
  });

  it('값 · 줄 번호 · 빌드 해시가 달라도 같은 오류로 묶는다', async () => {
    expect(normalizeMessage('Index 12 out of range 30')).toBe('Index # out of range #');
    expect(
      topFrame(
        'TypeError: x\n    at render (https://offside-lab.com/assets/index-a1b2c3d4.js:10:200)',
      ),
    ).toBe('render (/assets/index.js)');
    await recordClientErrors(
      report('Index 3 out of range', 'TypeError\n at f (app.bundle:1:2)'),
      T0,
    );
    await recordClientErrors(
      report('Index 9 out of range', 'TypeError\n at f (app.bundle:7:8)'),
      T0 + 1000,
    );
    const rows = takeClientErrors();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: '2026-10-18',
      platform: 'ios',
      kind: 'fatal',
      count: 2,
      message: 'Index # out of range',
      frame: 'f (app.bundle)',
    });
    expect(takeClientErrors()).toEqual([]);
  });

  it('isolate 상한을 넘은 새 오류는 버리고 기존 오류는 계속 센다', async () => {
    for (let i = 0; i < MAX_PENDING; i++) await recordClientErrors(report(`e${'x'.repeat(i)}`), T0);
    expect(await recordClientErrors(report('new one'), T0)).toBe(1);
    expect(await recordClientErrors(report('e'), T0)).toBe(0);
    expect(takeClientErrors()).toHaveLength(MAX_PENDING);
  });

  it('D1에 더하면 같은 날 같은 오류는 count만 늘고 마지막 버전이 바뀐다', async () => {
    await recordClientErrors(report('boom'), T0);
    await flushClientErrors(ctx.env.DB, takeClientErrors());
    await recordClientErrors({ ...report('boom'), version: '1.1.4 (19)' }, T0 + 60_000);
    await recordClientErrors({ ...report('boom'), version: '1.1.4 (19)' }, T0 + 61_000);
    await flushClientErrors(ctx.env.DB, takeClientErrors());
    const rows = await ctx.env.DB.prepare('SELECT * FROM client_errors').all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({
      count: 3,
      first_version: '1.1.3 (18)',
      last_version: '1.1.4 (19)',
      place: 'play',
    });
  });

  it('POST /v1/client-errors: 204, 세션 · DB를 읽지 않고 메모리에만 센다', async () => {
    const { cookie } = await issueCookie(ctx);
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await callJson({ ...ctx.env, DB }, 'POST', '/v1/client-errors', {
      cookie,
      body: report('boom'),
    });
    expect(res.status).toBe(204);
    expect(seen).toEqual([]);
    expect(takeClientErrors()).toHaveLength(1);
  });

  it('형식이 틀리거나 Origin이 없으면 받지 않는다', async () => {
    const bad = await callJson(ctx.env, 'POST', '/v1/client-errors', {
      body: { platform: 'pc', version: '1', items: [] },
    });
    expect(bad.status).toBe(400);
    const noOrigin = await callJson(ctx.env, 'POST', '/v1/client-errors', {
      body: report('boom'),
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(noOrigin.status).toBe(403);
    expect(takeClientErrors()).toEqual([]);
  });
});
