import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { parseLegendsPath } from './public-legends.js';

const ID = '0f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f';
const ANON = '1f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f';
const entry = (id: string, name: string | null) => ({
  id,
  name,
  pos: 'FW',
  dpos: 'ST',
  nation: 'PT',
  number: 7,
  retireAge: 41,
  peak: 93,
  potReal: 95,
  legendScore: 3920,
  apps: 1081,
  goals: 841,
  assists: 199,
  trophies: 40,
  awards: 132,
  caps: 207,
  ballon: 14,
  lastClub: '밀라노 <로소네리>',
  retiredAt: '2026-10-03T13:14:07.484Z',
  hasDetail: true,
  title: null,
  retiredNumber: null,
  value: 73488000,
  season: 0,
});
const snapshot = {
  number: 7,
  pos: 'FW',
  age: 41,
  peak: 93,
  lastClub: '밀라노 로소네리',
  career: [
    {
      year: 2027,
      age: 19,
      club: '마치다 블루스카이',
      league: 'J1리그',
      apps: 33,
      goals: 27,
      assists: 6,
      cs: 0,
      rating: 7.63,
      rank: 4,
      ovr: 77,
      honors: [],
    },
  ],
  trophies: [{ year: 2030, t: '프리미어리그 우승', club: '리버풀 더 레즈' }],
  awards: [{ year: 2026, t: '득점왕' }],
  ballon: [{ year: 2029, rank: 13 }],
  nat: { caps: 207, goals: 76, assists: 15 },
  storyLog: [{ year: 2030, key: 'rival', name: '평생의 라이벌', ending: '끝내 넘어선 벽' }],
  miles: [{ year: 2027, t: '프로 데뷔골' }],
};
const template =
  '<html><head><title>old</title><!-- offside-seo:start --><meta name="robots" content="noindex"><!-- offside-seo:end --></head><body><!-- public-news-body --></body></html>';
const assets = {
  fetch: async (req: Request) => {
    const path = new URL(req.url).pathname;
    if (path === '/seo-policy.json')
      return Response.json({ indexingEnabled: true, origin: 'https://offside-lab.com' });
    if (path === '/news-shell') return new Response(template);
    return new Response('', { status: 404 });
  },
};

/** Cache API 흉내(이 데이터센터의 caches.default). */
function stubCache() {
  const store = new Map<string, Response>();
  vi.stubGlobal('caches', {
    default: {
      match: async (req: Request) => store.get(req.url)?.clone(),
      put: async (req: Request, res: Response) => void store.set(req.url, res.clone()),
    },
  });
  return store;
}
const calls: string[] = [];
function stubApi() {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes(`/v1/hof/${ID}`))
        return Response.json({ data: { entry: entry(ID, '호날드'), snapshot } });
      if (url.includes(`/v1/hof/${ANON}`))
        return Response.json({ data: { entry: entry(ANON, null), snapshot } });
      if (url.includes('/v1/hof/')) return new Response('', { status: 404 });
      return Response.json({
        data: { entries: [entry(ID, '호날드'), entry(ANON, null)], total: 71907 },
      });
    }),
  );
}
const waits: Promise<unknown>[] = [];
const get = async (path: string, method = 'GET') => {
  const res = await worker.fetch(
    new Request(`https://offside-lab.com${path}`, { method }),
    { ASSETS: assets },
    { waitUntil: (p) => void waits.push(p) },
  );
  await Promise.all(waits.splice(0));
  return res;
};
afterEach(() => vi.unstubAllGlobals());

describe('T-11-231 명예의 전당 공개 페이지', () => {
  it('허브는 자바스크립트 없이 읽히는 본문과 색인 메타를 낸다', async () => {
    stubCache();
    stubApi();
    const res = await get('/legends/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('index, follow');
    expect(html).toContain('71,907');
    expect(html).toContain(`href="/legends/p/${ID}/"`);
    expect(html).toContain('익명 선수');
    expect(html).toContain('밀라노 &lt;로소네리&gt;');
    expect(html).toContain('href="/legends/rank/goals/"');
    expect(html).toContain('<link rel="canonical" href="https://offside-lab.com/legends/">');
  });

  it('같은 페이지를 다시 열면 엣지 캐시에서 내고 API를 다시 부르지 않는다', async () => {
    stubCache();
    stubApi();
    await get('/legends/rank/goals/');
    const first = calls.length;
    const again = await get('/legends/rank/goals/');
    expect(again.status).toBe(200);
    expect(await again.text()).toContain('득점');
    expect(calls.length).toBe(first);
    const head = await get('/legends/rank/goals/', 'HEAD');
    expect(head.status).toBe(200);
    expect(calls.length).toBe(first);
  });

  it('이름 공개 · 상위권 선수만 색인하고 익명 선수는 noindex', async () => {
    stubCache();
    stubApi();
    const named = await get(`/legends/p/${ID}/`);
    const html = await named.text();
    expect(named.headers.get('X-Robots-Tag')).toBe('index, follow');
    expect(html).toContain('호날드');
    expect(html).toContain('마치다 블루스카이');
    expect(html).toContain('평생의 라이벌: 끝내 넘어선 벽');
    expect(named.headers.get('Cache-Control')).toBe('public, max-age=86400');
    const anon = await get(`/legends/p/${ANON}/`);
    expect(anon.headers.get('X-Robots-Tag')).toBe('noindex, follow');
  });

  it('없는 선수는 404, 비정규 경로는 정규 경로로 보낸다', async () => {
    stubCache();
    stubApi();
    expect((await get('/legends/p/2f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f/')).status).toBe(404);
    expect((await get('/legends/rank/nope/')).status).toBe(404);
    const r = await get('/legends/pos/FW?x=1');
    expect(r.status).toBe(308);
    expect(r.headers.get('Location')).toBe('/legends/pos/fw/');
  });

  it('API가 실패하면 503이고 캐시하지 않는다', async () => {
    const store = stubCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    const res = await get('/legends/');
    expect(res.status).toBe(503);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, follow');
    expect(store.size).toBe(0);
  });

  it('경로 해석', () => {
    expect(parseLegendsPath('/legends')?.path).toBe('/legends/');
    expect(parseLegendsPath('/legends/index.html')?.path).toBe('/legends/');
    expect(parseLegendsPath('/legends/pos/gk/')?.path).toBe('/legends/pos/gk/');
    expect(parseLegendsPath('/legends/p/not-an-id/')).toBeNull();
  });
});
