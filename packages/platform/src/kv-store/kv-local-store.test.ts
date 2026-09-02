import { createEngineClient, inlineSimulator } from '@offside/engine-client';
import { runLocalStoreContractTests } from '@offside/engine-client/testing';
import { career01, career01EngineCommands } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createKvLocalStore } from './kv-local-store.js';
import { MemoryStringKV } from './memory-kv.js';

runLocalStoreContractTests('toss-storage', () => createKvLocalStore(new MemoryStringKV()));

describe('createKvLocalStore', () => {
  it('키 정렬이 revision 숫자 순서와 같다(9 → 10)', async () => {
    const store = createKvLocalStore(new MemoryStringKV());
    await store.transaction('readwrite', async (tx) => {
      for (let revision = 8; revision <= 11; revision++) {
        await tx.snapshots.put({
          id: `career-x:${revision}`,
          careerId: 'career-x',
          revision,
          checkpoint: 'STEP_BOUNDARY',
          state: '{}',
          stateHash: 'a'.repeat(64),
          rulesetVersion: '1.0.0',
          contentPackVersion: '0.1.0',
          rngState: { s: [1, 2, 3, 4], draws: 0 },
          createdAt: '2026-01-01T00:00:00.000Z',
        });
      }
    });

    const listed = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('career-x'));
    expect(listed.map((s) => s.revision)).toEqual([8, 9, 10, 11]);

    const latest = await store.transaction('readonly', (tx) => tx.snapshots.getLatest('career-x'));
    expect(latest?.revision).toBe(11);

    await store.close();
  });

  it('keys() 접두 필터가 다른 prefix 키를 섞지 않는다', async () => {
    const kv = new MemoryStringKV();
    const storeA = createKvLocalStore(kv, 'a:');
    const storeB = createKvLocalStore(kv, 'b:');

    await storeA.transaction('readwrite', (tx) => tx.kv.put('shared', 'from-a'));
    await storeB.transaction('readwrite', (tx) => tx.kv.put('shared', 'from-b'));

    expect(await storeA.transaction('readonly', (tx) => tx.kv.get<string>('shared'))).toBe('from-a');
    expect(await storeB.transaction('readonly', (tx) => tx.kv.get<string>('shared'))).toBe('from-b');

    await storeA.close();
    await storeB.close();
  });

  it('golden fixture를 실행하면 stateHash가 golden과 같다', async () => {
    const store = createKvLocalStore(new MemoryStringKV());
    const engine = createEngineClient({ store, simulator: inlineSimulator });
    const careerId = career01.createCareer.careerId;

    let idCounter = 0;
    for (const command of career01EngineCommands(() => `kv-golden-${idCounter++}`)) {
      const result = await engine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'season-2025-26' } : {}),
      });
      if (!result.ok) {
        throw new Error(`golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
      }
    }

    const loaded = await engine.loadCareer(careerId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.snapshot.stateHash).toBe(career01.golden.stateHash);
      expect(loaded.snapshot.revision).toBe(career01.golden.revision);
    }

    await store.close();
  });
});
