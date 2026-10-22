import { afterEach, describe, expect, it } from 'vitest';
import { titlesOf, PERMANENT_TITLES, TITLE_GRADES } from '@offside/contracts/owner-title';
import { setLocale } from './i18n/core.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { titleLabel, titleCondition, titleRelated, titleGradeLabel } from './ownerTitle.js';

describe('대표 칭호 (T-11-150)', () => {
  afterEach(() => setLocale('ko'));

  it('칭호 id를 지금 언어 문구로 읽는다', () => {
    expect(titleLabel('cup-3-champion')).toBe('제3회 챔피언');
    expect(titleLabel('cup-12-runnerup')).toBe('제12회 준우승');
    // T-11-410 구간 대회 칭호.
    expect(titleLabel('cup-3-junior-champion')).toBe('제3회 주니어 챔피언');
    expect(titleLabel('cup-4-master-sf')).toBe('제4회 마스터 4강');
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

  it('T-11-418e 리그 1부 우승 칭호: 컵 우승과 같은 단계에서 먼저, 세 언어로 읽는다', () => {
    expect(
      titlesOf(
        [
          { edition: 3, stage: 'champion' },
          { edition: 2, stage: 'runnerup' },
        ],
        [2],
      ),
    ).toEqual(['league-2-champion', 'cup-3-champion', 'cup-2-runnerup']);
    expect(titleLabel('league-2-champion')).toBe('시즌 2 리그 챔피언');
    setLocale('en', en);
    expect(titleLabel('league-2-champion')).toBe('Season 2 League Champion');
    setLocale('ja', ja);
    expect(titleLabel('league-2-champion')).toBe('シーズン2 リーグ王者');
    expect(titleLabel('league-0-champion')).toBeNull();
  });
});

it('permanent labels and criteria are translated and unknown titles stay hidden', () => {
  for (const locale of ['ko', 'en', 'ja'] as const) {
    setLocale(locale);
    for (const t of PERMANENT_TITLES) {
      expect(titleLabel(t.id)).toBeTruthy();
      if (t.id !== 'owner-pioneer') expect(titleCondition(t.id)).toContain(String(t.target));
      expect(titleRelated(t.id)).toBeTruthy();
    }
    for (const grade of TITLE_GRADES) expect(titleGradeLabel(grade)).toBeTruthy();
    expect(titleCondition('owner-developer')).toContain('10');
    expect(titleCondition('owner-star-maker')).toContain('90');
  }
  expect(titleLabel('owner-unknown')).toBeNull();
  setLocale('ko');
});
