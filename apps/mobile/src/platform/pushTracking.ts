import * as Crypto from 'expo-crypto';
import { apiFetch } from '@offside/app-core/api/client';
import { NotificationIdSchema } from '@offside/contracts';
import { kv } from './setup';
import { sessionToken, onSessionChanged } from './session';

const KEY = 'offside_push_interactions';
type Entry = {
  id: string;
  event: 'click' | 'target_open';
  occurredAt: string;
  sessionHash: string;
};
let revision = 0;
let flushing: Promise<void> | undefined;
let adding = Promise.resolve();
function entries(): Entry[] {
  try {
    const raw: unknown = JSON.parse(kv.getString(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (e): e is Entry =>
          e &&
          NotificationIdSchema.safeParse(e.id).success &&
          (e.event === 'click' || e.event === 'target_open') &&
          typeof e.sessionHash === 'string' &&
          typeof e.occurredAt === 'string' &&
          Date.parse(e.occurredAt) >= Date.now() - 86400_000,
      )
      .slice(-50);
  } catch {
    return [];
  }
}
function save(rows: Entry[]) {
  kv.set(KEY, JSON.stringify(rows));
}
const key = (e: Entry) => `${e.sessionHash}:${e.id}:${e.event}`;
onSessionChanged(() => {
  revision++;
  kv.remove(KEY);
});

/** Bounded offline buffer. No token is persisted; changing account clears old events. */
export async function trackPushInteraction(id: string, event: Entry['event']) {
  const token = sessionToken();
  if (!token || !NotificationIdSchema.safeParse(id).success) return;
  const at = new Date().toISOString();
  const rev = revision;
  adding = adding
    .then(async () => {
      const sessionHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        token,
      );
      if (rev !== revision || token !== sessionToken()) return;
      const next = { id, event, occurredAt: at, sessionHash };
      const rows = entries();
      if (!rows.some((row) => key(row) === key(next))) save([...rows, next].slice(-50));
    })
    .catch(() => {});
  await adding;
  await flushPushInteractions();
}
export function flushPushInteractions(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const token = sessionToken();
    if (!token) return;
    const rev = revision;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
    if (rev !== revision || token !== sessionToken()) return;
    save(entries().filter((e) => e.sessionHash === hash));
    while (rev === revision && token === sessionToken()) {
      const entry = entries()[0];
      if (!entry) return;
      const result = await apiFetch(`/v1/notifications/${entry.id}/interaction`, {
        method: 'POST',
        keepCache: true,
        body: JSON.stringify({ event: entry.event, occurredAt: entry.occurredAt }),
      });
      if (rev !== revision || token !== sessionToken()) return;
      if (!result.ok && result.error.retryable) return;
      save(entries().filter((e) => key(e) !== key(entry)));
    }
  })()
    .catch(() => {})
    .finally(() => {
      flushing = undefined;
    });
  return flushing;
}
