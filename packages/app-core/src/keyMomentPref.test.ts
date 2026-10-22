import { afterEach, describe, expect, it, vi } from 'vitest';
import * as g from '@offside/game/index';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { setStorage } from '@offside/game/storage';
import { createGameActions, type GameHost } from './game-actions.js';
import { KEY_MOMENTS_KEY, keyMomentsOn, setKeyMomentsOn } from './keyMomentPref.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { initialAppState } from './state.js';
// 구간 진행이 늦게 불러오는 모듈을 먼저 올려 둔다(가짜 타이머 아래에서 동적 import가 멈추지 않게).
import './keyMoments.js';

const mem = new Map<string, string>();
setStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });

/** 리그 구간(phase 1)을 진행하며 결정적 장면 카드가 한 번이라도 떴는지 센다. 확인 버튼까지 누르고 끝낸다. */
async function playLeagueBlock(): Promise<{ moments: number; apps: number }> {
  const state = initialAppState();
  setActiveRng(createRng(7));
  const s = g.newGame(
    {
      name: 'T',
      number: 9,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      retireAt: 45,
    },
    7,
  );
  s.age = 22;
  s.leagueId = 'k3';
  s.club = { ...g.CLUBS.find((c) => c.leagueId === 'k3')!, str: g.ovr(s) - 10 };
  s.contract = { years: 2, salary: 1000 };
  s.mil.served = true;
  s.phase = 1;
  s.pending = null;
  state.G = s;
  const sheet = createSheetController(initialSheetState(), {
    tick: async () => {},
    painted: async () => {},
    motionOK: () => false,
  });
  const host: GameHost = {
    state,
    sheet,
    save: vi.fn(() => {
      s.rng = getActiveRng().getState();
    }),
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
  const run = createGameActions(host).advance();
  let moments = 0;
  let apps = 0;
  for (let t = 0; t < 200; t++) {
    await vi.advanceTimersByTimeAsync(500);
    const v = sheet.state.view;
    if (v?.kind === 'block') {
      apps = v.tally.apps;
      if (v.moment && !v.moment.result) {
        moments++;
        v.moment.choose(v.moment.choices[0]!.id);
      }
    }
    const ok = sheet.state.buttons.find((b) => b.cls === 'btn-primary');
    if (v?.kind === 'block' && ok) {
      ok.fn();
      break;
    }
  }
  await vi.runAllTimersAsync();
  await run;
  return { moments, apps };
}

describe('T-11-426 결정적 장면 켜기 · 끄기', () => {
  afterEach(() => {
    vi.useRealTimers();
    mem.clear();
  });

  it('기본은 켬이고, 끈 값은 이 기기에 남는다', () => {
    expect(keyMomentsOn()).toBe(true);
    setKeyMomentsOn(false);
    expect(mem.get(KEY_MOMENTS_KEY)).toBe('false');
    expect(keyMomentsOn()).toBe(false);
    setKeyMomentsOn(true);
    expect(keyMomentsOn()).toBe(true);
  });

  it('켜 두면 리그 구간 중계가 장면에서 멈추고, 끄면 멈추지 않는다', async () => {
    vi.useFakeTimers();
    const on = await playLeagueBlock();
    expect(on.apps).toBeGreaterThan(0);
    expect(on.moments).toBe(1);
    setKeyMomentsOn(false);
    const off = await playLeagueBlock();
    expect(off.apps).toBeGreaterThan(0);
    expect(off.moments).toBe(0);
  });
});
