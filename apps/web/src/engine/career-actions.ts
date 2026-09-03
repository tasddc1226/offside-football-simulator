// EngineClient 위의 순수 함수(React 없음). 06 "분석 이벤트": 실행마다 command_submitted ·
// command_resolved(outcomeClass = nextAction) · command_failed를 보낸다.
import type { Command, Effect, PlayerDraft, SimulationMode } from '@offside/domain';
import { selectEligibleEvents, type EventDefinition } from '@offside/content';
import type { EngineCommand, ExecuteResult, LoadResult } from '@offside/engine-client';
import { deleteCareerOnServer } from '../api/client.js';
import { platform } from '../platform/index.js';
import type { TrainingFocus } from '../shared/start-season.js';
import type { AppEngine } from './engine.js';
import { classifyDeleteResult, queuePendingDelete } from './pending-delete.js';
import { getSyncClient } from './sync.js';
import { ACTIVE_SERVICE_SEASON_ID } from './versions.js';

type LatencyBucket = '<100ms' | '<500ms' | '<2s' | '>=2s';

function latencyBucket(elapsedMs: number): LatencyBucket {
  if (elapsedMs < 100) return '<100ms';
  if (elapsedMs < 500) return '<500ms';
  if (elapsedMs < 2000) return '<2s';
  return '>=2s';
}

function trackSubmitted(commandType: Command['type']): void {
  platform.analytics.track('command_submitted', { commandType });
}

function trackResult(commandType: Command['type'], startedAt: number, result: ExecuteResult): void {
  if (result.ok) {
    platform.analytics.track('command_resolved', {
      commandType,
      outcomeClass: result.nextAction,
      latencyBucket: latencyBucket(Date.now() - startedAt),
    });
  } else {
    platform.analytics.track('command_failed', { commandType, errorCode: result.error.code });
  }
}

/**
 * ok:true고 replayed:false(=이번에 새로 확정)일 때만 동기화 클라이언트에 통지한다. 동기화
 * 클라이언트를 준비하지 못해도(예: Worker 생성 실패) 로컬 실행 결과에는 영향을 주지 않는다
 * (ADR-002 로컬 우선) — fire-and-forget이라 실패는 콘솔에만 남긴다.
 */
function notifySync(careerId: string, result: ExecuteResult): void {
  if (result.ok && !result.replayed) {
    void getSyncClient()
      .then((sync) => sync.notifyCommitted(careerId, result.domainSnapshot))
      .catch((error: unknown) => {
        console.error('notifySync: 동기화 클라이언트를 준비하지 못했다', error);
      });
  }
}

/** 이미 읽은 revision으로 명령을 만들어 실행하고, submit/resolve/fail 분석 이벤트를 함께 보낸다. */
async function commit(engine: AppEngine, careerId: string, expectedRevision: number, command: Command): Promise<ExecuteResult> {
  const startedAt = Date.now();
  trackSubmitted(command.type);

  const engineCommand: EngineCommand = { ...command, commandId: engine.newId(), expectedRevision };
  const result = await engine.client.execute({ careerId, command: engineCommand });

  trackResult(command.type, startedAt, result);
  notifySync(careerId, result);
  return result;
}

/** 공통 실행기: loadCareer로 최신 revision을 읽어 expectedRevision을 채운 뒤 commit한다. */
export async function execute(engine: AppEngine, careerId: string, command: Command): Promise<ExecuteResult> {
  const load: LoadResult = await engine.client.loadCareer(careerId);
  if (!load.ok) {
    return { ok: false, error: load.error };
  }
  return commit(engine, careerId, load.snapshot.revision, command);
}

export async function createCareer(
  engine: AppEngine,
  options: { simulationMode: SimulationMode },
): Promise<ExecuteResult> {
  const careerId = engine.newId();
  const seedBytes = crypto.getRandomValues(new Uint8Array(8));
  const seed = Array.from(seedBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  const command: Command = {
    type: 'CREATE_CAREER',
    payload: {
      careerId,
      seed,
      simulationMode: options.simulationMode,
      rulesetVersion: engine.versions.rulesetVersion,
      contentPackVersion: engine.versions.contentPackVersion,
    },
  };

  const startedAt = Date.now();
  trackSubmitted(command.type);

  const engineCommand: EngineCommand = { ...command, commandId: engine.newId(), expectedRevision: 0 };
  const result = await engine.client.execute({
    careerId,
    command: engineCommand,
    createdServiceSeasonId: ACTIVE_SERVICE_SEASON_ID,
  });

  trackResult(command.type, startedAt, result);
  notifySync(careerId, result);
  return result;
}

export function updateDraft(engine: AppEngine, careerId: string, draft: Partial<PlayerDraft>): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'UPDATE_PLAYER_DRAFT', payload: { draft } });
}

export function confirmPlayer(engine: AppEngine, careerId: string): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'CONFIRM_PLAYER', payload: {} });
}

/** 최신 상태로 selectEligibleEvents(pack, state)를 계산해 ADVANCE { eligibleEvents }를 보낸다. */
export async function advance(engine: AppEngine, careerId: string): Promise<ExecuteResult> {
  const load: LoadResult = await engine.client.loadCareer(careerId);
  if (!load.ok) {
    return { ok: false, error: load.error };
  }
  const eligibleEvents = selectEligibleEvents(engine.pack, load.snapshot.state);
  return commit(engine, careerId, load.snapshot.revision, { type: 'ADVANCE', payload: { eligibleEvents } });
}

/**
 * 로컬 삭제는 항상 수행한다. 서버 삭제가 재시도 가능한 이유(네트워크·5xx·RATE_LIMITED)로
 * 실패하면 kv sync:pending-delete에 큐잉해 앱 시작·online 때 다시 시도한다.
 * CAREER_NOT_FOUND·CAREER_NOT_OWNED·401은 서버에 이미 없다는 뜻이라 성공으로 본다.
 */
export async function deleteCareer(engine: AppEngine, careerId: string): Promise<void> {
  await engine.client.deleteCareer(careerId);
  const result = await deleteCareerOnServer(careerId);
  if (classifyDeleteResult(result) === 'retry') {
    await queuePendingDelete(engine.store, careerId);
  }
}

type ResolveEventOutcomePayload = {
  id: string;
  weight: number;
  effects: Effect[];
  addTags?: string[];
  removeTags?: string[];
};

/**
 * 팩 outcome(EventDefinition['choices'][number]['outcomes'])을 RESOLVE_EVENT payload의 outcome
 * 형태로 좁힌다. `outcome.effects`는 content `EffectSchema`가 이미 `EFFECT_DEFAULTS`를 채운 완전한
 * domain `Effect` 형태로 파싱하므로(스키마가 `satisfies z.ZodType<Effect>`) 값 변환은 없고,
 * `cause`·`kind`·`title`·`followUps`처럼 명령 payload에 없는 필드만 걷어낸다.
 */
export function toResolveEventOutcomes(
  outcomes: EventDefinition['choices'][number]['outcomes'],
): ResolveEventOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ResolveEventOutcomePayload = {
      id: outcome.id,
      weight: outcome.weight,
      effects: outcome.effects,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

/**
 * `state.pending.kind === 'EVENT'`의 `eventId`로 `engine.pack.eventsById`에서 정의를 찾아
 * RESOLVE_EVENT를 보낸다. pending이 없거나 팩에 정의·선택지가 없으면(딥링크 오용 등) 커밋 없이
 * VALIDATION_FAILED를 돌려준다.
 */
export async function resolveEvent(engine: AppEngine, careerId: string, choiceId: string): Promise<ExecuteResult> {
  const load: LoadResult = await engine.client.loadCareer(careerId);
  if (!load.ok) {
    return { ok: false, error: load.error };
  }

  const pending = load.snapshot.state.pending;
  if (pending === null || pending.kind !== 'EVENT') {
    return { ok: false, error: { code: 'VALIDATION_FAILED', message: 'resolveEvent: 해소할 pending 이벤트가 없다.' } };
  }

  const definition = engine.pack.eventsById.get(pending.eventId);
  if (definition === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: 팩에 이벤트 정의가 없다: ${pending.eventId}` },
    };
  }

  const choice = definition.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: 정의에 없는 choiceId: ${choiceId}` },
    };
  }

  const command: Command = {
    type: 'RESOLVE_EVENT',
    payload: {
      eventId: definition.id,
      definitionVersion: definition.version,
      choiceId,
      outcomes: toResolveEventOutcomes(choice.outcomes),
    },
  };

  return commit(engine, careerId, load.snapshot.revision, command);
}

export function acceptOffer(engine: AppEngine, careerId: string, offerId: string): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'ACCEPT_OFFER', payload: { offerId } });
}

export type StartSeasonChoice = { simulationMode: SimulationMode; trainingFocus?: TrainingFocus };

/**
 * T-2-005 접점(PR #40, origin/main 머지 확인): domain `Command['START_SEASON']['payload']`에
 * `trainingFocus`가 붙었다 — SCR-005의 선택을 그대로 실어 보낸다.
 */
export function toStartSeasonPayload(choice: StartSeasonChoice): Command {
  return {
    type: 'START_SEASON',
    payload: {
      simulationMode: choice.simulationMode,
      serviceSeasonId: ACTIVE_SERVICE_SEASON_ID,
      ...(choice.trainingFocus !== undefined ? { trainingFocus: choice.trainingFocus } : {}),
    },
  };
}

export function startSeason(engine: AppEngine, careerId: string, choice: StartSeasonChoice): Promise<ExecuteResult> {
  return execute(engine, careerId, toStartSeasonPayload(choice));
}

export function resolveRole(engine: AppEngine, careerId: string, decision: 'ACCEPT' | 'DECLINE'): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'RESOLVE_ROLE', payload: { decision } });
}

export function settleSeason(engine: AppEngine, careerId: string): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'SETTLE_SEASON', payload: {} });
}
