import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/client.js', () => ({ apiFetch: vi.fn(), cachedGet: vi.fn() }));
vi.mock('./outboxStore.js', () => ({ loadOutbox: () => [] }));

import { apiFetch, cachedGet } from './api/client.js';
import { cleanupKeep, clearStaleCareers, findStaleCareers } from './careerCleanup.js';
import type { OutboxItem } from './outboxStore.js';

const fail = {
  ok: false as const,
  error: { code: 'NETWORK_ERROR', message: 'x', retryable: true },
};

afterEach(() => vi.resetAllMocks());

describe('T-11-354 정리에서 뺄 커리어', () => {
  it('은퇴 전 세이브와 올리지 못한 업로드의 커리어를 한 번씩 넣는다', () => {
    const outbox = [
      { kind: 'season', careerId: 'a', year: 2026, body: {} },
      { kind: 'retirement', careerId: 'b', body: {} },
      { kind: 'season', careerId: 'a', year: 2027, body: {} },
    ] as unknown as OutboxItem[];
    expect(cleanupKeep({ cid: 'a', retired: false }, outbox)).toEqual(['a', 'b']);
    expect(cleanupKeep({ cid: 'c', retired: true }, [])).toEqual([]);
    expect(cleanupKeep(null, [])).toEqual([]);
  });

  it('최대 20개까지만 보낸다', () => {
    const outbox = Array.from({ length: 30 }, (_, i) => ({
      kind: 'retirement',
      careerId: `id${i}`,
      body: {},
    })) as unknown as OutboxItem[];
    expect(cleanupKeep({ cid: 'cur' }, outbox)).toHaveLength(20);
    expect(cleanupKeep({ cid: 'cur' }, outbox)[0]).toBe('cur');
  });
});

describe('T-11-354 정리할 커리어 찾기', () => {
  it('찾은 수 · 없음 · 오류', async () => {
    vi.mocked(cachedGet).mockResolvedValueOnce({ ok: true, data: { count: 3 } });
    expect(await findStaleCareers(['a', 'b'])).toEqual({ kind: 'found', count: 3 });
    expect(vi.mocked(cachedGet).mock.calls[0]![0]).toBe('/v1/careers/mine/stale?keep=a,b');

    vi.mocked(cachedGet).mockResolvedValueOnce({ ok: true, data: { count: 0 } });
    expect(await findStaleCareers([])).toEqual({ kind: 'none' });
    expect(vi.mocked(cachedGet).mock.calls[1]![0]).toBe('/v1/careers/mine/stale');

    vi.mocked(cachedGet).mockResolvedValueOnce(fail as never);
    expect(await findStaleCareers([])).toEqual({ kind: 'error' });
  });
});

describe('T-11-354 정리', () => {
  it('남은 게 없을 때까지 나눠 부르고 정리한 수를 더한다', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ ok: true, data: { cleared: 500, remaining: 120 } })
      .mockResolvedValueOnce({ ok: true, data: { cleared: 120, remaining: 0 } });
    expect(await clearStaleCareers(['a'])).toEqual({ ok: true, cleared: 620 });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(vi.mocked(apiFetch).mock.calls[0]![1]!.body as string)).toEqual({
      keep: ['a'],
    });
  });

  it('중간에 실패하면 그때까지 정리한 수와 함께 멈춘다', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ ok: true, data: { cleared: 500, remaining: 10 } })
      .mockResolvedValueOnce(fail as never);
    expect(await clearStaleCareers([])).toEqual({ ok: false, cleared: 500 });
  });

  it('정리할 게 없으면 한 번만 부른다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: { cleared: 0, remaining: 0 } });
    expect(await clearStaleCareers([])).toEqual({ ok: true, cleared: 0 });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
