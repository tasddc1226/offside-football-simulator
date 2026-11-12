import { describe, expect, it, vi } from 'vitest';
import { createScoutAttempts } from './scoutAttempts.js';

const transient = { ok: false, error: { retryable: true } } as const;
const terminal = { ok: false, error: {} } as const;
const done = { ok: true } as const;
function setup() {
  let seq = 0;
  const key = vi.fn(() => `key-${++seq}`);
  const plan = vi.fn(() => ({ seed: seq * 100, hit: seq % 2 === 0 }));
  return { attempts: createScoutAttempts(plan, key), key, plan };
}
describe('scout attempt identity', () => {
  it('does not create a key or draw a seed while merely opening the screen', () => {
    const { key, plan } = setup();
    expect(key).not.toHaveBeenCalled();
    expect(plan).not.toHaveBeenCalled();
  });
  it('retries a scout with both the same idempotency key and the same RNG plan', () => {
    const { attempts, key, plan } = setup();
    const first = attempts.forScout();
    attempts.settleScout(transient);
    const retry = attempts.forScout();
    expect(retry.key).toBe(first.key);
    expect(retry.plan).toBe(first.plan);
    expect(key).toHaveBeenCalledTimes(1);
    expect(plan).toHaveBeenCalledTimes(1);
  });
  it('rotates scout identity only after a terminal response or success', () => {
    const { attempts } = setup();
    const first = attempts.forScout();
    attempts.settleScout(terminal);
    const second = attempts.forScout();
    expect(second.key).not.toBe(first.key);
    expect(second.plan).not.toEqual(first.plan);
    attempts.settleScout(done);
    expect(attempts.forScout().key).not.toBe(second.key);
  });
  it('keeps reroll retries separate from a pending scout plan', () => {
    const { attempts, plan } = setup();
    const scout = attempts.forScout();
    const reroll = attempts.forReroll();
    attempts.settleReroll(transient);
    expect(attempts.forReroll()).toBe(reroll);
    attempts.settleReroll(done);
    const nextReroll = attempts.forReroll();
    expect(nextReroll).not.toBe(reroll);
    expect(attempts.forScout()).toEqual(scout);
    expect(plan).toHaveBeenCalledTimes(1);
    attempts.settleReroll(terminal);
    expect(attempts.forReroll()).not.toBe(nextReroll);
  });
});
