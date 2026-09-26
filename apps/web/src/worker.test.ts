import { describe, expect, it } from 'vitest';
import worker from './worker.js';

// ASSETS 바인딩 흉내: 경로별 본문·타입만 돌려준다(없는 경로는 404).
const assets = {
  fetch: async (req: Request) => {
    const { pathname } = new URL(req.url);
    if (pathname === '/' || pathname === '/app-shell')
      return new Response('<!doctype html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    if (pathname === '/assets/index-abc.js')
      return new Response('x', { headers: { 'Content-Type': 'text/javascript' } });
    if (pathname === '/seo-policy.json')
      return Response.json({ indexingEnabled: true, origin: 'https://offside-lab.com' });
    return new Response('', { status: 404 });
  },
};
const get = (path: string) =>
  worker.fetch(new Request(`https://offside-lab.com${path}`), { ASSETS: assets });

describe('T-10-037 preconnect 헤더', () => {
  it('HTML 응답은 폰트 파일·API 연결을 미리 열라고 알린다', async () => {
    for (const path of ['/', '/settings']) {
      const link = (await get(path)).headers.get('Link');
      expect(link, path).toContain('<https://fonts.gstatic.com>; rel=preconnect; crossorigin');
      expect(link, path).toContain('<https://api.offside-lab.com>; rel=preconnect');
    }
  });

  it('번들 같은 정적 파일에는 붙이지 않는다', async () => {
    expect((await get('/assets/index-abc.js')).headers.get('Link')).toBeNull();
  });
});
