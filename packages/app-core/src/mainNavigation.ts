import type { Screen } from './state.js';

/** The five destinations stay stable across general browsing and detail pages. */
export const MAIN_SCREENS = [
  'hof',
  'board',
  'home',
  'owner',
  'settings',
] as const satisfies readonly Screen[];
const BROWSE_SCREENS: readonly Screen[] = [
  ...MAIN_SCREENS,
  'cup',
  'league',
  'market',
  'funds',
  'shop',
  'manager',
  'recap',
  'honors',
  'firsts',
  'dex',
  'legend',
  'admin',
];
export const hasMainNav = (screen: Screen): boolean => BROWSE_SCREENS.includes(screen);
