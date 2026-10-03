import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson } from '../test/http.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';
import { verifyGithubRelease } from '../auth/github-release.js';
import { STALE } from '../edgeKeys.js';

vi.mock('../auth/github-release.js', () => ({ verifyGithubRelease: vi.fn() }));
const path = '/v1/internal/release-notes';
const body = {
  sha: 'a'.repeat(40),
  entries: [
    {
      id: 'route-test',
      title: '기록실 개선',
      items: ['시즌을 선택할 수 있어요'],
      availability: 'web-app',
    },
  ],
};
describe('배포 전용 릴리즈 노트 경로', () => {
  let ctx: TestD1;
  beforeAll(async () => {
    ctx = await createTestD1();
  });
  afterAll(async () => {
    await ctx.dispose();
  });
  afterEach(() => {
    vi.mocked(verifyGithubRelease).mockReset();
  });
  it('세션·쿠키가 있어도 배포 인증 없이는 DB를 읽지 않는다', async () => {
    const spy = spyDb(ctx.env.DB);
    for (const headers of [{ Authorization: 'Bearer invalid' }, { Cookie: 'session=admin' }]) {
      vi.mocked(verifyGithubRelease).mockRejectedValue(new Error('invalid signature'));
      const r = await callJson(
        { ...ctx.env, ENVIRONMENT: 'production', DB: spy.DB },
        'POST',
        path,
        { body, headers },
      );
      expect(r.status).toBe(403);
    }
    expect(spy.seen).toEqual([]);
  });
  it('local/staging에서는 인증 토큰이 있어도 쓰지 않는다', async () => {
    const spy = spyDb(ctx.env.DB);
    const r = await callJson({ ...ctx.env, DB: spy.DB }, 'POST', path, {
      body,
      headers: { Authorization: 'Bearer valid' },
    });
    expect(r.status).toBe(403);
    expect(verifyGithubRelease).not.toHaveBeenCalled();
    expect(spy.seen).toEqual([]);
  });
  it('예정 앱 버전 누락·중복 ID를 거부한다', async () => {
    for (const entries of [
      [{ ...body.entries[0], availability: 'web-app-pending' }],
      [body.entries[0], body.entries[0]],
    ]) {
      const r = await callJson({ ...ctx.env, ENVIRONMENT: 'production' }, 'POST', path, {
        body: { ...body, entries },
        headers: { Authorization: 'Bearer valid' },
      });
      expect(r.status).toBe(400);
    }
  });
  it('실제 게시에서만 캐시를 비우며 재실행·dry-run은 추가 알림을 만들지 않는다', async () => {
    const edge = installFakeEdgeCache();
    const spy = spyDb(ctx.env.DB);
    const env = { ...ctx.env, ENVIRONMENT: 'production', DB: spy.DB };
    try {
      vi.mocked(verifyGithubRelease).mockResolvedValue(undefined);
      const dry = await callJson(env, 'POST', path, {
        body: { ...body, dryRun: true },
        headers: { Authorization: 'Bearer valid' },
      });
      expect(dry.status).toBe(200);
      expect(edge.purged).toEqual([]);
      const r = await callJson(env, 'POST', path, {
        body,
        headers: { Authorization: 'Bearer valid' },
      });
      expect(r.status).toBe(200);
      expect(((await r.json()) as { data: { updated: boolean } }).data.updated).toBe(true);
      await flushEdge();
      expect(edge.purged).toEqual(STALE.boardChanged('release').map((p) => `http://localhost${p}`));
      const count = edge.purged.length;
      const again = await callJson(env, 'POST', path, {
        body,
        headers: { Authorization: 'Bearer valid' },
      });
      expect(((await again.json()) as { data: { updated: boolean } }).data.updated).toBe(false);
      await flushEdge();
      expect(edge.purged).toHaveLength(count);
      expect(spy.seen.some((s) => /(?:sessions|profiles)/.test(s))).toBe(false);
    } finally {
      edge.uninstall();
    }
  });
});
