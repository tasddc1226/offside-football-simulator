import { describe, expect, it, vi } from 'vitest';
import { observeOfferView, watchMeasuredShown } from './offerVisibility.js';

type Entry = { isIntersecting: boolean; intersectionRatio: number };
function fakeIO() {
  const made: {
    cb: (e: Entry[]) => void;
    init: unknown;
    observed: unknown[];
    disconnects: number;
  }[] = [];
  class IO {
    rec: (typeof made)[number];
    constructor(cb: (e: Entry[]) => void, init?: unknown) {
      this.rec = { cb, init, observed: [], disconnects: 0 };
      made.push(this.rec);
    }
    observe(n: unknown) {
      this.rec.observed.push(n);
    }
    disconnect() {
      this.rec.disconnects++;
    }
  }
  return { IO, made, fire: (e: Entry) => made.at(-1)!.cb([e]) };
}

describe('web offer visibility (IntersectionObserver)', () => {
  it('an initial 1% intersecting callback is not an exposure; ≥50% is, once per mount', () => {
    const io = fakeIO();
    const onShown = vi.fn();
    const node = {};
    observeOfferView(node, { IO: io.IO, ready: () => true, onShown });
    expect(io.made[0]!.observed).toEqual([node]);
    expect(io.made[0]!.init).toEqual({ threshold: 0.5 });
    io.fire({ isIntersecting: true, intersectionRatio: 0.01 });
    io.fire({ isIntersecting: true, intersectionRatio: 0.49 });
    expect(onShown).not.toHaveBeenCalled();
    io.fire({ isIntersecting: true, intersectionRatio: 0.5 });
    io.fire({ isIntersecting: true, intersectionRatio: 1 });
    expect(onShown).toHaveBeenCalledOnce();
    expect(io.made[0]!.disconnects).toBe(1);
  });

  it('offscreen (not intersecting) never counts, even with a stale ratio', () => {
    const io = fakeIO();
    const onShown = vi.fn();
    observeOfferView({}, { IO: io.IO, ready: () => true, onShown });
    io.fire({ isIntersecting: false, intersectionRatio: 0.9 });
    io.fire({ isIntersecting: false, intersectionRatio: 0 });
    expect(onShown).not.toHaveBeenCalled();
  });

  it('a disabled (busy) offer is not counted until it is enabled and visible again', () => {
    const io = fakeIO();
    const onShown = vi.fn();
    let busy = true;
    observeOfferView({}, { IO: io.IO, ready: () => !busy, onShown });
    io.fire({ isIntersecting: true, intersectionRatio: 1 });
    expect(onShown).not.toHaveBeenCalled();
    busy = false;
    io.fire({ isIntersecting: true, intersectionRatio: 0.8 });
    expect(onShown).toHaveBeenCalledOnce();
  });

  it('a new mount counts again; destroy disconnects; no observer means no exposure', () => {
    const io = fakeIO();
    const onShown = vi.fn();
    const destroy = observeOfferView({}, { IO: io.IO, ready: () => true, onShown });
    destroy();
    expect(io.made[0]!.disconnects).toBe(1);
    observeOfferView({}, { IO: io.IO, ready: () => true, onShown });
    io.fire({ isIntersecting: true, intersectionRatio: 0.6 });
    expect(onShown).toHaveBeenCalledOnce();
    expect(() =>
      observeOfferView({}, { IO: undefined, ready: () => true, onShown })(),
    ).not.toThrow();
  });

  it('a callback already queued before destroy (unmounted offer) is not counted', () => {
    const io = fakeIO();
    const onShown = vi.fn();
    const destroy = observeOfferView({}, { IO: io.IO, ready: () => true, onShown });
    const queued = io.made[0]!.cb;
    destroy();
    queued([{ isIntersecting: true, intersectionRatio: 1 }]);
    expect(onShown).not.toHaveBeenCalled();
  });

  it('a throwing observer or onShown never escapes', () => {
    class Broken {
      constructor() {
        throw new Error('no IO');
      }
      observe() {}
      disconnect() {}
    }
    expect(() =>
      observeOfferView({}, { IO: Broken, ready: () => true, onShown: () => {} })(),
    ).not.toThrow();
    const io = fakeIO();
    observeOfferView(
      {},
      {
        IO: io.IO,
        ready: () => true,
        onShown: () => {
          throw new Error('sdk');
        },
      },
    );
    expect(() => io.fire({ isIntersecting: true, intersectionRatio: 1 })).not.toThrow();
  });
});

describe('native offer visibility (measured share)', () => {
  function harness() {
    const subs = new Set<() => void>();
    let share: number | null = 0;
    const pending: ((s: number) => void)[] = [];
    let deferred = false;
    const onShown = vi.fn();
    const w = watchMeasuredShown({
      measure: (cb) => {
        if (share === null) return; // 스크롤 창을 잴 수 없음
        if (deferred) pending.push(cb);
        else cb(share);
      },
      subscribe: (fn) => {
        subs.add(fn);
        return () => void subs.delete(fn);
      },
      onShown,
    });
    return {
      w,
      onShown,
      subs,
      scroll: (s: number | null) => {
        share = s;
        subs.forEach((fn) => fn());
      },
      defer: () => (deferred = true),
      resolve: (s: number) => pending.splice(0).forEach((cb) => cb(s)),
    };
  }

  it('mounted / expanded but offscreen is not an exposure; scrolling it ≥50% into view is, once', () => {
    const h = harness();
    h.w.check(); // 펼친 직후 화면 밖(0%)
    h.scroll(0.3);
    expect(h.onShown).not.toHaveBeenCalled();
    h.scroll(0.5);
    h.scroll(1);
    expect(h.onShown).toHaveBeenCalledOnce();
    expect(h.subs.size).toBe(0); // 한 번 세면 스크롤 구독을 끊는다
  });

  it('no measurable scroll viewport means no exposure', () => {
    const h = harness();
    h.scroll(null);
    h.w.check();
    expect(h.onShown).not.toHaveBeenCalled();
  });

  it('a measurement that arrives after unmount / busy (stop) is dropped', () => {
    const h = harness();
    h.defer();
    h.w.check();
    h.w.stop();
    h.resolve(1);
    expect(h.onShown).not.toHaveBeenCalled();
  });
});
