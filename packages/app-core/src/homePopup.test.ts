import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimHomePopup, homePopupTurn, passHomePopup, resetHomePopup } from './homePopup.js';

beforeEach(() => {
  resetHomePopup();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const settledFlag = (p: Promise<void>) => {
  const s = { done: false };
  void p.then(() => (s.done = true));
  return s;
};

describe('home popup order', () => {
  it('한 방문에 홈 팝업은 하나만', () => {
    expect(claimHomePopup('attendance')).toBe(true);
    expect(claimHomePopup('partner')).toBe(false);
  });

  it('출석은 기다리지 않는다', async () => {
    const s = settledFlag(homePopupTurn('attendance'));
    await Promise.resolve();
    expect(s.done).toBe(true);
  });

  it('제휴 팝업은 출석 · 컵 우승이 정할 때까지 기다린다', async () => {
    const s = settledFlag(homePopupTurn('partner'));
    passHomePopup('attendance');
    await Promise.resolve();
    expect(s.done).toBe(false);
    passHomePopup('cup');
    await Promise.resolve();
    expect(s.done).toBe(true);
    expect(claimHomePopup('partner')).toBe(true);
  });

  it('앞 순서 창이 자리를 잡으면 바로 풀리고 자리는 내주지 않는다', async () => {
    const s = settledFlag(homePopupTurn('cup'));
    expect(claimHomePopup('attendance')).toBe(true);
    await Promise.resolve();
    expect(s.done).toBe(true);
    expect(claimHomePopup('cup')).toBe(false);
  });

  it('앞 순서 창이 소식이 없으면 정해진 시간 뒤에 차례가 온다', async () => {
    const s = settledFlag(homePopupTurn('partner', 3000));
    await vi.advanceTimersByTimeAsync(2999);
    expect(s.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(s.done).toBe(true);
    expect(claimHomePopup('partner')).toBe(true);
  });
});
