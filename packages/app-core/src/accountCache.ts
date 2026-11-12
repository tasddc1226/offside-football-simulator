import type { Profile } from './api/client.js';

export type AccountValue = Profile | null | 'error' | undefined;
export type AccountCacheState = { value: AccountValue; fetchedAt: number };
const REVALIDATE_MS = 5 * 60_000;
const idOf = (p: AccountValue) => (p && p !== 'error' ? p.id : p);

/** Shared freshness and account-generation policy. Session renewal and reactive state stay in adapters. */
export function createAccountCache(
  cache: AccountCacheState,
  loadAccount: (silent: boolean) => Promise<void>,
  now: () => number = () => Date.now(),
) {
  let generation = 0;
  let inflight: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function setAccount(value: AccountValue, fetched = true) {
    const before = cache.value;
    if (fetched) cache.fetchedAt = now();
    cache.value = value;
    if (idOf(before) !== idOf(value)) generation++;
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        // An optional observer cannot prevent account state from settling.
      }
    }
  }

  function load(silent: boolean): Promise<void> {
    inflight ??= loadAccount(silent).finally(() => (inflight = null));
    return inflight;
  }
  function freshAccount(): Promise<void> {
    if (cache.value === undefined) return load(false);
    if (now() - cache.fetchedAt > REVALIDATE_MS) return load(true);
    return inflight ?? Promise.resolve();
  }
  return {
    setAccount,
    accountGeneration: () => generation,
    onAccountChange(fn: () => void): () => void {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    ensureAccount() {
      if (cache.value === undefined) void load(false);
      else if (now() - cache.fetchedAt > REVALIDATE_MS) void load(true);
    },
    freshAccount,
    accountFresh: () => cache.value !== undefined && now() - cache.fetchedAt <= REVALIDATE_MS,
  };
}
