import {
  IDEMPOTENCY_KEY_HEADER,
  IF_MATCH_HEADER,
  type CareerSnapshot,
  type CommandLogEntry,
  type GetCareerResponse,
  type PutCareerBody,
} from '@offside/contracts';
import type { CareerState, SimulationMode } from '@offside/domain';
import {
  career01,
  career01EngineCommands,
  career02Season,
  career02SeasonEngineCommands,
  career10Transfer,
  career10TransferEngineCommands,
  career11Loan,
  career11LoanEngineCommands,
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../engine.js';
import { forkCareerByReplay } from '../fork.js';
import { importCareerFromServer } from '../import.js';
import { replayCommandLog } from '../replay.js';
import { inlineSimulator } from '../simulator/index.js';
import { MemoryLocalStore } from '../store/memory.js';
import { createSyncClient } from './client.js';
import type { SyncTransportResponse } from './types.js';

/**
 * T-0-008 규칙 1(If-Match)·3(revision 검사)·4(같은 Idempotency-Key 재요청 → 최초 응답)을 흉내 낸
 * 메모리 서버. 서버 측 hash 재계산·리플레이는 하지 않는다(ADR-003).
 */
function createFakeServer() {
  type CareerRow = { revision: number; snapshot: CareerSnapshot; commands: CommandLogEntry[] };
  const db = new Map<string, CareerRow>();
  const idempotency = new Map<string, unknown>();

  function makeResponse(status: number, data: unknown): SyncTransportResponse {
    return { status, headers: new Headers(), json: async () => data };
  }

  function envelope(data: unknown): unknown {
    return { data, meta: { requestId: 'req_golden' } };
  }

  function errorEnvelope(code: string, retryable: boolean, details?: unknown): unknown {
    return {
      error: { code, message: `오류: ${code}`, retryable, ...(details !== undefined ? { details } : {}) },
      meta: { requestId: 'req_golden' },
    };
  }

  function careerIdFromUrl(url: string): string {
    const marker = '/careers/';
    const index = url.indexOf(marker);
    return url.slice(index + marker.length);
  }

  async function handlePut(careerId: string, init: RequestInit): Promise<SyncTransportResponse> {
    const idemKey = (init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER] as string;
    const cacheKey = `${careerId}:${idemKey}`;
    const cached = idempotency.get(cacheKey);
    if (cached !== undefined) {
      return makeResponse(200, envelope(cached));
    }

    const body = JSON.parse(init.body as string) as PutCareerBody;
    const ifMatch = (init.headers as Record<string, string>)[IF_MATCH_HEADER];
    if (ifMatch !== String(body.baseRevision)) {
      return makeResponse(400, errorEnvelope('VALIDATION_FAILED', false, { reason: 'IF_MATCH_MISMATCH' }));
    }

    const existing = db.get(careerId);
    const serverRevision = existing?.revision ?? 0;
    if (serverRevision !== body.baseRevision) {
      return makeResponse(
        409,
        errorEnvelope('CAREER_REVISION_CONFLICT', false, {
          serverRevision,
          serverSnapshotUrl: `/v1/careers/${careerId}`,
        }),
      );
    }

    const snapshot: CareerSnapshot = {
      id: `${careerId}:${body.snapshot.revision}`,
      careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...body.snapshot,
    };
    const newCommands: CommandLogEntry[] = body.commands.map((command) => ({
      careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...command,
    }));
    db.set(careerId, { revision: snapshot.revision, snapshot, commands: [...(existing?.commands ?? []), ...newCommands] });

    const data = { revision: snapshot.revision, syncedAt: '2026-01-01T00:00:00.000Z', verificationStatus: 'PENDING' };
    idempotency.set(cacheKey, data);
    return makeResponse(200, envelope(data));
  }

  async function handleGet(careerId: string): Promise<SyncTransportResponse> {
    const existing = db.get(careerId);
    if (existing === undefined) {
      return makeResponse(404, errorEnvelope('CAREER_NOT_FOUND', false));
    }
    return makeResponse(200, envelope({ snapshot: existing.snapshot, commands: existing.commands }));
  }

  const fetchFn = async (url: string, init: RequestInit): Promise<SyncTransportResponse> => {
    const careerId = careerIdFromUrl(url);
    if ((init.method ?? 'GET') === 'PUT') return handlePut(careerId, init);
    return handleGet(careerId);
  };

  return { fetchFn, db };
}

describe('sync 클라이언트 golden 통합', () => {
  it('career01 명령을 checkpoint마다 서버로 동기화하면 최종 revision이 golden과 같다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const server = createFakeServer();
    let idCounter = 0;

    const sync = createSyncClient({
      engine,
      store,
      fetch: server.fetchFn,
      baseUrl: '/v1',
      now: () => '2026-01-01T00:00:00.000Z',
      newId: () => `req-${idCounter++}`,
    });

    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(() => `cmd-${idCounter++}`);

    for (const command of commands) {
      const result = await engine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'season-2025-26' } : {}),
      });
      if (!result.ok) {
        throw new Error(`golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
      }
      sync.notifyCommitted(careerId, result.domainSnapshot);
      await sync.flush(careerId);
    }

    const finalState = sync.getState(careerId);
    expect(finalState).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: career01.golden.revision,
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
    });

    const serverRow = server.db.get(careerId);
    expect(serverRow?.revision).toBe(career01.golden.revision);
    expect(serverRow?.snapshot.stateHash).toBe(career01.golden.stateHash);
    expect(serverRow?.commands).toHaveLength(career01.golden.revision);

    const nextBody = await engine.buildSyncBody(careerId);
    expect(nextBody).toBeNull();
  });
});

/**
 * T-2-006: career01 뒤에 이어 career-02-season(FAST·CHAPTER)을 재생하는 명령 로그로 sync
 * 클라이언트·`replayCommandLog`·`forkCareerByReplay`·`importCareerFromServer`가 모두 golden과
 * 같은 hash를 내는지 검사한다(시즌 명령 START_SEASON·RESOLVE_ROLE·ADVANCE·SETTLE_SEASON 포함).
 */
function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function withoutCareerId(state: CareerState): Omit<CareerState, 'careerId'> {
  const rest: Partial<CareerState> = { ...state };
  delete rest.careerId;
  return rest as Omit<CareerState, 'careerId'>;
}

function buildCareer01ThenSeasonCommands(mode: SimulationMode): EngineCommand[] {
  const newId = makeIdGenerator(`golden-season-${mode}`);
  return [...career01EngineCommands(newId), ...career02SeasonEngineCommands(mode, newId, career01.golden.revision)];
}

type DuplicatePredicate = (command: EngineCommand) => boolean;

async function runCommandsOnFreshStore(
  commands: EngineCommand[],
  createdServiceSeasonId: string,
  careerId = career01.createCareer.careerId,
  options: { duplicate?: DuplicatePredicate } = {},
) {
  const store = new MemoryLocalStore();
  const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
  let duplicateResponse: Awaited<ReturnType<typeof engine.execute>> | null = null;

  for (const command of commands) {
    const result = await engine.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId } : {}),
    });
    if (!result.ok) {
      throw new Error(`시즌 golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
    }
    if (options.duplicate?.(command)) {
      duplicateResponse = await engine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId } : {}),
      });
      if (!duplicateResponse.ok) {
        throw new Error(`중복 명령 실패: ${command.type} ${duplicateResponse.error.code} ${duplicateResponse.error.message}`);
      }
      expect(duplicateResponse.replayed).toBe(true);
      expect(duplicateResponse.snapshot.stateHash).toBe(result.snapshot.stateHash);
    }
  }

  return { store, engine, careerId, duplicateResponse };
}

describe('시즌 명령을 포함한 golden: sync 클라이언트·replay·fork·import', () => {
  it.each(['FAST', 'CHAPTER'] as const)(
    '%s 모드: sync 클라이언트로 career01+시즌 전체를 동기화하면 최종 revision·hash가 golden과 같다',
    async (mode) => {
      const store = new MemoryLocalStore();
      const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
      const server = createFakeServer();
      let reqCounter = 0;

      const sync = createSyncClient({
        engine,
        store,
        fetch: server.fetchFn,
        baseUrl: '/v1',
        now: () => '2026-01-01T00:00:00.000Z',
        newId: () => `req-season-${reqCounter++}`,
      });

      const careerId = career01.createCareer.careerId;
      for (const command of buildCareer01ThenSeasonCommands(mode)) {
        const result = await engine.execute({
          careerId,
          command,
          ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'season-2025-26' } : {}),
        });
        if (!result.ok) {
          throw new Error(`시즌 golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
        }
        sync.notifyCommitted(careerId, result.domainSnapshot);
        await sync.flush(careerId);
      }

      const serverRow = server.db.get(careerId);
      expect(serverRow?.revision).toBe(career02Season.golden[mode].revision);
      expect(serverRow?.snapshot.stateHash).toBe(career02Season.golden[mode].stateHash);
    },
  );

  it.each(['FAST', 'CHAPTER'] as const)('%s 모드: replayCommandLog가 저장된 로그에서 golden과 같은 hash를 낸다', async (mode) => {
    const commands = buildCareer01ThenSeasonCommands(mode);
    const { store, careerId } = await runCommandsOnFreshStore(commands, 'season-2025-26');

    const entries = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    const result = await replayCommandLog(
      inlineSimulator,
      null,
      entries,
      { rulesetVersion: career01.rulesetVersion, contentPackVersion: career01.contentPackVersion },
      rulesetProto,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.snapshot.revision).toBe(career02Season.golden[mode].revision);
    expect(result.snapshot.stateHash).toBe(career02Season.golden[mode].stateHash);
  });

  it.each(['FAST', 'CHAPTER'] as const)(
    '%s 모드: forkCareerByReplay가 시즌 필드를 그대로 옮기고 careerId·hash만 다른 상태를 만든다',
    async (mode) => {
      const commands = buildCareer01ThenSeasonCommands(mode);
      const { store, engine, careerId } = await runCommandsOnFreshStore(commands, 'season-2025-26');

      const before = await engine.loadCareer(careerId);
      if (!before.ok) throw new Error('unreachable');

      const result = await forkCareerByReplay({ engine, store, newId: makeIdGenerator(`fork-season-${mode}`) }, careerId);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');

      const forked = await engine.loadCareer(result.newCareerId);
      if (!forked.ok) throw new Error('unreachable');

      expect(forked.snapshot.revision).toBe(career02Season.golden[mode].revision);
      expect(forked.snapshot.stateHash).not.toBe(before.snapshot.stateHash);
      // FootballSeason은 careerId를 담지 않으므로 fork 뒤에도 그대로 같아야 한다.
      expect(forked.snapshot.state.season).toEqual(before.snapshot.state.season);
      expect(forked.snapshot.state.seasonHistory).toEqual(before.snapshot.state.seasonHistory);
    },
  );

  it.each(['FAST', 'CHAPTER'] as const)('%s 모드: importCareerFromServer가 시즌 로그를 새 로컬 store로 복원한다', async (mode) => {
    const commands = buildCareer01ThenSeasonCommands(mode);
    const { store: sourceStore, careerId } = await runCommandsOnFreshStore(commands, 'season-2025-26');

    const snapshot = await sourceStore.transaction('readonly', (tx) => tx.snapshots.getLatest(careerId));
    const commandEntries = await sourceStore.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    if (!snapshot) throw new Error('스냅샷이 없다.');

    const targetStore = new MemoryLocalStore();
    const importResult = await importCareerFromServer(
      targetStore,
      { createdServiceSeasonId: 'season-2025-26', snapshot, commands: commandEntries },
      { createdServiceSeasonId: 'season-2025-26', now: '2026-01-01T00:00:00.000Z' },
    );

    expect(importResult.ok).toBe(true);
    if (!importResult.ok) throw new Error('unreachable');
    expect(importResult.revision).toBe(career02Season.golden[mode].revision);

    const restored = await targetStore.transaction('readonly', (tx) => tx.snapshots.getLatest(careerId));
    expect(restored?.stateHash).toBe(career02Season.golden[mode].stateHash);
  });
});

type MarketGoldenScenario = {
  label: string;
  careerId: string;
  versions: { rulesetVersion: string; contentPackVersion: string };
  golden: { revision: number; stateHash: string };
  makeCommands: () => EngineCommand[];
  duplicate: DuplicatePredicate;
};

const MARKET_GOLDEN_SCENARIOS: readonly MarketGoldenScenario[] = [
  {
    label: 'career-10-transfer',
    careerId: career10Transfer.createCareer.careerId,
    versions: career10Transfer,
    golden: career10Transfer.golden,
    makeCommands: () => career10TransferEngineCommands(makeIdGenerator('golden-transfer')),
    duplicate: (command) => command.type === 'ACCEPT_OFFER' && command.payload.offerId === 'OFR-16-1',
  },
  {
    label: 'career-11-loan',
    careerId: career11Loan.createCareer.careerId,
    versions: career11Loan,
    golden: career11Loan.golden,
    makeCommands: () => career11LoanEngineCommands(makeIdGenerator('golden-loan')),
    duplicate: (command) => command.type === 'LOAN_RETURN',
  },
];

async function buildGetCareerResponse(store: MemoryLocalStore, careerId: string): Promise<GetCareerResponse> {
  return store.transaction('readonly', async (tx) => {
    const snapshot = await tx.snapshots.getLatest(careerId);
    if (snapshot === undefined) throw new Error(`${careerId} snapshot 없음`);
    const commands = await tx.commandLog.listSince(careerId, 0);
    return { createdServiceSeasonId: 'season-2025-26', snapshot, commands: commands.slice().sort((a, b) => a.revision - b.revision) };
  });
}

describe('T-3-004 transfer·loan golden: replay·fork·import·중복 명령', () => {
  it.each(MARKET_GOLDEN_SCENARIOS)('$label의 최종 hash와 로그·checkpoint가 모든 경로에서 보존된다', async (scenario) => {
    const commands = scenario.makeCommands();
    const source = await runCommandsOnFreshStore(
      commands,
      `svc-${scenario.label}`,
      scenario.careerId,
      { duplicate: scenario.duplicate },
    );

    const loaded = await source.engine.loadCareer(scenario.careerId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error('unreachable');
    expect(loaded.snapshot.revision).toBe(scenario.golden.revision);
    expect(loaded.snapshot.stateHash).toBe(scenario.golden.stateHash);
    expect(loaded.snapshot.state.clubHistory.filter((stint) => stint.kind === 'PERMANENT' && stint.toSeasonIndex === null)).toHaveLength(1);
    expect(source.duplicateResponse?.ok).toBe(true);

    const commandEntries = await source.store.transaction('readonly', (tx) => tx.commandLog.listSince(scenario.careerId, 0));
    expect(commandEntries.map((entry) => entry.revision)).toEqual(commands.map((_, index) => index + 1));
    expect(commandEntries.map((entry) => entry.commandType)).toEqual(commands.map((command) => command.type));

    const snapshots = await source.store.transaction('readonly', (tx) => tx.snapshots.listByCareer(scenario.careerId));
    expect(snapshots).toHaveLength(commands.length);
    expect(snapshots.at(-1)?.checkpoint).toBe('SEASON_START');

    const replay = await replayCommandLog(
      inlineSimulator,
      null,
      commandEntries,
      scenario.versions,
      rulesetProto,
    );
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error('unreachable');
    expect(replay.snapshot.revision).toBe(scenario.golden.revision);
    expect(replay.snapshot.stateHash).toBe(scenario.golden.stateHash);

    const fork = await forkCareerByReplay(
      { engine: source.engine, store: source.store, newId: makeIdGenerator(`fork-${scenario.label}`) },
      scenario.careerId,
    );
    expect(fork.ok).toBe(true);
    if (!fork.ok) throw new Error('unreachable');
    const forked = await source.engine.loadCareer(fork.newCareerId);
    expect(forked.ok).toBe(true);
    if (!forked.ok) throw new Error('unreachable');
    expect(forked.snapshot.revision).toBe(scenario.golden.revision);
    expect(forked.snapshot.stateHash).not.toBe(scenario.golden.stateHash);
    expect(forked.snapshot.state.careerId).toBe(fork.newCareerId);
    expect(withoutCareerId(forked.snapshot.state)).toEqual(withoutCareerId(loaded.snapshot.state));

    const targetStore = new MemoryLocalStore();
    const imported = await importCareerFromServer(
      targetStore,
      await buildGetCareerResponse(source.store, scenario.careerId),
      { createdServiceSeasonId: `svc-${scenario.label}`, now: '2026-09-04T00:00:00.000Z' },
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error('unreachable');
    expect(imported.revision).toBe(scenario.golden.revision);
    const restored = await targetStore.transaction('readonly', (tx) => tx.snapshots.getLatest(scenario.careerId));
    expect(restored?.stateHash).toBe(scenario.golden.stateHash);
    expect(restored?.checkpoint).toBe('SEASON_START');
  });
});
