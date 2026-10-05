import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotificationInbox, initialInboxState } from './notification-inbox.js';
import { apiFetch } from './api/client.js';
vi.mock('./api/client.js', () => ({ apiFetch: vi.fn() }));
const request = vi.mocked(apiFetch);
const item = (id = 'ntf_one') => ({
  id,
  kind: 'news' as const,
  title: '새 소식',
  body: '새 공지를 확인해요.',
  target: { type: 'screen' as const, screen: 'home' as const },
  createdAt: '2026-10-05T06:00:00.000Z',
  readAt: null,
});
const page = (items = [item()]) => ({
  ok: true as const,
  data: { items, nextCursor: null, unreadCount: items.length },
});
beforeEach(() => {
  vi.resetAllMocks();
});
describe('session-private inbox cache', () => {
  it('deduplicates simultaneous loads and caches repeat screen entry until invalidated', async () => {
    request.mockResolvedValue(page());
    const s = initialInboxState(),
      c = createNotificationInbox(s);
    await Promise.all([c.load(), c.load()]);
    await c.load();
    expect(request).toHaveBeenCalledOnce();
    c.invalidate();
    await c.load();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('drops an old account response after reset and retains no private detail', async () => {
    let finish!: (value: ReturnType<typeof page>) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const s = initialInboxState(),
      c = createNotificationInbox(s);
    const old = c.load();
    c.reset();
    request.mockResolvedValueOnce(page([item('ntf_new')]));
    await c.load();
    finish(page());
    await old;
    expect(s.items.map((x) => x.id)).toEqual(['ntf_new']);
    expect(s.detail).toBeNull();
  });
  it('marks detail read after opening, updates counts and removes it from the unread filter', async () => {
    request
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce({ ok: true, data: { readAt: '2026-10-05T06:01:00.000Z' } });
    const s = initialInboxState(),
      c = createNotificationInbox(s);
    await c.load({ unread: true });
    await c.open('ntf_one');
    expect(request.mock.calls.map(([p]) => p)).toEqual([
      '/v1/notifications?unread=1',
      '/v1/notifications/ntf_one/read',
    ]);
    expect(s.items).toEqual([]);
    expect(s.detail?.readAt).toBeTruthy();
    expect(s.unreadCount).toBe(0);
  });
  it('retains unread state on failed read and preserves retry feedback', async () => {
    request.mockResolvedValueOnce(page()).mockResolvedValueOnce({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '다시 시도해요.', retryable: true },
    });
    const s = initialInboxState(),
      c = createNotificationInbox(s);
    await c.load();
    await c.open('ntf_one');
    expect(s.unreadCount).toBe(1);
    expect(s.detail?.readAt).toBeNull();
    expect(s.error).toBe('다시 시도해요.');
  });
  it('bounds read-all by the newest loaded timestamp and waits for a write before loading another filter', async () => {
    request.mockResolvedValueOnce(page());
    const s = initialInboxState(),
      c = createNotificationInbox(s);
    await c.load();
    let finish!: (r: { ok: true; data: { updated: number } }) => void;
    request
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(page([]));
    const write = c.readAll(),
      reload = c.load({ unread: true });
    finish({ ok: true, data: { updated: 1 } });
    await Promise.all([write, reload]);
    expect(JSON.parse(request.mock.calls[1]![1]!.body as string)).toEqual({
      through: item().createdAt,
    });
    expect(request.mock.calls[2]![0]).toBe('/v1/notifications?unread=1');
    expect(s.items).toEqual([]);
  });
  it('keeps invalidation that arrives during a load and prevents old account detail from marking read', async () => {
    let finish!: (r: ReturnType<typeof page>) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const s = initialInboxState(),
      c = createNotificationInbox(s);
    const loading = c.load();
    c.invalidate();
    finish(page());
    await loading;
    request.mockResolvedValueOnce(page());
    await c.load();
    expect(request).toHaveBeenCalledTimes(2);
    let detail!: (r: { ok: true; data: ReturnType<typeof item> }) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          detail = resolve;
        }),
    );
    const old = c.open('ntf_missing');
    await vi.waitFor(() => expect(detail).toBeTypeOf('function'));
    c.reset();
    detail({ ok: true, data: item('ntf_missing') });
    await old;
    expect(request.mock.calls.some(([p]) => p.endsWith('/read'))).toBe(false);
    expect(s.detail).toBeNull();
  });
});
