import { describe, expect, it } from 'vitest';
import { DPOS } from '@offside/game/data';
import type { AppState } from './state.js';
import { pickCreateDetail, setCreatePosition, toggleCreateFocus } from './create-controls.js';
import { scoutItemsView } from './scoutItemsView.js';

const draft = (): Pick<AppState['C'], 'pos' | 'dpos' | 'focus'> => ({
  pos: 'FW',
  dpos: 'RW',
  focus: [],
});

describe('creation input and scout item policy', () => {
  it('keeps a hidden detail selection while resetting the main position to a complete focus pair', () => {
    const c = draft();
    setCreatePosition(c, 'GK', false);
    expect(c.pos).toBe('GK');
    expect(c.dpos).toBe('RW');
    expect(c.focus).toHaveLength(2);
  });
  it('changing detail gives a private focus array so another draft cannot change the definition', () => {
    const original = [...DPOS.ST.focus];
    const c = draft();
    pickCreateDetail(c, 'ST');
    expect(c.dpos).toBe('ST');
    expect(c.focus).toEqual(original);
    c.focus.pop();
    expect(DPOS.ST.focus).toEqual(original);
  });
  it('replaces the oldest focus with one tap, and tapping a selected focus removes it', () => {
    const c = draft();
    c.focus = ['pac', 'sho'];
    toggleCreateFocus(c, 'pas');
    expect(c.focus).toEqual(['sho', 'pas']);
    toggleCreateFocus(c, 'sho');
    expect(c.focus).toEqual(['pas']);
  });
  it('failed item loading hides owner tools and clears counts', () => {
    expect(scoutItemsView({ ok: false })).toEqual({
      owner: false,
      rerolls: 0,
      scouts: 0,
      mileage: 0,
      pity: { used: 0, streak: 0, elites: 0 },
    });
  });
  it('keeps supplied counters and gives legacy item payloads the same optional defaults', () => {
    expect(scoutItemsView({ ok: true, data: { reroll: 2 } })).toEqual({
      owner: true,
      rerolls: 2,
      scouts: 0,
      mileage: 0,
      pity: { used: 0, streak: 0, elites: 0 },
    });
    const pity = { used: 4, streak: 2, elites: 1 };
    const result = scoutItemsView({ ok: true, data: { reroll: 2, scout: 3, mileage: 8, pity } });
    expect(result).toEqual({ owner: true, rerolls: 2, scouts: 3, mileage: 8, pity });
    expect(result.pity).toBe(pity);
  });
});
