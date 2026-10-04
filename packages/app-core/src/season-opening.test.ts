import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ovr } from '@offside/game/attributes';
import { startOvr } from './create-view.js';
import { setLatestBalance } from '@offside/game/balance';
import { createRng, setActiveRng } from '@offside/game/rng';
import { loadSave } from '@offside/game/save';
import { retireAge } from '@offside/game/season';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { watchDetailOpening } from './season-opening.js';
import { draftCareerRules, initialAppState } from './state.js';

const BEFORE = '2026-10-05T14:59:59.999Z';
const OPEN = '2026-10-05T15:00:00.000Z';

function harness() {
  const state = initialAppState();
  const host: GameHost = {
    state,
    sheet: createSheetController(initialSheetState(), {
      tick: async () => {},
      painted: async () => {},
      motionOK: () => false,
    }),
    save: vi.fn(),
    toast: vi.fn(),
    scrollTop: vi.fn(),
    uploadSeason: vi.fn(),
    uploadRetirement: vi.fn(),
    trackPage: vi.fn(),
    analytics: {
      replace: vi.fn(),
      start: vi.fn(),
      play: vi.fn(),
      firstSeason: vi.fn(),
      retire: vi.fn(),
    },
  };
  return { state, host, actions: createGameActions(host) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(BEFORE));
  setLatestBalance(null);
  setActiveRng(createRng(61006));
});
afterEach(() => {
  vi.useRealTimers();
  setLatestBalance(null);
});

describe('시즌 1 개막 · 웹/앱 공용 생성 경계', () => {
  it('개막 직전 생성한 선수는 개막 뒤 복원해도 프리시즌 규칙을 유지한다', () => {
    const h = harness();
    h.state.C.dpos = 'W'; // 전에 고른 값도 프리시즌에는 적용하지 않는다.
    h.actions.startCareer('T', 9);
    const before = h.state.G!;
    expect(before.dpos).toBeUndefined();
    expect(retireAge(before)).toBe(41);
    const saved = JSON.stringify(before);
    vi.setSystemTime(new Date(OPEN));
    const restored = loadSave(JSON.parse(saved))!.G;
    expect(restored.dpos).toBeUndefined();
    expect(retireAge(restored)).toBe(41);
    expect(restored.attrs).toEqual(before.attrs);
    expect(restored.pot).toBe(before.pot);
    expect(restored.rng).toEqual(before.rng);
  });

  it('개막 시각부터 선택한 세부 포지션과 45세 규칙이 함께 저장·복원된다', () => {
    vi.setSystemTime(new Date(OPEN));
    const h = harness();
    h.state.C.pos = 'MF';
    h.state.C.dpos = 'CM';
    h.actions.startCareer('T', 9);
    expect(h.state.G).toMatchObject({ pos: 'MF', dpos: 'CM', retireAt: 45 });
    const restored = loadSave(JSON.parse(JSON.stringify(h.state.G)))!.G;
    expect(restored).toMatchObject({ pos: 'MF', dpos: 'CM', retireAt: 45 });
  });

  it('프리시즌 후보를 고른 채 자정을 넘어도 세부 포지션 없는 시즌 1 선수를 만들지 않는다', () => {
    const h = harness();
    h.actions.rollCandidates();
    const picked = h.state.candidates![0]!;
    const attrs = { ...picked.attrs };
    const focus = [...h.state.C.focus];
    vi.setSystemTime(new Date(OPEN));
    h.actions.startCareer('T', 9, picked.attrs);
    expect(h.state.G).toMatchObject({ dpos: 'ST', retireAt: 45, focus });
    expect(picked.attrs).toEqual(attrs);
    expect(Math.abs(ovr(h.state.G!) - startOvr(h.state.C.pos, attrs))).toBeLessThanOrEqual(1);
    expect(h.host.save).toHaveBeenCalledOnce();
  });
});

describe('개막 선택지 알림', () => {
  it('경계에서 한 번만 알리고 취소한 화면은 갱신하지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BEFORE));
    const opened = vi.fn();
    const closed = vi.fn();
    const stop = watchDetailOpening(closed);
    watchDetailOpening(opened);
    stop();
    expect(opened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(opened).toHaveBeenCalledOnce();
    expect(closed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(opened).toHaveBeenCalledOnce();
  });

  it('개막 뒤에는 즉시 알리고 타이머를 남기지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(OPEN));
    const opened = vi.fn();
    watchDetailOpening(opened)();
    expect(opened).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('타이머 상한보다 먼 개막도 즉시 반복하지 않고 경계까지 기다린다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(OPEN) - 2_147_483_650));
    const opened = vi.fn();
    const stop = watchDetailOpening(opened);
    vi.advanceTimersByTime(2_147_483_647);
    expect(opened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3);
    expect(opened).toHaveBeenCalledOnce();
    stop();
  });

  it('각 큰 포지션의 기본값을 쓰되 유효한 선택과 프리시즌 규칙은 지킨다', () => {
    for (const [pos, dpos] of [
      ['FW', 'ST'],
      ['MF', 'AM'],
      ['DF', 'CB'],
      ['GK', 'GK'],
    ] as const) {
      expect(draftCareerRules({ pos, dpos: null }, OPEN)).toEqual({ dpos, retireAt: 45 });
      expect(draftCareerRules({ pos, dpos: 'W' }, BEFORE)).toEqual({
        dpos: undefined,
        retireAt: 41,
      });
    }
    expect(draftCareerRules({ pos: 'FW', dpos: 'W' }, OPEN).dpos).toBe('W');
    expect(draftCareerRules({ pos: 'DF', dpos: 'W' }, OPEN).dpos).toBe('CB');
  });
});
