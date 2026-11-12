import { expect, it, vi } from 'vitest';
import { createAccountCache, type AccountCacheState } from './accountCache.js';
import type { Profile } from './api/client.js';

const profile = (id: string): Profile => ({
  id,
  linked: { google: false, apple: false, toss: false },
  googleEmailMasked: null,
  recoveryCodeIssuedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  nickname: null,
});

it('shares an unknown-account load, keeps the exact TTL boundary, and waits for a stale refresh', async () => {
  let now = 1_000_000;
  let finish!: () => void;
  const cache: AccountCacheState = { value: undefined, fetchedAt: 0 };
  const load = vi.fn(async (_silent: boolean) => {
    await new Promise<void>((r) => (finish = r));
    policy.setAccount(profile('A'));
  });
  const policy = createAccountCache(cache, load, () => now);
  policy.ensureAccount();
  const first = policy.freshAccount();
  const same = policy.freshAccount();
  expect(first).toBe(same);
  expect(load.mock.calls).toEqual([[false]]);
  finish();
  await first;
  now += 5 * 60_000;
  expect(policy.accountFresh()).toBe(true);
  await policy.freshAccount();
  expect(load).toHaveBeenCalledTimes(1);
  now++;
  expect(policy.accountFresh()).toBe(false);
  const stale = policy.freshAccount();
  expect(cache.value).toEqual(profile('A'));
  expect(load.mock.calls).toEqual([[false], [true]]);
  finish();
  await stale;
  expect(policy.accountFresh()).toBe(true);
});

it('preserves unknown, failure and absent account states and notifies without changing same-account generation', () => {
  const cache: AccountCacheState = { value: undefined, fetchedAt: 0 };
  const policy = createAccountCache(
    cache,
    async () => {},
    () => 100,
  );
  const observe = vi.fn();
  policy.onAccountChange(() => {
    throw Error('optional observer');
  });
  const off = policy.onAccountChange(observe);
  policy.setAccount(profile('A'));
  const generation = policy.accountGeneration();
  policy.setAccount(profile('A'));
  expect(policy.accountGeneration()).toBe(generation);
  expect(observe).toHaveBeenCalledTimes(2);
  policy.setAccount(null, false);
  expect(cache.fetchedAt).toBe(100);
  expect(cache.value).toBeNull();
  policy.setAccount('error');
  expect(cache.value).toBe('error');
  expect(policy.accountFresh()).toBe(true);
  policy.setAccount(undefined, false);
  expect(policy.accountFresh()).toBe(false);
  expect(policy.accountGeneration()).toBe(generation + 3);
  off();
  policy.setAccount(profile('B'));
  expect(observe).toHaveBeenCalledTimes(5);
});

it('allows a new request after a rejected load', async () => {
  const cache: AccountCacheState = { value: undefined, fetchedAt: 0 };
  const load = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(Error('offline'))
    .mockResolvedValueOnce();
  const policy = createAccountCache(cache, load);
  await expect(policy.freshAccount()).rejects.toThrow('offline');
  await policy.freshAccount();
  expect(load).toHaveBeenCalledTimes(2);
});
