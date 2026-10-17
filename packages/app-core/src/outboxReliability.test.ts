import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const stored = new Map<string, string>();
const local = {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => {
    stored.set(k, v);
  },
};
const body = {
  career: {
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    appVersion: 'test',
  },
  season: {
    age: 18,
    club: 'club',
    league: 'league',
    apps: 10,
    goals: 1,
    assists: 0,
    rating: 7,
    rank: 1,
    ovr: 55,
    honors: [],
  },
  events: [],
} as const;
const response = (status = 200) => new Response('{"data":{}}', { status });
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', local);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('retains an unsaved enqueue until storage recovers, and sends a stable revision on retries', async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async (_url, init) => response(init?.method === 'PUT' ? 503 : 200));
  vi.stubGlobal('fetch', fetch);
  const { enqueueSeason, flushOutbox } = await import('./outbox.js');
  const write = vi.spyOn(local, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(enqueueSeason('career', 2026, body as never)).toBe(false);
  await flushOutbox();
  expect(fetch).not.toHaveBeenCalled();
  write.mockRestore();
  await flushOutbox();
  const pending = JSON.parse(stored.get('ft_outbox')!);
  expect(pending).toHaveLength(1);
  await flushOutbox();
  const puts = fetch.mock.calls.filter(([, init]) => init?.method === 'PUT');
  expect(puts.length).toBeGreaterThanOrEqual(2);
  expect(new Set(puts.map(([, init]) => init.headers['X-Upload-Revision'])).size).toBe(1);
});
it('does not use browser keepalive for large persisted payloads', async () => {
  const fetch = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetch);
  const { enqueueSeason, flushOutbox } = await import('./outbox.js');
  enqueueSeason('large', 2026, { ...body, events: [{ text: 'x'.repeat(70_000) }] } as never);
  await flushOutbox();
  expect(fetch.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1].keepalive).toBe(false);
});
it('permanent validation failure is preserved separately rather than destroyed or retried forever', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url, init) => response(init?.method === 'PUT' ? 422 : 200)),
  );
  const { enqueueSeason, flushOutbox } = await import('./outbox.js');
  enqueueSeason('rejected', 2026, body as never);
  await flushOutbox();
  expect(JSON.parse(stored.get('ft_outbox')!)).toEqual([]);
  expect(JSON.parse(stored.get('ft_outbox:rejected')!)).toHaveLength(1);
});

it('persists season events synchronously before the lazy network module resolves', async () => {
  const { createUploader } = await import('./upload.js');
  const rec = { ...body.season, year: 2026 };
  const event = { k: 'ev', id: 'choice', c: 1, h: 0 };
  const state = {
    cid: 'buffer',
    flags: {},
    career: [rec],
    name: 'T',
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    evBuf: [event],
  };
  const upload = createUploader({ appVersion: 'test', outbox: () => new Promise(() => {}) });
  upload.uploadSeason(state as never, rec as never);
  expect(state.evBuf).toEqual([]);
  const queue = JSON.parse(stored.get('ft_outbox')!);
  expect(queue[0].body.events).toEqual([event]);
});

it('keeps original season events when durable queue storage is unavailable', async () => {
  const { createUploader } = await import('./upload.js');
  const rec = { ...body.season, year: 2026 };
  const event = { k: 'ev', id: 'choice', c: 1, h: 0 };
  const state = {
    cid: 'buffer',
    flags: {},
    career: [rec],
    name: 'T',
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    evBuf: [event],
  };
  vi.spyOn(local, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const upload = createUploader({ appVersion: 'test', outbox: () => new Promise(() => {}) });
  upload.uploadSeason(state as never, rec as never);
  expect(state.evBuf).toEqual([event]);
});

it('native upload does not depend on browser TextEncoder availability', async () => {
  vi.stubGlobal('TextEncoder', undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  const { enqueueSeason, flushOutbox } = await import('./outbox.js');
  enqueueSeason('native', 2026, body as never);
  await flushOutbox();
  expect(JSON.parse(stored.get('ft_outbox')!)).toEqual([]);
});
