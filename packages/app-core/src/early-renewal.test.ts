import { describe, expect, it, vi } from 'vitest';
import * as g from '@offside/game/index';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { loadSave } from '@offside/game/save';
import type { GameState } from '@offside/game/types';
import { createGameActions, type GameHost } from './game-actions.js';
import { createSheetController, initialSheetState } from './sheet-controller.js';
import { initialAppState } from './state.js';

function harness(saved?: GameState) {
  const state = initialAppState();
  setActiveRng(createRng(saved?.rng?.seed ?? 3));
  const s =
    saved ??
    g.newGame(
      {
        name: 'T',
        number: 9,
        pos: 'FW',
        foot: '오른발',
        type: 'poacher',
        trait: 'late',
        retireAt: 45,
      },
      3,
    );
  if (!saved) {
    s.age = 31;
    s.leagueId = 'k3';
    s.club = { ...g.CLUBS.find((c) => c.leagueId === 'k3')!, str: g.ovr(s) };
    s.contract = { years: 1, salary: 1000 };
    s.trust = 2;
    s.mil.served = true;
    s.fame = 300;
    s.pending = { type: 'market', res: null, m: null };
  }
  state.G = s;
  const sheet = createSheetController(initialSheetState(), {
    tick: async () => {},
    painted: async () => {},
    motionOK: () => false,
  });
  const save = vi.fn(() => {
    s.rng = getActiveRng().getState();
  });
  const host: GameHost = {
    state,
    sheet,
    save,
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
  return { s, state, sheet, save, actions: createGameActions(host) };
}

describe('웹·앱 공용 조기 연장 진행', () => {
  it('시장·계약서 반복 열기와 저장복원은 제안·RNG를 보존하고 사인은 한 번만 처리한다', () => {
    const h = harness();
    h.actions.nextPending();
    const p = h.s.pending!;
    if (p.type !== 'market') throw new Error('market');
    const m = p.m!;
    const index = m.options.findIndex((o) => o.kind === 'renew');
    expect(index).toBeGreaterThanOrEqual(0);
    const saved = JSON.stringify(h.s);
    const rng = getActiveRng().getState();
    h.actions.nextPending();
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(getActiveRng().getState()).toEqual(rng);
    const marketView = h.sheet.state.view;
    if (marketView?.kind !== 'market') throw new Error('market view');
    expect(marketView.options[index]!.sub).toContain('1년 남음 · 1년 연장 · 총 2년');
    expect(marketView.options[index]!.sub).toContain('이번 시즌부터');
    h.actions.pickOption(index);
    const contract = h.sheet.state.view;
    if (contract?.kind !== 'contract') throw new Error('contract');
    expect(contract.terms).toContainEqual({ label: '추가 연장', value: '1년' });
    expect(contract.terms).toContainEqual({ label: '총 계약 기간', value: '2년' });
    contract.onClose();
    expect(JSON.stringify(h.s)).toBe(saved);
    expect(p.m).toBe(m);

    const restored = loadSave(JSON.parse(saved))!.G;
    const r = harness(restored);
    r.actions.nextPending();
    expect(r.save).not.toHaveBeenCalled();
    expect(JSON.stringify(r.s)).toBe(saved);
    r.actions.pickOption(index);
    const cv = r.sheet.state.view;
    if (cv?.kind !== 'contract') throw new Error('contract');
    cv.onSign();
    expect(r.s.contract!.years).toBe(2);
    expect(r.s.trust).toBe(3);
    expect(r.s.pending).toBeNull();
    const after = JSON.stringify(r.s);
    cv.onSign();
    r.actions.pickOption(index);
    expect(JSON.stringify(r.s)).toBe(after);
    expect(r.save).toHaveBeenCalledTimes(1);
    const loadedAfter = loadSave(JSON.parse(after))!.G;
    const a = harness(loadedAfter);
    a.actions.nextPending();
    a.actions.pickOption(index);
    expect(JSON.stringify(a.s)).toBe(after);
  });

  it('연장 계약서를 닫고 기존 조건으로 잔류하거나 다른 구단에 사인할 수 있다', () => {
    for (const kind of ['stay', 'offer']) {
      const h = harness();
      h.actions.nextPending();
      const p = h.s.pending!;
      if (p.type !== 'market') throw new Error('market');
      const options = p.m!.options;
      h.actions.pickOption(options.findIndex((o) => o.kind === 'renew'));
      const contract = h.sheet.state.view;
      if (contract?.kind !== 'contract') throw new Error('contract');
      contract.onClose();
      const i = options.findIndex((o) => o.kind === kind);
      expect(i).toBeGreaterThanOrEqual(0);
      h.actions.pickOption(i);
      if (kind === 'offer') {
        const transfer = h.sheet.state.view;
        if (transfer?.kind !== 'contract') throw new Error('transfer');
        transfer.onSign();
        const o = options[i]!;
        if (o.kind !== 'offer') throw new Error('offer');
        expect(h.s.club.id).toBe(o.clubId);
      } else expect(h.s.contract).toEqual({ years: 1, salary: 1000 });
      expect(h.s.pending).toBeNull();
      const after = JSON.stringify(h.s);
      contract.onSign(); // 선택이 끝난 뒤 오래된 연장 계약서 콜백.
      expect(JSON.stringify(h.s)).toBe(after);
    }
  });
});
