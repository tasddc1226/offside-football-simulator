import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('./api/client.js', () => ({ apiFetch }));
const input = { careerId: '00000000-0000-4000-8000-000000000001', state: 'active' } as const;
beforeEach(() => {
  vi.resetModules();
  apiFetch.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it.each([
  ['RATE_LIMITED', 60 * 60_000],
  ['PROFILE_REQUIRED', 60_000],
  ['INVALID_RESPONSE', 60_000],
  ['NETWORK_ERROR', 60_000],
])('retries %s with the appropriate delay and no extra profile GET', async (code, wait) => {
  apiFetch
    .mockResolvedValueOnce({ ok: false, error: { code, retryable: false } })
    .mockResolvedValue({ ok: true });
  const activity = await import('./careerActivity.js');
  await activity.reportCareerActivity(input);
  await vi.advanceTimersByTimeAsync(Number(wait) - 1);
  expect(apiFetch).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(apiFetch).toHaveBeenCalledTimes(2);
  expect(apiFetch.mock.calls.every(([path]) => path === '/v1/career-activity')).toBe(true);
  expect(JSON.parse(apiFetch.mock.calls[1]![1].body)).toEqual(input);
  expect(apiFetch.mock.calls[1]![1].keepCache).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not retry a permanent ownership rejection', async () => {
  apiFetch.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', retryable: false } });
  const activity = await import('./careerActivity.js');
  await activity.reportCareerActivity(input);
  await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
  expect(apiFetch).toHaveBeenCalledOnce();
});
