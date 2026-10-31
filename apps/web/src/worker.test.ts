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
const ctx = { waitUntil: () => {} };
const get = (path: string) =>
  worker.fetch(new Request(`https://offside-lab.com${path}`), { ASSETS: assets }, ctx);

describe('T-10-037 preconnect 헤더', () => {
  it('HTML 응답은 폰트 파일·API 연결을 미리 열라고 알린다', async () => {
    for (const path of ['/', '/settings']) {
      const link = (await get(path)).headers.get('Link');
      expect(link, path).toContain('<https://fonts.gstatic.com>; rel=preconnect; crossorigin');
      expect(link, path).toContain('<https://cdn.jsdelivr.net>; rel=preconnect; crossorigin');
      expect(link, path).toContain('<https://api.offside-lab.com>; rel=preconnect');
    }
  });

  it('번들 같은 정적 파일에는 붙이지 않는다', async () => {
    expect((await get('/assets/index-abc.js')).headers.get('Link')).toBeNull();
  });
});

describe('T-10-068 공유 미리보기 카드 경로', () => {
  const PATH = '/og/career/0f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f.png?v=1';

  it('카드 워커(OG 바인딩)에 넘기고 그 응답을 그대로 돌려준다', async () => {
    const seen: string[] = [];
    const og = {
      fetch: async (req: Request) => {
        seen.push(req.url);
        return new Response('png', { headers: { 'Content-Type': 'image/png' } });
      },
    };
    const res = await worker.fetch(
      new Request(`https://offside-lab.com${PATH}`),
      {
        ASSETS: assets,
        OG: og,
      },
      ctx,
    );
    expect(await res.text()).toBe('png');
    expect(seen).toEqual([`https://offside-lab.com${PATH}`]);
  });

  it('카드 워커의 302는 따라가지 않고 그대로 돌려준다', async () => {
    const og = {
      fetch: async (req: Request) => {
        expect(req.redirect).toBe('manual');
        return new Response(null, { status: 302, headers: { Location: '/og-career-x.png' } });
      },
    };
    const res = await worker.fetch(
      new Request(`https://offside-lab.com${PATH}`),
      { ASSETS: assets, OG: og },
      ctx,
    );
    expect(res.status).toBe(302);
  });

  it('카드 워커가 없으면(로컬) 404', async () => {
    expect((await get(PATH)).status).toBe(404);
  });
});

describe('T-11-531 크리에이터 짧은 주소', () => {
  it('추적 링크로 넘긴다(대소문자 무시)', async () => {
    for (const [path, content] of [
      [
        '/ethio',
        'utm_source=tiktok&utm_medium=partner&utm_campaign=creator_test&utm_content=ethio_tiktok',
      ],
      ['/ETHIO', 'utm_content=ethio_tiktok'],
      [
        '/ethio-yt',
        'utm_source=youtube&utm_medium=partner&utm_campaign=creator_test&utm_content=ethio_short',
      ],
    ] as const) {
      const res = await get(path);
      expect(res.status, path).toBe(302);
      expect(res.headers.get('Location'), path).toContain(content);
    }
  });
});

describe('T-11-584 랜딩 /get', () => {
  it('기기 스토어로 302, 캐시 · 색인하지 않는다', async () => {
    const res = await worker.fetch(
      new Request('https://offside-lab.com/get?os=android&p=end'),
      { ASSETS: assets },
      ctx,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/^https:\/\/play\.google\.com\//);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
});

describe('T-11-585 랜딩 이미지', () => {
  it('/landing/ 파일은 noindex를 붙이지 않는다', async () => {
    const res = await worker.fetch(
      new Request('https://offside-lab.com/landing/live.webp'),
      {
        ASSETS: {
          // 운영 ASSETS는 _headers의 /* 규칙대로 noindex를 붙여 돌려준다.
          fetch: async () =>
            new Response('x', {
              headers: { 'Content-Type': 'image/webp', 'X-Robots-Tag': 'noindex, nofollow' },
            }),
        },
      },
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
  });
});

describe('T-11-597 동의 지역 쿠키', () => {
  const at = (path: string, country?: string) => {
    const req = new Request(`https://offside-lab.com${path}`);
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, { ASSETS: assets }, ctx);
  };
  it('HTML 응답에 접속 나라로 정한 지역을 붙인다', async () => {
    expect((await at('/', 'KR')).headers.get('Set-Cookie')).toMatch(
      /^offside_consent_region=notice;/,
    );
    expect((await at('/', 'DE')).headers.get('Set-Cookie')).toMatch(/^offside_consent_region=ask;/);
    expect((await at('/settings')).headers.get('Set-Cookie')).toMatch(
      /^offside_consent_region=ask;/,
    );
  });
  it('정적 파일에는 붙이지 않는다', async () => {
    expect((await at('/assets/index-abc.js', 'KR')).headers.get('Set-Cookie')).toBeNull();
  });
});
