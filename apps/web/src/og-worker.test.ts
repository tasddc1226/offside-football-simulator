import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './og-worker.js';

// wrangler가 묶는 wasm 모듈은 vitest가 읽지 못한다 — 굽기는 실제 워커(dry-run·배포 뒤 확인)에서 본다.
vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({ default: {} }));

const ID = '0f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f';
const entry = {
  id: ID,
  name: null,
  pos: 'FW',
  number: 9,
  legendScore: 612,
  lastClub: '울산 호랑이',
};
// API는 body/status를, 그 밖(글꼴 서버)은 503 — 카드를 굽지 못하는 상황.
const withApi = (body: unknown, status: number) =>
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
    String(input).includes('/v1/hof/')
      ? new Response(JSON.stringify(body), { status })
      : new Response('', { status: 503 }),
  );
const get = (path: string) => worker.fetch(new Request(`https://offside-lab.com${path}`));

afterEach(() => vi.unstubAllGlobals());

describe('T-10-068 카드 워커', () => {
  it('명예의 전당에 없는 선수·모르는 경로는 404', async () => {
    withApi({}, 404);
    expect((await get(`/og/career/${ID}.png?v=1`)).status).toBe(404);
    expect((await get('/og/career/x.png')).status).toBe(404);
  });

  it('카드를 굽지 못하면(글꼴 실패) 레전드 등급 카드로 돌려보낸다', async () => {
    withApi({ data: { entry } }, 200);
    const res = await get(`/og/career/${ID}.png?v=1`);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(
      /^https:\/\/offside-lab\.com\/og-career-lg_world-v\d+\.png$/,
    );
  });
});
