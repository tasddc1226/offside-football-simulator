import { describe, expect, it } from 'vitest';
import type { OwnerTitlesResponse } from './api/ownerProfile.js';
import { titleCollection } from './ownerTitleCollection.js';

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
});
