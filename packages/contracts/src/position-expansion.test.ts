import { expect, it } from 'vitest';
import { PeakProfileSchema, DetailPosSchema } from './careers.js';
import { TeamLayoutSchema } from './teams.js';
import { BASE_DETAIL, SELECTABLE_DETAIL_POSITIONS } from './positions.js';
import { positionRole, positionedLayout, presetLayout, slotRating } from './owner-team.js';
import { footBonus } from './team-synergy.js';

const roles = { GK: 30, CB: 60, FB: 70, DM: 65, CM: 60, AM: 50, W: 55, ST: 40 };
it('accepts legacy eight-role profiles and new positions without dropping old records', () => {
  const profile = { attrs: { pac: 60, sho: 60, pas: 60, dri: 60, def: 60, phy: 60 }, roles };
  expect(PeakProfileSchema.parse(profile)).toEqual(profile);
  for (const d of SELECTABLE_DETAIL_POSITIONS) {
    expect(DetailPosSchema.parse(d)).toBe(d);
    expect(slotRating(d, { peak: 90, pos: 'DF', roles })).toBe(roles[BASE_DETAIL[d]]);
  }
  expect(PeakProfileSchema.safeParse({ ...profile, roles: { ...roles, LB: 100 } }).success).toBe(
    false,
  );
});
it('maps all 17 positions from pitch coordinates and accepts historical layouts unchanged', () => {
  const points = [
    [50, 91, 'GK'],
    [50, 75, 'CB'],
    [18, 75, 'LB'],
    [82, 75, 'RB'],
    [18, 62, 'LWB'],
    [82, 62, 'RWB'],
    [50, 80, 'SW'],
    [50, 62, 'DM'],
    [50, 49, 'CM'],
    [50, 37, 'AM'],
    [18, 49, 'LM'],
    [82, 49, 'RM'],
    [50, 16, 'ST'],
    [50, 24, 'CF'],
    [50, 30, 'SS'],
    [18, 25, 'LW'],
    [82, 25, 'RW'],
  ] as const;
  for (const [x, y, d] of points) expect(positionRole(x, y, d === 'GK' ? 0 : 1)).toBe(d);
  const old = presetLayout('4-3-3');
  expect(TeamLayoutSchema.parse(old)).toEqual(old);
  const next = positionedLayout(old);
  expect(TeamLayoutSchema.parse(next)).toEqual(next);
  expect(next.map((p) => p.slot)).toEqual([
    'GK',
    'LB',
    'CB',
    'CB',
    'RB',
    'DM',
    'CM',
    'AM',
    'LW',
    'ST',
    'RW',
  ]);
  expect(old[1]!.slot).toBe('FB');
});
it('keeps matching-foot bonuses for sided fullbacks and wingers', () => {
  const p = {
    type: null,
    nation: null,
    raised: false,
    slot: 'FB' as const,
    x: 18,
    foot: '왼발' as const,
  };
  expect(footBonus({ ...p, slot: 'LB' })).toBe(footBonus(p));
  expect(footBonus({ ...p, slot: 'RW', x: 82 })).toBe(footBonus({ ...p, slot: 'W', x: 82 }));
});
