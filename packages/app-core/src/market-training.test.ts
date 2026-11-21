// T-11-798 이적 시장을 확정해 새 시즌으로 넘어갈 때 훈련이 이어지는지.
import { describe, expect, it, vi } from 'vitest';
import * as g from '@offside/game/index';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { GameState, MarketOption } from '@offside/game/types';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { initialAppState } from './state.js';

const STAY: MarketOption = { kind: 'stay', name: '잔류', desc: '' };

function career(training: string): GameState {
  setActiveRng(createRng(11));
  const s = g.newGame(
    {
      name: 'T',
      number: 9,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      retireAt: 40,
    },
    11,
  );
  s.age = 28;
  s.leagueId = 'k1';
  s.club = { ...g.CLUBS.find((c) => c.leagueId === 'k1')! };
  s.contract = { years: 2, salary: 3000 };
  s.training = training;
  return s;
}

function harness(s: GameState, options: MarketOption[]) {
  s.pending = { type: 'market', res: null, m: { options, note: '', canRetire: false } };
  const state = initialAppState();
  state.G = s;
  const sheet = createSheetController(initialSheetState(), {
    tick: async () => {},
    painted: async () => {},
    motionOK: () => false,
  });
  const host: GameHost = {
    state,
    sheet,
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
  setActiveRng(createRng(77));
  return { s, sheet, host, actions: createGameActions(host) };
}

describe('T-11-798 이적 시장 확정 뒤의 훈련', () => {
  it('능력치 훈련은 새 시즌에도 이어 간다(프리시즌 훈련이 휴식으로 사라지지 않는다)', () => {
    for (const t of ['pac', 'sho', 'def', 'phy']) {
      const h = harness(career(t), [STAY]);
      h.actions.pickOption(0);
      expect(h.s.pending).toBeNull();
      expect(h.s.phase).toBe(0);
      expect(h.s.training).toBe(t);
    }
  });

  it('개인 코치 · 미디어 활동 · 휴식은 휴식으로 시작한다', () => {
    for (const t of ['coach', 'media', 'rest']) {
      const h = harness(career(t), [STAY]);
      h.actions.pickOption(0);
      expect(h.s.pending).toBeNull();
      expect(h.s.training).toBe('rest');
    }
  });

  it('병역으로 확정되면(복무 이어 가기) 지금처럼 휴식으로 시작한다', () => {
    const serve: MarketOption = { kind: 'serve', name: '복무', first: true, desc: '' };
    const h = harness(career('sho'), [serve]);
    h.actions.pickOption(0);
    expect(h.s.pending).toBeNull();
    expect(h.s.training).toBe('rest');
  });

  it('시장이 다시 열리는 병역 결과(현역 입대)는 훈련을 건드리지 않고, 다시 고를 때 정한다', () => {
    const army: MarketOption = { kind: 'army', name: '현역 입대', desc: '' };
    const h = harness(career('sho'), [army]);
    h.actions.pickOption(0);
    expect(h.s.mil.served).toBe(true);
    expect(h.s.pending?.type).toBe('market');
    expect(h.s.training).toBe('sho');
  });
});
