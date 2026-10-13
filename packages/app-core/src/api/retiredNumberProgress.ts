import type { RetiredNumberProgress } from '@offside/contracts';
import { cachedGet, invalidateApiCache } from './client.js';

const progressPath = (careerId: string) =>
  `/v1/careers/${encodeURIComponent(careerId)}/retired-number-progress`;
const listeners = new Map<string, Set<() => void>>();

/** Subscribe only while the guide is open. The outbox notifies once per synced career/batch. */
export function onRetiredNumberProgressSynced(careerId: string, fn: () => void): () => void {
  const callbacks = listeners.get(careerId) ?? new Set<() => void>();
  callbacks.add(fn);
  listeners.set(careerId, callbacks);
  return () => {
    callbacks.delete(fn);
    if (!callbacks.size) listeners.delete(careerId);
  };
}

/** Successful season uploads invalidate only this career's guide, including every shirt number. */
export function retiredNumberProgressSynced(careerId: string): void {
  invalidateApiCache(progressPath(careerId));
  for (const fn of listeners.get(careerId) ?? []) fn();
}

// Shared web/native cache. Successful season batches invalidate it before notifying open guides.
export const fetchRetiredNumberProgress = (careerId: string, number: number) =>
  cachedGet<RetiredNumberProgress>(`${progressPath(careerId)}?number=${number}`, 5 * 60_000);
