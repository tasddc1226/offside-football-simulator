import { afterEach, describe, expect, it } from 'vitest';
import { titlesOf } from '@offside/contracts/owner-title';
import { setLocale } from './i18n/core.js';
import { titleLabel } from './ownerTitle.js';

describe('대표 칭호 (T-11-150)', () => {
  afterEach(() => setLocale('ko'));

  it('칭호 id를 지금 언어 문구로 읽는다', () => {
    expect(titleLabel('cup-3-champion')).toBe('제3회 챔피언');
    expect(titleLabel('cup-12-runnerup')).toBe('제12회 준우승');
    expect(titleLabel('cup-1-sf')).toBe('제1회 4강');
    expect(titleLabel('cup-1-qf')).toBeNull();
    expect(titleLabel(null)).toBeNull();
  });

  it('받은 칭호는 우승 > 준우승 > 4강, 같은 단계면 최근 회차 먼저', () => {
    expect(
      titlesOf([
        { edition: 1, stage: 'sf' },
        { edition: 2, stage: 'champion' },
        { edition: 3, stage: 'qf' },
        { edition: 4, stage: 'sf' },
        { edition: 5, stage: 'runnerup' },
        { edition: 6, stage: 'champion' },
      ]),
    ).toEqual(['cup-6-champion', 'cup-2-champion', 'cup-5-runnerup', 'cup-4-sf', 'cup-1-sf']);
  });
});
