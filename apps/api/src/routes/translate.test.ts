import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie } from '../test/http.js';

describe('번역 보기 /v1/translate', () => {
  let ctx: TestD1;
  let run: ReturnType<typeof vi.fn>;
  let env: TestD1['env'];
  const translate = (cookie: string | undefined, text: string, to = 'en') =>
    callJson(env, 'POST', '/v1/translate', { ...(cookie ? { cookie } : {}), body: { text, to } });

  beforeEach(async () => {
    ctx = await createTestD1();
    run = vi.fn(async () => ({ choices: [{ message: { content: 'Nice goal!' } }] }));
    env = { ...ctx.env, AI: { run } as unknown as Ai };
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('프로필이 있어야 하고, 같은 글·같은 언어는 캐시에서 돌려주며 AI를 다시 부르지 않는다', async () => {
    expect((await translate(undefined, '골 멋져요')).status).toBe(401);
    const { cookie } = await issueCookie(ctx);
    for (let i = 0; i < 3; i++) {
      const res = await translate(cookie, '골 멋져요');
      expect(res.status).toBe(200);
      expect(((await res.json()) as { data: { text: string } }).data.text).toBe('Nice goal!');
    }
    expect(run).toHaveBeenCalledTimes(1);
    expect((await translate(cookie, '골 멋져요', 'ja')).status).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
    // 원문은 저장하지 않는다.
    const rows = await ctx.env.DB.prepare('SELECT * FROM translations').all();
    expect(JSON.stringify(rows.results)).not.toContain('골 멋져요');
  });

  it('AI가 없으면 503이고 실패는 캐시하지 않는다. 잘못된 입력은 400', async () => {
    const { cookie } = await issueCookie(ctx);
    env = { ...ctx.env };
    expect((await translate(cookie, '안녕')).status).toBe(503);
    expect((await ctx.env.DB.prepare('SELECT COUNT(*) n FROM translations').first())!.n).toBe(0);
    expect((await translate(cookie, '안녕', 'fr')).status).toBe(400);
    expect((await translate(cookie, 'x'.repeat(501))).status).toBe(400);
  });

  it('캐시에 없는 번역은 프로필당 시간당 60번까지', async () => {
    const { cookie } = await issueCookie(ctx);
    for (let i = 0; i < 60; i++) expect((await translate(cookie, `글 ${i}`)).status).toBe(200);
    expect((await translate(cookie, '글 60')).status).toBe(429);
    // 캐시에 있는 글은 횟수와 상관없이 볼 수 있다.
    expect((await translate(cookie, '글 0')).status).toBe(200);
  });
});
