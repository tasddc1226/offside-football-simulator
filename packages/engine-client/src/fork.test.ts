import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { forkCareerByReplay } from './fork.js';
import { createEngineClient, type EngineClient } from './engine.js';
import { inlineSimulator, type Simulator } from './simulator/index.js';
import { MemoryLocalStore } from './store/memory.js';
import type { CareerState, SimulationResult } from '@offside/domain';

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

async function runGoldenOnFreshStore(): Promise<{ store: MemoryLocalStore; engine: EngineClient; careerId: string }> {
  const store = new MemoryLocalStore();
  const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
  const careerId = career01.createCareer.careerId;
  const commands = career01EngineCommands(makeIdGenerator('golden-cmd'));

  for (const command of commands) {
    const result = await engine.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
    });
    if (!result.ok) {
      throw new Error(`golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
    }
  }

  return { store, engine, careerId };
}

function withoutCareerId(state: CareerState): Omit<CareerState, 'careerId'> {
  const rest: Partial<CareerState> = { ...state };
  delete rest.careerId;
  return rest as Omit<CareerState, 'careerId'>;
}

function failingSimulator(base: Simulator, failAtCall: number): Simulator {
  let calls = 0;
  return {
    simulate(input): Promise<SimulationResult> {
      calls += 1;
      if (calls === failAtCall) {
        return Promise.resolve({ ok: false, error: { code: 'VALIDATION_FAILED', message: '테스트 실패 주입' } });
      }
      return base.simulate(input);
    },
  };
}

describe('forkCareerByReplay', () => {
  it('골든을 끝까지 실행한 뒤 포크하면 revision이 같고 careerId만 다른 새 커리어가 생긴다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();
    const originalBefore = await engine.loadCareer(careerId);
    expect(originalBefore.ok).toBe(true);
    if (!originalBefore.ok) throw new Error('unreachable');

    const result = await forkCareerByReplay({ engine, store, newId: makeIdGenerator('fork-id') }, careerId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.revision).toBe(originalBefore.snapshot.revision);
    expect(result.newCareerId).not.toBe(careerId);

    const originalAfter = await engine.loadCareer(careerId);
    expect(originalAfter.ok).toBe(true);
    if (!originalAfter.ok) throw new Error('unreachable');
    expect(originalAfter.snapshot).toEqual(originalBefore.snapshot);

    const forked = await engine.loadCareer(result.newCareerId);
    expect(forked.ok).toBe(true);
    if (!forked.ok) throw new Error('unreachable');
    expect(forked.snapshot.revision).toBe(originalBefore.snapshot.revision);
    expect(forked.snapshot.stateHash).not.toBe(originalBefore.snapshot.stateHash);
    expect(withoutCareerId(forked.snapshot.state)).toEqual(withoutCareerId(originalBefore.snapshot.state));
    expect(forked.snapshot.state.careerId).toBe(result.newCareerId);

    const records = await engine.listCareers();
    const forkedRecord = records.find((record) => record.id === result.newCareerId);
    expect(forkedRecord).toBeDefined();
    expect(forkedRecord?.lastSyncedRevision).toBe(0);
    expect(forkedRecord?.createdServiceSeasonId).toBe('svc_kickoff');

    const originalRecord = records.find((record) => record.id === careerId);
    expect(originalRecord?.revision).toBe(originalBefore.snapshot.revision);
  });

  it('명령 로그 중간 항목이 없으면 FORK_LOG_INCOMPLETE를 돌려준다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(makeIdGenerator('gap-cmd')).slice(0, 4); // CREATE, UPDATE×2, CONFIRM

    for (const command of commands) {
      const result = await engine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok) throw new Error(`실패: ${result.error.code}`);
    }

    // revision 2 항목을 지워 로그에 빈틈을 만든다.
    await store.transaction('readwrite', async (tx) => {
      const entries = await tx.commandLog.listSince(careerId, 0);
      await tx.commandLog.deleteByCareer(careerId);
      for (const entry of entries.filter((e) => e.revision !== 2)) {
        await tx.commandLog.append(entry);
      }
    });

    const result = await forkCareerByReplay({ engine, store, newId: makeIdGenerator('fork-gap') }, careerId);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VERIFICATION_FAILED');
    expect(result.error.details).toEqual({ reason: 'FORK_LOG_INCOMPLETE', atRevision: 2 });
  });

  it('첫 항목이 CREATE_CAREER가 아니면 FORK_LOG_INCOMPLETE(atRevision 1)를 돌려준다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(makeIdGenerator('nohead-cmd')).slice(0, 2); // CREATE, UPDATE

    for (const command of commands) {
      const result = await engine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok) throw new Error(`실패: ${result.error.code}`);
    }

    await store.transaction('readwrite', async (tx) => {
      const entries = await tx.commandLog.listSince(careerId, 0);
      await tx.commandLog.deleteByCareer(careerId);
      for (const entry of entries.filter((e) => e.revision !== 1)) {
        await tx.commandLog.append(entry);
      }
    });

    const result = await forkCareerByReplay({ engine, store, newId: makeIdGenerator('fork-nohead') }, careerId);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.details).toEqual({ reason: 'FORK_LOG_INCOMPLETE', atRevision: 1 });
  });

  it('존재하지 않는 careerId는 CAREER_NOT_FOUND를 돌려준다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });

    const result = await forkCareerByReplay({ engine, store, newId: makeIdGenerator('fork-missing') }, 'no-such-career');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('CAREER_NOT_FOUND');
  });

  it('재실행 중간에 실패하면 새 커리어를 지우고 원본은 그대로 둔다', async () => {
    const store = new MemoryLocalStore();
    const seedEngine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(makeIdGenerator('fail-cmd')).slice(0, 4); // CREATE, UPDATE×2, CONFIRM

    for (const command of commands) {
      const result = await seedEngine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok) throw new Error(`실패: ${result.error.code}`);
    }

    const originalBefore = await seedEngine.loadCareer(careerId);
    expect(originalBefore.ok).toBe(true);

    // 3번째 simulate 호출(=revision 3, 두 번째 UPDATE_PLAYER_DRAFT)에서 실패시킨다.
    const brokenEngine = createEngineClient({
      store,
      simulator: failingSimulator(inlineSimulator, 3),
      ruleset: rulesetProto,
    });

    const result = await forkCareerByReplay(
      { engine: brokenEngine, store, newId: makeIdGenerator('fork-fail') },
      careerId,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VALIDATION_FAILED');

    const records = await seedEngine.listCareers();
    expect(records.map((record) => record.id)).toEqual([careerId]);

    const originalAfter = await seedEngine.loadCareer(careerId);
    expect(originalAfter.ok).toBe(true);
    if (!originalAfter.ok || !originalBefore.ok) throw new Error('unreachable');
    expect(originalAfter.snapshot).toEqual(originalBefore.snapshot);
  });
});
