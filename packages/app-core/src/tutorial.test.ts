import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COACH_STEPS,
  bubbleAt,
  coachAt,
  coachDone,
  coachPick,
  coachReplay,
  coachReplaying,
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

  it('T-11-796 다시 보기 표시는 단계를 넘기고 다시 열어도 이어지고, 끝나면 지워진다', () => {
    const m = fakeStorage();
    const saved = () => JSON.parse(m.get('ft_tutorial')!) as unknown;
    // 처음 온 기기의 안내에는 표시가 없다.
    expect(coachResume(false)).toBe(0);
    expect(coachReplaying()).toBe(false);
    coachAt(2);
    expect(saved()).toEqual({ i: 2 });
    coachDone();
    // 커리어 기록이 없는 기기에서 누른 다시 보기도 표시가 붙는다.
    expect(coachReplay()).toBe(0);
    expect(coachReplaying()).toBe(true);
    expect(saved()).toEqual({ i: 0, replay: true });
    coachAt(3);
    expect(saved()).toEqual({ i: 3, replay: true });
    // 같은 실행에서 다시 읽어도 그대로다.
    expect(coachResume(true)).toBe(3);
    expect(coachReplaying()).toBe(true);
    coachDone();
    expect(coachReplaying()).toBe(false);
    expect(saved()).toEqual({ i: -1 });
    // 새로고침 · 앱 재실행: 기억하던 값이 없는 상태(위에서 끝내 false)에서 저장값의 표시만 보고 되살린다.
    m.set('ft_tutorial', JSON.stringify({ i: 3, replay: true }));
    expect(coachResume(true)).toBe(3);
    expect(coachReplaying()).toBe(true);
    coachAt(4);
    expect(saved()).toEqual({ i: 4, replay: true });
    coachDone();
    // 마지막 단계를 넘겨 끝나도 지워진다.
    coachReplay();
    coachAt(COACH_STEPS.length);
    expect(coachReplaying()).toBe(false);
    expect(saved()).toEqual({ i: -1 });
    // 표시 없이 저장된 값(옛 코드가 쓴 값)은 처음 온 기기의 안내로 읽는다.
    m.set('ft_tutorial', JSON.stringify({ i: 4 }));
    expect(coachResume(false)).toBe(4);
    expect(coachReplaying()).toBe(false);
    // 끝난 값에 표시가 남아 있어도 다시 보기로 보지 않는다.
    m.set('ft_tutorial', JSON.stringify({ i: -1, replay: true }));
    expect(coachResume(false)).toBeNull();
    expect(coachReplaying()).toBe(false);
  });

  it('T-11-796 첫 안내를 끝내기 전에 누른 다시 보기는 다시 보기로 치지 않는다', () => {
    const m = fakeStorage();
    const saved = () => JSON.parse(m.get('ft_tutorial')!) as unknown;
    expect(coachResume(false)).toBe(0);
    coachAt(2);
    // 첫 안내가 아직 진행 중이다. 처음부터 다시 보더라도 남은 단계는 처음 보는 것이라 계측에 남긴다.
    expect(coachReplay()).toBe(0);
    expect(coachReplaying()).toBe(false);
    expect(saved()).toEqual({ i: 0, replay: false });
    // 커리어를 시작한 뒤 다시 열어도(첫 단계에 서 있어도) 그대로 첫 안내다.
    expect(coachResume(true)).toBe(0);
    expect(coachReplaying()).toBe(false);
    coachAt(5);
    expect(saved()).toEqual({ i: 5 });
    // 끝낸 뒤에 누르면 그때부터 다시 보기다. 다시 보기 도중에 또 눌러도 다시 보기다.
    coachDone();
    coachReplay();
    expect(coachReplaying()).toBe(true);
    coachAt(2);
    coachReplay();
    expect(coachReplaying()).toBe(true);
    expect(saved()).toEqual({ i: 0, replay: true });
    coachDone();
  });

  it('T-11-796 표시를 적기 전에 누른 다시 보기(커리어를 해 본 기기가 표시 없이 첫 단계에 있음)도 다시 보기로 읽는다', () => {
    const m = fakeStorage();
    m.set('ft_tutorial', JSON.stringify({ i: 0 }));
    expect(coachResume(true)).toBe(0);
    expect(coachReplaying()).toBe(true);
    // 단계를 넘기면 표시를 적어 다음 실행에도 이어진다.
    coachAt(1);
    expect(JSON.parse(m.get('ft_tutorial')!)).toEqual({ i: 1, replay: true });
    coachDone();
    // 커리어 기록이 없는 기기가 첫 단계에 있는 것은 처음 온 기기의 안내다.
    m.set('ft_tutorial', JSON.stringify({ i: 0 }));
    expect(coachResume(false)).toBe(0);
    expect(coachReplaying()).toBe(false);
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
