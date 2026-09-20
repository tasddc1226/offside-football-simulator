import { describe, expect, it } from 'vitest';
import { evaluateLegacyEndings, type LegacyEndingFacts } from './eligibility.js';

const base: LegacyEndingFacts = {
  oneClubSeasons: 0,
  fans: 0,
  nationalCaps: 0,
  decisiveInternational: false,
  trophies: 1,
  achievement: 0,
  contribution: 0,
  derbySuccesses: 0,
  promotions: 0,
  captainSeasons: 0,
  starterSeasonsAfterLoan: 0,
  seasonsAfterComeback: 0,
  seasonsAfterThirty: 0,
  totalSeasons: 0,
  peakOvr: 50,
  finalChoice: 'RETIRE',
  tags: [],
};

const variants: Array<[string, Partial<LegacyEndingFacts>, string]> = [
  ['one club', { oneClubSeasons: 10, fans: 80, tags: ['TAG-ONE-CLUB'] }, 'END-ONE-CLUB-LEGEND'],
  ['national caps', { nationalCaps: 30 }, 'END-NATIONAL-HERO'],
  ['international decisive', { decisiveInternational: true }, 'END-NATIONAL-HERO'],
  [
    'uncrowned',
    { trophies: 0, achievement: 60, contribution: 80, tags: ['TAG-UNCROWNED'] },
    'END-UNCROWNED-KING',
  ],
  ['derby', { derbySuccesses: 3, tags: ['TAG-DERBY-HERO'] }, 'END-DERBY-HERO'],
  [
    'promotion captain',
    { promotions: 2, captainSeasons: 1, tags: ['TAG-PROMOTION-EXPERT'] },
    'END-PROMOTION-CAPTAIN',
  ],
  ['loan', { starterSeasonsAfterLoan: 3, tags: ['TAG-LOAN-LEGEND'] }, 'END-LOAN-LEGEND'],
  ['comeback', { seasonsAfterComeback: 3, tags: ['TAG-COMEBACK'] }, 'END-COMEBACK-PLAYER'],
  ['ironman', { tags: ['TAG-IRONMAN'] }, 'END-IRONMAN'],
  ['coach', { finalChoice: 'COACH_EPILOGUE' }, 'END-PLAYER-COACH'],
  ['mentor', { seasonsAfterThirty: 3, tags: ['TAG-MENTOR'] }, 'END-MENTOR'],
  ['late bloomer', { peakOvr: 70, tags: ['TAG-LATE-BLOOMER'] }, 'END-LATE-BLOOMER'],
  ['journeyman', { totalSeasons: 8, tags: ['TAG-JOURNEYMAN'] }, 'END-JOURNEYMAN'],
  ['controversial', { achievement: 60, tags: ['TAG-CONTROVERSIAL'] }, 'END-CONTROVERSIAL-STAR'],
];

describe('Legacy ending eligibility policy 1.0.0', () => {
  it.each(variants)('reaches the %s ending with its documented facts', (_name, patch, endingId) => {
    expect(evaluateLegacyEndings({ ...base, ...patch })).toEqual({
      endingId,
      endingCandidates: [],
    });
  });

  it('uses strict boundaries and requires every tag-backed condition', () => {
    expect(
      evaluateLegacyEndings({ ...base, oneClubSeasons: 9, fans: 80, tags: ['TAG-ONE-CLUB'] })
        .endingId,
    ).toBe('END-COMPLETE-SHORT');
    expect(
      evaluateLegacyEndings({ ...base, peakOvr: 69, tags: ['TAG-LATE-BLOOMER'] }).endingId,
    ).toBe('END-COMPLETE-SHORT');
    expect(
      evaluateLegacyEndings({ ...base, promotions: 2, captainSeasons: 1, tags: [] }).endingId,
    ).toBe('END-COMPLETE-SHORT');
    expect(
      evaluateLegacyEndings({ ...base, achievement: 60, tags: ['TAG-TRAITOR'] }).endingId,
    ).toBe('END-CONTROVERSIAL-STAR');
  });

  it('delegates priority, deduplication and the two-candidate limit to the resolver', () => {
    const result = evaluateLegacyEndings({
      ...base,
      oneClubSeasons: 10,
      fans: 80,
      nationalCaps: 30,
      achievement: 60,
      contribution: 80,
      trophies: 0,
      totalSeasons: 8,
      tags: ['TAG-ONE-CLUB', 'TAG-UNCROWNED', 'TAG-JOURNEYMAN', 'TAG-ONE-CLUB', 'UNKNOWN'],
    });
    expect(result).toEqual({
      endingId: 'END-ONE-CLUB-LEGEND',
      endingCandidates: ['END-NATIONAL-HERO', 'END-UNCROWNED-KING'],
    });
  });

  it.each([
    { nationalCaps: -1 },
    { fans: 101 },
    { peakOvr: 70.5 },
    { decisiveInternational: 'yes' },
    { finalChoice: 'UNKNOWN' },
    { tags: ['TAG-OK', 3] },
  ])('rejects malformed facts %j', (patch) => {
    expect(() =>
      evaluateLegacyEndings({ ...base, ...patch } as unknown as LegacyEndingFacts),
    ).toThrow(RangeError);
  });
});

it.each([
  [
    { foreignSeasons: 1, bigSeasons: 0, settled: false, returned: false },
    'END-OVERSEAS-CHALLENGER',
  ],
  [{ foreignSeasons: 3, bigSeasons: 0, settled: true, returned: false }, 'END-SECOND-HOME'],
  [{ foreignSeasons: 2, bigSeasons: 0, settled: false, returned: true }, 'END-HOMECOMING'],
  [{ foreignSeasons: 4, bigSeasons: 2, settled: true, returned: false }, 'END-WORLD-PIONEER'],
  [{ foreignSeasons: 0, bigSeasons: 0, settled: false, returned: false }, 'END-COMPLETE-SHORT'],
] as const)('resolves overseas endings from completed playing evidence %j', (overseas, ending) => {
  expect(evaluateLegacyEndings({ ...base, overseas }).endingId).toBe(ending);
});
it('does not let a single big-league appearance or an unearned belonging tag claim an established ending', () => {
  expect(
    evaluateLegacyEndings({
      ...base,
      overseas: { foreignSeasons: 2, bigSeasons: 1, settled: true, returned: false },
    }).endingId,
  ).toBe('END-OVERSEAS-CHALLENGER');
});
