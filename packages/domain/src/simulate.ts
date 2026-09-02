import { compareCodePoints, type JsonValue } from './canonical.js';
import { applyEffects, expireEffects } from './effects.js';
import { hashState } from './hash.js';
import { rollInt, seedRng } from './rng.js';
import type { AttributeKey, CareerStage, CareerState, DomainSnapshot, Effect, SimulationMode } from './types.js';

export type Command =
  | {
      type: 'CREATE_CAREER';
      payload: {
        careerId: string;
        seed: string;
        stage: CareerStage;
        age: number;
        attributes: Record<AttributeKey, number>;
        // 브리프의 CREATE_CAREER payload 원안에는 초기 state·context·relationships가 없었다.
        // 오케스트레이터 답변(fixture 필드 불일치 질문)에 따라 이 세 필드를 추가한다.
        state: { form: number; fitness: number; morale: number };
        context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
        relationships: { managerTrust: number; captain: number; rival: number; fans: number; agent: number };
        simulationMode: SimulationMode;
        rulesetVersion: string;
        contentPackVersion: string;
      };
    }
  | {
      type: 'RESOLVE_EVENT';
      payload: {
        eventId: string;
        definitionVersion: number;
        choiceId: string;
        outcomes: Array<{ id: string; weight: number; effects: Effect[]; addTags?: string[]; removeTags?: string[] }>;
      };
    }
  | { type: 'ADVANCE'; payload: Record<string, never> };

export type SimulationInput = {
  snapshot: DomainSnapshot | null;
  command: Command & { commandId: string; expectedRevision: number };
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
    status: 'ACTIVE',
    stage: command.payload.stage,
    age: command.payload.age,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: command.payload.simulationMode,
    attributes: command.payload.attributes,
    state: command.payload.state,
    context: command.payload.context,
    relationships: command.payload.relationships,
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: seedRng(command.payload.seed),
    rulesetVersion: command.payload.rulesetVersion,
    contentPackVersion: command.payload.contentPackVersion,
  };

  return {
    ok: true,
    snapshot: buildSnapshot(state, 1, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

function resolveEvent(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'RESOLVE_EVENT') {
    return fail('VALIDATION_FAILED', 'RESOLVE_EVENT 처리기에 다른 명령이 전달되었다.');
  }

  const state = snapshot.state;
  if (state.resolvedEventIds.includes(command.payload.eventId)) {
    return fail('COMMAND_ALREADY_RESOLVED', `이벤트 ${command.payload.eventId}는 이미 확정되었다.`);
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

  const nextState: CareerState = {
    ...effectResult.state,
    tags,
    resolvedEventIds: [...state.resolvedEventIds, command.payload.eventId],
    rngState: rolled.state,
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'EVENT_RESOLVED'),
    roll: rolled.value,
    outcomeId: chosen.id,
    appliedEffects: effectResult.applied,
    nextAction: 'ADVANCE',
  };
}

function advanceStep(_input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const state = snapshot.state;
  if (state.currentStep === 12) {
    return fail('VALIDATION_FAILED', 'currentStep이 12일 때는 ADVANCE를 처리할 수 없다. 시즌 결산이 필요하다.');
  }

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

/**
 * CREATE_CAREER → RESOLVE_EVENT → ADVANCE 명령을 처리하는 순수 함수.
 * throw하지 않는다: 도메인 오류는 항상 `{ ok: false }`로 돌아온다.
 */
export function simulate(input: SimulationInput): SimulationResult {
  if (input.command.type === 'CREATE_CAREER') {
    return createCareer(input);
  }

  const snapshot = input.snapshot;
  if (snapshot === null) {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER가 아닌 명령은 snapshot이 필요하다.');
  }
  if (input.command.expectedRevision !== snapshot.revision) {
    return fail('CAREER_REVISION_CONFLICT', 'expectedRevision이 snapshot revision과 다르다.', {
      serverRevision: snapshot.revision,
      expectedRevision: input.command.expectedRevision,
    });
  }
  if (input.rulesetVersion !== snapshot.rulesetVersion || input.contentPackVersion !== snapshot.contentPackVersion) {
    return fail('VERSION_MISMATCH', 'SimulationInput의 버전이 snapshot과 다르다.');
  }
  if (snapshot.state.status !== 'ACTIVE') {
    return fail('VALIDATION_FAILED', `status가 ${snapshot.state.status}일 때는 진행 명령을 받을 수 없다.`);
  }

  if (input.command.type === 'RESOLVE_EVENT') {
    return resolveEvent(input, snapshot);
  }
  return advanceStep(input, snapshot);
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

/** stateHash 일치, 버전 일치, 배열 정렬 불변을 검사한다. */
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
  return { ok: true };
}
