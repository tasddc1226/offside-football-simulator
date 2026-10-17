// Small synchronous durable producer, independent of the lazy-loaded networking module.
import type { PutCareerSeasonBody, PutRetirementBody } from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import { OUTBOX_KEY } from './achDirty.js';

export type OutboxItem = { revision?: number } & (
  | { kind: 'season'; careerId: string; year: number; body: PutCareerSeasonBody }
  | { kind: 'retirement'; careerId: string; body: PutRetirementBody }
);

let unsaved: OutboxItem[] | null = null;
let lastRevision = 0;
export const loadOutbox = (): OutboxItem[] => unsaved ?? loadKey<OutboxItem[]>(OUTBOX_KEY) ?? [];
export function saveOutbox(items: OutboxItem[]): boolean {
  const saved = saveKey(OUTBOX_KEY, items);
  unsaved = saved ? null : items;
  if (!saved) console.error('[outbox] persistence failed; pending records retained');
  return saved;
}
export function persistUpload(item: OutboxItem): boolean {
  const items = loadOutbox();
  // The synchronous producer and lazy sender may enqueue the same immutable payload.
  const signature = (i: OutboxItem) =>
    JSON.stringify({
      kind: i.kind,
      careerId: i.careerId,
      year: i.kind === 'season' ? i.year : undefined,
      body: i.body,
    });
  if (!items.some((i) => signature(i) === signature(item))) {
    lastRevision = items.reduce(
      (v, i) => Math.max(v, (i.revision ?? 0) + 1),
      Math.max(Date.now(), lastRevision + 1),
    );
    items.push({ ...item, revision: lastRevision });
  }
  return saveOutbox(items);
}
