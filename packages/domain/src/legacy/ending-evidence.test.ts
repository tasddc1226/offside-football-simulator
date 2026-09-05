import { describe, expect, it } from 'vitest';
import { grantCareerTag } from '../career-tags.js';
import { hashState } from '../hash.js';
import { hashSeasonResult } from '../settlement.js';
import type { CareerState, CareerTagId, ChapterRecord, StatGroup } from '../types.js';
import { archiveFixture, copy } from './__fixtures__/archive.js';
import { createCareerArchiveCore, verifyCareerArchiveCore } from './archive.js';
import { createLegacyResult } from './result.js';
import type { LegacyEndingId } from './endings.js';

// Controlled RAW_EVIDENCE fixtures, not claims that these choices were played by simulate.
// Test the real Archive -> evidence -> score -> ending adapters without injecting LegacyEndingFacts.
function rawCareer(seasons: number) {
  const fixture = archiveFixture();
  const state = fixture.snapshot.state;
  const original = state.seasonHistory[0]!;
  state.careerTags = [];
  state.careerTagGrants = [];
  state.tags = [];
  state.health.episodes = [];
  state.relationships = { managerTrust: 60, captain: 60, rival: 60, fans: 60, agent: 60 };
  state.timeline = [];
  state.clubHistory = [
    {
      ...state.clubHistory[0]!,
      teamId: original.teamId,
      fromSeasonIndex: 1,
      toSeasonIndex: null,
      kind: 'PERMANENT',
      endReason: null,
    },
  ];
  state.seasonHistory = Array.from({ length: seasons }, (_, offset) => {
    const season = copy(original);
    season.index = offset + 1;
    season.settledAtRevision = season.index * 20;
    season.result.index = season.index;
    season.competitions = [];
    season.result.competitions = [];
    season.result.chapters = [];
    season.result.captaincyAtEnd = 'NONE';
    season.result.baseOvr = { before: 60, after: 60 };
    state.timeline.push(
      {
        revision: season.settledAtRevision - 10,
        kind: 'SEASON_STARTED',
        refId: String(season.index),
        age: 18 + offset,
        step: 1,
      },
      {
        revision: season.settledAtRevision,
        kind: 'SEASON_SETTLED',
        refId: String(season.index),
        age: 18 + offset,
        step: 12,
      },
    );
    return season;
  });
  state.age = 18 + seasons;
  fixture.snapshot.revision = seasons * 20 + 1;
  state.timeline.push({
    revision: fixture.snapshot.revision,
    kind: 'RETIRED',
    refId: 'RETIRE',
    age: state.age,
    step: 12,
  });
  return fixture;
}

function tag(state: CareerState, id: CareerTagId, season = 1) {
  const grant = grantCareerTag(state, id, {
    seasonIndex: season,
    revision: season * 20,
    refId: `raw-evidence:${id}`,
  });
  state.careerTags = grant.careerTags;
  state.careerTagGrants = grant.careerTagGrants;
}

function chapter(id: string, trigger: ChapterRecord['trigger']): ChapterRecord {
  return {
    chapterId: id,
    version: 1,
    step: 3,
    matchId: `${id}:match`,
    importance: 'MAJOR',
    trigger,
    decisions: [{ decisionId: 'D1', optionId: 'A', outcomeId: 'success', outcomeKind: 'SUCCESS' }],
    ratingDeltaTenths: 1,
  };
}

function excellentSeasons(state: CareerState) {
  for (const season of state.seasonHistory) {
    const r = season.result;
    r.playerStats = {
      group: 'FW',
      appearances: { total: 20, started: 20, sub: 0, zeroMinute: 0, out: 0 },
      minutes: 1800,
      ratedMatches: 20,
      ratingSumTenths: 1500,
      yellow: 0,
      red: 0,
      injuries: 0,
      totals: { group: 'FW', goals: 14, assists: 0, xgCenti: 1400, shots: 50, offsides: 2 },
    };
    r.selectionSummary = {
      ...r.selectionSummary,
      started: 20,
      sub: 0,
      out: 0,
      zeroMinute: 0,
      minutes: 1800,
      possibleMinutes: 1800,
      squadRoleAtEnd: 'STARTER',
    };
    r.promiseFulfilment = { ...r.promiseFulfilment, fulfilled: true, minutesShareBp: 10000 };
    r.legacy = {
      policyVersion: '1.0.0',
      incomeMinor: 0,
      contractId: state.contract!.id,
      relationships: { ...state.relationships },
      promotion: false,
      ageAtStart: 17 + season.index,
      injuryMissedMatches: 0,
    };
  }
}

function sustainedUntitledSeasons(state: CareerState, group: StatGroup) {
  state.relationships = { managerTrust: 75, captain: 75, rival: 50, fans: 75, agent: 75 };
  tag(state, 'TAG-ONE-CLUB', 10);
  tag(state, 'TAG-MANAGER-FAVOURITE', 12);
  for (const season of state.seasonHistory) {
    const totals =
      group === 'GK'
        ? { group, saves: 60, psxgMinusGoalsCenti: 0, cleanSheet: 0, crossesClaimed: 0, buildUpPasses: 0 }
        : group === 'DF'
          ? { group, tackles: 80, interceptions: 40, aerialsWon: 40, goalsConcededInvolved: 0, cleanSheet: 0 }
          : group === 'MF'
            ? { group, assists: 0, chancesCreated: 60, progressivePasses: 120, passesAttempted: 0, passesCompleted: 0, ballRecoveries: 60 }
            : { group, goals: 10, assists: 4, xgCenti: 0, shots: 0, offsides: 0 };
    season.result.playerStats = {
      group,
      appearances: { total: 20, started: 20, sub: 0, zeroMinute: 0, out: 0 },
      minutes: 1800,
      ratedMatches: 20,
      ratingSumTenths: 1400,
      yellow: 0,
      red: 0,
      injuries: 0,
      totals,
    };
    season.result.selectionSummary = {
      ...season.result.selectionSummary,
      started: 20,
      sub: 0,
      out: 0,
      zeroMinute: 0,
      minutes: 1800,
      possibleMinutes: 1800,
      squadRoleAtEnd: 'STARTER',
    };
    season.result.promiseFulfilment = {
      ...season.result.promiseFulfilment,
      fulfilled: true,
      minutesShareBp: 10000,
    };
    season.result.legacy = {
      policyVersion: '1.0.0',
      incomeMinor: 0,
      contractId: state.contract!.id,
      relationships: { ...state.relationships },
      promotion: false,
      ageAtStart: 17 + season.index,
      injuryMissedMatches: 0,
    };
  }
  state.seasonHistory[4]!.result.chapters = [chapter('untitled-decider-5', 'DECIDER')];
  state.seasonHistory[14]!.result.chapters = [chapter('untitled-decider-15', 'DECIDER')];
}

type Case = { ending: LegacyEndingId; seasons: number; prepare: (state: CareerState) => void };
const cases: Case[] = [
  {
    ending: 'END-ONE-CLUB-LEGEND',
    seasons: 10,
    prepare: (s) => {
      tag(s, 'TAG-ONE-CLUB', 8);
      s.relationships.fans = 80;
    },
  },
  {
    ending: 'END-NATIONAL-HERO',
    seasons: 1,
    prepare: (s) => {
      s.legacyEvents = {
        policyVersion: '1.0.0',
        mentoredSeasonIndices: [],
        tournaments: [
          {
            sourceId: 'U23:OLYMPICS:1',
            seasonIndex: 1,
            age: 19,
            tournament: 'OLYMPICS',
            medal: 'GOLD',
            matches: Array.from({ length: 6 }, (_, i) => ({
              index: i + 1,
              roll: 1,
              won: true,
              minutes: 90,
            })),
          },
        ],
      };
    },
  },
  {
    ending: 'END-UNCROWNED-KING',
    seasons: 20,
    prepare: (s) => {
      s.relationships = { managerTrust: 100, captain: 100, rival: 50, fans: 100, agent: 100 };
      excellentSeasons(s);
      for (const season of s.seasonHistory.slice(0, 15))
        season.result.chapters = [chapter(`decider-${season.index}`, 'DECIDER')];
    },
  },
  {
    ending: 'END-DERBY-HERO',
    seasons: 3,
    prepare: (s) => {
      tag(s, 'TAG-DERBY-HERO', 3);
      for (const season of s.seasonHistory)
        season.result.chapters = [chapter(`derby-${season.index}`, 'DERBY')];
    },
  },
  {
    ending: 'END-PROMOTION-CAPTAIN',
    seasons: 2,
    prepare: (s) => {
      excellentSeasons(s);
      for (const season of s.seasonHistory) season.result.legacy!.promotion = true;
      s.seasonHistory[1]!.result.captaincyAtEnd = 'CAPTAIN';
    },
  },
  {
    ending: 'END-LOAN-LEGEND',
    seasons: 4,
    prepare: (s) => {
      tag(s, 'TAG-LOAN-LEGEND');
      for (const season of s.seasonHistory.slice(1))
        season.result.selectionSummary.squadRoleAtEnd = 'STARTER';
    },
  },
  {
    ending: 'END-COMEBACK-PLAYER',
    seasons: 4,
    prepare: (s) => {
      tag(s, 'TAG-COMEBACK');
    },
  },
  {
    ending: 'END-IRONMAN',
    seasons: 10,
    prepare: (s) => {
      excellentSeasons(s);
      tag(s, 'TAG-IRONMAN', 10);
      s.seasonHistory[0]!.result.competitions = [
        {
          competitionId: 'league-1',
          kind: 'LEAGUE',
          played: 20,
          won: 20,
          drawn: 0,
          lost: 0,
          goalsFor: 40,
          goalsAgainst: 0,
          position: 1,
          cupRound: null,
        },
      ];
    },
  },
  {
    ending: 'END-PLAYER-COACH',
    seasons: 1,
    prepare: (s) => {
      s.timeline.at(-1)!.refId = 'COACH_EPILOGUE';
    },
  },
  {
    ending: 'END-MENTOR',
    seasons: 3,
    prepare: (s) => {
      s.tags = ['MENTOR_SUCCESS:1', 'MENTOR_SUCCESS:2', 'MENTOR_SUCCESS:3'];
      for (const entry of s.timeline) entry.age += 13;
      s.age += 13;
    },
  },
  {
    ending: 'END-LATE-BLOOMER',
    seasons: 2,
    prepare: (s) => {
      for (const entry of s.timeline) entry.age += 8;
      s.age += 8;
      s.seasonHistory[1]!.result.baseOvr.after = 70;
    },
  },
  {
    ending: 'END-JOURNEYMAN',
    seasons: 8,
    prepare: (s) => {
      tag(s, 'TAG-JOURNEYMAN', 6);
    },
  },
  {
    ending: 'END-CONTROVERSIAL-STAR',
    seasons: 10,
    prepare: (s) => {
      excellentSeasons(s);
      tag(s, 'TAG-CONTROVERSIAL', 3);
      s.seasonHistory[0]!.result.competitions = [
        {
          competitionId: 'league-1',
          kind: 'LEAGUE',
          played: 20,
          won: 20,
          drawn: 0,
          lost: 0,
          goalsFor: 40,
          goalsAgainst: 0,
          position: 1,
          cupRound: null,
        },
      ];
    },
  },
  { ending: 'END-COMPLETE-SHORT', seasons: 1, prepare: () => {} },
];

describe('RAW_EVIDENCE: all 14 Archive-to-ending projections (not command replay)', () => {
  it.each(cases)('$ending', ({ ending, seasons, prepare }) => {
    const { snapshot, context } = rawCareer(seasons);
    prepare(snapshot.state);
    for (const season of snapshot.state.seasonHistory) {
      season.competitions = copy(season.result.competitions);
      season.result.hash = hashSeasonResult(season.result);
    }
    snapshot.stateHash = hashState(snapshot.state);
    const archive = createCareerArchiveCore(snapshot, context);
    expect(verifyCareerArchiveCore(archive, context)).toEqual({ ok: true });
    const result = createLegacyResult(archive, context);
    expect(result.endingId).toBe(ending);
    expect(result.sources.some((source) => source.sourceId === result.bestMomentRef)).toBe(true);
    if (ending === 'END-UNCROWNED-KING') expect(result.totalScore).toBeGreaterThanOrEqual(80);
  });

  it('can derive an 80±5 untitled contribution path from comparable raw evidence in every position', () => {
    const results = (['GK', 'DF', 'MF', 'FW'] as const).map((group) => {
      const { snapshot, context } = rawCareer(20);
      sustainedUntitledSeasons(snapshot.state, group);
      for (const season of snapshot.state.seasonHistory) {
        season.competitions = [];
        season.result.competitions = [];
        season.result.hash = hashSeasonResult(season.result);
      }
      snapshot.stateHash = hashState(snapshot.state);
      const archive = createCareerArchiveCore(snapshot, context);
      expect(verifyCareerArchiveCore(archive, context)).toEqual({ ok: true });
      const result = createLegacyResult(archive, context, undefined, '1.1.0');
      expect(result.sources.some((source) => source.sourceId === 'tag:TAG-UNCROWNED')).toBe(true);
      expect(result.sources.filter((source) => source.kind === 'CHAPTER')).toHaveLength(2);
      expect(result.totalScore).toBeGreaterThanOrEqual(75);
      expect(result.totalScore).toBeLessThanOrEqual(85);
      return result;
    });
    expect(results.map((result) => result.totalScore)).toEqual([81, 81, 81, 81]);
  });
});
