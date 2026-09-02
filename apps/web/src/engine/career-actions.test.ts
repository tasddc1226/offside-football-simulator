import { loadContentPack } from '@offside/content';
import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { MemoryLocalStore, inlineSimulator, type ExecuteResult } from '@offside/engine-client';
import { describe, expect, it, vi } from 'vitest';
import { advance, confirmPlayer, createCareer, deleteCareer, execute, updateDraft } from './career-actions.js';
import { createAppEngine, type AppEngine } from './engine.js';

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

    await updateDraft(engine, careerId, { name: '김서준', nationalityCode: 'KR', preferredFoot: 'LEFT' });
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
