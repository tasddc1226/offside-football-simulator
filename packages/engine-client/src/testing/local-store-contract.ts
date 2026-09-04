import type { CareerSnapshot, CommandLogEntry } from '@offside/contracts';
import { ATTRIBUTE_KEYS, type AttributeKey, type DomainSnapshot } from '@offside/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStoreConstraintError, type LocalStore } from '../ports/local-store.js';
import type { IdempotencyRecord, LocalCareerRecord } from '../types.js';

function buildAttributes(value: number): Record<AttributeKey, number> {
  const attributes = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) attributes[key] = value;
  return attributes;
}

function makeCareer(overrides: Partial<LocalCareerRecord> = {}): LocalCareerRecord {
  return {
    id: 'car_test_01',
    ownerProfileId: null,
    status: 'ACTIVE',
    revision: 1,
    lastSyncedRevision: 0,
    createdServiceSeasonId: 'season-2025-26',
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDomainSnapshot(overrides: Partial<DomainSnapshot> = {}): DomainSnapshot {
  const state: DomainSnapshot['state'] = {
    schemaVersion: 1,
    careerId: 'car_test_01',
    status: 'ACTIVE',
    stage: 'YOUTH',
    age: 17,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: 'CHAPTER',
    attributes: buildAttributes(50),
    growthCarryCenti: buildAttributes(0),
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 100 },
    relationships: { managerTrust: 50, captain: 50, rival: 50, fans: 50, agent: 50 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
      profile: null,
    },
    pending: null,
    contract: null,
    parentContract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
    nextManager: null,
    captaincy: 'NONE',
    captaincySeasons: 0,
    controversyFailures: 0,
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 5000 },
  };
  return {
    revision: 1,
    checkpoint: 'CAREER_CREATED',
    state,
    stateHash: 'a'.repeat(64),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    ...overrides,
  };
}

function makeCareerSnapshot(overrides: Partial<CareerSnapshot> = {}): CareerSnapshot {
  return {
    id: 'car_test_01:1',
    careerId: 'car_test_01',
    revision: 1,
    checkpoint: 'CAREER_CREATED',
    state: JSON.stringify({ schemaVersion: 1, careerId: 'car_test_01' }),
    stateHash: 'a'.repeat(64),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCommandLogEntry(overrides: Partial<CommandLogEntry> = {}): CommandLogEntry {
  return {
    careerId: 'car_test_01',
    revision: 1,
    commandId: 'cmd_test_01',
    commandType: 'ADVANCE',
    payload: {},
    resultHash: 'a'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeIdempotencyRecord(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  const domainSnapshot = makeDomainSnapshot();
  return {
    commandId: 'cmd_test_01',
    careerId: 'car_test_01',
    revision: 1,
    resultHash: domainSnapshot.stateHash,
    response: {
      ok: true,
      snapshot: makeCareerSnapshot(),
      domainSnapshot,
      nextAction: 'ADVANCE',
      appliedEffects: [],
      replayed: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * `LocalStore` 구현이 지켜야 할 계약 테스트. `factory`는 매 테스트마다 빈 store를 새로 만들어야 한다.
 */
export function runLocalStoreContractTests(name: string, factory: () => LocalStore | Promise<LocalStore>): void {
  describe(`LocalStore 계약: ${name}`, () => {
    let store: LocalStore;

    beforeEach(async () => {
      store = await factory();
    });

    afterEach(async () => {
      await store.close();
    });

    it('careers: CRUD와 반환 순서(updatedAt 내림차순, 동률이면 id 오름차순)', async () => {
      await store.transaction('readwrite', async (tx) => {
        await tx.careers.put(makeCareer({ id: 'b', updatedAt: '2026-01-01T00:00:00.000Z' }));
        await tx.careers.put(makeCareer({ id: 'a', updatedAt: '2026-01-02T00:00:00.000Z' }));
        await tx.careers.put(makeCareer({ id: 'c', updatedAt: '2026-01-02T00:00:00.000Z' }));
      });

      const listed = await store.transaction('readonly', (tx) => tx.careers.list());
      expect(listed.map((career) => career.id)).toEqual(['a', 'c', 'b']);

      const got = await store.transaction('readonly', (tx) => tx.careers.get('a'));
      expect(got?.updatedAt).toBe('2026-01-02T00:00:00.000Z');

      expect(await store.transaction('readonly', (tx) => tx.careers.get('missing'))).toBeUndefined();

      await store.transaction('readwrite', (tx) => tx.careers.delete('a'));
      expect(await store.transaction('readonly', (tx) => tx.careers.get('a'))).toBeUndefined();
      expect((await store.transaction('readonly', (tx) => tx.careers.list())).map((c) => c.id)).toEqual(['c', 'b']);
    });

    it('snapshots: (careerId, revision) 기준 upsert와 getLatest', async () => {
      await store.transaction('readwrite', async (tx) => {
        await tx.snapshots.put(makeCareerSnapshot({ id: 'x:1', careerId: 'x', revision: 1 }));
        await tx.snapshots.put(makeCareerSnapshot({ id: 'x:2', careerId: 'x', revision: 2 }));
        await tx.snapshots.put(makeCareerSnapshot({ id: 'x:2', careerId: 'x', revision: 2, checkpoint: 'STEP_BOUNDARY' }));
      });

      const latest = await store.transaction('readonly', (tx) => tx.snapshots.getLatest('x'));
      expect(latest?.revision).toBe(2);
      expect(latest?.checkpoint).toBe('STEP_BOUNDARY');

      const revision1 = await store.transaction('readonly', (tx) => tx.snapshots.get('x', 1));
      expect(revision1?.revision).toBe(1);
      expect(await store.transaction('readonly', (tx) => tx.snapshots.get('x', 99))).toBeUndefined();
      expect(await store.transaction('readonly', (tx) => tx.snapshots.getLatest('unknown-career'))).toBeUndefined();

      await store.transaction('readwrite', (tx) => tx.snapshots.deleteByCareer('x'));
      expect(await store.transaction('readonly', (tx) => tx.snapshots.getLatest('x'))).toBeUndefined();
    });

    // T-2-006 05 "저장" checkpoint 종류: STEP_BOUNDARY(위 테스트에 이미 있음)에 더해 시즌 경계
    // checkpoint(SEASON_START·SEASON_SETTLED)도 저장·복원(get·getLatest)이 값을 그대로 돌려주는지 본다.
    it('snapshots: SEASON_START·SEASON_SETTLED checkpoint도 그대로 저장·복원된다', async () => {
      await store.transaction('readwrite', async (tx) => {
        await tx.snapshots.put(makeCareerSnapshot({ id: 'season:11', careerId: 'season', revision: 11, checkpoint: 'SEASON_START' }));
        await tx.snapshots.put(makeCareerSnapshot({ id: 'season:17', careerId: 'season', revision: 17, checkpoint: 'SEASON_SETTLED' }));
      });

      const start = await store.transaction('readonly', (tx) => tx.snapshots.get('season', 11));
      expect(start?.checkpoint).toBe('SEASON_START');

      const latest = await store.transaction('readonly', (tx) => tx.snapshots.getLatest('season'));
      expect(latest?.revision).toBe(17);
      expect(latest?.checkpoint).toBe('SEASON_SETTLED');

      const all = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('season'));
      expect(all.map((s) => s.checkpoint)).toEqual(['SEASON_START', 'SEASON_SETTLED']);
    });

    it('snapshots: transfer·loan의 CONTRACT_CONFIRMED·SEASON_SETTLED·STEP_BOUNDARY 상태를 그대로 보존한다', async () => {
      const expected = [
        makeCareerSnapshot({
          id: 'transfer:18',
          careerId: 'transfer',
          revision: 18,
          checkpoint: 'CONTRACT_CONFIRMED',
          state: JSON.stringify({
            schemaVersion: 1,
            careerId: 'transfer',
            contract: { kind: 'PERMANENT', teamId: 'busan-tier2' },
            parentContract: null,
            clubHistory: [{ kind: 'PERMANENT', toSeasonIndex: null }],
          }),
        }),
        makeCareerSnapshot({
          id: 'transfer:22',
          careerId: 'transfer',
          revision: 22,
          checkpoint: 'SEASON_SETTLED',
          state: JSON.stringify({
            schemaVersion: 1,
            careerId: 'transfer',
            contract: { kind: 'PERMANENT', teamId: 'busan-tier2' },
            parentContract: null,
            clubHistory: [{ kind: 'PERMANENT', toSeasonIndex: null }],
          }),
        }),
        makeCareerSnapshot({
          id: 'loan:16',
          careerId: 'loan',
          revision: 16,
          checkpoint: 'CONTRACT_CONFIRMED',
          state: JSON.stringify({
            schemaVersion: 1,
            careerId: 'loan',
            contract: { kind: 'LOAN', teamId: 'busan-tier2' },
            parentContract: { kind: 'PERMANENT', suspended: true, teamId: 'seoul-tier1' },
            clubHistory: [{ kind: 'LOAN', toSeasonIndex: null }],
          }),
        }),
        makeCareerSnapshot({
          id: 'loan:21',
          careerId: 'loan',
          revision: 21,
          checkpoint: 'SEASON_SETTLED',
          state: JSON.stringify({
            schemaVersion: 1,
            careerId: 'loan',
            contract: { kind: 'LOAN', teamId: 'busan-tier2' },
            parentContract: { kind: 'PERMANENT', suspended: true, teamId: 'seoul-tier1' },
            clubHistory: [{ kind: 'LOAN', toSeasonIndex: null }],
          }),
        }),
        makeCareerSnapshot({
          id: 'loan:22',
          careerId: 'loan',
          revision: 22,
          checkpoint: 'STEP_BOUNDARY',
          state: JSON.stringify({
            schemaVersion: 1,
            careerId: 'loan',
            contract: { kind: 'PERMANENT', teamId: 'seoul-tier1' },
            parentContract: null,
            clubHistory: [{ kind: 'PERMANENT', toSeasonIndex: null }],
          }),
        }),
      ];

      await store.transaction('readwrite', async (tx) => {
        for (const snapshot of expected) await tx.snapshots.put(snapshot);
      });

      const transfer = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('transfer'));
      const loan = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('loan'));
      expect(transfer.map((snapshot) => snapshot.checkpoint)).toEqual(['CONTRACT_CONFIRMED', 'SEASON_SETTLED']);
      expect(loan.map((snapshot) => snapshot.checkpoint)).toEqual(['CONTRACT_CONFIRMED', 'SEASON_SETTLED', 'STEP_BOUNDARY']);
      expect(transfer.concat(loan).map((snapshot) => snapshot.state)).toEqual(expected.map((snapshot) => snapshot.state));
    });

    it('snapshots: listByCareer는 닫힌 구간을 revision 오름차순으로 돌려준다', async () => {
      await store.transaction('readwrite', async (tx) => {
        for (let revision = 1; revision <= 5; revision++) {
          await tx.snapshots.put(makeCareerSnapshot({ id: `y:${revision}`, careerId: 'y', revision }));
        }
      });

      const all = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('y'));
      expect(all.map((s) => s.revision)).toEqual([1, 2, 3, 4, 5]);

      const ranged = await store.transaction('readonly', (tx) =>
        tx.snapshots.listByCareer('y', { fromRevision: 2, toRevision: 4 }),
      );
      expect(ranged.map((s) => s.revision)).toEqual([2, 3, 4]);

      const fromOnly = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('y', { fromRevision: 4 }));
      expect(fromOnly.map((s) => s.revision)).toEqual([4, 5]);

      const toOnly = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer('y', { toRevision: 2 }));
      expect(toOnly.map((s) => s.revision)).toEqual([1, 2]);
    });

    it('commandLog: append 중복은 LocalStoreConstraintError, listSince는 afterRevision 자신을 제외한다', async () => {
      await store.transaction('readwrite', async (tx) => {
        for (let revision = 1; revision <= 3; revision++) {
          await tx.commandLog.append(makeCommandLogEntry({ careerId: 'z', revision, commandId: `cmd-${revision}` }));
        }
      });

      const since1 = await store.transaction('readonly', (tx) => tx.commandLog.listSince('z', 1));
      expect(since1.map((entry) => entry.revision)).toEqual([2, 3]);

      const since0 = await store.transaction('readonly', (tx) => tx.commandLog.listSince('z', 0));
      expect(since0.map((entry) => entry.revision)).toEqual([1, 2, 3]);

      await expect(
        store.transaction('readwrite', (tx) =>
          tx.commandLog.append(makeCommandLogEntry({ careerId: 'z', revision: 1, commandId: 'cmd-dup' })),
        ),
      ).rejects.toBeInstanceOf(LocalStoreConstraintError);

      await store.transaction('readwrite', (tx) => tx.commandLog.deleteByCareer('z'));
      expect(await store.transaction('readonly', (tx) => tx.commandLog.listSince('z', 0))).toEqual([]);
    });

    it('idempotency: CRUD', async () => {
      await store.transaction('readwrite', (tx) =>
        tx.idempotency.put(makeIdempotencyRecord({ commandId: 'cmd-a', careerId: 'w' })),
      );

      const got = await store.transaction('readonly', (tx) => tx.idempotency.get('cmd-a'));
      expect(got?.commandId).toBe('cmd-a');
      expect(await store.transaction('readonly', (tx) => tx.idempotency.get('missing'))).toBeUndefined();

      await store.transaction('readwrite', (tx) => tx.idempotency.deleteByCareer('w'));
      expect(await store.transaction('readonly', (tx) => tx.idempotency.get('cmd-a'))).toBeUndefined();
    });

    it('kv: CRUD와 중첩 객체 왕복', async () => {
      const nested = { a: { b: [1, 2, { c: 'd' }] }, e: null };
      await store.transaction('readwrite', (tx) => tx.kv.put('nested', nested));

      const roundtripped = await store.transaction('readonly', (tx) => tx.kv.get<typeof nested>('nested'));
      expect(roundtripped).toEqual(nested);

      expect(await store.transaction('readonly', (tx) => tx.kv.get('missing'))).toBeUndefined();

      await store.transaction('readwrite', (tx) => tx.kv.delete('nested'));
      expect(await store.transaction('readonly', (tx) => tx.kv.get('nested'))).toBeUndefined();
    });

    it('readwrite 트랜잭션이 throw하면 롤백된다(이전 값 유지, 새 값 없음)', async () => {
      await store.transaction('readwrite', (tx) => tx.careers.put(makeCareer({ id: 'stable' })));

      await expect(
        store.transaction('readwrite', async (tx) => {
          await tx.careers.put(makeCareer({ id: 'stable', status: 'ARCHIVED' }));
          await tx.careers.put(makeCareer({ id: 'new-one' }));
          throw new Error('의도된 실패');
        }),
      ).rejects.toThrow('의도된 실패');

      const stable = await store.transaction('readonly', (tx) => tx.careers.get('stable'));
      expect(stable?.status).toBe('ACTIVE');
      expect(await store.transaction('readonly', (tx) => tx.careers.get('new-one'))).toBeUndefined();
    });

    it('동시 readwrite 두 개는 직렬화된다(카운터 +1을 각각 실행하면 2가 된다)', async () => {
      await store.transaction('readwrite', (tx) => tx.kv.put('counter', 0));

      async function increment(): Promise<void> {
        await store.transaction('readwrite', async (tx) => {
          const current = (await tx.kv.get<number>('counter')) ?? 0;
          await tx.kv.put('counter', current + 1);
        });
      }

      await Promise.all([increment(), increment()]);

      expect(await store.transaction('readonly', (tx) => tx.kv.get<number>('counter'))).toBe(2);
    });

    it('반환값을 mutate해도 저장된 값은 바뀌지 않는다', async () => {
      await store.transaction('readwrite', (tx) => tx.careers.put(makeCareer({ id: 'immutable' })));

      const first = await store.transaction('readonly', (tx) => tx.careers.get('immutable'));
      if (first === undefined) throw new Error('unreachable');
      first.status = 'ARCHIVED';

      const second = await store.transaction('readonly', (tx) => tx.careers.get('immutable'));
      expect(second?.status).toBe('ACTIVE');
    });

    it('close() 후에는 다시 호출하지 않는다', async () => {
      // afterEach가 이 테스트가 끝난 뒤 store.close()를 호출한다. close()를 두 번 호출하는 것이
      // 안전하다고 구현이 보장할 필요는 없으므로, 여기서는 직접 close()를 부르지 않고
      // "정상적으로 쓴 뒤 afterEach의 단일 close()로 끝난다"만 확인한다.
      await store.transaction('readwrite', (tx) => tx.kv.put('k', 'v'));
      expect(await store.transaction('readonly', (tx) => tx.kv.get('k'))).toBe('v');
    });
  });
}
