import { expect, it } from 'vitest';
import './index.js';
import { newGame, newSeason } from './engine.js';
import { nationalCalendar, natSeasonEnd } from './national.js';
import { createRng, setActiveRng, getActiveRng } from './rng.js';
import { syncFace } from './attributes.js';
import { applyBalance } from './balance.js';

const player = (seed = 599) => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  Object.assign(s, { year: 2030, age: 22, leagueId: 'k1' });
  for (const k of Object.keys(s.sub)) s.sub[k] = 80;
  syncFace(s);
  s.season = newSeason(s);
  return s;
};
it('calendar uses tournament years, eligibility ages and known qualifications without RNG', () => {
  const s = player();
  s.nat.qual[2030] = false;
  const rng = getActiveRng().getState();
  const rows = nationalCalendar(s);
  expect(rows.find((r) => r.key === 'wc')).toMatchObject({ year: 2030, qualified: false, age: 22 });
  expect(rows.find((r) => r.key === 'ag')).toMatchObject({ year: 2030, age: 22, youth: true });
  expect(rows.find((r) => r.key === 'asian')?.year).toBe(2031);
  expect(rows.find((r) => r.key === 'olympic')).toMatchObject({
    year: 2032,
    age: 24,
    qualified: undefined,
  });
  s.nation = 'FR';
  expect(nationalCalendar(s).some((r) => r.key === 'ag')).toBe(false);
  expect(nationalCalendar(s).some((r) => r.key === 'euro' && r.year === 2032)).toBe(true);
  expect(getActiveRng().getState()).toEqual(rng);
});
it('Asian Games bonus does not change Olympics or non-Korean national tournaments', () => {
  for (const nation of ['KR', 'JP'])
    for (const year of [2030, 2032]) {
      if (nation === 'KR' && year === 2030) continue;
      const run = (bonus: number) => {
        const s = player();
        s.nation = nation;
        s.year = year;
        applyBalance({ agKoreaBonus: bonus });
        return natSeasonEnd(s);
      };
      expect(run(6)).toEqual(run(0));
    }
  applyBalance();
});
