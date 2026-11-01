import { compGameViews, natViews, tourView } from './game-report.js';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as g from '@offside/game/index';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { setStorage } from '@offside/game/storage';
import type { NatTourResult } from '@offside/game/national';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { initialAppState } from './state.js';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T00:00:00.000Z'));
  setActiveRng(createRng(7));
  const memory = new Map<string, string>();
  setStorage({ getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('report conversion parity (R6)', () => {
  it('cup legs, league numbering, opponents, bench and final preserve copy without consuming RNG or mutating inputs', () => {
    const games = [
      { stage: '리그', res: 'W' as const, mins: 90, g: 2, a: 1 },
      { stage: '리그', res: 'D' as const, mins: 0, g: 0, a: 0 },
      { stage: '준결승', leg: 2, opp: 'missing-club', won: true, mins: 90, g: 0, a: 0 },
      { stage: '결승', won: false, mins: 10, g: 0, a: 0 },
    ];
    const before = JSON.stringify(games);
    const rng = getActiveRng().getState();
    expect(compGameViews(games)).toMatchSnapshot();
    expect(compGameViews([])).toEqual([]);
    expect(JSON.stringify(games)).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
  });

  it('national absence, bench, participation and old saved tournament without matches', () => {
    const match = {
      team: '대한민국',
      comp: '월드컵',
      stage: '결승',
      opp: '일본',
      kg: 1,
      og: 0,
      res: 'W',
      pso: null,
      mins: 90,
      g: 1,
      a: 0,
      rating: 8,
    };
    const nt = [
      { name: '대표팀', called: false as const },
      {
        name: '대표팀',
        called: true as const,
        comp: '월드컵',
        role: 'starter' as const,
        games: [match, { ...match, mins: 0 }],
      },
    ];
    const tour: NatTourResult = {
      year: 2026,
      name: '월드컵',
      stage: '우승',
      inSquad: true,
      apps: 1,
      goals: 1,
      matches: [match],
    };
    const before = JSON.stringify({ nt, tour });
    const rng = getActiveRng().getState();
    expect({
      nat: natViews(nt),
      inSquad: tourView(tour),
      absent: tourView({ ...tour, inSquad: false }),
      explicitReason: tourView({ ...tour, inSquad: false, why: 'fixture reason' }),
    }).toMatchSnapshot();
    const old = { ...tour };
    Reflect.deleteProperty(old, 'matches');
    expect(tourView(old)).toMatchSnapshot('old save');
    expect(natViews(null)).toEqual([]);
    expect(JSON.stringify({ nt, tour })).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
  });

  it.each(['FW', 'GK'] as const)(
    '%s advance keeps state/RNG/report and save/analytics order, including duplicate input guard',
    async (pos) => {
      const state = initialAppState();
      const s = g.newGame(
        {
          name: 'Fixture',
          number: 9,
          pos,
          foot: '오른발',
          type: g.TYPES[pos][0]!.id,
          trait: 'late',
          retireAt: 45,
        },
        7,
      );
      s.cid = 'report-fixture';
      state.G = s;
      const calls: string[] = [];
      const sheet = createSheetController(initialSheetState(), {
        tick: async () => {},
        painted: async () => {},
        motionOK: () => false,
      });
      vi.spyOn(sheet, 'playSteps').mockImplementation(async () => {
        calls.push('steps');
      });
      const host: GameHost = {
        state,
        sheet,
        save: () => {
          calls.push('save');
          s.rng = getActiveRng().getState();
        },
        toast: () => {
          calls.push('toast');
        },
        scrollTop: () => {
          calls.push('scroll');
        },
        uploadSeason: () => {
          calls.push('uploadSeason');
        },
        uploadRetirement: () => {
          calls.push('uploadRetirement');
        },
        trackPage: () => {},
        analytics: {
          replace: () => {},
          start: () => {},
          complete: () => {
            calls.push('complete');
          },
          play: () => {
            calls.push('play');
          },
          firstSeason: () => {},
          retire: () => {},
        },
      };
      const actions = createGameActions(host);
      await Promise.all([actions.advance(), actions.advance()]);
      expect({
        stateHash: createHash('sha256').update(JSON.stringify(s)).digest('hex'),
        rng: getActiveRng().getState(),
        report: state.report,
        calls,
      }).toMatchSnapshot();
      expect(calls).toEqual(['complete', 'save', 'play', 'steps', 'scroll']);
    },
  );
});
