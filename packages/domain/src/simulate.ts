import { compareCodePoints, type JsonValue } from './canonical.js';
import { applyEffects, expireEffects } from './effects.js';
import { hashState } from './hash.js';
import { findMatchingOfferBranch, generateOffers } from './offers.js';
import { generatePlayerProfile, type ConfirmedPlayerDraft } from './player.js';
import { rollInt, seedRng } from './rng.js';
import { rollRange } from './roll-range.js';
import type { Ruleset } from './ruleset.js';
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type CareerStage,
  type CareerState,
  type Contract,
  type DomainSnapshot,
  type Effect,
  type PlayerDraft,
  type Position,
  type PreferredFoot,
  type SimulationMode,
} from './types.js';

export type Command =
  | {
      type: 'CREATE_CAREER';
      payload: {
        careerId: string;
        seed: string;
        simulationMode: SimulationMode;
        rulesetVersion: string;
        contentPackVersion: string;
      };
    }
  | { type: 'UPDATE_PLAYER_DRAFT'; payload: { draft: Partial<PlayerDraft> } }
  | { type: 'CONFIRM_PLAYER'; payload: Record<string, never> }
  | { type: 'ADVANCE'; payload: { eligibleEvents: Array<{ eventId: string; version: number; weight: number }> } }
  | {
      type: 'RESOLVE_EVENT';
      payload: {
        eventId: string;
        definitionVersion: number;
        choiceId: string;
        outcomes: Array<{ id: string; weight: number; effects: Effect[]; addTags?: string[]; removeTags?: string[] }>;
      };
    }
  | { type: 'ACCEPT_OFFER'; payload: { offerId: string } };

export type SimulationInput = {
  snapshot: DomainSnapshot | null;
  command: Command & { commandId: string; expectedRevision: number };
  ruleset: Ruleset;
  rulesetVersion: string;
  contentPackVersion: string;
};

export type SimulationResult =
  | {
      ok: true;
      snapshot: DomainSnapshot;
      roll?: number;
      outcomeId?: string;
      appliedEffects: Effect[];
      nextAction: 'DECISION' | 'ADVANCE' | 'SETTLEMENT';
    }
  | {
      ok: false;
      error: {
        code: 'VALIDATION_FAILED' | 'CAREER_REVISION_CONFLICT' | 'COMMAND_ALREADY_RESOLVED' | 'VERSION_MISMATCH';
        message: string;
        details?: JsonValue;
      };
    };

function fail(
  code: 'VALIDATION_FAILED' | 'CAREER_REVISION_CONFLICT' | 'COMMAND_ALREADY_RESOLVED' | 'VERSION_MISMATCH',
  message: string,
  details?: JsonValue,
): SimulationResult {
  return details === undefined ? { ok: false, error: { code, message } } : { ok: false, error: { code, message, details } };
}

function sortUniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags)).sort(compareCodePoints);
}

function buildSnapshot(
  state: CareerState,
  revision: number,
  checkpoint: DomainSnapshot['checkpoint'],
): DomainSnapshot {
  return {
    revision,
    checkpoint,
    state,
    stateHash: hashState(state),
    rulesetVersion: state.rulesetVersion,
    contentPackVersion: state.contentPackVersion,
  };
}

function zeroAttributes(): Record<AttributeKey, number> {
  const attributes = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = 0;
  }
  return attributes;
}

function emptyDraft(): PlayerDraft {
  return {
    name: null,
    nationalityCode: null,
    preferredFoot: null,
    position: null,
    archetypeId: null,
    backgroundId: null,
  };
}

function createCareer(input: SimulationInput): SimulationResult {
  const command = input.command;
  if (command.type !== 'CREATE_CAREER') {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER 처리기에 다른 명령이 전달되었다.');
  }
  if (input.snapshot !== null) {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER는 기존 snapshot이 없을 때만 유효하다.');
  }
  if (command.expectedRevision !== 0) {
    return fail('CAREER_REVISION_CONFLICT', '새 Career의 expectedRevision은 0이어야 한다.', {
      serverRevision: 0,
      expectedRevision: command.expectedRevision,
    });
  }
  if (
    command.payload.rulesetVersion !== input.rulesetVersion ||
    command.payload.contentPackVersion !== input.contentPackVersion
  ) {
    return fail('VERSION_MISMATCH', '명령의 버전이 SimulationInput의 버전과 다르다.');
  }

  const state: CareerState = {
    schemaVersion: 1,
    careerId: command.payload.careerId,
    status: 'DRAFT',
    stage: 'YOUTH',
    age: 17,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: command.payload.simulationMode,
    attributes: zeroAttributes(),
    state: { form: 0, fitness: 0, morale: 0 },
    context: { tacticalFit: 0, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 0, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: seedRng(command.payload.seed),
    rulesetVersion: command.payload.rulesetVersion,
    contentPackVersion: command.payload.contentPackVersion,
    player: { draft: emptyDraft(), profile: null },
    pending: null,
    contract: null,
    timeline: [],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(state, 1, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'DECISION',
  };
}

const POSITIONS: readonly Position[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
const PREFERRED_FEET: readonly PreferredFoot[] = ['LEFT', 'RIGHT', 'BOTH'];

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function has<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function updatePlayerDraft(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'UPDATE_PLAYER_DRAFT') {
    return fail('VALIDATION_FAILED', 'UPDATE_PLAYER_DRAFT 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'DRAFT') {
    return fail('VALIDATION_FAILED', 'DRAFT 상태에서만 UPDATE_PLAYER_DRAFT를 받을 수 있다.', { reason: 'NOT_DRAFT' });
  }

  const patch = command.payload.draft;
  const merged: PlayerDraft = { ...state.player.draft };
  const ruleset = input.ruleset;

  if (has(patch, 'name')) {
    const raw = patch.name as string | null;
    if (raw === null) {
      merged.name = null;
    } else {
      const trimmed = raw.trim();
      const { nameMin, nameMax } = ruleset.draftRules;
      if (trimmed.length < nameMin || trimmed.length > nameMax) {
        return fail('VALIDATION_FAILED', `이름은 ${nameMin}~${nameMax}자여야 한다.`, {
          field: 'name',
          reason: 'LENGTH',
        });
      }
      if (hasControlChars(raw)) {
        return fail('VALIDATION_FAILED', '이름에 제어문자·줄바꿈을 쓸 수 없다.', {
          field: 'name',
          reason: 'CONTROL_CHARS',
        });
      }
      merged.name = trimmed;
    }
  }

  if (has(patch, 'nationalityCode')) {
    const raw = patch.nationalityCode as string | null;
    if (raw !== null && !ruleset.nationalities.some((nationality) => nationality.code === raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 국적 코드: ${raw}`, { field: 'nationalityCode', reason: 'UNKNOWN' });
    }
    merged.nationalityCode = raw;
  }

  if (has(patch, 'preferredFoot')) {
    const raw = patch.preferredFoot as PreferredFoot | null;
    if (raw !== null && !PREFERRED_FEET.includes(raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 주발: ${raw}`, { field: 'preferredFoot', reason: 'UNKNOWN' });
    }
    merged.preferredFoot = raw;
  }

  if (has(patch, 'position')) {
    const raw = patch.position as Position | null;
    if (raw !== null && !POSITIONS.includes(raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 포지션: ${raw}`, { field: 'position', reason: 'UNKNOWN' });
    }
    merged.position = raw;
  }

  if (has(patch, 'archetypeId')) {
    const raw = patch.archetypeId as string | null;
    if (raw !== null && !ruleset.archetypes.some((archetype) => archetype.id === raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 아키타입: ${raw}`, { field: 'archetypeId', reason: 'UNKNOWN' });
    }
    merged.archetypeId = raw;
  }

  if (has(patch, 'backgroundId')) {
    const raw = patch.backgroundId as string | null;
    if (raw !== null && !ruleset.backgrounds.some((background) => background.id === raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 배경: ${raw}`, { field: 'backgroundId', reason: 'UNKNOWN' });
    }
    merged.backgroundId = raw;
  }

  if (merged.position !== null && merged.archetypeId !== null) {
    const archetype = ruleset.archetypes.find((candidate) => candidate.id === merged.archetypeId);
    if (archetype !== undefined && archetype.position !== merged.position) {
      return fail('VALIDATION_FAILED', '아키타입과 포지션이 일치하지 않는다.', {
        field: 'archetypeId',
        reason: 'ARCHETYPE_POSITION_MISMATCH',
      });
    }
  }

  const nextState: CareerState = { ...state, player: { ...state.player, draft: merged } };
  return {
    ok: true,
    snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'DECISION',
  };
}

const DRAFT_FIELDS: Array<keyof PlayerDraft> = [
  'name',
  'nationalityCode',
  'preferredFoot',
  'position',
  'archetypeId',
  'backgroundId',
];

function confirmPlayer(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'CONFIRM_PLAYER') {
    return fail('VALIDATION_FAILED', 'CONFIRM_PLAYER 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'DRAFT') {
    return fail('VALIDATION_FAILED', 'DRAFT 상태에서만 CONFIRM_PLAYER를 받을 수 있다.', { reason: 'NOT_DRAFT' });
  }

  const draft = state.player.draft;
  const missing = DRAFT_FIELDS.filter((field) => draft[field] === null);
  if (missing.length > 0) {
    return fail('VALIDATION_FAILED', '선수 초안이 완성되지 않았다.', { missing });
  }

  const confirmedDraft: ConfirmedPlayerDraft = {
    name: draft.name as string,
    nationalityCode: draft.nationalityCode as string,
    preferredFoot: draft.preferredFoot as PreferredFoot,
    position: draft.position as Position,
    archetypeId: draft.archetypeId as string,
    backgroundId: draft.backgroundId as string,
  };

  const generated = generatePlayerProfile(confirmedDraft, input.ruleset, state.rngState);
  const nextRevision = snapshot.revision + 1;
  const nextStep = 12;

  const nextState: CareerState = {
    ...state,
    status: 'ACTIVE',
    currentStep: nextStep,
    seasonPhase: 'SETTLEMENT',
    attributes: generated.attributes,
    state: generated.state,
    context: generated.context,
    relationships: generated.relationships,
    rngState: generated.rngState,
    player: { draft: state.player.draft, profile: generated.profile },
    timeline: [
      ...state.timeline,
      { revision: nextRevision, kind: 'CAREER_CONFIRMED', refId: null, age: state.age, step: nextStep },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

function isEligibleEventsSorted(events: ReadonlyArray<{ eventId: string }>): boolean {
  for (let i = 1; i < events.length; i++) {
    if (compareCodePoints(events[i - 1]!.eventId, events[i]!.eventId) > 0) return false;
  }
  return true;
}

function advance(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'ADVANCE') {
    return fail('VALIDATION_FAILED', 'ADVANCE 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail('VALIDATION_FAILED', `status가 ${state.status}일 때는 ADVANCE를 받을 수 없다.`, {
      reason: 'NOT_ACTIVE',
    });
  }
  if (state.pending !== null) {
    return fail('VALIDATION_FAILED', '이미 결정 대기 중인 pending이 있다.', { reason: 'PENDING_DECISION' });
  }

  const eligibleEvents = command.payload.eligibleEvents;

  if (eligibleEvents.length > 0) {
    if (!isEligibleEventsSorted(eligibleEvents)) {
      return fail('VALIDATION_FAILED', 'eligibleEvents는 eventId 오름차순이어야 한다.', {
        reason: 'UNSORTED_ELIGIBLE_EVENTS',
      });
    }
    for (const event of eligibleEvents) {
      if (!Number.isInteger(event.weight) || event.weight <= 0) {
        return fail('VALIDATION_FAILED', 'eligibleEvents의 weight는 양의 정수여야 한다.', {
          reason: 'INVALID_WEIGHT',
        });
      }
    }

    let chosen = eligibleEvents[0]!;
    let nextRngState = state.rngState;
    if (eligibleEvents.length >= 2) {
      const weightSum = eligibleEvents.reduce((sum, event) => sum + event.weight, 0);
      if (weightSum > 0xffffffff) {
        return fail('VALIDATION_FAILED', 'eligibleEvents weight 합이 2^32를 넘는다.', { reason: 'INVALID_WEIGHT' });
      }
      const rolled = rollRange(state.rngState, 1, weightSum);
      nextRngState = rolled.state;
      let cumulative = 0;
      for (const event of eligibleEvents) {
        cumulative += event.weight;
        if (rolled.value <= cumulative) {
          chosen = event;
          break;
        }
      }
    }

    const nextState: CareerState = {
      ...state,
      rngState: nextRngState,
      pending: { kind: 'EVENT', eventId: chosen.eventId, version: chosen.version },
    };
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'EVENT_OFFERED'),
      appliedEffects: [],
      nextAction: 'DECISION',
    };
  }

  if (state.contract === null) {
    const branch = findMatchingOfferBranch(input.ruleset.offerRules, state.tags);
    if (branch !== null) {
      if (state.player.profile === null) {
        throw new RangeError('advance: ACTIVE 상태인데 player.profile이 null이다.');
      }
      const nextRevision = snapshot.revision + 1;
      const generated = generateOffers(
        input.ruleset,
        branch,
        state.tags,
        state.player.profile.baseOvr,
        nextRevision,
        state.rngState,
      );
      const nextState: CareerState = {
        ...state,
        rngState: generated.rngState,
        pending: { kind: 'OFFERS', offers: generated.offers },
      };
      return {
        ok: true,
        snapshot: buildSnapshot(nextState, nextRevision, 'CHAPTER_DECISION'),
        appliedEffects: [],
        nextAction: 'DECISION',
      };
    }
  }

  if (state.seasonPhase !== 'SETTLEMENT') {
    const nextStep = state.currentStep + 1;
    const expired = expireEffects(state, nextStep);
    const nextState: CareerState = { ...expired, currentStep: nextStep };
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'STEP_BOUNDARY'),
      appliedEffects: [],
      nextAction: nextStep === 12 ? 'SETTLEMENT' : 'DECISION',
    };
  }

  return fail('VALIDATION_FAILED', '더 진행할 결정이 없다.', { reason: 'NOTHING_TO_ADVANCE' });
}

function resolveEvent(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'RESOLVE_EVENT') {
    return fail('VALIDATION_FAILED', 'RESOLVE_EVENT 처리기에 다른 명령이 전달되었다.');
  }

  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail('VALIDATION_FAILED', `status가 ${state.status}일 때는 RESOLVE_EVENT를 받을 수 없다.`, {
      reason: 'NOT_ACTIVE',
    });
  }

  const pending = state.pending;
  if (pending === null || pending.kind !== 'EVENT') {
    return fail('VALIDATION_FAILED', '해소할 pending 이벤트가 없다.', { reason: 'NO_PENDING_EVENT' });
  }
  if (pending.eventId !== command.payload.eventId || pending.version !== command.payload.definitionVersion) {
    return fail('VALIDATION_FAILED', 'pending 이벤트와 요청이 다르다.', { reason: 'PENDING_EVENT_MISMATCH' });
  }

  const outcomes = command.payload.outcomes;
  const weightSum = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  // rollInt는 maxExclusive가 1 이상의 정수가 아니면 throw한다(프로그래밍 오류 가정). 여기서
  // 미리 검증해 simulate()가 throw하지 않는다는 규칙을 content 데이터 오류로도 어기지 않게 한다.
  if (!Number.isInteger(weightSum) || weightSum <= 0 || weightSum > 0xffffffff) {
    return fail('VALIDATION_FAILED', 'outcome 가중치 합은 1 이상 2^32 이하의 정수여야 한다.');
  }

  const rolled = rollInt(state.rngState, weightSum);
  let cumulative = 0;
  let chosen = outcomes[0];
  for (const outcome of outcomes) {
    cumulative += outcome.weight;
    if (rolled.value < cumulative) {
      chosen = outcome;
      break;
    }
  }
  if (chosen === undefined) {
    return fail('VALIDATION_FAILED', 'outcomes가 비어 있다.');
  }

  const effectResult = applyEffects(state, chosen.effects, { step: state.currentStep });

  let tags = effectResult.state.tags;
  if (chosen.addTags && chosen.addTags.length > 0) {
    tags = [...tags, ...chosen.addTags];
  }
  if (chosen.removeTags && chosen.removeTags.length > 0) {
    const removeSet = new Set(chosen.removeTags);
    tags = tags.filter((tag) => !removeSet.has(tag));
  }
  tags = sortUniqueTags(tags);

  const nextRevision = snapshot.revision + 1;
  const nextState: CareerState = {
    ...effectResult.state,
    tags,
    resolvedEventIds: [...state.resolvedEventIds, command.payload.eventId],
    rngState: rolled.state,
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'EVENT_RESOLVED',
        refId: `${command.payload.eventId}:${command.payload.choiceId}:${chosen.id}`,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'EVENT_RESOLVED'),
    roll: rolled.value,
    outcomeId: chosen.id,
    appliedEffects: effectResult.applied,
    nextAction: 'ADVANCE',
  };
}

function acceptOffer(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'ACCEPT_OFFER') {
    return fail('VALIDATION_FAILED', 'ACCEPT_OFFER 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail('VALIDATION_FAILED', `status가 ${state.status}일 때는 ACCEPT_OFFER를 받을 수 없다.`, {
      reason: 'NOT_ACTIVE',
    });
  }

  const pending = state.pending;
  if (pending === null || pending.kind !== 'OFFERS') {
    return fail('VALIDATION_FAILED', '결정 대기 중인 제안이 없다.', { reason: 'NO_PENDING_OFFERS' });
  }
  const offer = pending.offers.find((candidate) => candidate.id === command.payload.offerId);
  if (offer === undefined) {
    return fail('VALIDATION_FAILED', '제안 목록에 없는 offerId다.', { reason: 'OFFER_NOT_FOUND' });
  }
  if (state.player.profile === null) {
    throw new RangeError('acceptOffer: ACTIVE 상태인데 player.profile이 null이다.');
  }
  const backgroundId = state.player.profile.backgroundId;

  const ruleset = input.ruleset;
  const background = ruleset.backgrounds.find((candidate) => candidate.id === backgroundId);
  if (background === undefined) {
    throw new RangeError(`acceptOffer: 룰셋에 backgroundId '${backgroundId}'가 없다.`);
  }

  const nextRevision = snapshot.revision + 1;
  const stage: CareerStage = offer.leagueTier === 'YOUTH' ? 'YOUTH' : 'PRO';
  const isNewClub = offer.teamId !== background.startTeamId;

  const contract: Contract = {
    id: `CTR-${nextRevision}`,
    offerId: offer.id,
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    lengthSeasons: offer.lengthSeasons,
    wageMinorPerWeek: offer.wageMinorPerWeek,
    signingBonusMinor: offer.signingBonusMinor,
    rolePromise: offer.rolePromise,
    shirtNumber: offer.shirtNumber,
    signatureType: 'AUTO',
    signedAtRevision: nextRevision,
  };

  const nextState: CareerState = {
    ...state,
    stage,
    contract,
    pending: null,
    context: {
      ...state.context,
      squadStatus: ruleset.contractRules.squadStatusByRole[offer.rolePromise],
      tacticalFit: offer.tacticalFitEstimate,
    },
    relationships: isNewClub
      ? { ...state.relationships, managerTrust: ruleset.contractRules.newClubManagerTrust }
      : state.relationships,
    timeline: [
      ...state.timeline,
      { revision: nextRevision, kind: 'CONTRACT_SIGNED', refId: contract.id, age: state.age, step: state.currentStep },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'SETTLEMENT',
  };
}

/**
 * CREATE_CAREER → UPDATE_PLAYER_DRAFT → CONFIRM_PLAYER → ADVANCE → RESOLVE_EVENT → ACCEPT_OFFER
 * 명령을 처리하는 순수 함수. throw하지 않는다: 도메인 오류는 항상 `{ ok: false }`로 돌아온다.
 */
export function simulate(input: SimulationInput): SimulationResult {
  if (input.ruleset.version !== input.rulesetVersion) {
    return fail('VERSION_MISMATCH', '룰셋 버전이 SimulationInput.rulesetVersion과 다르다.');
  }

  const command = input.command;
  if (command.type === 'CREATE_CAREER') {
    return createCareer(input);
  }

  const snapshot = input.snapshot;
  if (snapshot === null) {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER가 아닌 명령은 snapshot이 필요하다.');
  }
  if (command.expectedRevision !== snapshot.revision) {
    return fail('CAREER_REVISION_CONFLICT', 'expectedRevision이 snapshot revision과 다르다.', {
      serverRevision: snapshot.revision,
      expectedRevision: command.expectedRevision,
    });
  }
  if (input.rulesetVersion !== snapshot.rulesetVersion || input.contentPackVersion !== snapshot.contentPackVersion) {
    return fail('VERSION_MISMATCH', 'SimulationInput의 버전이 snapshot과 다르다.');
  }

  switch (command.type) {
    case 'UPDATE_PLAYER_DRAFT':
      return updatePlayerDraft(input, snapshot);
    case 'CONFIRM_PLAYER':
      return confirmPlayer(input, snapshot);
    case 'ADVANCE':
      return advance(input, snapshot);
    case 'RESOLVE_EVENT':
      return resolveEvent(input, snapshot);
    case 'ACCEPT_OFFER':
      return acceptOffer(input, snapshot);
  }
}

function isSorted(values: readonly string[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (compareCodePoints(values[i - 1] as string, values[i] as string) > 0) return false;
  }
  return true;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * stateHash 일치, 버전 일치, 배열 정렬 불변, 타임라인 revision 단조 증가, pending·status 정합,
 * contract·pending(OFFERS) 정합을 검사한다. 계약 중에도 pending이 EVENT인 것은 유효하다
 * (Phase 2부터 시즌 중 이벤트가 계약된 선수에게도 걸린다). 계약 중에 새 제안(OFFERS)이 pending인
 * 것만 정합성 위반이다.
 */
export function verifySnapshot(snapshot: DomainSnapshot): { ok: true } | { ok: false; reason: string } {
  if (hashState(snapshot.state) !== snapshot.stateHash) {
    return { ok: false, reason: 'STATE_HASH_MISMATCH' };
  }
  if (
    snapshot.rulesetVersion !== snapshot.state.rulesetVersion ||
    snapshot.contentPackVersion !== snapshot.state.contentPackVersion
  ) {
    return { ok: false, reason: 'VERSION_MISMATCH' };
  }
  if (!isSorted(snapshot.state.tags) || hasDuplicates(snapshot.state.tags)) {
    return { ok: false, reason: 'TAGS_NOT_SORTED_OR_DUPLICATED' };
  }
  if (!isSorted(snapshot.state.appliedSourceIds)) {
    return { ok: false, reason: 'APPLIED_SOURCE_IDS_NOT_SORTED' };
  }

  const timeline = snapshot.state.timeline;
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i]!.revision <= timeline[i - 1]!.revision) {
      return { ok: false, reason: 'TIMELINE_NOT_MONOTONIC' };
    }
  }

  if (snapshot.state.status !== 'ACTIVE' && snapshot.state.pending !== null) {
    return { ok: false, reason: 'PENDING_STATUS_MISMATCH' };
  }
  if (snapshot.state.contract !== null && snapshot.state.pending?.kind === 'OFFERS') {
    return { ok: false, reason: 'CONTRACT_OFFERS_CONFLICT' };
  }

  return { ok: true };
}
