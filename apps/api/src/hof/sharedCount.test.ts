import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { COUNT_FRESH_MS, COUNT_LOCK_MS, sharedCount } from './sharedCount.js';

let t: TestD1;
const D = () => t.env.DB;
const T0 = Date.parse('2026-11-10T13:00:00Z');

beforeAll(async () => {
  t = await createTestD1();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await D().prepare("DELETE FROM app_meta WHERE key LIKE 'hof_count:%'").run();
});

const counter = (n: number) => {
  const calls = { n: 0 };
  return { calls, load: async () => (calls.n++, n) };
};

describe('sharedCount (T-11-688)', () => {
  it('counts once for many concurrent first requests', async () => {
    const { calls, load } = counter(209_000);
    const bg: Promise<unknown>[] = [];
    const got = await Promise.all(
      Array.from({ length: 20 }, () => sharedCount(D(), 'k', load, (p) => bg.push(p), T0)),
    );
    expect(new Set(got)).toEqual(new Set([209_000]));
    expect(calls.n).toBe(1);
  });

  it('serves the stored value while fresh without counting', async () => {
    await sharedCount(
      D(),
      'k',
      async () => 5,
      () => {},
      T0,
    );
    const { calls, load } = counter(9);
    expect(await sharedCount(D(), 'k', load, () => {}, T0 + COUNT_FRESH_MS - 1)).toBe(5);
    expect(calls.n).toBe(0);
  });

  it('refreshes a stale value in the background exactly once', async () => {
    await sharedCount(
      D(),
      'k',
      async () => 5,
      () => {},
      T0,
    );
    const { calls, load } = counter(7);
    const bg: Promise<unknown>[] = [];
    const later = T0 + COUNT_FRESH_MS + 1;
    const got = await Promise.all(
      Array.from({ length: 10 }, () => sharedCount(D(), 'k', load, (p) => bg.push(p), later)),
    );
    expect(new Set(got)).toEqual(new Set([5]));
    await Promise.all(bg);
    expect(calls.n).toBe(1);
    expect(await sharedCount(D(), 'k', load, () => {}, later + 1)).toBe(7);
  });

  it('lets another request take over an abandoned refresh', async () => {
    await sharedCount(
      D(),
      'k',
      async () => 5,
      () => {},
      T0,
    );
    const stale = T0 + COUNT_FRESH_MS + 1;
    // 잡은 쪽이 끝내지 못했다(세는 중 죽음).
    await sharedCount(
      D(),
      'k',
      () => new Promise<number>(() => {}),
      () => {},
      stale,
    );
    const { calls, load } = counter(8);
    const bg: Promise<unknown>[] = [];
    await sharedCount(D(), 'k', load, (p) => bg.push(p), stale + 1);
    expect(calls.n).toBe(0);
    await sharedCount(D(), 'k', load, (p) => bg.push(p), stale + COUNT_LOCK_MS + 1);
    await Promise.all(bg);
    expect(calls.n).toBe(1);
  });

  it('keeps keys apart', async () => {
    expect(
      await sharedCount(
        D(),
        'a',
        async () => 1,
        () => {},
        T0,
      ),
    ).toBe(1);
    expect(
      await sharedCount(
        D(),
        'b',
        async () => 2,
        () => {},
        T0,
      ),
    ).toBe(2);
  });
});
