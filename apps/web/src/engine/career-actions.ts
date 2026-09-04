// EngineClient 위의 순수 함수(React 없음). 06 "분석 이벤트": 실행마다 command_submitted ·
// command_resolved(outcomeClass = nextAction) · command_failed를 보낸다.
import type { ChapterOutcomeKind, Command, Effect, PlayerDraft, SimulationMode } from '@offside/domain';
import { selectChapterCandidates, selectEligibleEvents, type ChapterDefinition, type EventDefinition } from '@offside/content';
import type { EngineCommand, ExecuteResult, LoadResult } from '@offside/engine-client';
import { deleteCareerOnServer } from '../api/client.js';
import { platform } from '../platform/index.js';
import type { TrainingFocus } from '../shared/start-season.js';
import type { AppEngine } from './engine.js';
import { startCareerFunnel } from './funnel.js';
import { classifyDeleteResult, queuePendingDelete } from './pending-delete.js';
import { resolveServiceSeasonId } from './service-season.js';
import { getSyncClient } from './sync.js';

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

/** e2e 결정론 훅(T-2-008): DEV 서버에서만 `localStorage['offside:e2e-seed']`가 있으면 그 값을
 * seed로 쓴다. `import.meta.env.DEV`는 프로덕션 빌드에서 상수 false로 치환돼 이 분기가 죽은
 * 코드로 제거된다(같은 관례: apps/web/src/main.tsx의 `/__dev/hash-probe` 분기) — 프로덕션
 * 번들·경로는 바뀌지 않는다. */
const E2E_SEED_STORAGE_KEY = 'offside:e2e-seed';

function newCareerSeed(): string {
  if (import.meta.env.DEV && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    const override = localStorage.getItem(E2E_SEED_STORAGE_KEY);
    if (override !== null) return override;
  }
  const seedBytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(seedBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createCareer(
  engine: AppEngine,
  options: { simulationMode: SimulationMode },
): Promise<ExecuteResult> {
  const careerId = engine.newId();
  const seed = newCareerSeed();

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

  const serviceSeasonId = await resolveServiceSeasonId();

  const startedAt = Date.now();
  trackSubmitted(command.type);

  const engineCommand: EngineCommand = { ...command, commandId: engine.newId(), expectedRevision: 0 };
  const result = await engine.client.execute({
    careerId,
    command: engineCommand,
    createdServiceSeasonId: serviceSeasonId,
  });

  trackResult(command.type, startedAt, result);
  notifySync(careerId, result);
  if (result.ok && !result.replayed) {
    await startCareerFunnel(engine, careerId);
  }
  return result;
}

export function updateDraft(engine: AppEngine, careerId: string, draft: Partial<PlayerDraft>): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'UPDATE_PLAYER_DRAFT', payload: { draft } });
}

export function confirmPlayer(engine: AppEngine, careerId: string): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'CONFIRM_PLAYER', payload: {} });
}

/**
 * 최신 상태로 selectEligibleEvents(pack, state)·selectChapterCandidates(pack, state)를 계산해
 * ADVANCE { eligibleEvents, chapterCandidates }를 보낸다(T-2-008 D-38: chapterCandidates가 비면
 * 챕터는 열리지 않는다).
 */
export async function advance(engine: AppEngine, careerId: string): Promise<ExecuteResult> {
  const load: LoadResult = await engine.client.loadCareer(careerId);
  if (!load.ok) {
    return { ok: false, error: load.error };
  }
  const eligibleEvents = selectEligibleEvents(engine.pack, load.snapshot.state);
  const chapterCandidates = selectChapterCandidates(engine.pack, load.snapshot.state);
  return commit(engine, careerId, load.snapshot.revision, {
    type: 'ADVANCE',
    payload: { eligibleEvents, chapterCandidates },
  });
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
 * `state.pending.kind === 'EVENT' | 'INJURY'`의 `eventId`로 `engine.pack.eventsById`에서 정의를
 * 찾아 RESOLVE_EVENT를 보낸다. INJURY는 presentation이 INJURY인 정의와 choice의 rehabPlan을
 * 함께 요구한다(전용 SCR-022가 생기기 전까지 SCR-013의 최소 호환 경로). pending이 없거나 팩에
 * 정의·선택지가 없으면(딥링크 오용 등) 커밋 없이 VALIDATION_FAILED를 돌려준다.
 */
export async function resolveEvent(engine: AppEngine, careerId: string, choiceId: string): Promise<ExecuteResult> {
  const load: LoadResult = await engine.client.loadCareer(careerId);
  if (!load.ok) {
    return { ok: false, error: load.error };
  }

  const pending = load.snapshot.state.pending;
  if (pending === null || (pending.kind !== 'EVENT' && pending.kind !== 'INJURY')) {
    return { ok: false, error: { code: 'VALIDATION_FAILED', message: 'resolveEvent: 해소할 pending 이벤트가 없다.' } };
  }

  const definition = engine.pack.eventsById.get(pending.eventId);
  if (definition === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: 팩에 이벤트 정의가 없다: ${pending.eventId}` },
    };
  }

  if (pending.kind === 'INJURY' && definition.presentation !== 'INJURY') {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: INJURY pending에 맞는 이벤트 정의가 아니다: ${pending.eventId}` },
    };
  }
  if (pending.kind === 'EVENT' && definition.presentation === 'INJURY') {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: INJURY 이벤트는 INJURY pending에서만 해소할 수 있다: ${pending.eventId}` },
    };
  }

  const choice = definition.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: 정의에 없는 choiceId: ${choiceId}` },
    };
  }

  const rehabPlan = pending.kind === 'INJURY' ? choice.rehabPlan : undefined;
  if (pending.kind === 'INJURY' && rehabPlan === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveEvent: 재활 계획이 없는 INJURY choice다: ${choiceId}` },
    };
  }

  const command: Command = {
    type: 'RESOLVE_EVENT',
    payload: {
      eventId: definition.id,
      definitionVersion: definition.version,
      choiceId,
      outcomes: toResolveEventOutcomes(choice.outcomes),
      ...(rehabPlan === undefined ? {} : { rehabPlan }),
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
 * `trainingFocus`가 붙었다 — SCR-005의 선택을 그대로 실어 보낸다. `serviceSeasonId`는 호출하는 쪽이
 * `resolveServiceSeasonId()`(T-2-012 D-54)로 구해 넘긴다 — 이 함수는 순수 함수로 남긴다.
 */
export function toStartSeasonPayload(choice: StartSeasonChoice, serviceSeasonId: string): Command {
  return {
    type: 'START_SEASON',
    payload: {
      simulationMode: choice.simulationMode,
      serviceSeasonId,
      ...(choice.trainingFocus !== undefined ? { trainingFocus: choice.trainingFocus } : {}),
    },
  };
}

export async function startSeason(engine: AppEngine, careerId: string, choice: StartSeasonChoice): Promise<ExecuteResult> {
  const serviceSeasonId = await resolveServiceSeasonId();
  return execute(engine, careerId, toStartSeasonPayload(choice, serviceSeasonId));
}

export function resolveRole(engine: AppEngine, careerId: string, decision: 'ACCEPT' | 'DECLINE'): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'RESOLVE_ROLE', payload: { decision } });
}

export function settleSeason(engine: AppEngine, careerId: string): Promise<ExecuteResult> {
  return execute(engine, careerId, { type: 'SETTLE_SEASON', payload: {} });
}

type ResolveChapterOutcomePayload = {
  id: string;
  kind: ChapterOutcomeKind;
  weight: number;
  effects: Effect[];
  ratingDeltaTenths: number;
  addTags?: string[];
  removeTags?: string[];
};

/**
 * 팩 outcome(ChapterDefinition['decisions'][number]['options'][number]['outcomes'])을
 * RESOLVE_CHAPTER payload의 outcome 형태로 좁힌다(toResolveEventOutcomes와 같은 관례).
 * T-2-014 D-42: `kind`가 필수다(ChapterRecord.decisions[].outcomeKind로 그대로 저장된다).
 */
export function toResolveChapterOutcomes(
  outcomes: ChapterDefinition['decisions'][number]['options'][number]['outcomes'],
): ResolveChapterOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ResolveChapterOutcomePayload = {
      id: outcome.id,
      kind: outcome.kind,
      weight: outcome.weight,
      effects: outcome.effects,
      ratingDeltaTenths: outcome.ratingDeltaTenths,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

/**
 * `state.pending.kind === 'CHAPTER'`의 `chapterId`로 `engine.pack.chaptersById`에서 정의를 찾아
 * RESOLVE_CHAPTER를 보낸다. pending이 없거나 팩에 정의·판단·옵션이 없으면(딥링크 오용 등) 커밋
 * 없이 VALIDATION_FAILED를 돌려준다.
 */
export async function resolveChapter(
  engine: AppEngine,
  careerId: string,
  decisionId: string,
  optionId: string,
): Promise<ExecuteResult> {
  const load: LoadResult = await engine.client.loadCareer(careerId);
  if (!load.ok) {
    return { ok: false, error: load.error };
  }

  const pending = load.snapshot.state.pending;
  if (pending === null || pending.kind !== 'CHAPTER') {
    return { ok: false, error: { code: 'VALIDATION_FAILED', message: 'resolveChapter: 해소할 pending 챕터가 없다.' } };
  }

  const definition = engine.pack.chaptersById.get(pending.chapterId);
  if (definition === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveChapter: 팩에 챕터 정의가 없다: ${pending.chapterId}` },
    };
  }

  const decision = definition.decisions.find((candidate) => candidate.id === decisionId);
  if (decision === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveChapter: 정의에 없는 decisionId: ${decisionId}` },
    };
  }

  const option = decision.options.find((candidate) => candidate.id === optionId);
  if (option === undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: `resolveChapter: 정의에 없는 optionId: ${optionId}` },
    };
  }

  const command: Command = {
    type: 'RESOLVE_CHAPTER',
    payload: {
      chapterId: definition.id,
      definitionVersion: definition.version,
      decisionId,
      optionId,
      outcomes: toResolveChapterOutcomes(option.outcomes),
    },
  };

  return commit(engine, careerId, load.snapshot.revision, command);
}
