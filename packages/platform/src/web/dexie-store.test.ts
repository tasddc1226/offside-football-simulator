import { createEngineClient, inlineSimulator } from '@offside/engine-client';
import { runLocalStoreContractTests } from '@offside/engine-client/testing';
import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createDexieLocalStore } from './dexie-store.js';

let dbCounter = 0;
function freshDbName(): string {
  dbCounter += 1;
  return `test-dexie-${dbCounter}`;
}

runLocalStoreContractTests('dexie', () => createDexieLocalStore(freshDbName()));

describe('createDexieLocalStore', () => {
  it('같은 DB 이름을 다시 열어도 데이터가 남아 있다', async () => {
    const dbName = freshDbName();

    const store1 = await createDexieLocalStore(dbName);
    await store1.transaction('readwrite', (tx) => tx.kv.put('flag', 'persisted'));
    await store1.close();

    const store2 = await createDexieLocalStore(dbName);
    const value = await store2.transaction('readonly', (tx) => tx.kv.get<string>('flag'));
    expect(value).toBe('persisted');
    await store2.close();
  });

  it('golden fixture를 실행하면 stateHash가 golden과 같다', async () => {
    const store = await createDexieLocalStore(freshDbName());
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = career01.createCareer.careerId;

    let idCounter = 0;
    for (const command of career01EngineCommands(() => `dexie-golden-${idCounter++}`)) {
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
