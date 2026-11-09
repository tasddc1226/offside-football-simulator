import { describe, expect, it } from 'vitest';
import type { Screen } from './state.js';
import { newsBannerOnScreen } from './newsBanner.js';

// Record<Screen, …>라서 화면이 늘면 여기서 타입 오류가 나 새 화면의 배너 여부를 정하게 된다.
const EXPECTED: Record<Screen, boolean> = {
  home: true,
  create: false,
  retired: true,
  game: true,
  legend: true,
  settings: true,
  owner: true,
  honors: true,
  players: true,
  team: true,
  market: true,
  funds: true,
  shop: true,
  manager: true,
  recap: true,
  cup: true,
  league: true,
  board: false,
  dex: true,
  hof: true,
  firsts: true,
  chat: true,
  admin: true,
  shared: true,
};

describe('newsBannerOnScreen', () => {
  it.each(Object.entries(EXPECTED) as [Screen, boolean][])('%s → %s', (screen, shown) => {
    expect(newsBannerOnScreen(screen)).toBe(shown);
  });
});
