import { EFFECT_DEFAULTS, loadContentPack } from '@offside/content';
import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { MemoryLocalStore, inlineSimulator, type ExecuteResult } from '@offside/engine-client';
import { describe, expect, it, vi } from 'vitest';
import {
  acceptOffer,
  advance,
  confirmPlayer,
  createCareer,
  deleteCareer,
  execute,
  resolveEvent,
  resolveRole,
  settleSeason,
  startSeason,
  toResolveEventOutcomes,
  toStartSeasonPayload,
  updateDraft,
} from './career-actions.js';
import { createAppEngine, type AppEngine } from './engine.js';
import { ACTIVE_SERVICE_SEASON_ID } from './versions.js';

const syncHolder = vi.hoisted(() => ({ notifyCommitted: vi.fn() }));
vi.mock('./sync.js', () => ({
  getSyncClient: () =>
    Promise.resolve({
      notifyCommitted: syncHolder.notifyCommitted,
      flush: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
      resolveConflict: vi.fn(),
      dispose: vi.fn(),
    }),
}));

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

/** rulesetProto(fixtures)는 career01 fixture가 재생을 검증받은 룰셋이다. selectEligibleEvents는
 * 실제 콘텐츠 팩(EVT-CON-002 등)에서 계산해야 하므로 pack은 loadContentPack('0.1.0')을 쓴다. */
function makeTestEngine(newId = makeIdGenerator('id')): AppEngine {
  return createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: rulesetProto,
    pack: loadContentPack('0.1.0'),
    newId,
  });
}

describe('createCareer', () => {
  it('DRAFT 상태·revision 1의 새 커리어를 만든다', async () => {
    const engine = makeTestEngine();

    const result = await createCareer(engine, { simulationMode: 'FAST' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.revision).toBe(1);
    expect(result.domainSnapshot.state.status).toBe('DRAFT');
    expect(result.domainSnapshot.state.simulationMode).toBe('FAST');

    const listed = await engine.client.listCareers();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(result.snapshot.careerId);
    expect(listed[0]?.status).toBe('DRAFT');
  });

  it('매번 서로 다른 careerId·seed를 만든다', async () => {
    const engine = makeTestEngine();

    const first = await createCareer(engine, { simulationMode: 'FAST' });
    const second = await createCareer(engine, { simulationMode: 'FAST' });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');
    expect(first.snapshot.careerId).not.toBe(second.snapshot.careerId);
  });
});

describe('updateDraft·confirmPlayer', () => {
  it('CONFIRM_PLAYER 뒤 ACTIVE로 전환되고 player.profile이 채워진다', async () => {
    const engine = makeTestEngine();
    const created = await createCareer(engine, { simulationMode: 'CHAPTER' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    const careerId = created.snapshot.careerId;

    await updateDraft(engine, careerId, { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' });
    const secondDraft = await updateDraft(engine, careerId, {
      position: 'W',
      archetypeId: 'inside-forward',
      backgroundId: 'club-academy',
    });
    expect(secondDraft.ok).toBe(true);

    const confirmed = await confirmPlayer(engine, careerId);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error('unreachable');
    expect(confirmed.domainSnapshot.state.status).toBe('ACTIVE');
    expect(confirmed.domainSnapshot.state.player.profile?.name).toBe('김서준');
  });
});

describe('advance: selectEligibleEvents 배선', () => {
  it('career01 픽스처를 CONFIRM_PLAYER까지 재생한 뒤 advance가 selectEligibleEvents 결과(EVT-CON-002 포함)를 ADVANCE payload로 보낸다', async () => {
    const engine = makeTestEngine();
    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(makeIdGenerator('replay'));
    const upToConfirm = commands.slice(0, 4); // CREATE_CAREER, UPDATE_PLAYER_DRAFT×2, CONFIRM_PLAYER

    for (const command of upToConfirm) {
      const result = await engine.client.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok) {
        throw new Error(`재생 실패: ${command.type} ${result.error.code} ${result.error.message}`);
      }
    }

    // engine.client.execute를 감싸 advance()가 실제로 보내는 ADVANCE 명령의 payload를 가로챈다.
    // (도메인의 최종 가중 랜덤 선택 결과가 아니라, career-actions.advance()가 selectEligibleEvents로
    // 계산해 "보낸" 후보 목록 자체를 검증하는 것이 브리프 요구사항이다.)
    const capturedPayloads: Array<{ eligibleEvents: Array<{ eventId: string }> }> = [];
    const wrappedEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        execute: (request) => {
          if (request.command.type === 'ADVANCE') {
            capturedPayloads.push(request.command.payload as { eligibleEvents: Array<{ eventId: string }> });
          }
          return engine.client.execute(request);
        },
      },
    };

    const result = await advance(wrappedEngine, careerId);

    expect(result.ok).toBe(true);
    expect(capturedPayloads).toHaveLength(1);
    expect(capturedPayloads[0]?.eligibleEvents.some((event) => event.eventId === 'EVT-CON-002')).toBe(true);
  });
});

/** career01 픽스처를 CONFIRM_PLAYER까지 raw engine.client.execute로 재생하고 careerId를 돌려준다. */
async function replayToConfirmed(engine: AppEngine): Promise<string> {
  const careerId = career01.createCareer.careerId;
  const commands = career01EngineCommands(makeIdGenerator('replay'));
  for (const command of commands.slice(0, 4)) {
    const result = await engine.client.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
    });
    if (!result.ok) throw new Error(`재생 실패: ${command.type} ${result.error.code} ${result.error.message}`);
  }
  return careerId;
}

/** career01 픽스처를 계약 체결까지(pending null, season null) 재생한다. */
async function replayToSigned(engine: AppEngine): Promise<string> {
  const careerId = await replayToConfirmed(engine);
  await advance(engine, careerId);
  await resolveEvent(engine, careerId, 'A');
  await advance(engine, careerId);
  await resolveEvent(engine, careerId, 'B');
  const offered = await advance(engine, careerId);
  if (!offered.ok || offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
    throw new Error('제안 단계에 도달하지 못했다');
  }
  const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;
  const accepted = await acceptOffer(engine, careerId, offerId);
  if (!accepted.ok || accepted.domainSnapshot.state.pending !== null) {
    throw new Error('계약 뒤 pending이 null이어야 한다');
  }
  return careerId;
}

describe('toStartSeasonPayload', () => {
  it('simulationMode·ACTIVE_SERVICE_SEASON_ID를 담은 START_SEASON 명령을 만든다', () => {
    const command = toStartSeasonPayload({ simulationMode: 'FAST' });
    expect(command).toEqual({
      type: 'START_SEASON',
      payload: { simulationMode: 'FAST', serviceSeasonId: ACTIVE_SERVICE_SEASON_ID },
    });
  });

  it('trainingFocus를 골라도 payload에는 아직 싣지 않는다(T-2-005 접점, PR 본문 참고)', () => {
    const command = toStartSeasonPayload({ simulationMode: 'CHAPTER', trainingFocus: 'TECHNICAL' });
    expect(command.payload).not.toHaveProperty('trainingFocus');
  });
});

describe('startSeason', () => {
  it('SEASON_STARTED 타임라인 항목을 남기고 step 1 ROLE_PROPOSAL pending을 연다(RULE-TIME-002)', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);

    const result = await startSeason(engine, careerId, { simulationMode: 'FAST' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.state.season?.index).toBe(1);
    expect(result.domainSnapshot.state.season?.simulationMode).toBe('FAST');
    expect(result.domainSnapshot.state.pending?.kind).toBe('ROLE_PROPOSAL');
    expect(result.domainSnapshot.state.timeline.at(-1)).toMatchObject({ kind: 'SEASON_STARTED' });
  });
});

describe('resolveRole', () => {
  it('ACCEPT는 ROLE_RESOLVED 타임라인 항목을 남기고 pending을 닫는다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);
    const started = await startSeason(engine, careerId, { simulationMode: 'FAST' });
    if (!started.ok) throw new Error('startSeason 실패');

    const result = await resolveRole(engine, careerId, 'ACCEPT');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.state.pending).toBeNull();
    expect(result.domainSnapshot.state.season).not.toBeNull();
    expect(result.domainSnapshot.state.timeline.at(-1)).toMatchObject({ kind: 'ROLE_RESOLVED' });
  });
});

describe('settleSeason', () => {
  it('SETTLEMENT pending을 닫고 season을 null로 되돌린다(다음 시즌 시작 준비)', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);
    const started = await startSeason(engine, careerId, { simulationMode: 'FAST' });
    if (!started.ok) throw new Error('startSeason 실패');
    const roleResolved = await resolveRole(engine, careerId, 'ACCEPT');
    if (!roleResolved.ok) throw new Error('resolveRole 실패');

    // FAST 모드는 CHAPTER·CONTRACT 같은 자동 통과 슬롯만 남기고 SETTLEMENT까지 곧장 advance된다
    // (실측: 역할 수락 뒤 최대 4회). 안전 상한 20회.
    let current = roleResolved;
    for (let step = 0; step < 20 && current.domainSnapshot.state.pending?.kind !== 'SETTLEMENT'; step += 1) {
      const advanced = await advance(engine, careerId);
      if (!advanced.ok) throw new Error(`advance 실패: ${advanced.error.message}`);
      current = advanced;
    }
    expect(current.domainSnapshot.state.pending?.kind).toBe('SETTLEMENT');

    const result = await settleSeason(engine, careerId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.state.season).toBeNull();
    expect(result.domainSnapshot.state.pending).toBeNull();
    expect(result.domainSnapshot.state.seasonHistory).toHaveLength(1);
    expect(result.domainSnapshot.state.timeline.at(-1)).toMatchObject({ kind: 'SEASON_SETTLED' });
  });
});

describe('toResolveEventOutcomes', () => {
  it('EVT-CON-002 B의 DEFERRED effect가 EFFECT_DEFAULTS로 채워진 완전한 Effect 필드를 갖는다', () => {
    const pack = loadContentPack('0.1.0');
    const definition = pack.eventsById.get('EVT-CON-002')!;
    const choiceB = definition.choices.find((choice) => choice.id === 'B')!;

    const outcomes = toResolveEventOutcomes(choiceB.outcomes);
    const effect = outcomes[0]!.effects[0]!;

    expect(effect).toMatchObject({
      kind: 'DEFERRED',
      target: 'tacticalFit',
      delta: 6,
      clamp: EFFECT_DEFAULTS.DEFERRED.clamp,
      appliesAt: { kind: 'NEXT_SEASON_STEP', step: 1 },
      expiresAt: EFFECT_DEFAULTS.DEFERRED.expiresAt,
      stackingRule: EFFECT_DEFAULTS.DEFERRED.stackingRule,
    });
  });

  it('addTags·removeTags가 없는 outcome은 그 필드를 payload에 넣지 않는다', () => {
    const pack = loadContentPack('0.1.0');
    const definition = pack.eventsById.get('EVT-CON-003')!;
    const choiceA = definition.choices.find((choice) => choice.id === 'A')!;
    const neutralOutcome = choiceA.outcomes.find((outcome) => outcome.id === 'A2')!;
    expect(neutralOutcome.removeTags).toBeUndefined();

    const [outcome] = toResolveEventOutcomes([neutralOutcome]);

    expect(outcome).not.toHaveProperty('removeTags');
    expect(outcome?.addTags).toEqual(['입단테스트_완료', '테스트_보통']);
  });
});

describe('resolveEvent', () => {
  it('정의에 없는 choiceId는 커밋 없이 VALIDATION_FAILED다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    await advance(engine, careerId);

    const result = await resolveEvent(engine, careerId, 'Z');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('acceptOffer', () => {
  it('제안 수락 후 checkpoint가 CONTRACT_CONFIRMED고 contract가 채워진다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    await advance(engine, careerId);
    await resolveEvent(engine, careerId, 'A');
    await advance(engine, careerId);
    await resolveEvent(engine, careerId, 'B');
    const offered = await advance(engine, careerId);
    if (!offered.ok || offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;

    const result = await acceptOffer(engine, careerId, offerId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.checkpoint).toBe('CONTRACT_CONFIRMED');
    expect(result.domainSnapshot.state.contract?.offerId).toBe(offerId);
    expect(result.domainSnapshot.state.pending).toBeNull();
  });
});

describe('결정론: 픽스처 재생 vs 액션 경로', () => {
  it('career01 명령을 raw로 재생한 stateHash와 resolveEvent·acceptOffer로 같은 선택을 밟은 stateHash가 같다', async () => {
    // advance()는 selectEligibleEvents(pack, state)로 "지금 제시 가능한" 이벤트를 실시간 계산해
    // 보낸다(career-actions.ts). career01.json의 ADVANCE payload는 골든 경로를 고정하려고 미리
    // 박아둔 후보 목록이라 실제 계산 결과와 다를 수 있다(예: FAST 모드 CONFIRM_PLAYER 직후
    // currentStep이 이미 12라 EVT-REL-001도 같이 eligible해진다 — advance()는 정상 동작이고,
    // 픽스처가 그 시점 후보군을 그대로 반영하진 않는다는 뜻이다. PR 본문에 범위 밖 발견으로 남긴다).
    // 그래서 ADVANCE 단계는 픽스처의 raw 명령(고정 eligibleEvents)을 그대로 재생하고, 이 브리프가
    // 새로 만드는 resolveEvent·acceptOffer만 액션 경로로 검증한다.
    const fixtureEngine = makeTestEngine();
    const careerId = career01.createCareer.careerId;
    const fixtureCommands = career01EngineCommands(makeIdGenerator('fixture'));
    let fixtureFinalHash: string | null = null;
    for (const command of fixtureCommands) {
      const result = await fixtureEngine.client.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok) throw new Error(`fixture 재생 실패: ${command.type} ${result.error.code} ${result.error.message}`);
      fixtureFinalHash = result.domainSnapshot.stateHash;
    }
    expect(fixtureFinalHash).toBe(career01.golden.stateHash);

    const actionEngine = makeTestEngine();
    const actionCommands = career01EngineCommands(makeIdGenerator('action'));
    const [firstAdvance, secondAdvance, thirdAdvance] = [actionCommands[4]!, actionCommands[6]!, actionCommands[8]!];

    await replayToConfirmed(actionEngine);
    const advanced1 = await actionEngine.client.execute({ careerId, command: firstAdvance });
    if (!advanced1.ok) throw new Error(`ADVANCE#1 실패: ${advanced1.error.code} ${advanced1.error.message}`);
    await resolveEvent(actionEngine, careerId, 'A');
    const advanced2 = await actionEngine.client.execute({ careerId, command: secondAdvance });
    if (!advanced2.ok) throw new Error(`ADVANCE#2 실패: ${advanced2.error.code} ${advanced2.error.message}`);
    await resolveEvent(actionEngine, careerId, 'B');
    const offered = await actionEngine.client.execute({ careerId, command: thirdAdvance });
    if (!offered.ok || offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;
    expect(offerId).toBe('OFR-9-0');
    const finalResult = await acceptOffer(actionEngine, careerId, offerId);

    expect(finalResult.ok).toBe(true);
    if (!finalResult.ok) throw new Error('unreachable');
    expect(finalResult.domainSnapshot.stateHash).toBe(fixtureFinalHash);
  });
});

describe('deleteCareer', () => {
  it('삭제 후 목록에서 빠진다', async () => {
    const engine = makeTestEngine();
    const first = await createCareer(engine, { simulationMode: 'FAST' });
    const second = await createCareer(engine, { simulationMode: 'FAST' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');

    await deleteCareer(engine, first.snapshot.careerId);

    const listed = await engine.client.listCareers();
    expect(listed.map((record) => record.id)).toEqual([second.snapshot.careerId]);
  });
});

describe('notifySync 게이팅: ok:true·replayed:false일 때만 notifyCommitted', () => {
  it('ok:true·replayed:false면 notifyCommitted를 부른다', async () => {
    syncHolder.notifyCommitted.mockClear();
    const engine = makeTestEngine();

    const result = await createCareer(engine, { simulationMode: 'FAST' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    await vi.waitFor(() => expect(syncHolder.notifyCommitted).toHaveBeenCalledTimes(1));
    expect(syncHolder.notifyCommitted).toHaveBeenCalledWith(result.snapshot.careerId, result.domainSnapshot);
  });

  it('ok:true·replayed:true(재생)면 notifyCommitted를 부르지 않는다', async () => {
    syncHolder.notifyCommitted.mockClear();
    const seedEngine = makeTestEngine();
    const created = await createCareer(seedEngine, { simulationMode: 'FAST' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    // 시드 생성 자체도 notifyCommitted를 부른다(fire-and-forget) — 그게 가라앉을 때까지
    // 기다린 뒤 지우고, 이제부터가 진짜 검증 구간이다.
    await vi.waitFor(() => expect(syncHolder.notifyCommitted).toHaveBeenCalledTimes(1));
    syncHolder.notifyCommitted.mockClear();

    // 같은 결과를 재생(replayed:true)으로 바꿔치기해, loadCareer는 실제로 성공시키되
    // execute만 스크립트한다(존재하지 않는 careerId면 execute() 래퍼가 loadCareer에서
    // CAREER_NOT_FOUND로 먼저 끝나 execute를 아예 안 부른다).
    const replayedResult: ExecuteResult = { ...created, replayed: true };
    const scriptedEngine: AppEngine = { ...seedEngine, client: { ...seedEngine.client, execute: async () => replayedResult } };

    await execute(scriptedEngine, created.snapshot.careerId, { type: 'ADVANCE', payload: { eligibleEvents: [] } });

    // 마이크로태스크가 도는 동안 실제로 안 불렸는지 확인하려고 짧게 양보한다.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(syncHolder.notifyCommitted).not.toHaveBeenCalled();
  });

  it('ok:false면 notifyCommitted를 부르지 않는다', async () => {
    syncHolder.notifyCommitted.mockClear();
    const seedEngine = makeTestEngine();
    const created = await createCareer(seedEngine, { simulationMode: 'FAST' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    await vi.waitFor(() => expect(syncHolder.notifyCommitted).toHaveBeenCalledTimes(1));
    syncHolder.notifyCommitted.mockClear();

    const failedResult: ExecuteResult = { ok: false, error: { code: 'VALIDATION_FAILED', message: '실패' } };
    const scriptedEngine: AppEngine = { ...seedEngine, client: { ...seedEngine.client, execute: async () => failedResult } };

    await execute(scriptedEngine, created.snapshot.careerId, { type: 'ADVANCE', payload: { eligibleEvents: [] } });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(syncHolder.notifyCommitted).not.toHaveBeenCalled();
  });
});
