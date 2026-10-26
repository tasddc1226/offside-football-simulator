import type { CareerActivityInput } from '@offside/contracts';
import { apiFetch } from './api/client.js';

const MIN_GAP_MS = 60_000;
// T-11-505 서버는 같은 상태를 복귀 푸시(3 · 7 · 14일) 판정에만 쓴다. 켜 둔 채 계속 하는 동안은 6시간에 한 번만 보낸다.
const DEDUPE_MS = 6 * 60 * 60_000;
const RETRY_MS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000];
export const ACTIVITY_RATE_LIMIT_WAIT_MS = 60 * 60_000;
type SendResult = boolean | { ok: false; retryable: boolean; retryAfterMs?: number };
const keyOf = (input: CareerActivityInput) => `${input.careerId}:${input.state}`;

/** Latest activity plus one retirement marker; timers exist only for pending work. */
export function createCareerActivityTracker(
  send: (input: CareerActivityInput) => Promise<SendResult>,
  now: () => number = Date.now,
) {
  let pending: CareerActivityInput[] = [];
  let inFlight: CareerActivityInput | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let lastKey = '';
  let dedupeUntil = 0;
  let nextAt = 0;
  let failures = 0;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    clearTimer();
    if (!active || !pending.length || running || failures > RETRY_MS.length) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void flush();
      },
      Math.max(0, nextAt - now()),
    );
  }
  function flush(): Promise<void> {
    if (running) return running;
    if (!active || !pending.length || now() < nextAt) {
      schedule();
      return Promise.resolve();
    }
    clearTimer();
    // Defer send until running is assigned, including for synchronously throwing transports.
    running = Promise.resolve()
      .then(async () => {
        const current = pending.shift()!;
        inFlight = current;
        let result: SendResult = false;
        try {
          result = await send(current);
        } catch {
          // The save remains usable offline; keep the same pending activity.
        }
        if (result === true || (typeof result === 'object' && !result.retryable)) {
          failures = 0;
          lastKey = keyOf(current);
          dedupeUntil = now() + DEDUPE_MS;
          nextAt = now() + MIN_GAP_MS;
        } else {
          failures++;
          const retryAfter = typeof result === 'object' ? result.retryAfterMs : undefined;
          nextAt =
            now() +
            Math.max(
              MIN_GAP_MS,
              retryAfter ?? RETRY_MS[Math.min(failures - 1, RETRY_MS.length - 1)]!,
            );
          // Newer activity supersedes an old non-retirement failure. Preserve a retirement
          // before the latest state, but a newer retirement already carries that marker.
          if (current.state === 'retired') {
            if (!pending.some((x) => x.state === 'retired')) pending.unshift(current);
          } else if (!pending.length) pending.push(current);
        }
        inFlight = undefined;
      })
      .finally(() => {
        running = undefined;
        schedule();
      });
    return running;
  }
  function report(input: CareerActivityInput): Promise<void> {
    failures = Math.min(failures, RETRY_MS.length);
    input = { careerId: input.careerId, state: input.state };
    const key = keyOf(input);
    if (
      !pending.length &&
      (key === keyOfOptional(inFlight) || (key === lastKey && now() < dedupeUntil))
    )
      return running ?? Promise.resolve();
    if (pending.at(-1) && keyOf(pending.at(-1)!) === key) return flush();
    // This endpoint records one profile state and the first retirement, not a career ledger.
    const retired = input.state === 'retired' ? input : pending.find((x) => x.state === 'retired');
    pending = retired ? [retired] : [];
    if (input.state !== 'retired') pending.push(input);
    return flush();
  }
  function setActive(value: boolean) {
    active = value;
    if (!active) clearTimer();
    else {
      failures = Math.min(failures, RETRY_MS.length);
      void flush();
    }
  }
  function resume() {
    failures = Math.min(failures, RETRY_MS.length);
    return flush(); // Foreground/online events never bypass an existing cooldown.
  }
  function dispose() {
    active = false;
    clearTimer();
  }
  return { report, flush: resume, setActive, dispose };
}
const keyOfOptional = (input: CareerActivityInput | undefined) => input && keyOf(input);

const tracker = createCareerActivityTracker(async (input) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const result = await apiFetch('/v1/career-activity', {
      method: 'PUT',
      body: JSON.stringify(input),
      keepCache: true,
      signal: controller.signal,
    });
    if (result.ok) return true;
    return {
      ok: false,
      retryable:
        result.error.retryable ||
        ['RATE_LIMITED', 'PROFILE_REQUIRED', 'INVALID_RESPONSE', 'NETWORK_ERROR'].includes(
          result.error.code,
        ),
      ...(result.error.code === 'RATE_LIMITED'
        ? { retryAfterMs: ACTIVITY_RATE_LIMIT_WAIT_MS }
        : {}),
    };
  } finally {
    clearTimeout(timer);
  }
});
export const reportCareerActivity = tracker.report;
export const flushCareerActivity = tracker.flush;
export const setCareerActivityActive = tracker.setActive;
