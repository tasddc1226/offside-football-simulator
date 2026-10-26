// T-11-438 커리어 진행 화면 안내 보강: 이벤트 선택지 표기 뜻(G3) · 결정적 장면의 잃는 것(G4) · 중계 도중 끊긴 리포트 보관(G5).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as g from '@offside/game/index';
import { ATTR_LABEL } from '@offside/game/data';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { setStorage } from '@offside/game/storage';
import type { GameState } from '@offside/game/types';
import { keepPhaseReport, takePhaseReport } from './career.js';
import { recordPhaseOvr } from './growth.js';
import { createGameActions, type GameHost } from './game-actions.js';
import { gameActionsText as L } from './i18n/ko/gameActions';
import { keyMomentText as K } from './i18n/ko/keyMoment';
import { setKeyMomentsOn } from './keyMomentPref.js';
import { momentCard, momentHooks } from './keyMoments.js';
import { createSheetController, initialSheetState, matchRows } from './sheet-controller.js';
import type { PhaseReport, SheetView } from './sheets.js';
import { initialAppState } from './state.js';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  setStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
});
afterEach(() => {
  vi.useRealTimers();
});

function career(pos: g.Pos = 'FW', seed = 7): GameState {
  setActiveRng(createRng(seed));
  const s = g.newGame(
    {
      name: 'T',
      number: 9,
      pos,
      foot: '오른발',
      type: g.TYPES[pos][0]!.id,
      trait: 'late',
      retireAt: 45,
    },
    seed,
  );
  s.age = 22;
  s.leagueId = 'k3';
  s.club = { ...g.CLUBS.find((c) => c.leagueId === 'k3')!, str: g.ovr(s) - 10 };
  s.contract = { years: 2, salary: 1000 };
  s.mil.served = true;
  s.pending = null;
  return s;
}

function harness(s: GameState, motion = false) {
  const state = initialAppState();
  state.G = s;
  const sheet = createSheetController(initialSheetState(), {
    tick: async () => {},
    painted: async () => {},
    motionOK: () => motion,
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
  return { state, sheet, actions: createGameActions(host) };
}

type EventView = Extract<SheetView, { kind: 'event' }>;
const eventView = (id: string, motion = false): EventView => {
  const s = career();
  s.pending = { type: 'event', id, then: null };
  const h = harness(s, motion);
  h.actions.nextPending();
  return h.sheet.state.view as EventView;
};

describe('G3 이벤트 선택지 표기 뜻', () => {
  it("'안전' 선택지가 있으면 그 뜻을 시트에 한 줄로 보인다", () => {
    const v = eventView('bench-talk');
    expect(v.choices[1]!.odds).toBe(L.oddsSafe);
    expect(v.legend).toEqual([{ term: L.oddsSafe, text: L.oddsSafeHint }]);
  });

  it('판정만 없는 선택지뿐이면 따로 설명하지 않는다', () => {
    expect(eventView('ad').legend).toEqual([]);
  });

  it("원터치 선택지는 움직임을 켰을 때만 '원터치' 뜻을 보인다", () => {
    const on = eventView('penalty', true);
    expect(on.choices[0]!.odds).toMatch(/^원터치/);
    expect(on.legend).toContainEqual({ term: L.oddsMinigameTerm, text: L.oddsMinigameHint });
    const off = eventView('penalty', false);
    expect(off.legend.some((l) => l.term === L.oddsMinigameTerm)).toBe(false);
  });
});

describe('G4 결정적 장면에서 잃는 것', () => {
  /** 전반기 장면이 걸린 커리어를 찾아 장면 카드를 만든다. */
  function card(pos: g.Pos) {
    for (let seed = 1; seed < 80; seed++) {
      const s = career(pos, seed);
      Object.assign(s, { trust: 95, cond: 100 });
      g.playPhase(s);
      const r = g.playPhase(s, momentHooks(s));
      const m = r.block?.moment;
      if (m) return momentCard(s, m, r);
    }
    throw new Error('장면이 걸린 커리어가 없다');
  }

  it('공격수 찬스는 기록이 줄 수 있다고 알리고, 선택지마다 남는 기록은 따로 적지 않는다(늘 골)', () => {
    const c = card('FW');
    expect(c.stake).toBe(K.stakeChance);
    expect(c.choices.every((x) => x.rec === undefined)).toBe(true);
  });

  it('미드필더 찬스는 슈팅 선택지는 골, 나머지는 도움으로 남는다고 보인다', () => {
    const c = card('MF');
    expect(c.stake).toBe(K.stakeChance);
    for (const x of c.choices)
      expect(x.rec).toBe(x.attr === ATTR_LABEL.sho ? K.recGoal : K.recAssist);
  });

  it('수비 위기는 실점 · 패배를 알린다', () => {
    const c = card('DF');
    expect(c.stake).toBe(K.stakeCrisis);
    expect(c.choices.every((x) => x.rec === undefined)).toBe(true);
  });
});

describe('G5 중계 도중 끊긴 구간 리포트', () => {
  /** 리그 구간(phase 1)을 진행한다. onTicker는 중계가 처음 보일 때 한 번 부른다. */
  async function playLeague(s: GameState, onTicker: () => void, onStart?: () => void) {
    s.phase = 1;
    const h = harness(s);
    onStart?.();
    const run = h.actions.advance();
    let seen = false;
    for (let t = 0; t < 200; t++) {
      await vi.advanceTimersByTimeAsync(500);
      const v = h.sheet.state.view;
      if (v?.kind === 'block' && !seen) {
        seen = true;
        onTicker();
      }
      const ok = h.sheet.state.buttons.find((b) => b.cls === 'btn-primary');
      if (v?.kind === 'block' && ok) {
        ok.fn();
        break;
      }
    }
    await vi.runAllTimersAsync();
    await run;
    return h;
  }

  it('저장 때 리포트도 남기고, 중계가 끝나 화면에 띄우면 지운다. 난수는 경기 줄 한 번만 쓴다', async () => {
    vi.useFakeTimers();
    setKeyMomentsOn(false);
    const s = career();
    s.phase = 1;
    let pre = '';
    let seed = 0;
    let mid: { cid: string; report: PhaseReport } | null = null;
    const h = await playLeague(
      s,
      () => {
        mid = JSON.parse(mem.get('ft_phase_report')!);
      },
      () => {
        pre = JSON.stringify(s);
        seed = getActiveRng().getState().seed;
      },
    );
    expect(mid!.cid).toBe(s.cid);
    expect(mid!.report.year).toBe(s.year);
    expect(mid!.report.games.length).toBe(h.state.report!.games.length);
    expect({ ...mid!.report, key: 0 }).toEqual({ ...h.state.report!, key: 0 });
    expect(mem.get('ft_phase_report')).toBe('null');
    // 리포트를 보관해도 난수 소비는 '구간 진행 + 경기 줄 한 번'과 같다.
    const after = getActiveRng().getState().seed;
    setActiveRng(createRng(seed));
    const s2 = JSON.parse(pre) as GameState;
    recordPhaseOvr(s2);
    const r2 = g.playPhase(s2);
    matchRows(s2, r2.block!);
    expect(getActiveRng().getState().seed).toBe(after);
  });

  it('다음 실행 때 같은 커리어 · 같은 해면 한 번 꺼내고 지운다', () => {
    const s = career();
    const report = { year: s.year, games: [] } as unknown as PhaseReport;
    keepPhaseReport(s.cid, report);
    expect(takePhaseReport({ ...s, cid: 'other' })).toBeNull();
    keepPhaseReport(s.cid, report);
    expect(takePhaseReport({ ...s, year: s.year + 1 })).toBeNull();
    keepPhaseReport(s.cid, report);
    expect(takePhaseReport(s)).toEqual(report);
    expect(takePhaseReport(s)).toBeNull();
    expect(takePhaseReport(null)).toBeNull();
  });
});
