import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COACH_STEPS,
  bubbleAt,
  coachAt,
  coachDone,
  coachPick,
  coachReplay,
  coachResume,
  playedBefore,
} from './tutorial.js';

function fakeStorage(opts: { full?: boolean } = {}) {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.full) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
  });
  return m;
}

describe('T-11-473 첫 커리어 따라가기 안내', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('처음 온 기기는 첫 단계부터, 커리어를 해 본 기기는 띄우지 않는다', () => {
    const m = fakeStorage();
    expect(playedBefore()).toBe(false);
    expect(coachResume()).toBe(0);
    m.clear();
    m.set('ft_hof', '[]');
    expect(playedBefore()).toBe(true);
    expect(coachResume()).toBeNull();
    // 한 번 끝난 것으로 적으면 세이브를 지워도 다시 뜨지 않는다.
    m.delete('ft_hof');
    expect(coachResume()).toBeNull();
  });

  it('본 단계까지 기억하고, 건너뛰면 끝나며, 다시 보기는 처음부터', () => {
    fakeStorage();
    expect(coachResume(false)).toBe(0);
    coachAt(3);
    expect(coachResume(false)).toBe(3);
    coachAt(COACH_STEPS.length);
    expect(coachResume(false)).toBeNull();
    expect(coachReplay()).toBe(0);
    expect(coachResume(true)).toBe(0);
    coachDone();
    expect(coachResume(false)).toBeNull();
  });

  it('저장소에 적을 수 없으면 띄우지 않는다(매번 처음부터 뜨지 않게)', () => {
    fakeStorage({ full: true });
    expect(coachResume(false)).toBeNull();
  });

  it('지금 화면에 보이는 첫 단계를 고르고, 앞 단계를 지나쳤으면 따라간다', () => {
    const on =
      (...ids: string[]) =>
      (id: string) =>
        ids.includes(id);
    expect(coachPick(0, on('new'))).toBe(0);
    expect(coachPick(0, on('pos', 'focus', 'candidates'))).toBe(1);
    expect(coachPick(2, on('pos', 'focus', 'candidates'))).toBe(2);
    expect(coachPick(1, on('cands', 'start'))).toBe(4);
    expect(coachPick(6, on('new'))).toBeNull();
    // 은퇴 안내는 결산 카드를 그대로 비춘다.
    expect(coachPick(9, on('season'))).toBe(9);
    expect(new Set(COACH_STEPS.map((s) => s.id)).size).toBe(COACH_STEPS.length);
  });

  it('말풍선은 아래에 자리가 있으면 아래, 없으면 위에, 화면 안으로', () => {
    const view = { w: 390, h: 800 };
    const b = { w: 320, h: 140 };
    expect(bubbleAt({ x: 20, y: 100, w: 350, h: 50 }, view, b)).toEqual({
      x: 35,
      y: 162,
      below: true,
    });
    const up = bubbleAt({ x: 16, y: 700, w: 358, h: 60 }, view, b);
    expect(up.below).toBe(false);
    expect(up.y).toBe(700 - 12 - 140);
    expect(bubbleAt({ x: 360, y: 100, w: 30, h: 30 }, view, b).x).toBe(390 - 16 - 320);
  });
});
