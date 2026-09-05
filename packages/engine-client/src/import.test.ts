import type { GetCareerResponse } from '@offside/contracts';
import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createEngineClient, type EngineClient } from './engine.js';
import { importCareerFromServer } from './import.js';
import { inlineSimulator } from './simulator/index.js';
import { MemoryLocalStore } from './store/memory.js';

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

const CAREER_ID = career01.createCareer.careerId;
const NOW = '2026-09-02T00:00:00.000Z';

async function runGoldenOnFreshStore(): Promise<{ store: MemoryLocalStore; engine: EngineClient }> {
  const store = new MemoryLocalStore();
  const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
  const commands = career01EngineCommands(makeIdGenerator('golden-cmd'));

  for (const command of commands) {
    const result = await engine.execute({
      careerId: CAREER_ID,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
    });
    if (!result.ok) {
      throw new Error(`golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
    }
  }

  return { store, engine };
}

/** 서버가 `GET /careers/{id}`로 돌려줄 법한 응답을 소스 store에서 그대로 읽어 만든다. */
async function buildGetCareerResponse(store: MemoryLocalStore, careerId: string): Promise<GetCareerResponse> {
  return store.transaction('readonly', async (tx) => {
    const snapshot = await tx.snapshots.getLatest(careerId);
    if (snapshot === undefined) throw new Error('snapshot 없음');
    const commands = await tx.commandLog.listSince(careerId, 0);
    return { createdServiceSeasonId: 'svc_kickoff', snapshot, commands: commands.slice().sort((a, b) => a.revision - b.revision) };
  });
}

describe('importCareerFromServer', () => {
  it('golden Snapshot을 가져오면 loadCareer가 같은 state를 돌려준다', async () => {
    const { store: sourceStore } = await runGoldenOnFreshStore();
    const response = await buildGetCareerResponse(sourceStore, CAREER_ID);
    const sourceEngine = createEngineClient({ store: sourceStore, simulator: inlineSimulator, ruleset: rulesetProto });
    const sourceLoaded = await sourceEngine.loadCareer(CAREER_ID);
    expect(sourceLoaded.ok).toBe(true);
    if (!sourceLoaded.ok) throw new Error('unreachable');

    const destStore = new MemoryLocalStore();
    const result = await importCareerFromServer(destStore, response, {
      createdServiceSeasonId: 'svc_current_pointer_must_be_ignored',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.revision).toBe(response.snapshot.revision);

    const destEngine = createEngineClient({ store: destStore, simulator: inlineSimulator, ruleset: rulesetProto });
    const destLoaded = await destEngine.loadCareer(CAREER_ID);
    expect(destLoaded.ok).toBe(true);
    if (!destLoaded.ok) throw new Error('unreachable');
    expect(destLoaded.snapshot.state).toEqual(sourceLoaded.snapshot.state);
    expect(destLoaded.snapshot.stateHash).toBe(sourceLoaded.snapshot.stateHash);

    const records = await destEngine.listCareers();
    const record = records.find((item) => item.id === CAREER_ID);
    expect(record).toBeDefined();
    expect(record?.revision).toBe(response.snapshot.revision);
    expect(record?.lastSyncedRevision).toBe(response.snapshot.revision);
    expect(record?.ownerProfileId).toBeNull();
    expect(record?.createdServiceSeasonId).toBe('svc_kickoff');
  });

  it('손상된 hash는 거부한다', async () => {
    const { store: sourceStore } = await runGoldenOnFreshStore();
    const response = await buildGetCareerResponse(sourceStore, CAREER_ID);
    // 마지막 글자를 고정값으로 바꾸면 원래 글자가 우연히 같을 때 무효화(no-op)된다 — 항상
    // 달라지도록 마지막 글자가 '0'이면 '1'로, 아니면 '0'으로 뒤집는다.
    const originalHash = response.snapshot.stateHash;
    const lastChar = originalHash.slice(-1);
    const flippedChar = lastChar === '0' ? '1' : '0';
    const corrupted: GetCareerResponse = {
      ...response,
      snapshot: { ...response.snapshot, stateHash: `${originalHash.slice(0, -1)}${flippedChar}` },
    };

    const destStore = new MemoryLocalStore();
    const result = await importCareerFromServer(destStore, corrupted, {
      createdServiceSeasonId: 'svc_kickoff',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VERIFICATION_FAILED');

    const records = await destStore.transaction('readonly', (tx) => tx.careers.list());
    expect(records).toHaveLength(0);
  });

  it('로컬에 미전송 revision이 있으면 덮어쓰지 않는다', async () => {
    const { store: sourceStore } = await runGoldenOnFreshStore();
    const response = await buildGetCareerResponse(sourceStore, CAREER_ID);

    const destStore = new MemoryLocalStore();
    await destStore.transaction('readwrite', async (tx) => {
      await tx.careers.put({
        id: CAREER_ID,
        ownerProfileId: null,
        status: 'ACTIVE',
        revision: 2,
        lastSyncedRevision: 1,
        createdServiceSeasonId: 'svc_local',
        rulesetVersion: rulesetProto.version,
        contentPackVersion: '0.1.0',
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    const result = await importCareerFromServer(destStore, response, {
      createdServiceSeasonId: 'svc_kickoff',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('CAREER_REVISION_CONFLICT');

    const record = await destStore.transaction('readonly', (tx) => tx.careers.get(CAREER_ID));
    expect(record?.revision).toBe(2);
    expect(record?.lastSyncedRevision).toBe(1);
    expect(record?.createdServiceSeasonId).toBe('svc_local');
  });
});
