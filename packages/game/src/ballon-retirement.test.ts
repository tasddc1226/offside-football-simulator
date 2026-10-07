import { expect, it } from 'vitest';
import { clubsIn, leagueOf, newGame, newSeason } from './engine.js';
import { ballonWinsOf } from './legend.js';
import { createRng, setActiveRng } from './rng.js';
import { endSeason, retire } from './season.js';
import { setStorage } from './storage.js';

it('마지막 시즌 수상은 은퇴 통산 횟수와 상세에 포함하고 후보 기록은 세지 않는다', () => {
  setActiveRng(createRng(7));
  const s = newGame(
    { name: '수상', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
  s.age = 30;
  s.leagueId = 'pl';
  s.club = { ...clubsIn('pl')[0]! };
  s.season = newSeason(s);
  for (const key of Object.keys(s.sub)) s.sub[key] = 99;
  const year = s.year;
  s.awards = [{ year: year - 1, t: '발롱도르' }];
  s.ballon = [
    { year: year - 1, rank: 1 },
    { year: year - 2, rank: 2 },
  ];
  Object.assign(s.season, {
    played: leagueOf('pl').matches,
    apps: 38,
    goals: 100,
    ratingSum: 380,
    w: 38,
    d: 0,
    l: 0,
    pts: 114,
  });
  const result = endSeason(s);
  expect(result.awards).toContain('발롱도르');
  expect(s.awards).toContainEqual({ year, t: '발롱도르' });
  expect(ballonWinsOf(s)).toBe(2);
  setStorage({ getItem: () => null, setItem: () => {} });
  const entry = retire(s);
  expect(entry.ballon).toBe(2);
  expect(entry.detail?.awards).toContainEqual({ year, t: '발롱도르' });
  expect(entry.detail?.ballon).toContainEqual({ year, rank: 1 });
});
