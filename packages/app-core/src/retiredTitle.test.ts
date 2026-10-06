import { expect, it } from 'vitest';
import { retiredTitleOf } from './retiredTitle.js';

it('local server-only representative titles wait for session verification, including id-less backups', () => {
  expect(retiredTitleOf('career', 'wall_of_honor', {})).toBeNull();
  expect(retiredTitleOf('', 'wall_of_honor', {})).toBeNull();
  expect(retiredTitleOf('career', 'wall_of_honor', { career: null })).toBeNull();
  expect(retiredTitleOf('career', null, { career: 'wall_of_honor' })).toBe('wall_of_honor');
  expect(retiredTitleOf('career', 'europe', {})).toBe('europe');
  expect(retiredTitleOf(undefined, 'wall_of_honor', {})).toBe('wall_of_honor');
});
