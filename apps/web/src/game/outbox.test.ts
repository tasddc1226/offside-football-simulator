import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest의 node 환경에는 localStorage가 없다 — season.test.ts와 같은 방식으로 메모리로 흉내낸다.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const seasonBody = {
  career: { pos: 'FW' as const, foot: '오른발' as const, type: 'poacher', trait: 'late', startYear: 2026, appVersion: '0.0.0' },
  season: { age: 18, club: '테스트 FC', league: '고교리그', apps: 10, goals: 3, assists: 1, rating: 7.1, rank: 1, ovr: 55, honors: [] },
  events: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('outbox', () => {
  it('enqueue 후 flush에 성공하면 큐가 비워진다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {}, meta: { requestId: 'r' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { enqueueSeason } = await import('./outbox.js');

    enqueueSeason('11111111-1111-1111-1111-111111111111', 2026, seasonBody);
    // enqueue가 내부에서 flush를 fire-and-forget으로 돌리므로, 마이크로태스크가 끝날 때까지 기다린다.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const raw = localStorage.getItem('ft_outbox');
    expect(raw ? JSON.parse(raw) : []).toEqual([]);
    // GET /v1/profile 확인 1회 + PUT 시즌 업로드 1회.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('네트워크 오류가 나면 항목이 큐에 남는다', async () => {
    const fetchMock = vi
      .fn()
      // GET /v1/profile은 성공(세션 확인).
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {}, meta: { requestId: 'r' } }), { status: 200 }))
      // PUT 업로드는 네트워크 오류.
      .mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const { enqueueSeason } = await import('./outbox.js');

    enqueueSeason('22222222-2222-2222-2222-222222222222', 2026, seasonBody);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const raw = localStorage.getItem('ft_outbox');
    const items = raw ? (JSON.parse(raw) as unknown[]) : [];
    expect(items).toHaveLength(1);
  });
});
