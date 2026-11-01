import { describe, expect, it } from 'vitest';
import type { OwnerTitlesResponse } from './api/ownerProfile.js';
import { PERMANENT_TITLES } from '@offside/contracts/owner-title';
import {
  titleCollection,
  titleGroups,
  titleNextTier,
  titleProgressText,
  titleTierText,
} from './ownerTitleCollection.js';

describe('title collection', () => {
  it('keeps a single card for earned permanent and cup titles, excluding unknown IDs', () => {
    const result = titleCollection({
      titles: ['owner-developer', 'cup-1-champion', 'unknown'],
      permanent: [
        {
          id: 'owner-developer',
          value: 10,
          target: 10,
          earnedAt: '2026-10-10T00:00:00Z',
          isNew: true,
        },
      ],
    });
    expect(result.earned).toEqual(['owner-developer', 'cup-1-champion']);
    expect(result.cups).toEqual(['cup-1-champion']);
    expect(result.locked).toEqual([]);
  });
  it('sorts unfinished goals by relative progress without changing the catalog', () => {
    const permanent: OwnerTitlesResponse['permanent'] = [
      { id: 'owner-academy', value: 10, target: 50, earnedAt: null, isNew: false },
      { id: 'owner-legend-home', value: 2, target: 3, earnedAt: null, isNew: false },
      { id: 'owner-assists', value: 1, target: 5, earnedAt: null, isNew: false },
    ];
    expect(titleCollection({ titles: [], permanent }).locked.map((t) => t.id)).toEqual([
      'owner-legend-home',
      'owner-academy',
      'owner-assists',
    ]);
    expect(permanent[0]?.id).toBe('owner-academy');
  });

  it('T-11-556 shows only the next tier of each ladder, grouped by category with trophies last', () => {
    const at = '2026-10-10T00:00:00Z';
    const permanent: OwnerTitlesResponse['permanent'] = PERMANENT_TITLES.map((t) => ({
      id: t.id,
      target: t.target,
      value: t.metric === 'retired' ? 60 : t.metric === 'division' ? 3 : 0,
      earnedAt: ['owner-developer', 'owner-academy'].includes(t.id) ? at : null,
      isNew: false,
    }));
    const hall = { titles: ['cup-2-champion'], permanent };
    const { locked } = titleCollection(hall);
    expect(locked.map((t) => t.id)).toContain('owner-youth-kingdom');
    expect(locked.map((t) => t.id)).toContain('owner-star-maker');
    expect(locked.map((t) => t.id)).not.toContain('owner-star-factory');
    expect(locked).toHaveLength(new Set(PERMANENT_TITLES.map((t) => t.metric)).size);
    expect(locked[0]?.id).toBe('owner-youth-kingdom');
    const groups = titleGroups(hall);
    expect(groups.earned.map((g) => g.key)).toEqual(['growth', 'trophy']);
    expect(groups.earned[0]?.ids).toEqual(['owner-developer', 'owner-academy']);
    expect(groups.locked.map((g) => g.key)).toEqual([
      'growth',
      'position',
      'record',
      'legacy',
      'team',
    ]);
    expect(titleTierText('owner-academy')).toBe('2/3단계');
    expect(titleTierText('owner-keeper')).toBeNull();
    expect(titleNextTier(hall, 'owner-developer')).toBe('다음 단계 · 육성 왕국 60/100');
    expect(titleNextTier(hall, 'owner-keeper')).toBeNull();
    const elite = permanent.find((t) => t.id === 'owner-division-elite')!;
    expect(titleProgressText(elite)).toBe('프로 II / 엘리트 II');
    expect(titleProgressText({ ...elite, value: 0 })).toBe('기록 없음 / 엘리트 II');
    expect(titleProgressText(permanent[0]!)).toBe('60/10');
  });
});
