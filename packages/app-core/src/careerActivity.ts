import type { CareerActivityInput } from '@offside/contracts';
import { apiFetch } from './api/client.js';

/** Event driven, serialized and coalesced. No polling or save body uploads. */
export function createCareerActivityTracker(
  send: (input: CareerActivityInput) => Promise<boolean>,
  now: () => number = Date.now,
) {
  const pending: CareerActivityInput[] = [];
  let running: Promise<void> | undefined;
  let lastKey = '';
  let nextAt = 0;
  function report(input: CareerActivityInput): Promise<void> {
    const key = `${input.careerId}:${input.state}`;
    if (!pending.length && key === lastKey && now() < nextAt) return running ?? Promise.resolve();
    if (pending.at(-1)?.state !== 'retired') pending.pop();
    pending.push(input);
    if (running) return running;
    running = (async () => {
      while (pending.length) {
        const current = pending.shift()!;
        lastKey = `${current.careerId}:${current.state}`;
        nextAt = now() + 30 * 60_000;
        let ok = false;
        try {
          ok = await send(current);
        } catch {
          /* Offline gameplay remains available. */
        }
        if (!ok) nextAt = now() + 5 * 60_000;
      }
    })().finally(() => {
      running = undefined;
    });
    return running;
  }
  return { report };
}
const tracker = createCareerActivityTracker(async (input) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    return (
      await apiFetch('/v1/career-activity', {
        method: 'PUT',
        body: JSON.stringify(input),
        keepCache: true,
        signal: controller.signal,
      })
    ).ok;
  } finally {
    clearTimeout(timer);
  }
});
export const reportCareerActivity = tracker.report;
