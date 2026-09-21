import { clamp } from './clamp.js';
import { computeBaseOvr } from './player.js';
import { rollInt, type RngState } from './rng.js';
import { rollRange } from './roll-range.js';
import type { InjuryRules, Ruleset } from './ruleset.js';
import type {
  AttributeKey,
  Availability,
  CareerState,
  InjuryEpisode,
  InjurySeverity,
  MatchRecord,
  Pending,
  PlayerProfile,
  RehabPlan,
  TimelineEntry,
} from './types.js';

type InjuryPending = Extract<Pending, { kind: 'INJURY' }>;

type InjuryHookResult = {
  health: CareerState['health'];
  availability: Availability;
  injuryCount: number;
  timeline: TimelineEntry[];
  rng: RngState;
  attributes: CareerState['attributes'];
  profile: PlayerProfile | null;
  forcedPending: InjuryPending | null;
};

/** 활성 부상의 availability와 episode 잔여치를 같은 값으로 유지한다. */
export function syncInjuryRemaining(
  health: CareerState['health'],
  availability: Availability,
): CareerState['health'] {
  if (availability === null || availability.kind !== 'INJURY') return health;
  const index = health.episodes.findIndex(
    (episode) =>
      (episode.status === 'ACTIVE' || episode.status === 'REHAB') &&
      episode.occurredAt.matchId === availability.sinceMatchId,
  );
  if (index < 0) return health;
  return {
    episodes: health.episodes.map((episode, i) =>
      i === index ? { ...episode, remainingMatches: availability.matchesRemaining } : episode,
    ),
  };
}

/** 다음 시즌 시작 시 부상만 carry한다. 정지(SUSPENSION)는 시즌 경계를 넘지 않는다. */
export function injuryAvailabilityFromHealth(health: CareerState['health']): Availability {
  for (let i = health.episodes.length - 1; i >= 0; i -= 1) {
    const episode = health.episodes[i]!;
    if (episode.status !== 'ACTIVE' && episode.status !== 'REHAB') continue;
    if (episode.remainingMatches === undefined) {
      throw new RangeError(
        `injuryAvailabilityFromHealth: ${episode.id}에 remainingMatches가 없다.`,
      );
    }
    if (episode.remainingMatches > 0) {
      return {
        kind: 'INJURY',
        matchesRemaining: episode.remainingMatches,
        sinceMatchId: episode.occurredAt.matchId,
      };
    }
  }
  return null;
}

function timelineEntry(
  revision: number,
  kind: TimelineEntry['kind'],
  refId: string,
  state: CareerState,
  step: number,
): TimelineEntry {
  return { revision, kind, refId, age: state.age, step };
}

function profileAfterAttributes(
  state: CareerState,
  attributes: CareerState['attributes'],
  ruleset: Ruleset,
): PlayerProfile | null {
  const profile = state.player.profile;
  if (profile === null) return null;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === profile.archetypeId);
  if (archetype === undefined) return profile;
  return { ...profile, baseOvr: computeBaseOvr(attributes, archetype.roleWeights) };
}

function applySequela(
  state: CareerState,
  episode: InjuryEpisode,
  ruleset: Ruleset,
  magnitude: number,
): {
  episode: InjuryEpisode;
  attributes: CareerState['attributes'];
  profile: PlayerProfile | null;
} {
  const bodyPart = ruleset.injuryRules.bodyParts.find(
    (candidate) => candidate.id === episode.bodyPart,
  );
  const key = bodyPart?.sequelaKeys[0] as AttributeKey | undefined;
  if (key === undefined || magnitude === 0) {
    return {
      episode: { ...episode, permanentDelta: [] },
      attributes: state.attributes,
      profile: state.player.profile,
    };
  }
  const before = state.attributes[key];
  const after = clamp(before + magnitude, 1, 99);
  const actualDelta = after - before;
  const attributes = actualDelta === 0 ? state.attributes : { ...state.attributes, [key]: after };
  return {
    episode: { ...episode, permanentDelta: actualDelta === 0 ? [] : [{ key, delta: actualDelta }] },
    attributes,
    profile: profileAfterAttributes(state, attributes, ruleset),
  };
}

/**
 * 선수 상태가 부상 심각도 분포에 반영하는 위험 보정값을 계산한다.
 * 감소한 MINOR 가중치는 MODERATE(3/4)와 MAJOR(1/4)로 이동하며, 합은 항상 10000이다.
 */
export function adjustedSeverityWeights(
  rules: InjuryRules,
  state: CareerState,
): InjuryRules['severityWeights'] {
  const base = rules.severityWeights;
  const durability = state.attributes.durability;
  const riskAdjustment = clamp(
    Math.max(0, rules.durabilityPivot - durability) * rules.severityShiftBpPerDurabilityPoint +
      (state.state.fitness < rules.fitnessBelow ? rules.fitnessAddBp : 0) +
      Math.max(0, state.age - rules.ageFrom) * rules.ageAddBpPerYear,
    0,
    base.MINOR,
  );
  const movedToModerate = Math.floor((riskAdjustment * 3) / 4);
  const movedToMajor = riskAdjustment - movedToModerate;
  return {
    MINOR: base.MINOR - riskAdjustment,
    MODERATE: base.MODERATE + movedToModerate,
    MAJOR: base.MAJOR + movedToMajor,
  };
}

function rollSeverity(
  state: RngState,
  weights: InjuryRules['severityWeights'],
): { severity: InjurySeverity; state: RngState } {
  const rolled = rollInt(state, 10000);
  const moderateBoundary = weights.MINOR + weights.MODERATE;
  const severity: InjurySeverity =
    rolled.value < weights.MINOR ? 'MINOR' : rolled.value < moderateBoundary ? 'MODERATE' : 'MAJOR';
  return { severity, state: rolled.state };
}

function rollBodyPart(
  state: RngState,
  rules: InjuryRules,
): { bodyPart: InjuryRules['bodyParts'][number]; state: RngState } {
  const total = rules.bodyParts.reduce((sum, bodyPart) => sum + bodyPart.weight, 0);
  const rolled = rollInt(state, total);
  let cumulative = 0;
  for (const bodyPart of rules.bodyParts) {
    cumulative += bodyPart.weight;
    if (rolled.value < cumulative) return { bodyPart, state: rolled.state };
  }
  throw new RangeError('rollBodyPart: bodyParts 가중치 합이 유효하지 않다.');
}

function injuryRange(rules: InjuryRules, severity: InjurySeverity): { min: number; max: number } {
  return rules.matchesOut[severity];
}

function nextEpisodeId(state: CareerState, seasonIndex: number, step: number): string {
  const sequence =
    state.health.episodes.filter((episode) => episode.occurredAt.seasonIndex === seasonIndex)
      .length + 1;
  return `INJ-${seasonIndex}-${step}-${sequence}`;
}

function shouldForce(
  severity: InjurySeverity,
  injuryCount: number,
  rules: InjuryRules,
  allowForcedPending: boolean,
): boolean {
  return severity !== 'MINOR' && allowForcedPending && injuryCount < rules.maxForcedPerSeason;
}

function injuryEventReference(
  episode: InjuryEpisode,
  state: CareerState,
  rules: InjuryRules,
  recurrence = false,
): { id: string; version: number } {
  const contextual = rules.contextualEvents;
  if (contextual === undefined) return rules.event;
  if (recurrence && contextual.recurrence !== undefined) return contextual.recurrence;
  const byBodyPart = contextual.byBodyPart?.[episode.bodyPart];
  if (byBodyPart !== undefined) return byBodyPart;
  const ageEvent = contextual.byAgeFrom
    ?.slice()
    .sort((a, b) => b.age - a.age)
    .find((candidate) => state.age >= candidate.age)?.event;
  return ageEvent ?? rules.event;
}

function forcedPending(
  episode: InjuryEpisode,
  step: number,
  rules: InjuryRules,
  state: CareerState,
  recurrence = false,
): InjuryPending {
  const event = injuryEventReference(episode, state, rules, recurrence);
  return { kind: 'INJURY', step, episodeId: episode.id, eventId: event.id, version: event.version };
}

function identityHook(input: {
  state: CareerState;
  availability: Availability;
  injuryCount: number;
  rng: RngState;
}): InjuryHookResult {
  return {
    health: input.state.health,
    availability: input.availability,
    injuryCount: input.injuryCount,
    timeline: [],
    rng: input.rng,
    attributes: input.state.attributes,
    profile: input.state.player.profile,
    forcedPending: null,
  };
}

/**
 * 부상 episode는 한 출전에서 match RNG를 한 번만 재발 검사에 쓴다. 새 별도 부상이 생긴
 * 순간에는 이전 RECOVERED 창을 명시적으로 닫아, 최신 창만 검사하는 호출자와 실제
 * `recurrenceWindowMatches` 길이가 어긋나거나 창이 조용히 직렬 연장되지 않게 한다.
 */
function closeOpenRecurrenceWindows(episodes: readonly InjuryEpisode[]): InjuryEpisode[] {
  return episodes.map((episode) =>
    episode.status === 'RECOVERED' && episode.recurrenceChecksRemaining > 0
      ? { ...episode, recurrenceChecksRemaining: 0 }
      : episode,
  );
}

/** Counts only the current same-body recurrence chain; an unrelated fresh injury starts over. */
export function recurrenceChainLength(
  episodes: readonly InjuryEpisode[],
  episodeId: string,
): number {
  const index = episodes.findIndex((episode) => episode.id === episodeId);
  if (index < 0) return 0;
  const bodyPart = episodes[index]!.bodyPart;
  let chain = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const prior = episodes[i]!;
    if (prior.bodyPart !== bodyPart || prior.status !== 'RECURRED') break;
    chain += 1;
  }
  return chain;
}

/** 경기의 injuredOff 한 번에 대해 심각도→부위→이탈 경기 수 순서로 정확히 3회 roll한다. */
export function onMatchInjury(input: {
  state: CareerState;
  seasonIndex: number;
  step: number;
  match: MatchRecord;
  availability: Availability;
  injuryCount: number;
  ruleset: Ruleset;
  rng: RngState;
  revision?: number;
  allowForcedPending?: boolean;
}): InjuryHookResult {
  const rules = input.ruleset.injuryRules;
  if (input.state.player.profile === null) return identityHook(input);
  let state = input.rng;
  const severityResult = rollSeverity(state, adjustedSeverityWeights(rules, input.state));
  state = severityResult.state;
  const bodyPartResult = rollBodyPart(state, rules);
  state = bodyPartResult.state;
  const range = injuryRange(rules, severityResult.severity);
  const durationResult = rollRange(state, range.min, range.max);
  state = durationResult.state;

  const forced = shouldForce(
    severityResult.severity,
    input.injuryCount,
    rules,
    input.allowForcedPending ?? true,
  );
  const episode: InjuryEpisode = {
    id: nextEpisodeId(input.state, input.seasonIndex, input.step),
    severity: severityResult.severity,
    bodyPart: bodyPartResult.bodyPart.id,
    occurredAt: { seasonIndex: input.seasonIndex, step: input.step, matchId: input.match.id },
    diagnosisRange: { minMatches: range.min, maxMatches: range.max },
    rehab: forced ? null : 'STANDARD',
    recurrenceRiskBp: bodyPartResult.bodyPart.recurrenceBaseBp,
    recurrenceChecksRemaining: 0,
    status: forced ? 'ACTIVE' : 'REHAB',
    permanentDelta: null,
    remainingMatches: durationResult.value,
  };
  const timelineRevision = input.revision ?? 1;
  const priorEpisodes = closeOpenRecurrenceWindows(input.state.health.episodes);
  return {
    health: { episodes: [...priorEpisodes, episode] },
    availability: {
      kind: 'INJURY',
      matchesRemaining: durationResult.value,
      sinceMatchId: input.match.id,
    },
    injuryCount: forced ? input.injuryCount + 1 : input.injuryCount,
    timeline: [timelineEntry(timelineRevision, 'INJURED', episode.id, input.state, input.step)],
    rng: state,
    attributes: input.state.attributes,
    profile: input.state.player.profile,
    forcedPending: forced ? forcedPending(episode, input.step, rules, input.state) : null,
  };
}

/** 부상 이탈 경기 수가 0이 된 직후 에피소드를 회복시키고 재발 검사 창을 연다. */
export function onInjuryRecovered(input: {
  state: CareerState;
  availability: Availability;
  match: MatchRecord;
  ruleset: Ruleset;
  step: number;
  revision?: number;
  rng: RngState;
}): InjuryHookResult {
  if (input.availability === null || input.availability.kind !== 'INJURY') {
    return identityHook({
      state: input.state,
      availability: input.availability,
      injuryCount: input.state.season?.injuryCount ?? 0,
      rng: input.rng,
    });
  }
  const injuryAvailability = input.availability;
  const index = input.state.health.episodes.findIndex(
    (episode) =>
      episode.status === 'REHAB' && episode.occurredAt.matchId === injuryAvailability.sinceMatchId,
  );
  if (index < 0) {
    return identityHook({
      state: input.state,
      availability: null,
      injuryCount: input.state.season?.injuryCount ?? 0,
      rng: input.rng,
    });
  }
  const episode = input.state.health.episodes[index]!;
  // 후유증은 최초 MAJOR 회복에서만 확정한다. 재발 episode는 성공 순간 이미
  // permanentDelta를 기록하므로, 여기서 다시 적용하지 않는다.
  const magnitude = episode.permanentDelta === null && episode.severity === 'MAJOR' ? -1 : 0;
  const sequela =
    episode.permanentDelta === null
      ? applySequela(input.state, episode, input.ruleset, magnitude)
      : { episode, attributes: input.state.attributes, profile: input.state.player.profile };
  const recoveredEpisode = { ...sequela.episode };
  delete recoveredEpisode.remainingMatches;
  const recovered = {
    ...recoveredEpisode,
    status: 'RECOVERED' as const,
    recurrenceChecksRemaining: input.ruleset.injuryRules.recurrenceWindowMatches,
  };
  const timelineRevision = input.revision ?? 1;
  return {
    health: {
      episodes: input.state.health.episodes.map((candidate, i) =>
        i === index ? recovered : candidate,
      ),
    },
    availability: null,
    injuryCount: input.state.season?.injuryCount ?? 0,
    timeline: [timelineEntry(timelineRevision, 'RECOVERED', recovered.id, input.state, input.step)],
    rng: input.rng,
    attributes: sequela.attributes,
    profile: sequela.profile,
    forcedPending: null,
  };
}

/** 재발 검사를 실패로 끝내고 남은 검사 횟수만 감소시킨다(roll은 호출자가 이미 소비했다). */
export function onRecurrenceCheckFailed(
  state: CareerState,
  episodeId: string,
): CareerState['health'] {
  return {
    episodes: state.health.episodes.map((episode) =>
      episode.id === episodeId
        ? {
            ...episode,
            recurrenceChecksRemaining: Math.max(0, episode.recurrenceChecksRemaining - 1),
          }
        : episode,
    ),
  };
}

/** 재발 성공 시 원 에피소드를 RECURRED로 닫고 같은 부위의 한 단계 높은 새 에피소드를 만든다. */
export function onMatchRecurrence(input: {
  state: CareerState;
  seasonIndex: number;
  step: number;
  match: MatchRecord;
  episodeId: string;
  injuryCount: number;
  ruleset: Ruleset;
  rng: RngState;
  revision?: number;
  allowForcedPending?: boolean;
}): InjuryHookResult {
  const rules = input.ruleset.injuryRules;
  const originalIndex = input.state.health.episodes.findIndex(
    (episode) => episode.id === input.episodeId,
  );
  if (originalIndex < 0)
    return identityHook({
      state: input.state,
      availability: null,
      injuryCount: input.injuryCount,
      rng: input.rng,
    });
  const original = input.state.health.episodes[originalIndex]!;
  const severity: InjurySeverity = original.severity === 'MINOR' ? 'MODERATE' : 'MAJOR';
  const bodyPart = rules.bodyParts.find((candidate) => candidate.id === original.bodyPart);
  if (bodyPart === undefined)
    throw new RangeError(`onMatchRecurrence: bodyPart '${original.bodyPart}'가 없다.`);
  const range = injuryRange(rules, severity);
  const durationResult = rollRange(input.rng, range.min, range.max);
  const forced = shouldForce(severity, input.injuryCount, rules, input.allowForcedPending ?? true);
  const episode: InjuryEpisode = {
    id: nextEpisodeId(input.state, input.seasonIndex, input.step),
    severity,
    bodyPart: original.bodyPart,
    occurredAt: { seasonIndex: input.seasonIndex, step: input.step, matchId: input.match.id },
    diagnosisRange: { minMatches: range.min, maxMatches: range.max },
    rehab: forced ? null : 'STANDARD',
    // Conservative rehab remains meaningful after a recurrence instead of being
    // silently reset to the body-part base risk for the next loop.
    recurrenceRiskBp:
      rules.recurrenceMaxChain !== undefined && original.rehab === 'CONSERVATIVE'
        ? original.recurrenceRiskBp
        : bodyPart.recurrenceBaseBp,
    recurrenceChecksRemaining: 0,
    status: forced ? 'ACTIVE' : 'REHAB',
    permanentDelta: null,
    remainingMatches: durationResult.value,
  };
  // 재발 후유증은 새 severity가 확정되는 즉시 적용한다. applySequela는 실제
  // clamp 결과를 permanentDelta에 남기고 같은 입력 상태에서 profile.baseOvr를
  // 다시 계산하므로 attributes/profile 갱신이 하나의 불변 결과로 이동한다.
  const recurrenceMagnitude = severity === 'MAJOR' ? -2 : severity === 'MODERATE' ? -1 : 0;
  const sequela = applySequela(input.state, episode, input.ruleset, recurrenceMagnitude);
  const recurrentEpisode: InjuryEpisode = {
    ...sequela.episode,
    rehab: forced ? null : 'STANDARD',
    status: forced ? ('ACTIVE' as const) : ('REHAB' as const),
  };
  const closedOriginal = { ...original, status: 'RECURRED' as const, recurrenceChecksRemaining: 0 };
  const health = {
    episodes: closeOpenRecurrenceWindows(input.state.health.episodes)
      .map((candidate, i) => (i === originalIndex ? closedOriginal : candidate))
      .concat(recurrentEpisode),
  };
  const timelineRevision = input.revision ?? 1;
  return {
    health,
    availability: {
      kind: 'INJURY',
      matchesRemaining: durationResult.value,
      sinceMatchId: input.match.id,
    },
    injuryCount: forced ? input.injuryCount + 1 : input.injuryCount,
    timeline: [
      timelineEntry(timelineRevision, 'INJURY_RECURRED', episode.id, input.state, input.step),
    ],
    rng: durationResult.state,
    attributes: sequela.attributes,
    profile: sequela.profile,
    forcedPending: forced ? forcedPending(episode, input.step, rules, input.state, true) : null,
  };
}

/** RESOLVE_EVENT가 INJURY pending을 닫을 때 고른 재활 계획을 에피소드에 적용한다. */
export function applyRehabPlan(
  episode: InjuryEpisode,
  plan: RehabPlan,
  injuryRules: InjuryRules,
): InjuryEpisode {
  const rehabRule = injuryRules.rehab[plan];
  const shiftedRange = rehabDurationRange(episode, plan, injuryRules);
  const returnMatches =
    plan === 'EARLY'
      ? shiftedRange.minMatches
      : plan === 'CONSERVATIVE'
        ? shiftedRange.maxMatches
        : Math.floor((shiftedRange.minMatches + shiftedRange.maxMatches) / 2);
  return {
    ...episode,
    status: 'REHAB',
    rehab: plan,
    recurrenceRiskBp: clamp(episode.recurrenceRiskBp + rehabRule.recurrenceAddBp, 0, 10000),
    recurrenceChecksRemaining: 0,
    remainingMatches: returnMatches,
  };
}

/**
 * 재활 계획이 실제 복귀 기간에 적용하는 이동 범위다.
 * diagnosisRange는 발생 당시 severity 규칙의 원본 min/max를 보존해야 하므로,
 * 이 계산 결과를 episode에 저장하지 않고 RESOLVE_EVENT의 availability에만 쓴다.
 */
export function rehabDurationRange(
  episode: InjuryEpisode,
  plan: RehabPlan,
  injuryRules: InjuryRules,
): { minMatches: number; maxMatches: number } {
  const shift = injuryRules.rehab[plan].returnShiftMatches;
  return {
    minMatches: Math.max(1, episode.diagnosisRange.minMatches + shift),
    maxMatches: Math.max(1, episode.diagnosisRange.maxMatches + shift),
  };
}
