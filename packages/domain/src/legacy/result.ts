import { canonicalize, compareCodePoints, type JsonValue } from '../canonical.js';
import { CAREER_TAGS } from '../career-tags.js';
import { sha256Hex } from '../hash.js';
import { seasonWonTitle } from '../reputation.js';
import type { CareerState, CareerTagId, SeasonSummary, StatGroup } from '../types.js';
import {
  ArchiveError,
  verifyCareerArchiveCore,
  type ArchiveContext,
  type CareerArchiveCore,
} from './archive.js';
import { evaluateLegacyEndings, type LegacyEndingFacts } from './eligibility.js';
import {
  calculateLegacyScore,
  LEGACY_COMPONENT_WEIGHTS,
  type LegacyComponentScores,
} from './score.js';
import { nationalityForCareer } from './career-event.js';

/** Independent, immutable Phase 5 policy. Never normalize against a changing player population. */
export const LEGACY_POLICY = Object.freeze({
  version: '1.0.0',
  performancePer90Centi: Object.freeze({ GK: 300, DF: 800, MF: 1200, FW: 70 }),
  longevityBySeasons: Object.freeze([
    0, 8, 15, 22, 28, 34, 40, 45, 50, 55, 60, 65, 70, 75, 80, 84, 88, 91, 94, 97, 100,
  ]),
  lateBloomerPeakOvr: 70,
  lateBloomerAge: 26,
  lateBloomerGain: 6,
  weights: LEGACY_COMPONENT_WEIGHTS,
  trophies: Object.freeze({
    league: 15,
    cup: 10,
    tierPercents: Object.freeze([100, 75, 50, 25]),
    minimumParticipationBp: 4000,
    belowMinimumPercent: 50,
  }),
  merit: Object.freeze({
    minimumRatedMatches: 10,
    minimumRatingTenths: 75,
    minimumMinutesBp: 6000,
    perSeason: 6,
    cap: 60,
  }),
  chapters: Object.freeze({ each: 2, cap: 30, seniorCapPointsCenti: 50, seniorCapLimit: 20 }),
  medals: Object.freeze({ GOLD: 12, SILVER: 8, BRONZE: 5 }),
  contribution: Object.freeze({
    minutes: 40,
    performancePercent: 50,
    promise: 10,
    expectedPerformance: 80,
  }),
  longevity: Object.freeze({
    appearanceDivisor: 50,
    appearanceCap: 10,
    majorInjuryPenalty: 3,
    injuryPenaltyCap: 15,
    comeback: 10,
  }),
  relationship: Object.freeze({ seasonPercent: 80, finalPercent: 20 }),
  narrative: Object.freeze({ COMMON: 5, RARE: 12, EPIC: 25 }),
});

export type LegacyVersion = '1.0.0' | '1.1.0' | '1.2.0';

/** Experimental next policy; runtime activation requires the separate population acceptance gate.
 * The 1.0.0 definition above and its persisted results must never be rewritten. */
export const LEGACY_POLICY_110 = Object.freeze({
  version: '1.1.0',
  basePolicyChecksum: sha256Hex(canonicalize(LEGACY_POLICY as unknown as JsonValue)),
  contribution: Object.freeze({ careerPercent: 30, primePercent: 70, primeSeasons: 5 }),
  longevity: Object.freeze({ fullActiveMinutesBp: 4000, pointsPerActiveSeason: 6 }),
  merit: Object.freeze({
    minimumRatedMatches: 10,
    minimumRatingTenths: 65,
    minimumMinutesBp: 4000,
    basePerSeason: 3,
    ratingStepTenths: 2,
    maxPerSeason: 9,
    cap: 60,
  }),
  relationship: Object.freeze({
    strongestBonds: 2,
    careerPercent: 70,
    careerAnchor: 70,
    primePercent: 30,
    primeAnchor: 80,
    primeSeasons: 3,
  }),
  narrative: Object.freeze({ COMMON: 10, RARE: 25, EPIC: 50 }),
});

/** T-7-032(D-80 1라운드 ③): 1.6.1+ 활성화 게이트 전용. 1.1.0의 모든 항목을 상속하고
 * `performancePer90Centi`(포지션 편차 조정)·`bandCuts`(상위 밴드 비율 조정)만 재정의한다.
 * 1.0.0·1.1.0으로 바인딩된 결과는 이 정책을 절대 참조하지 않는다. */
export const LEGACY_POLICY_120 = Object.freeze({
  ...LEGACY_POLICY_110,
  version: '1.2.0',
  basePolicyChecksum: sha256Hex(canonicalize(LEGACY_POLICY_110 as unknown as JsonValue)),
  performancePer90Centi: Object.freeze({ GK: 450, DF: 900, MF: 900, FW: 300 }),
  bandCuts: Object.freeze({ LEGEND: 90, ICON: 82, REMEMBERED: 60, SOLID: 30 }),
});

export function legacyPolicyForVersion(version: LegacyVersion) {
  if (version === '1.0.0') return LEGACY_POLICY;
  if (version === '1.1.0') return LEGACY_POLICY_110;
  if (version === '1.2.0') return LEGACY_POLICY_120;
  throw new ArchiveError('VERSION_MISMATCH');
}

export type LegacySource = Readonly<{
  sourceId: string;
  revision: number;
  seasonIndex: number | null;
  kind: 'SEASON' | 'CHAPTER' | 'TAG' | 'RETIREMENT';
}>;
export type LegacyFactor = Readonly<{
  component: keyof LegacyComponentScores;
  sourceIds: readonly string[];
  reasonTag: string;
  value: number;
}>;
export type LegacyReferencePopulation = Readonly<{
  id: string;
  legacyVersion: string;
  rulesetVersion: string;
  /** Per-position, sorted integer scores from a frozen simulated-career population. */
  scores: Readonly<Record<StatGroup, readonly number[]>>;
}>;

function canonical(value: unknown): string {
  return canonicalize(value as JsonValue);
}
function score(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}
function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// T-7-032: 버전별 기대치. 1.0.0·1.1.0은 원래 LEGACY_POLICY 기대치를 그대로 쓴다(값·동작 불변).
function performance(summary: SeasonSummary, version: LegacyVersion = '1.0.0'): number {
  const stats = summary.result.playerStats;
  const total = stats.totals;
  const value =
    total.group === 'GK'
      ? total.saves
      : total.group === 'DF'
        ? total.tackles + total.interceptions + total.aerialsWon
        : total.group === 'MF'
          ? total.chancesCreated + total.progressivePasses + total.ballRecoveries
          : total.goals + total.assists;
  const performancePer90Centi =
    version === '1.2.0' ? LEGACY_POLICY_120.performancePer90Centi : LEGACY_POLICY.performancePer90Centi;
  // Rate and exposure are separate: one excellent minute cannot produce a full contribution score.
  return score(
    ratio(value * 90 * 100, stats.minutes * performancePer90Centi[stats.group]) *
      LEGACY_POLICY.contribution.expectedPerformance,
  );
}

/** Retirement-only tags: existing grants remain evidence; no hidden potential is exposed. */
export function deriveRetirementTags(state: CareerState): CareerTagId[] {
  const tags = new Set<CareerTagId>(state.careerTags);
  const history = state.seasonHistory;
  const ageAtSeason = (s: SeasonSummary) =>
    state.timeline.find(
      (t) =>
        t.kind === 'SEASON_STARTED' &&
        t.revision < s.settledAtRevision &&
        t.revision > (history[s.index - 2]?.settledAtRevision ?? 0),
    )?.age;
  const earlyPeak = Math.max(
    history[0]?.result.baseOvr.before ?? 0,
    ...history
      .filter((s) => (ageAtSeason(s) ?? 0) < LEGACY_POLICY.lateBloomerAge)
      .map((s) => s.result.baseOvr.after),
  );
  if (
    history.some(
      (s) =>
        (ageAtSeason(s) ?? 0) >= LEGACY_POLICY.lateBloomerAge &&
        s.result.baseOvr.after >= earlyPeak + LEGACY_POLICY.lateBloomerGain,
    )
  )
    tags.add('TAG-LATE-BLOOMER');
  // Only successful, explicit mentorship evidence counts; captaincy alone is not mentorship.
  if (new Set(state.tags.filter((tag) => /^MENTOR_SUCCESS:[^:]+$/.test(tag))).size >= 3)
    tags.add('TAG-MENTOR');
  if (
    history.length >= 10 &&
    !history.some((s) => seasonWonTitle(s.result)) &&
    mean(history.map((s) => performance(s))) >= 80
  )
    tags.add('TAG-UNCROWNED');
  if (
    history.filter(
      (s) =>
        s.result.legacy?.promotion === true &&
        s.result.selectionSummary.squadRoleAtEnd === 'STARTER',
    ).length >= 2
  )
    tags.add('TAG-PROMOTION-EXPERT');
  return [...tags].sort(compareCodePoints);
}

export function deriveLegacyEvidence(archive: CareerArchiveCore, version: LegacyVersion = '1.0.0') {
  legacyPolicyForVersion(version);
  const state = JSON.parse(archive.source.state) as CareerState;
  const history = state.seasonHistory;
  const tags = deriveRetirementTags(state);
  const sources: LegacySource[] = [];
  const sourceIds: Record<keyof LegacyComponentScores, string[]> = {
    achievement: [],
    contribution: [],
    longevity: [],
    relationship: [],
    narrative: [],
  };
  const add = (component: keyof LegacyComponentScores, source: LegacySource) => {
    sources.push(source);
    sourceIds[component].push(source.sourceId);
  };
  let trophyPoints = 0;
  let individualMeritPoints = 0;
  let trophies = 0;
  let chapterSuccesses = 0;
  let derbySuccesses = 0;
  let nationalCaps = 0;
  // 1.2.0은 1.1.0의 merit·relationship·narrative 등을 그대로 상속한다(performancePer90Centi·
  // bandCuts만 재정의). LEGACY_POLICY_120에는 상속된 필드가 이미 담겨 있다.
  const policy110Like =
    version === '1.2.0' ? LEGACY_POLICY_120 : version === '1.1.0' ? LEGACY_POLICY_110 : null;
  const meritPolicy = policy110Like ? policy110Like.merit : LEGACY_POLICY.merit;
  const decisiveInternational =
    state.legacyEvents?.tournaments.some(
      (t) => t.medal === 'GOLD' && t.matches.at(-1)?.won === true,
    ) ?? false;
  for (const season of history) {
    const { result } = season;
    const source = {
      revision: season.settledAtRevision,
      seasonIndex: season.index,
      kind: 'SEASON' as const,
    };
    add('contribution', { ...source, sourceId: `season:${season.index}:performance` });
    add('longevity', { ...source, sourceId: `season:${season.index}:duration` });
    add('relationship', { ...source, sourceId: `season:${season.index}:relationships` });
    // Versioned individual season recognition, separate from trophies. Ratings belong to
    // achievement; the contribution axis uses position rates/minutes/promises, not ratings again.
    if (
      result.playerStats.ratedMatches >= meritPolicy.minimumRatedMatches &&
      ratio(result.playerStats.ratingSumTenths, result.playerStats.ratedMatches) >=
        meritPolicy.minimumRatingTenths &&
      result.promiseFulfilment.minutesShareBp >= meritPolicy.minimumMinutesBp
    ) {
      const seasonMeritPoints = policy110Like
        ? Math.min(
            policy110Like.merit.maxPerSeason,
            policy110Like.merit.basePerSeason +
              Math.floor(
                (ratio(result.playerStats.ratingSumTenths, result.playerStats.ratedMatches) -
                  policy110Like.merit.minimumRatingTenths) /
                  policy110Like.merit.ratingStepTenths,
              ),
          )
        : LEGACY_POLICY.merit.perSeason;
      individualMeritPoints += seasonMeritPoints;
      add('achievement', {
        ...source,
        sourceId: policy110Like
          ? `season:${season.index}:established-contribution`
          : `season:${season.index}:individual-merit`,
      });
    }
    const tier = state.clubHistory.find(
      (stint) =>
        stint.teamId === season.teamId &&
        stint.fromSeasonIndex <= season.index &&
        (stint.toSeasonIndex === null || stint.toSeasonIndex >= season.index),
    )?.leagueTier;
    for (const competition of result.competitions) {
      if (!seasonWonTitle({ competitions: [competition] })) continue;
      trophies += 1;
      trophyPoints +=
        (competition.kind === 'CUP' ? LEGACY_POLICY.trophies.cup : LEGACY_POLICY.trophies.league) *
        ((LEGACY_POLICY.trophies.tierPercents[(typeof tier === 'number' ? tier : 4) - 1] ?? 25) /
          100) *
        (result.promiseFulfilment.minutesShareBp < LEGACY_POLICY.trophies.minimumParticipationBp
          ? LEGACY_POLICY.trophies.belowMinimumPercent / 100
          : 1);
      add('achievement', {
        ...source,
        sourceId: `season:${season.index}:trophy:${competition.competitionId}`,
      });
    }
    for (const chapter of result.chapters) {
      // A chapter is a single appearance/evidence unit, irrespective of its number of choices.
      const succeeded = chapter.decisions.some((decision) => decision.outcomeKind === 'SUCCESS');
      if (chapter.trigger === 'NATIONAL_DEBUT') nationalCaps += 1;
      if (!succeeded) continue;
      chapterSuccesses += 1;
      if (chapter.trigger === 'DERBY') derbySuccesses += 1;
      // A debut is not an international tournament win; no automatic national-hero promotion.
      add('achievement', {
        ...source,
        kind: 'CHAPTER',
        sourceId: `season:${season.index}:chapter:${chapter.chapterId}`,
      });
    }
  }
  for (const tag of tags) {
    const grant = state.careerTagGrants.find((g) => g.tagId === tag);
    add('narrative', {
      sourceId: `tag:${tag}`,
      revision: grant?.atRevision ?? archive.source.revision,
      seasonIndex: grant?.seasonIndex ?? null,
      kind: 'TAG',
    });
  }
  for (const tournament of state.legacyEvents?.tournaments ?? []) {
    add('achievement', {
      sourceId: tournament.sourceId,
      revision:
        state.timeline.find((t) => t.refId === tournament.sourceId)?.revision ??
        archive.source.revision,
      seasonIndex: tournament.seasonIndex,
      kind: 'CHAPTER',
    });
  }
  const components: LegacyComponentScores = {
    achievement: score(
      trophyPoints +
        Math.min(meritPolicy.cap, individualMeritPoints) +
        Math.min(LEGACY_POLICY.chapters.cap, chapterSuccesses * LEGACY_POLICY.chapters.each) +
        Math.min(
          LEGACY_POLICY.chapters.seniorCapLimit,
          (nationalCaps * LEGACY_POLICY.chapters.seniorCapPointsCenti) / 100,
        ) +
        (state.legacyEvents?.tournaments.reduce(
          (sum, t) => sum + (t.medal === null ? 0 : LEGACY_POLICY.medals[t.medal]),
          0,
        ) ?? 0),
    ),
    contribution: score(
      mean(
        history.map((s) => {
          const r = s.result;
          return (
            LEGACY_POLICY.contribution.minutes *
              ratio(r.playerStats.minutes, r.selectionSummary.possibleMinutes) +
            (LEGACY_POLICY.contribution.performancePercent / 100) * performance(s) +
            (r.promiseFulfilment.fulfilled ? LEGACY_POLICY.contribution.promise : 0)
          );
        }),
      ),
    ),
    longevity: score(
      (LEGACY_POLICY.longevityBySeasons[Math.min(20, history.length)] ?? 0) +
        Math.min(
          LEGACY_POLICY.longevity.appearanceCap,
          archive.records.totals.playedMatches / LEGACY_POLICY.longevity.appearanceDivisor,
        ) -
        Math.min(
          LEGACY_POLICY.longevity.injuryPenaltyCap,
          state.health.episodes.filter((e) => e.severity === 'MAJOR').length *
            LEGACY_POLICY.longevity.majorInjuryPenalty,
        ) +
        (tags.includes('TAG-COMEBACK') ? LEGACY_POLICY.longevity.comeback : 0),
    ),
    relationship: score(
      (LEGACY_POLICY.relationship.seasonPercent / 100) *
        mean(
          history.map((s) =>
            s.result.legacy === undefined
              ? s.result.stateDeltas.managerTrust.after
              : mean([
                  s.result.legacy.relationships.managerTrust,
                  s.result.legacy.relationships.captain,
                  s.result.legacy.relationships.fans,
                  s.result.legacy.relationships.agent,
                ]),
          ),
        ) +
        (LEGACY_POLICY.relationship.finalPercent / 100) *
          mean([
            state.relationships.managerTrust,
            state.relationships.captain,
            state.relationships.fans,
            state.relationships.agent,
          ]),
    ),
    narrative: score(
      tags.reduce((sum, tag) => sum + LEGACY_POLICY.narrative[CAREER_TAGS[tag].rarity], 0),
    ),
  };
  if (policy110Like) {
    const policy = policy110Like;
    const top = (values: number[], count: number) =>
      values.toSorted((a, b) => b - a).slice(0, count);
    const contributions = history.map((season) => {
      const r = season.result;
      return (
        LEGACY_POLICY.contribution.minutes *
          ratio(r.playerStats.minutes, r.selectionSummary.possibleMinutes) +
        (LEGACY_POLICY.contribution.performancePercent / 100) * performance(season, version) +
        (r.promiseFulfilment.fulfilled ? LEGACY_POLICY.contribution.promise : 0)
      );
    });
    components.contribution = score(
      (policy.contribution.careerPercent / 100) * mean(contributions) +
        (policy.contribution.primePercent / 100) *
          mean(top(contributions, policy.contribution.primeSeasons)),
    );
    components.longevity = score(
      history.reduce(
        (sum, { result: r }) =>
          sum +
          Math.min(
            1,
            ratio(r.playerStats.minutes, r.selectionSummary.possibleMinutes) /
              (policy.longevity.fullActiveMinutesBp / 10000),
          ),
        0,
      ) * policy.longevity.pointsPerActiveSeason,
    );
    // Rivalry is competitive tension, not a positive bond. Captain relationship is not captaincy.
    const bonds = history.map(({ result: r }) =>
      r.legacy === undefined
        ? r.stateDeltas.managerTrust.after
        : mean(
            top(
              [
                r.legacy.relationships.managerTrust,
                r.legacy.relationships.captain,
                r.legacy.relationships.fans,
                r.legacy.relationships.agent,
              ],
              policy.relationship.strongestBonds,
            ),
          ),
    );
    components.relationship = score(
      (policy.relationship.careerPercent * mean(bonds)) / policy.relationship.careerAnchor +
        (policy.relationship.primePercent * mean(top(bonds, policy.relationship.primeSeasons))) /
          policy.relationship.primeAnchor,
    );
    components.narrative = score(
      tags.reduce((sum, tag) => sum + policy.narrative[CAREER_TAGS[tag].rarity], 0),
    );
  }
  const grantSeason = (id: CareerTagId) =>
    state.careerTagGrants.find((g) => g.tagId === id)?.seasonIndex;
  const after = (id: CareerTagId, starter: boolean) => {
    const from = grantSeason(id);
    return from === undefined
      ? 0
      : history.filter(
          (s) =>
            s.index > from && (!starter || s.result.selectionSummary.squadRoleAtEnd === 'STARTER'),
        ).length;
  };
  const oneClubSeasons = Math.max(
    0,
    ...archive.records.clubs.map((club) => club.seasonIndices.length),
  );
  const finalChoice =
    state.timeline.findLast((t) => t.kind === 'RETIRED')?.refId === 'COACH_EPILOGUE'
      ? ('COACH_EPILOGUE' as const)
      : ('RETIRE' as const);
  const facts: LegacyEndingFacts = {
    oneClubSeasons,
    fans: state.relationships.fans,
    nationalCaps,
    decisiveInternational,
    trophies,
    achievement: components.achievement,
    contribution: components.contribution,
    derbySuccesses,
    promotions: history.filter((s) => s.result.legacy?.promotion === true).length,
    captainSeasons: history.filter((s) => s.result.captaincyAtEnd === 'CAPTAIN').length,
    starterSeasonsAfterLoan: after('TAG-LOAN-LEGEND', true),
    seasonsAfterComeback: after('TAG-COMEBACK', false),
    seasonsAfterThirty: history.filter(
      (s) =>
        (state.timeline.find(
          (t) =>
            t.kind === 'SEASON_STARTED' &&
            t.revision < s.settledAtRevision &&
            t.revision > (history[s.index - 2]?.settledAtRevision ?? 0),
        )?.age ?? 0) >= 30,
    ).length,
    totalSeasons: history.length,
    peakOvr: Math.max(0, ...history.map((s) => s.result.baseOvr.after)),
    finalChoice,
    tags,
  };
  return { state, components, sources, sourceIds, facts, tags, trophies, nationalCaps };
}

/** Validate only a population that will actually be displayed. No synthetic percentage fallback. */
function percentile(
  population: LegacyReferencePopulation | undefined,
  rulesetVersion: string,
  group: StatGroup,
  total: number,
  version: LegacyVersion,
) {
  if (population === undefined)
    return { referencePopulationId: null, percentileHidden: true as const };
  if (
    !population.id ||
    population.legacyVersion !== version ||
    population.rulesetVersion !== rulesetVersion
  )
    throw new ArchiveError('VERSION_MISMATCH');
  for (const values of Object.values(population.scores)) {
    if (
      values.length < 10_000 ||
      values.some(
        (value, index) =>
          !Number.isSafeInteger(value) ||
          value < 0 ||
          value > 100 ||
          (index > 0 && value < values[index - 1]!),
      )
    )
      throw new ArchiveError('INVALID_BINDING');
  }
  if (Object.keys(population.scores).sort().join(',') !== 'DF,FW,GK,MF')
    throw new ArchiveError('INVALID_BINDING');
  const values = population.scores[group];
  return {
    referencePopulationId: population.id,
    referencePopulationChecksum: sha256Hex(canonical(population)),
    percentileHidden: false as const,
    percentile: Math.floor((values.filter((v) => v < total).length * 100) / values.length),
  };
}

/** Full private-archive -> public result projection. Contains neither RNG nor hidden potential. */
export function createLegacyResult(
  archive: CareerArchiveCore,
  context: ArchiveContext,
  population?: LegacyReferencePopulation,
  version: LegacyVersion = '1.0.0',
) {
  const policy = legacyPolicyForVersion(version);
  const verified = verifyCareerArchiveCore(archive, context);
  if (!verified.ok) throw new ArchiveError(verified.code);
  const evidence = deriveLegacyEvidence(archive, version);
  const summary = calculateLegacyScore(
    evidence.components,
    version === '1.2.0' ? LEGACY_POLICY_120.bandCuts : undefined,
  );
  const ending = evaluateLegacyEndings(evidence.facts);
  const ordered = (
    Object.keys(LEGACY_COMPONENT_WEIGHTS) as Array<keyof LegacyComponentScores>
  ).sort(
    (a, b) =>
      summary.componentScores[b] * LEGACY_COMPONENT_WEIGHTS[b] -
        summary.componentScores[a] * LEGACY_COMPONENT_WEIGHTS[a] || compareCodePoints(a, b),
  );
  const factors = ordered.map((component): LegacyFactor => ({
    component,
    sourceIds: evidence.sourceIds[component],
    reasonTag: `LEGACY_${component.toUpperCase()}`,
    value: summary.componentScores[component],
  }));
  // An actual unchosen branch at the final confirmation, never an invented lost transfer.
  const retirementSource: LegacySource = {
    sourceId: 'retirement:alternative',
    revision: archive.source.revision,
    seasonIndex: null,
    kind: 'RETIREMENT',
  };
  evidence.sources.push(retirementSource);
  const missed: LegacyFactor = {
    component: 'narrative',
    value: 0,
    sourceIds: [retirementSource.sourceId],
    reasonTag:
      evidence.facts.finalChoice === 'COACH_EPILOGUE'
        ? 'UNCHOSEN_PLAYER_ONLY_EPILOGUE'
        : 'UNCHOSEN_COACH_EPILOGUE',
  };
  const bestMoment = evidence.sources.find((s) => s.kind === 'CHAPTER') ??
    evidence.sources.find((s) => s.sourceId.includes(':trophy:')) ??
    evidence.sources.find((s) => s.kind === 'SEASON') ?? {
      sourceId: 'retirement',
      revision: archive.source.revision,
      seasonIndex: null,
      kind: 'RETIREMENT' as const,
    };
  if (!evidence.sources.some((source) => source.sourceId === bestMoment.sourceId))
    evidence.sources.push(bestMoment);
  const primaryGroup =
    archive.records.positions.toSorted(
      (a, b) => b.totals.minutes - a.totals.minutes || compareCodePoints(a.group, b.group),
    )[0]?.group ?? 'FW';
  const body = {
    legacyVersion: version,
    definitionChecksum: sha256Hex(canonical(policy)),
    rulesetVersion: archive.binding.rulesetVersion,
    archiveId: archive.archiveId,
    archiveHash: archive.hash,
    ...summary,
    ...ending,
    ...percentile(
      population,
      archive.binding.rulesetVersion,
      primaryGroup,
      summary.totalScore,
      version,
    ),
    topFactors: factors.slice(0, 3),
    missedOpportunity: missed,
    bestMomentRef: bestMoment.sourceId,
    sources: evidence.sources,
    tags: evidence.tags,
    // Logical timestamp supplied by the immutable archive, not wall clock time.
    computedAt: { retirementRevision: archive.source.revision },
    incomeMinor: evidence.state.seasonHistory.reduce(
      (sum, season) => sum + (season.result.legacy?.incomeMinor ?? 0),
      0,
    ),
    nationality: nationalityForCareer(evidence.state),
    international: {
      seniorCaps: evidence.nationalCaps,
      youthAppearances:
        evidence.state.legacyEvents?.tournaments.reduce(
          (sum, t) => sum + t.matches.filter((m) => m.minutes > 0).length,
          0,
        ) ?? 0,
      tournaments: (evidence.state.legacyEvents?.tournaments ?? []).map((t) => ({
        sourceId: t.sourceId,
        seasonIndex: t.seasonIndex,
        tournament: t.tournament,
        medal: t.medal,
      })),
    },
    coverage: {
      nationalAppearances: 'RECORDED_CHAPTERS_ONLY' as const,
      income: evidence.state.seasonHistory.every((season) => season.result.legacy !== undefined)
        ? ('COMPLETE' as const)
        : evidence.state.seasonHistory.some((season) => season.result.legacy !== undefined)
          ? ('PARTIAL' as const)
          : ('UNAVAILABLE' as const),
      referencePopulation:
        population === undefined ? ('UNAVAILABLE' as const) : ('AVAILABLE' as const),
    },
  };
  if (!Number.isSafeInteger(body.incomeMinor)) throw new ArchiveError('INVALID_SNAPSHOT');
  return freeze({ ...body, hash: sha256Hex(canonical(body)) });
}

export type LegacyResult = ReturnType<typeof createLegacyResult>;
