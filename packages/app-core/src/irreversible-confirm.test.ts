// T-11-431 되돌릴 수 없는 진로(대학 진학 · 상무 지원 · 현역 입대) 확인 시트.
import { describe, expect, it, vi } from 'vitest';
import * as g from '@offside/game/index';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import type { GameState, MarketOption } from '@offside/game/types';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { initialAppState } from './state.js';
import { gameActionsText as L } from './i18n/ko/gameActions';

const STAY: MarketOption = { kind: 'stay', name: '잔류', desc: '' };

function career(): GameState {
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
  return s;
}

function harness(s: GameState, options: MarketOption[], canRetire = true) {
  s.pending = { type: 'market', res: null, m: { options, note: '', canRetire } };
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

describe('T-11-431 되돌릴 수 없는 진로 확인', () => {
  const army: MarketOption = { kind: 'army', name: '현역 입대', desc: '' };
  const sangmuDue: MarketOption = { kind: 'sangmu', name: '상무', due: true, desc: '' };
  const uni: MarketOption = { kind: 'uni', name: '대학 진학', desc: '' };

  it.each([
    ['현역 입대', army, L.pathArmyTitle],
    ['상무 지원', sangmuDue, L.pathSangmuTitle],
    ['대학 진학', uni, L.pathUniTitle],
  ])(
    '%s은 확인 시트를 띄우고, 다시 고르면 상태·난수를 건드리지 않고 시장으로 돌아간다',
    (_, o, title) => {
      const h = harness(career(), [STAY, o]);
      const before = JSON.stringify(h.s);
      const rng = getActiveRng().getState();
      h.actions.pickOption(1);
      const v = h.sheet.state.view;
      if (v?.kind !== 'notice') throw new Error('notice');
      expect(v.title).toBe(title);
      expect(v.text).toMatch(/되돌릴 수 없어요/);
      expect(h.sheet.state.buttons.map((b) => b.label)).toContain(L.pathBack);
      expect(JSON.stringify(h.s)).toBe(before);
      expect(getActiveRng().getState()).toEqual(rng);
      expect(h.host.save).not.toHaveBeenCalled();
      h.sheet.state.buttons[1]!.fn();
      expect(h.sheet.state.view?.kind).toBe('market');
      expect(JSON.stringify(h.s)).toBe(before);
      expect(getActiveRng().getState()).toEqual(rng);
    },
  );

  it('상무 확인 문구는 합격 확률과 불합격했을 때의 길을 알린다', () => {
    const h = harness(career(), [STAY, sangmuDue]);
    h.actions.pickOption(1);
    const v = h.sheet.state.view;
    if (v?.kind !== 'notice') throw new Error('notice');
    expect(v.text).toContain(`${Math.round(g.sangmuChance(h.s) * 100)}%`);
    expect(v.text).toContain('바로 현역으로 입대해요');
    const notDue = harness(career(), [STAY, { kind: 'sangmu', name: '상무', desc: '' }]);
    notDue.actions.pickOption(1);
    expect((notDue.sheet.state.view as { text: string }).text).toContain('지금 팀에 남아요');
  });

  it('확인하면 확인 시트 없이 고른 것과 같은 결과 · 난수 소비로 확정한다', () => {
    for (const o of [army, sangmuDue, uni]) {
      const h = harness(career(), [STAY, o]);
      const ref = JSON.parse(JSON.stringify(h.s)) as GameState;
      const seed = getActiveRng().getState();
      h.actions.pickOption(1);
      h.sheet.state.buttons[0]!.fn();
      const after = getActiveRng().getState();
      // 기준: 같은 상태 · 같은 난수에서 게임 로직을 바로 부른다(시장이 다시 열리면 새 시장도 뽑는다).
      setActiveRng(createRng(seed.seed));
      const r = g.acceptOption(ref, o, [STAY, o]);
      if (r?.reopen) g.market(ref);
      expect(getActiveRng().getState()).toEqual(after);
      expect(h.s.attrs).toEqual(ref.attrs);
      expect(h.s.mil).toEqual(ref.mil);
      expect(h.s.leagueId).toBe(ref.leagueId);
      expect(h.s.year).toBe(ref.year);
      expect(h.host.save).toHaveBeenCalled();
    }
  });

  it('다른 길이 없는 선택(입영 통지 뒤 현역 입대)은 묻지 않고 바로 확정한다', () => {
    const h = harness(career(), [army], false);
    h.actions.pickOption(0);
    expect(h.s.mil.served).toBe(true);
    const v = h.sheet.state.view;
    expect(v?.kind === 'notice' && v.title).not.toBe(L.pathArmyTitle);
  });

  it('확인 버튼을 두 번 눌러도 한 번만 확정한다', () => {
    const h = harness(career(), [STAY, army]);
    h.actions.pickOption(1);
    const ok = h.sheet.state.buttons[0]!.fn;
    ok();
    const year = h.s.year;
    const rng = getActiveRng().getState();
    ok();
    expect(h.s.year).toBe(year);
    expect(getActiveRng().getState()).toEqual(rng);
  });
});
