// D-77 K리그식 리그·팀 구조 개편: 룰셋 1.5.0(K1 12·K2 14·K3 16·R리그) + 팩 0.6.0으로 커리어를
// 만들어 실제 엔진 경로(career-actions.ts, phase4-seed-reachability.test.ts의 stepOnceTowards와
// 같은 관례로 모든 pending 종류를 첫 선택지로 닫는 범용 드라이버 재사용)로 시즌 1개를 오류 없이
// 끝까지 재생할 수 있는지, 그리고 같은 seed로 두 번 재생해도 stateHash가 같은지(결정론)를 검증한다.
import { describe, expect, it } from 'vitest';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator, type EngineCommand } from '@offside/engine-client';
import {
  acceptOffer,
  advance,
  confirmPlayer,
  execute,
  resolveChapter,
  resolveEvent,
  resolveRole,
  settleSeason,
  updateDraft,
} from './career-actions.js';
import { createAppEngine, type AppEngine } from './engine.js';
import { FALLBACK_SERVICE_SEASON_ID } from './versions.js';

const RULESET_VERSION = '1.5.0';
const PACK_VERSION = '0.6.0';
const SEED = 'offside-t-kleague-structure-smoke-01';
const DRAFT_STEP_1 = { name: '김서준', gender: 'MALE' as const, nationalityCode: 'KR', preferredFoot: 'LEFT' as const };
const DRAFT_STEP_2 = { position: 'W' as const, archetypeId: 'inside-forward', backgroundId: 'club-academy' };

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

async function makeEngine(idPrefix: string): Promise<AppEngine> {
  return createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: loadRuleset(RULESET_VERSION),
    pack: loadContentPack(PACK_VERSION),
    newId: makeIdGenerator(idPrefix),
  });
}

async function createCareerWithSeed(engine: AppEngine, careerId: string): Promise<void> {
  const command: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: engine.newId(),
    expectedRevision: 0,
    payload: {
      careerId,
      seed: SEED,
      simulationMode: 'CHAPTER',
      rulesetVersion: engine.versions.rulesetVersion,
      contentPackVersion: engine.versions.contentPackVersion,
    },
  };
  const created = await engine.client.execute({ careerId, command, createdServiceSeasonId: FALLBACK_SERVICE_SEASON_ID });
  if (!created.ok) throw new Error(`CREATE_CAREER 실패: ${created.error.code} ${created.error.message}`);
}

/** CONFIRM_PLAYER부터 첫 계약(OFFERS 수락)까지. 모든 EVENT는 정의의 첫 선택지로 닫는다. */
async function onboardToContract(engine: AppEngine, careerId: string): Promise<void> {
  await updateDraft(engine, careerId, DRAFT_STEP_1);
  await updateDraft(engine, careerId, DRAFT_STEP_2);
  const confirmed = await confirmPlayer(engine, careerId);
  if (!confirmed.ok) throw new Error(`CONFIRM_PLAYER 실패: ${confirmed.error.code} ${confirmed.error.message}`);

  for (let guard = 0; guard < 10; guard += 1) {
    const load = await engine.client.loadCareer(careerId);
    if (!load.ok) throw new Error(`loadCareer 실패: ${load.error.code}`);
    const pending = load.snapshot.state.pending;
    if (pending?.kind === 'OFFERS') {
      const offer = pending.offers[0];
      if (offer === undefined) throw new Error('OFFERS pending인데 offers가 비어 있다');
      const accepted = await acceptOffer(engine, careerId, offer.id);
      if (!accepted.ok) throw new Error(`ACCEPT_OFFER 실패: ${accepted.error.code} ${accepted.error.message}`);
      return;
    }
    if (pending === null) {
      const result = await advance(engine, careerId);
      if (!result.ok) throw new Error(`advance(온보딩) 실패: ${result.error.code} ${result.error.message}`);
      continue;
    }
    if (pending.kind === 'EVENT') {
      const definition = engine.pack.eventsById.get(pending.eventId);
      if (definition === undefined) throw new Error(`팩에 이벤트 정의 없음: ${pending.eventId}`);
      const choice = definition.choices[0];
      if (choice === undefined) throw new Error(`이벤트에 선택지 없음: ${pending.eventId}`);
      const resolved = await resolveEvent(engine, careerId, choice.id);
      if (!resolved.ok) throw new Error(`RESOLVE_EVENT(온보딩 ${pending.eventId}) 실패: ${resolved.error.code} ${resolved.error.message}`);
      continue;
    }
    throw new Error(`온보딩 중 예상 밖 pending: ${pending.kind}`);
  }
  throw new Error('온보딩이 10회 안에 OFFERS에 도달하지 못했다');
}

/** pending 하나를 "첫 선택지"로 닫고, season이 없으면 START_SEASON을, 계약 체결 뒤 시즌이 없으면
 * 진행을 멈춘다(phase4-seed-reachability.test.ts stepOnceTowards와 같은 관례 — 모든 pending
 * 종류를 다룬다). SETTLEMENT에 도달하면 settleSeason 뒤 true를 돌려준다(시즌 1개 완료). */
async function stepOnceAndReportSettled(engine: AppEngine, careerId: string): Promise<boolean> {
  const load = await engine.client.loadCareer(careerId);
  if (!load.ok) throw new Error(`loadCareer 실패: ${load.error.code}`);
  const state = load.snapshot.state;
  if (state.status !== 'ACTIVE') throw new Error(`예상 밖 status: ${state.status}`);
  const pending = state.pending;

  if (pending === null) {
    if (state.contract !== null && state.season === null) {
      const result = await execute(engine, careerId, {
        type: 'START_SEASON',
        payload: { simulationMode: 'CHAPTER', serviceSeasonId: FALLBACK_SERVICE_SEASON_ID },
      });
      if (!result.ok) throw new Error(`START_SEASON 실패: ${result.error.code} ${result.error.message}`);
      return false;
    }
    const result = await advance(engine, careerId);
    if (!result.ok) throw new Error(`ADVANCE 실패: ${result.error.code} ${result.error.message}`);
    return false;
  }

  if (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM') {
    const definition = engine.pack.eventsById.get(pending.eventId);
    if (definition === undefined) throw new Error(`팩에 이벤트 정의 없음: ${pending.eventId}`);
    const choice = definition.choices[0];
    if (choice === undefined) throw new Error(`이벤트에 선택지 없음: ${pending.eventId}`);
    const result = await resolveEvent(engine, careerId, choice.id);
    if (!result.ok) throw new Error(`RESOLVE_EVENT(${pending.eventId}) 실패: ${result.error.code} ${result.error.message}`);
    return false;
  }

  if (pending.kind === 'CHAPTER') {
    const definition = engine.pack.chaptersById.get(pending.chapterId);
    if (definition === undefined) throw new Error(`팩에 챕터 정의 없음: ${pending.chapterId}`);
    const decision = definition.decisions[pending.resolved.length];
    if (decision === undefined) throw new Error('챕터 판단 인덱스 초과');
    const option = decision.options[0];
    if (option === undefined) throw new Error(`판단에 선택지 없음: ${decision.id}`);
    const result = await resolveChapter(engine, careerId, decision.id, option.id);
    if (!result.ok) throw new Error(`RESOLVE_CHAPTER 실패: ${result.error.code} ${result.error.message}`);
    return false;
  }

  if (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT') {
    const offer = pending.offers[0];
    if (offer === undefined) {
      const result = await advance(engine, careerId);
      if (!result.ok) throw new Error(`ADVANCE(CONTRACT checkpoint) 실패: ${result.error.code} ${result.error.message}`);
      return false;
    }
    const result = await acceptOffer(engine, careerId, offer.id);
    if (!result.ok) throw new Error(`ACCEPT_OFFER 실패: ${result.error.code} ${result.error.message}`);
    return false;
  }

  if (pending.kind === 'ROLE_PROPOSAL') {
    const result = await resolveRole(engine, careerId, 'ACCEPT');
    if (!result.ok) throw new Error(`RESOLVE_ROLE 실패: ${result.error.code} ${result.error.message}`);
    return false;
  }

  if (pending.kind === 'LOAN_RETURN') {
    const decision = pending.options[0] ?? 'RETURN';
    const result = await execute(engine, careerId, { type: 'LOAN_RETURN', payload: { decision } });
    if (!result.ok) throw new Error(`LOAN_RETURN 실패: ${result.error.code} ${result.error.message}`);
    return false;
  }

  // pending.kind === 'SETTLEMENT'
  const result = await settleSeason(engine, careerId);
  if (!result.ok) throw new Error(`SETTLE_SEASON 실패: ${result.error.code} ${result.error.message}`);
  return true;
}

/** 커리어 생성 → 온보딩 → 계약 체결 → 시즌 1개(SETTLE_SEASON까지)를 재생하고 최종 stateHash를 돌려준다. */
async function playOneSeason(idPrefix: string): Promise<{ stateHash: string; revision: number }> {
  const engine = await makeEngine(idPrefix);
  const careerId = 'car_kleague_structure_smoke';
  await createCareerWithSeed(engine, careerId);
  await onboardToContract(engine, careerId);

  const STEP_BUDGET = 200;
  let settled = false;
  for (let i = 0; i < STEP_BUDGET && !settled; i += 1) {
    settled = await stepOnceAndReportSettled(engine, careerId);
  }
  expect(settled, `시즌 1개를 ${STEP_BUDGET}스텝 안에 정산하지 못했다`).toBe(true);

  const load = await engine.client.loadCareer(careerId);
  if (!load.ok) throw new Error(`loadCareer 실패: ${load.error.code}`);
  expect(load.snapshot.state.seasonHistory).toHaveLength(1);
  expect(load.career.rulesetVersion).toBe(RULESET_VERSION);
  expect(load.career.contentPackVersion).toBe(PACK_VERSION);
  return { stateHash: load.snapshot.stateHash, revision: load.snapshot.revision };
}

describe('D-77 룰셋 1.5.0·팩 0.6.0: 커리어 생성 → 시즌 1개 시뮬레이션', () => {
  it('오류 없이 시즌 1개를 정산하고, 같은 seed로 두 번 재생하면 같은 stateHash가 나온다', async () => {
    const first = await playOneSeason('run1');
    const second = await playOneSeason('run2');

    expect(second.stateHash).toBe(first.stateHash);
    expect(second.revision).toBe(first.revision);
  });
});
