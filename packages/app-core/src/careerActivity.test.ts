import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVITY_RATE_LIMIT_WAIT_MS,
  createCareerActivityTracker,
  type ActivitySent,
} from './careerActivity.js';
const active = { careerId: '00000000-0000-4000-8000-000000000001', state: 'active' } as const;
const next = { ...active, careerId: '00000000-0000-4000-8000-000000000002' };
const retired = { ...active, state: 'retired' } as const;
const none = { careerId: null, state: 'none' } as const;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('career activity delivery', () => {
  it('coalesces repeated saves for 6 hours with no idle polling', async () => {
    const send = vi.fn(async () => true);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    for (let i = 0; i < 100; i++) await tracker.report({ ...active });
    expect(send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await advance(6 * 60 * 60_000 - 1);
    await tracker.report(active);
    expect(send).toHaveBeenCalledOnce();
    await advance(1);
    await tracker.report(active);
    expect(send).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the 6-hour window across app launches through the device store', async () => {
    let saved: ActivitySent | null = null;
    const store = { read: () => saved, write: (v: ActivitySent) => void (saved = v) };
    const send = vi.fn(async () => true);
    await createCareerActivityTracker(send, Date.now, store).report(active);
    await advance(60 * 60_000);
    // 다시 켠 앱: 새 추적기라도 같은 상태는 남은 창 동안 보내지 않는다.
    await createCareerActivityTracker(send, Date.now, store).report(active);
    expect(send).toHaveBeenCalledOnce();
    await createCareerActivityTracker(send, Date.now, store).report(retired);
    expect(send).toHaveBeenCalledTimes(2);
    await advance(6 * 60 * 60_000);
    await createCareerActivityTracker(send, Date.now, store).report(retired);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('ignores a stored window longer than 6 hours after the device clock moved back', async () => {
    const saved: ActivitySent = { key: `${active.careerId}:active`, until: 7 * 60 * 60_000 };
    const send = vi.fn(async () => true);
    const store = { read: () => saved, write: vi.fn() };
    await createCareerActivityTracker(send, Date.now, store).report(active);
    expect(send).toHaveBeenCalledOnce();
    expect(store.write).toHaveBeenCalledWith({ key: saved.key, until: 6 * 60 * 60_000 });
  });

  it('does not queue identical saves while the same request is in flight', async () => {
    let release!: (ok: boolean) => void;
    const send = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        }),
    );
    const tracker = createCareerActivityTracker(send);
    const first = tracker.report(active);
    await Promise.resolve();
    for (let i = 0; i < 100; i++) void tracker.report({ ...active });
    release(true);
    await first;
    await advance(60_000);
    expect(send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resumes exhausted retries on gameplay without skipping the existing cooldown', async () => {
    const send = vi.fn(async () => false);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    for (const ms of [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000]) await advance(ms);
    expect(vi.getTimerCount()).toBe(0);
    send.mockResolvedValue(true);
    await tracker.report(active);
    await advance(60 * 60_000 - 1);
    expect(send).toHaveBeenCalledTimes(6);
    await advance(1);
    expect(send).toHaveBeenCalledTimes(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('serializes and paces rapid retirement/new-career transitions', async () => {
    let release!: (ok: boolean) => void;
    const send = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(true);
    const tracker = createCareerActivityTracker(send);
    const first = tracker.report(active);
    await Promise.resolve();
    void tracker.report(retired);
    void tracker.report(next);
    release(true);
    await first;
    expect(send).toHaveBeenCalledOnce();
    await advance(60_000);
    expect(send.mock.calls.map((c) => c[0])).toEqual([active, retired]);
    await advance(60_000);
    expect(send.mock.calls.map((c) => c[0])).toEqual([active, retired, next]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, 'throw'])(
    'retains a failed record and retries without a new gameplay event: %s',
    async (failure) => {
      const send = vi
        .fn()
        .mockImplementationOnce(() =>
          failure === 'throw' ? Promise.reject(new Error('offline')) : Promise.resolve(false),
        )
        .mockResolvedValue(true);
      const tracker = createCareerActivityTracker(send);
      await tracker.report(active);
      await advance(59_999);
      expect(send).toHaveBeenCalledOnce();
      await advance(1);
      expect(send.mock.calls.map((c) => c[0])).toEqual([active, active]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('keeps a retirement before the latest state after a failed attempt', async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(retired);
    await tracker.report(next);
    await advance(60_000);
    await advance(60_000);
    expect(send.mock.calls.map((c) => c[0])).toEqual([retired, retired, next]);
  });

  it('coalesces failures to one retirement marker and the latest state', async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    for (let i = 0; i < 100; i++) {
      await tracker.report({
        ...active,
        careerId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        state: 'retired',
      });
      await tracker.report({
        ...active,
        careerId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      });
    }
    await tracker.report(none);
    await advance(60_000);
    await advance(60_000);
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      active,
      { careerId: '00000000-0000-4000-8000-000000000099', state: 'retired' },
      none,
    ]);
  });

  it('honors an hour-long rate-limit cooldown even when the state changes or online/foreground events fire', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        retryable: true,
        retryAfterMs: ACTIVITY_RATE_LIMIT_WAIT_MS,
      })
      .mockResolvedValue(true);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    for (let i = 0; i < 100; i++) {
      await tracker.report(i % 2 ? next : none);
      await tracker.flush();
      tracker.setActive(true);
    }
    await advance(ACTIVITY_RATE_LIMIT_WAIT_MS - 1);
    expect(send).toHaveBeenCalledOnce();
    await advance(1);
    expect(send.mock.calls.map((c) => c[0])).toEqual([active, next]);
  });

  it('stops automatic retries after five attempts, retaining pending work for a later event', async () => {
    const send = vi.fn(async () => false);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    for (const ms of [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000]) await advance(ms);
    expect(send).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
    await advance(60 * 60_000);
    send.mockResolvedValue(true);
    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses pending retries in the background and resumes without bypassing backoff', async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    tracker.setActive(false);
    expect(vi.getTimerCount()).toBe(0);
    await advance(30_000);
    tracker.setActive(true);
    await advance(29_999);
    expect(send).toHaveBeenCalledOnce();
    await advance(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not keep replaying permanent ownership/validation rejections', async () => {
    const send = vi.fn(async () => ({ ok: false as const, retryable: false }));
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    await tracker.report(active);
    await advance(60_000);
    expect(send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disposes timers without sending new requests', async () => {
    const send = vi.fn(async () => false);
    const tracker = createCareerActivityTracker(send);
    await tracker.report(active);
    tracker.dispose();
    await advance(24 * 60 * 60_000);
    expect(send).toHaveBeenCalledOnce();
  });
});
