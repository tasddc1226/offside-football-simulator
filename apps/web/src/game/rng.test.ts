import { describe, expect, it } from 'vitest';
import { createRng, setActiveRng, freshSeed } from './rng.js';
import { newGame } from './engine.js';

describe('시드 기반 PRNG', () => {
  it('같은 시드는 항상 같은 난수 시퀀스를 낸다', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 (거의 항상) 다른 시퀀스를 낸다', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('getState/setState로 정확히 재현된다', () => {
    const rng = createRng(999);
    rng.next();
    rng.next();
    const state = rng.getState();
    const before = rng.next();
    const replay = createRng(0);
    replay.setState(state);
    const after = replay.next();
    expect(after).toBe(before);
  });

  it('freshSeed는 0..0xffffffff 범위의 정수를 낸다', () => {
    for (let i = 0; i < 20; i++) {
      const seed = freshSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('같은 시드로 newGame을 두 번 호출하면 동일한 커리어 초기 상태가 나온다', () => {
    const opts = {
      name: '테스트선수',
      number: 7,
      pos: 'FW' as const,
      foot: '오른발' as const,
      type: 'poacher',
      trait: 'late',
    };
    setActiveRng(createRng(42));
    const g1 = newGame({ ...opts }, 42);
    setActiveRng(createRng(42));
    const g2 = newGame({ ...opts }, 42);
    expect(g1.attrs).toEqual(g2.attrs);
    expect(g1.sub).toEqual(g2.sub);
    expect(g1.pot).toBe(g2.pot);
    expect(g1.club.id).toBe(g2.club.id);
  });

  it('다른 시드로 newGame을 호출하면 (거의 항상) 다른 결과가 나온다', () => {
    const opts = {
      name: '테스트선수',
      number: 7,
      pos: 'FW' as const,
      foot: '오른발' as const,
      type: 'poacher',
      trait: 'late',
    };
    setActiveRng(createRng(1));
    const g1 = newGame({ ...opts }, 1);
    setActiveRng(createRng(2));
    const g2 = newGame({ ...opts }, 2);
    expect(g1.attrs).not.toEqual(g2.attrs);
  });
});
