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
      // 배포 인증은 사용자 세션을 조회하지 않는다. outbox INSERT의 수신 기기 JOIN은 별개다.
      expect(
        spy.seen.filter((s) => /^SELECT\b/i.test(s)).some((s) => /(?:sessions|profiles)/.test(s)),
      ).toBe(false);
    } finally {
      edge.uninstall();
    }
  });
  it('T-11-333: balance를 단 항목은 공개 밸런스 이력에 함께 쌓고 이력 캐시를 지운다', async () => {
    const edge = installFakeEdgeCache();
    const env = { ...ctx.env, ENVIRONMENT: 'production' };
    const entry = {
      id: 'route-balance',
      title: '성장 하한 조정',
      items: ['잠재력 근처에서도 조금씩 자라요'],
      en: { title: 'Growth floor', items: ['Players keep growing near potential.'] },
      availability: 'web-app',
      balance: { changes: [{ key: 'potGrowthFloor', from: 0.04, to: 0.15 }] },
    };
    const patches = () =>
      ctx.env.DB.prepare(
        "SELECT id, post_id, title_json, items_json, changes_json FROM balance_patches WHERE id LIKE 'route-%'",
      ).all<Record<string, string | null>>();
    try {
      vi.mocked(verifyGithubRelease).mockResolvedValue(undefined);
      const headers = { Authorization: 'Bearer valid' };
      const dry = await callJson(env, 'POST', path, {
        body: { ...body, entries: [entry], dryRun: true },
        headers,
      });
      expect(dry.status).toBe(200);
      expect((await patches()).results).toEqual([]);
      const r = await callJson(env, 'POST', path, { body: { ...body, entries: [entry] }, headers });
      expect(r.status).toBe(200);
      expect(((await r.json()) as { data: { balancePatchIds: string[] } }).data).toMatchObject({
        updated: true,
        balancePatchIds: ['route-balance'],
      });
      await flushEdge();
      expect(edge.purged).toContain(`http://localhost${STALE.balancePatched()[0]}`);
      const rows = (await patches()).results;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 'route-balance',
        post_id: expect.stringMatching(/^pst_/),
      });
      expect(JSON.parse(rows[0]!.title_json!)).toEqual({
        ko: '성장 하한 조정',
        en: 'Growth floor',
      });
      expect(JSON.parse(rows[0]!.items_json!)).toEqual({
        ko: ['잠재력 근처에서도 조금씩 자라요'],
        en: ['Players keep growing near potential.'],
      });
      expect(JSON.parse(rows[0]!.changes_json!)).toEqual([
        { key: 'potGrowthFloor', from: 0.04, to: 0.15 },
      ]);
      // 재실행은 다시 쌓지 않는다.
      const again = await callJson(env, 'POST', path, {
        body: { ...body, entries: [entry] },
        headers,
      });
      expect(((await again.json()) as { data: { updated: boolean } }).data.updated).toBe(false);
      expect((await patches()).results).toHaveLength(1);
      // 공개 이력에도 보인다.
      const history = await callJson(ctx.env, 'GET', '/v1/balance/history');
      const h = (await history.json()) as { data: { patches: { id: string }[] } };
      expect(h.data.patches.some((p) => p.id === 'route-balance')).toBe(true);
    } finally {
      edge.uninstall();
    }
  });
});
