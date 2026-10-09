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
  career: {
    pos: 'FW' as const,
    foot: '오른발' as const,
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    appVersion: '0.0.0',
  },
  season: {
    age: 18,
    club: '테스트 FC',
    league: '고교리그',
    apps: 10,
    goals: 3,
    assists: 1,
    rating: 7.1,
    rank: 1,
    ovr: 55,
    honors: [],
  },
  events: [],
};

const ok = () =>
  new Response(JSON.stringify({ data: {}, meta: { requestId: 'r' } }), { status: 200 });
const queue = () => JSON.parse(localStorage.getItem('ft_outbox') ?? '[]') as unknown[];
const summary = {
  retireAge: 34,
  peak: 80,
  legendScore: 300,
  apps: 1,
  goals: 1,
  assists: 1,
  trophies: 0,
  awards: 0,
  caps: 0,
  ballon: 0,
  lastClub: 'FC',
};
/** 보낸 PUT의 경로(/v1/careers/ 뒤). */
const puts = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    .map(([url]) => String(url).replace(/^.*\/v1\/careers\//, ''));

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('outbox', () => {
  it('enqueue 후 flush에 성공하면 큐가 비워진다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: {}, meta: { requestId: 'r' } }), { status: 200 }),
      );
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {}, meta: { requestId: 'r' } }), { status: 200 }),
      )
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

describe('T-10-034 전송 중 enqueue', () => {
  it('동기 루프로 여러 시즌을 넣어도 모두 보내고 큐를 비운다(이 계정으로 이어서 기록)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()));
    vi.stubGlobal('fetch', fetchMock);
    const { enqueueSeason, flushOutbox } = await import('./outbox.js');
    for (const y of [2026, 2027, 2028, 2029])
      enqueueSeason('66666666-6666-6666-6666-666666666666', y, seasonBody);
    await flushOutbox();
    expect(puts(fetchMock).map((u) => u.split('/').pop())).toEqual([
      '2026',
      '2027',
      '2028',
      '2029',
    ]);
    expect(queue()).toEqual([]);
  });

  it('PUT이 진행 중일 때 들어온 은퇴 기록이 지워지지 않고 이어서 전송된다', async () => {
    let release!: () => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok()) // GET /v1/profile
      .mockImplementationOnce(() => new Promise<Response>((r) => (release = () => r(ok())))) // 시즌 PUT(대기)
      .mockImplementation(() => Promise.resolve(ok()));
    vi.stubGlobal('fetch', fetchMock);
    const { enqueueSeason, enqueueRetirement, flushOutbox } = await import('./outbox.js');
    enqueueSeason('77777777-7777-7777-7777-777777777777', 2026, seasonBody);
    await new Promise((r) => setTimeout(r, 0));
    enqueueRetirement('77777777-7777-7777-7777-777777777777', summary);
    const waiting = flushOutbox(); // 진행 중인 회차 + 다시 도는 회차까지 기다린다.
    release();
    await waiting;
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.at(-1)).toMatch(/\/retirement$/);
    expect(queue()).toEqual([]);
  });
});

describe('T-11-040 업로드 한도(429)', () => {
  it('429는 버리지 않고 큐에 남겨 다음 회차에 다시 보낸다', async () => {
    const limited = () =>
      new Response(
        JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'x', retryable: true } }),
        {
          status: 429,
        },
      );
    // 첫 호출은 프로필 확인, 두 번째가 시즌 PUT이다.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(limited())
      .mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    const { enqueueSeason, flushOutbox } = await import('./outbox.js');
    enqueueSeason('88888888-8888-8888-8888-888888888888', 2026, seasonBody); // 큐에 넣으면 회차가 한 번 돈다.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(queue()).toHaveLength(1);
    await flushOutbox();
    expect(queue()).toEqual([]);
  });
});

describe('T-10-013 소유권 충돌', () => {
  const conflict = (code: string) =>
    new Response(JSON.stringify({ error: { code, message: 'x', retryable: false } }), {
      status: 409,
    });
  const flush = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };

  // 클라이언트가 configureOutbox로 넣는 알림을 모은다.
  const stubDispatch = async () => {
    const calls: [string, unknown][] = [];
    (await import('./outbox.js')).configureOutbox({
      onConflict: (items) => void calls.push(['offside:owner-conflict', items]),
      onRetiredNumber: (ev) => void calls.push(['offside:retired-number', ev]),
    });
    return () => calls;
  };

  it('CAREER_OWNER_MISMATCH는 버리고 그 항목으로 이벤트를 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(conflict('CAREER_OWNER_MISMATCH')),
    );
    const dispatched = await stubDispatch();
    const { enqueueSeason } = await import('./outbox.js');
    enqueueSeason('33333333-3333-3333-3333-333333333333', 2027, seasonBody);
    await flush();
    expect(queue()).toEqual([]);
    expect(dispatched()).toEqual([
      [
        'offside:owner-conflict',
        [
          {
            kind: 'season',
            careerId: '33333333-3333-3333-3333-333333333333',
            year: 2027,
            body: seasonBody,
          },
        ],
      ],
    ]);
  });

  it('다른 409는 알리지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(conflict('VALIDATION_FAILED')),
    );
    const dispatched = await stubDispatch();
    const { enqueueSeason } = await import('./outbox.js');
    enqueueSeason('44444444-4444-4444-4444-444444444444', 2027, seasonBody);
    await flush();
    expect(dispatched()).toEqual([]);
  });

  it('T-11-029 은퇴 응답의 영구결번 결과와 서비스 시즌을 함께 알린다(옛 응답은 시즌 없이)', async () => {
    const withData = (data: object) =>
      new Response(JSON.stringify({ data, meta: { requestId: 'r' } }), { status: 200 });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(ok()) // GET /v1/profile
        .mockResolvedValueOnce(withData({ retiredNumber: null, serviceSeason: 1 }))
        .mockResolvedValueOnce(withData({ retiredNumber: null })),
    );
    const dispatched = await stubDispatch();
    const { enqueueRetirement, flushOutbox } = await import('./outbox.js');
    enqueueRetirement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', summary);
    await flushOutbox();
    enqueueRetirement('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', summary);
    await flushOutbox();
    expect(dispatched()).toEqual([
      [
        'offside:retired-number',
        { careerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', result: null, serviceSeason: 1 },
      ],
      [
        'offside:retired-number',
        { careerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', result: null },
      ],
    ]);
  });

  it('pendingRetirementIds는 큐에 남은 은퇴 기록의 커리어 ID다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { enqueueRetirement, pendingRetirementIds } = await import('./outbox.js');
    enqueueRetirement('55555555-5555-5555-5555-555555555555', summary);
    await flush();
    expect([...pendingRetirementIds()]).toEqual(['55555555-5555-5555-5555-555555555555']);
  });
});

describe('T-10-045 재시도·버림·한도', () => {
  const CID = '88888888-8888-8888-8888-888888888888';
  const OTHER = '99999999-9999-9999-9999-999999999999';
  const status = (n: number) => new Response('{}', { status: n });
  const seed = (items: unknown[]) => localStorage.setItem('ft_outbox', JSON.stringify(items));
  const season = (careerId: string, year: number) => ({
    kind: 'season',
    careerId,
    year,
    body: seasonBody,
  });
  const retirement = (careerId: string) => ({ kind: 'retirement', careerId, body: summary });

  it('시즌 PUT이 재시도 대상이면 같은 커리어의 은퇴는 보내지 않고 남긴다(서버에 커리어가 없어 400으로 버려지지 않게)', async () => {
    // 첫 시즌 PUT이 5xx → 커리어가 아직 서버에 없다. 은퇴를 이어서 보내면 CAREER_NOT_FOUND(400)로 영구히 버려졌다.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(status(503))
      .mockResolvedValue(status(400));
    vi.stubGlobal('fetch', fetchMock);
    seed([season(CID, 2026), retirement(CID), season(OTHER, 2026)]);
    const { flushOutbox } = await import('./outbox.js');
    await flushOutbox();
    // 다른 커리어는 막지 않는다.
    expect(puts(fetchMock)).toEqual([`${CID}/seasons/2026`, `${OTHER}/seasons/2026`]);
    expect(queue()).toEqual([season(CID, 2026), retirement(CID)]);

    // 다음 flush에서 시즌이 올라가면 은퇴가 이어서 올라간다.
    fetchMock.mockReset().mockResolvedValue(ok());
    await flushOutbox();
    expect(puts(fetchMock)).toEqual([`${CID}/seasons/2026`, `${CID}/retirement`]);
    expect(queue()).toEqual([]);
  });

  it('401이면 버리지 않고, 다음 flush에서 프로필을 다시 확인한 뒤 보낸다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(status(401))
      .mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    seed([season(CID, 2026)]);
    const { flushOutbox } = await import('./outbox.js');
    await flushOutbox();
    expect(queue()).toHaveLength(1);
    await flushOutbox();
    const urls = fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/v1\//, ''));
    expect(urls).toEqual([
      'profile',
      `careers/${CID}/seasons/2026`,
      'profile',
      `careers/${CID}/seasons/2026`,
    ]);
    expect(queue()).toEqual([]);
  });

  it('오프라인·401이면 이번 회차를 멈춘다 — 다른 커리어 항목도 보내지 않는다', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    for (const fail of [
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve(status(401)),
    ]) {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(ok())
        .mockImplementationOnce(fail)
        .mockResolvedValue(ok());
      vi.stubGlobal('fetch', fetchMock);
      seed([season(CID, 2026), season(OTHER, 2026)]);
      const { flushOutbox } = await import('./outbox.js');
      await flushOutbox();
      expect(puts(fetchMock)).toEqual([`${CID}/seasons/2026`]);
      expect(queue()).toEqual([season(CID, 2026), season(OTHER, 2026)]);
      vi.resetModules();
    }
  });

  it('온라인인데 한 항목에서 예외가 나면 그 커리어만 미룬다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockRejectedValueOnce(new TypeError('body too large'))
      .mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    seed([season(CID, 2026), retirement(CID), season(OTHER, 2026)]);
    const { flushOutbox } = await import('./outbox.js');
    await flushOutbox();
    expect(puts(fetchMock)).toEqual([`${CID}/seasons/2026`, `${OTHER}/seasons/2026`]);
    expect(queue()).toEqual([season(CID, 2026), retirement(CID)]);
  });

  it('409가 아닌 4xx는 재시도해도 같으므로 버린다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(status(422)));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    seed([season(CID, 2026)]);
    const { flushOutbox } = await import('./outbox.js');
    await flushOutbox();
    expect(queue()).toEqual([]);
  });

  it('큐는 100개까지만 두고 오래된 항목부터 지운다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    seed(Array.from({ length: 100 }, (_, i) => season(CID, 1900 + i)));
    const { enqueueSeason } = await import('./outbox.js');
    enqueueSeason(CID, 2026, seasonBody);
    const years = (queue() as { year: number }[]).map((x) => x.year);
    expect(years).toHaveLength(100);
    expect(years[0]).toBe(1901);
    expect(years.at(-1)).toBe(2026);
  });
});

describe('T-11-182 남은 기록 다시 보내기 · 은퇴 알림', () => {
  const CID = '77777777-7777-7777-7777-777777777777';
  const seed = (items: unknown[]) => localStorage.setItem('ft_outbox', JSON.stringify(items));
  const retirement = { kind: 'retirement', careerId: CID, body: summary };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('5xx로 남은 은퇴 기록을 앱을 다시 켜지 않아도 30초 뒤 다시 보내고, 올라가면 알린다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    seed([retirement]);
    const { flushOutbox, onRetirementSynced, pendingRetirementIds } = await import('./outbox.js');
    const seen: boolean[] = [];
    const off = onRetirementSynced(() => void seen.push(pendingRetirementIds().has(CID)));
    await flushOutbox();
    expect(queue()).toHaveLength(1);
    expect(seen).toEqual([]);

    await vi.advanceTimersByTimeAsync(29_000);
    expect(puts(fetchMock)).toEqual([`${CID}/retirement`]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock)).toEqual([`${CID}/retirement`, `${CID}/retirement`]);
    expect(queue()).toEqual([]);
    // 알릴 때는 이미 큐에서 빠져 있다.
    expect(seen).toEqual([false]);

    // 큐가 비면 더 보내지 않는다.
    await vi.advanceTimersByTimeAsync(600_000);
    expect(puts(fetchMock)).toHaveLength(2);
    off();
  });

  it('계속 실패하면 간격을 늘려 다시 보낸다(30초 → 1분 → 2분)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValue(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    seed([retirement]);
    const { flushOutbox } = await import('./outbox.js');
    await flushOutbox();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(puts(fetchMock)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(puts(fetchMock)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock)).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(puts(fetchMock)).toHaveLength(4);
    expect(queue()).toHaveLength(1);
  });

  it('한도(429)에 걸리면 짧은 간격을 건너뛰고 5분 뒤에 다시 보낸다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValue(new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    seed([retirement]);
    const { flushOutbox } = await import('./outbox.js');
    await flushOutbox();
    await vi.advanceTimersByTimeAsync(299_000);
    expect(puts(fetchMock)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock)).toHaveLength(2);
  });
});
