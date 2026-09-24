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

describe('T-10-006 seasonPayload', () => {
  // 실제 커리어를 은퇴까지 헤드리스로 돌려(fulltime-sim 랜덤 정책의 축약판) 모든 시즌 페이로드가
  // 서버 계약을 통과하는지 본다. SEASON_PAYLOAD_CAREERS로 표본 수를 늘려 대량 검증할 수 있다.
  it('은퇴까지 모든 시즌 페이로드가 CareerSeasonPayloadSchema를 통과한다', async () => {
    const { CareerSeasonPayloadSchema } = await import('@offside/contracts');
    const g = await import('./index.js');
    const { seasonPayload } = await import('./outbox.js');
    const { createRng, setActiveRng, pick, ri } = await import('./rng.js');
    const N = Number(process.env.SEASON_PAYLOAD_CAREERS) || 12;
    let seasons = 0;
    let withComps = 0;
    for (let i = 0; i < N; i++) {
      setActiveRng(createRng(1000 + i));
      const pos = pick(['FW', 'MF', 'DF', 'GK'] as const);
      const s = g.newGame({ name: 'T', number: 9, pos, foot: '오른발', type: pick(g.TYPES[pos]).id, trait: pick(g.TRAITS).id }, 1000 + i);
      for (let y = 0; y < 30 && !s.retired; y++) {
        for (let ph = 0; ph <= g.LAST_PHASE; ph++) {
          s.training = s.cond < 45 ? 'rest' : pick(g.ATTR_KEYS);
          g.applyTraining(s);
          if (s.phase > 0) g.simBlock(s);
          g.compsPhase(s);
          g.natWindow(s);
          const e = g.rollEvent(s);
          s.phase++;
          if (e) g.resolveChoice(s, e, ri(0, g.EVENTS.find((x) => x.id === e)!.choices.length - 1));
        }
        const { rec } = g.endSeason(s);
        const payload = seasonPayload(rec);
        const parsed = CareerSeasonPayloadSchema.safeParse(payload);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
        seasons++;
        if (payload.comps?.length) withComps++;
        const m = g.market(s);
        if (!m.options.length || (m.canRetire && s.age >= 35)) g.retire(s);
        else g.acceptOption(s, m.options[0]!);
      }
      if (!s.retired) g.retire(s);
    }
    expect(seasons).toBeGreaterThan(N * 5);
    expect(withComps).toBeGreaterThan(0);
  });
});
