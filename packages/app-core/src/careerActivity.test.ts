import { describe, expect, it, vi } from 'vitest';
import { createCareerActivityTracker } from './careerActivity.js';
const active = { careerId: '00000000-0000-4000-8000-000000000001', state: 'active' } as const;
describe('career activity network budget', () => {
  it('reports creation and coalesces repeated saves for 30 minutes, without timers/polling', async () => {
    let now = 0;
    const send = vi.fn(async () => true);
    const tracker = createCareerActivityTracker(send, () => now);
    await tracker.report(active);
    for (let i = 0; i < 100; i++) await tracker.report({ ...active });
    expect(send).toHaveBeenCalledOnce();
    now = 30 * 60_000;
    await tracker.report(active);
    expect(send).toHaveBeenCalledTimes(2);
    await tracker.report({ ...active, state: 'retired' });
    expect(send).toHaveBeenCalledTimes(3);
  });
  it('preserves retirement while serializing a rapid new-career transition', async () => {
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
    void tracker.report({ ...active, state: 'retired' });
    void tracker.report({ ...active, careerId: '00000000-0000-4000-8000-000000000002' });
    release(true);
    await first;
    expect(send.mock.calls.map((c) => c[0].state)).toEqual(['active', 'retired', 'active']);
  });
  it('backs off offline failures without blocking retirement or clearing the save', async () => {
    let now = 0;
    const send = vi.fn(async () => false);
    const tracker = createCareerActivityTracker(send, () => now);
    await tracker.report(active);
    await tracker.report(active);
    expect(send).toHaveBeenCalledOnce();
    now = 5 * 60_000;
    await tracker.report(active);
    expect(send).toHaveBeenCalledTimes(2);
    await tracker.report({ careerId: null, state: 'none' });
    expect(send).toHaveBeenCalledTimes(3);
  });
});
