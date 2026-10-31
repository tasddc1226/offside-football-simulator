import { expect, it } from 'vitest';
import '@offside/game/index';
import { newGame } from '@offside/game/engine';
import { setActiveRng, createRng } from '@offside/game/rng';
import { careerDate, careerScoring } from './careerOverview.js';
it('shows the current year, completed season and my place below the leaders', () => {
  setActiveRng(createRng(599));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    599,
  );
  s.season.played = 20;
  expect(careerDate(s)).toContain(String(s.year));
  const rows = careerScoring(s, 'goals')!;
  expect(rows).toHaveLength(6);
  expect(rows.at(-1)).toMatchObject({ me: true, value: 0 });
  s.pending = { type: 'market', res: null, m: null };
  expect(careerDate(s)).toContain(String(s.year - 1));
  delete s.season.scoringVersion;
  expect(careerScoring(s, 'goals')).toBeNull();
});
