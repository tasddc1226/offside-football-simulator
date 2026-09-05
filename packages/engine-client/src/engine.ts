import type { CareerSnapshot, CommandLogEntry, PutCareerBody } from '@offside/contracts';
import { ArchiveError, canonicalize, sha256Hex, type JsonValue, type DomainSnapshot, type LegacyResult, type Ruleset } from '@offside/domain';
import { legacyVersionForResult, persistRetirementArchive, retirementArchiveKey, legacyResultKey, type RetirementArtifactsResolver, type RetirementRuntimeArtifacts } from './retirement-archive.js';
import { decodeSnapshot, encodeSnapshot } from './snapshot.js';
import { replayCommandLog } from './replay.js';
import type { Simulator } from './simulator/index.js';
import type {
  EngineCommand,
  EngineError,
  ExecuteResult,
  ExecuteSuccess,
  LocalCareerRecord,
} from './types.js';
import type { LocalStore } from './ports/local-store.js';

export type EngineClientDeps = {
  store: LocalStore;
  simulator: Simulator;
  /**
   * simulate()에 그대로 전달하는 룰셋. 버전별 선택·content 연동은 T-1-007·T-1-015에서 배선한다.
   * 이 단계에서는 이 EngineClient 인스턴스의 모든 simulate 호출에 같은 룰셋을 쓴다.
   */
  ruleset: Ruleset;
  now?: () => string;
  newId?: () => string;
  ownerProfileId?: () => string | null;
  /** Required for RETIRE: resolve checksums from bundled immutable artifacts, never user payload. */
  retirementArtifacts?: RetirementArtifactsResolver;
};

export type ExecuteRequest = { careerId: string; command: EngineCommand; createdServiceSeasonId?: string };

export type LoadResult =
  | { ok: true; career: LocalCareerRecord; snapshot: DomainSnapshot; recovered: { fromRevision: number; replayed: number } | null }
  | { ok: false; error: EngineError };

export interface EngineClient {
  execute(request: ExecuteRequest): Promise<ExecuteResult>;
  loadCareer(careerId: string): Promise<LoadResult>;
  listCareers(): Promise<LocalCareerRecord[]>;
  deleteCareer(careerId: string): Promise<void>;
  buildSyncBody(careerId: string): Promise<PutCareerBody | null>;
  markSynced(careerId: string, revision: number): Promise<void>;
}

type Versions = { rulesetVersion: string; contentPackVersion: string };

type RecoveryOutcome =
  | { ok: true; snapshot: DomainSnapshot; fromRevision: number; replayed: number }
  | { ok: false; atRevision: number; reason: 'GAP' | 'SIMULATION_FAILED' | 'RESULT_HASH_MISMATCH'; details?: unknown };

/**
 * 최신 Snapshot부터 거슬러 올라가며 정상인 Snapshot을 찾고, 그 뒤 명령 로그를 재생해 최신
 * 상태를 재구축한다. 트랜잭션 밖에서 호출해야 한다(`simulator.simulate`가 비동기).
 */
async function recoverLatestSnapshot(
  simulator: Simulator,
  snapshotsAscending: readonly CareerSnapshot[],
  commandLogEntries: readonly CommandLogEntry[],
  versions: Versions,
  ruleset: Ruleset,
): Promise<RecoveryOutcome> {
  let start: DomainSnapshot | null = null;
  let fromRevision = 0;

  for (let i = snapshotsAscending.length - 1; i >= 0; i--) {
    const candidate = snapshotsAscending[i]!;
    const decoded = decodeSnapshot(candidate);
    if (decoded.ok) {
      start = decoded.snapshot;
      fromRevision = candidate.revision;
      break;
    }
  }

  const entries = commandLogEntries
    .filter((entry) => entry.revision > fromRevision)
    .sort((a, b) => a.revision - b.revision);

  const replay = await replayCommandLog(simulator, start, entries, versions, ruleset);
  if (!replay.ok) {
    return { ok: false, atRevision: replay.atRevision, reason: replay.reason, details: replay.details };
  }
  return { ok: true, snapshot: replay.snapshot, fromRevision, replayed: replay.replayed };
}

function verificationFailedError(recovery: { atRevision: number; reason: string; details?: unknown }): EngineError {
  return {
    code: 'VERIFICATION_FAILED',
    message: `Snapshot 복구에 실패했다: ${recovery.reason} (revision ${recovery.atRevision})`,
    details: { atRevision: recovery.atRevision, reason: recovery.reason, details: recovery.details },
  };
}

type ReadOutcome =
  | { kind: 'idempotent'; response: ExecuteSuccess }
  | { kind: 'rejected'; error: EngineError }
  | { kind: 'ready'; career: LocalCareerRecord | undefined; versions: Versions; snapshot: DomainSnapshot | null }
  | {
      kind: 'needs-recovery';
      career: LocalCareerRecord;
      versions: Versions;
      priorSnapshots: CareerSnapshot[];
      commandLogEntries: CommandLogEntry[];
    };

export function createEngineClient(deps: EngineClientDeps): EngineClient {
  const store = deps.store;
  const simulator = deps.simulator;
  const ruleset = deps.ruleset;
  const now = deps.now ?? (() => new Date().toISOString());
  const ownerProfileId = deps.ownerProfileId ?? (() => null);

  const queues = new Map<string, Promise<unknown>>();

  function runQueued<T>(careerId: string, fn: () => Promise<T>): Promise<T> {
    const previous = queues.get(careerId) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    queues.set(careerId, settled);
    void settled.then(() => {
      if (queues.get(careerId) === settled) {
        queues.delete(careerId);
      }
    });
    return result;
  }

  async function doExecute(request: ExecuteRequest): Promise<ExecuteResult> {
    const { careerId, command } = request;
    const requestHash = sha256Hex(canonicalize({ careerId, command } as unknown as JsonValue));
    const reusedIdError: EngineError = {
      code: 'COMMAND_ALREADY_RESOLVED', message: '이미 사용한 commandId에 다른 요청을 보낼 수 없다.',
    };

    if (command.type === 'CREATE_CAREER' && !request.createdServiceSeasonId) {
      return {
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'CREATE_CAREER에는 createdServiceSeasonId가 필요하다.' },
      };
    }

    const readOutcome: ReadOutcome = await store.transaction('readonly', async (tx) => {
      const existing = await tx.idempotency.get(command.commandId);
      if (existing !== undefined) {
        if (existing.careerId !== careerId ||
          (existing.requestHash !== undefined && existing.requestHash !== requestHash) ||
          (command.type === 'RETIRE' && existing.requestHash === undefined)) {
          return { kind: 'rejected', error: reusedIdError };
        }
        return { kind: 'idempotent', response: { ...existing.response, replayed: true } };
      }

      const career = await tx.careers.get(careerId);

      if (command.type === 'CREATE_CAREER') {
        if (career !== undefined) {
          return {
            kind: 'rejected',
            error: { code: 'VALIDATION_FAILED', message: 'CREATE_CAREER: career가 이미 있다.' },
          };
        }
        return {
          kind: 'ready',
          career: undefined,
          snapshot: null,
          versions: {
            rulesetVersion: command.payload.rulesetVersion,
            contentPackVersion: command.payload.contentPackVersion,
          },
        };
      }

      if (career === undefined) {
        return { kind: 'rejected', error: { code: 'CAREER_NOT_FOUND', message: `career ${careerId}를 찾을 수 없다.` } };
      }
      if (career.status === 'ARCHIVED') {
        return { kind: 'rejected', error: { code: 'CAREER_ARCHIVED', message: 'career가 archived 상태다.' } };
      }
      if (career.revision !== command.expectedRevision) {
        return {
          kind: 'rejected',
          error: {
            code: 'CAREER_REVISION_CONFLICT',
            message: 'expectedRevision이 career.revision과 다르다.',
            details: { serverRevision: career.revision, expectedRevision: command.expectedRevision },
          },
        };
      }

      const versions: Versions = { rulesetVersion: career.rulesetVersion, contentPackVersion: career.contentPackVersion };
      const latest = await tx.snapshots.getLatest(careerId);
      if (latest !== undefined) {
        const decoded = decodeSnapshot(latest);
        if (decoded.ok) {
          return { kind: 'ready', career, versions, snapshot: decoded.snapshot };
        }
      }

      const priorSnapshots = await tx.snapshots.listByCareer(careerId);
      const commandLogEntries = await tx.commandLog.listSince(careerId, 0);
      return { kind: 'needs-recovery', career, versions, priorSnapshots, commandLogEntries };
    });

    if (readOutcome.kind === 'idempotent') return readOutcome.response;
    if (readOutcome.kind === 'rejected') return { ok: false, error: readOutcome.error };

    let baseSnapshot: DomainSnapshot | null;
    const versions = readOutcome.versions;

    if (readOutcome.kind === 'ready') {
      baseSnapshot = readOutcome.snapshot;
    } else {
      const recovery = await recoverLatestSnapshot(
        simulator,
        readOutcome.priorSnapshots,
        readOutcome.commandLogEntries,
        versions,
        ruleset,
      );
      if (!recovery.ok) {
        return { ok: false, error: verificationFailedError(recovery) };
      }
      baseSnapshot = recovery.snapshot;
    }

    const simResult = await simulator.simulate({
      snapshot: baseSnapshot,
      command,
      ruleset,
      rulesetVersion: versions.rulesetVersion,
      contentPackVersion: versions.contentPackVersion,
    });

    if (!simResult.ok) {
      return { ok: false, error: simResult.error };
    }

    let retirementArtifacts: RetirementRuntimeArtifacts | null = null;
    if (command.type === 'RETIRE' && simResult.snapshot.state.status === 'RETIRED') {
      if (deps.retirementArtifacts === undefined) {
        return { ok: false, error: { code: 'VERSION_MISMATCH', message: '은퇴 보관용 artifact registry가 필요하다.' } };
      }
      try {
        retirementArtifacts = deps.retirementArtifacts(versions);
      } catch {
        return { ok: false, error: { code: 'VERSION_MISMATCH', message: '이 커리어의 원본 artifact를 찾을 수 없다.' } };
      }
    }

    const createdAt = now();
    const careerSnapshot = encodeSnapshot(simResult.snapshot, { careerId, createdAt });

    const writeOutcome = await store.transaction('readwrite', async (tx) => {
      const existing = await tx.idempotency.get(command.commandId);
      if (existing !== undefined) {
        if (existing.careerId !== careerId ||
          (existing.requestHash !== undefined && existing.requestHash !== requestHash) ||
          (command.type === 'RETIRE' && existing.requestHash === undefined)) {
          return { kind: 'rejected', error: reusedIdError } as const;
        }
        return { kind: 'idempotent', response: existing.response } as const;
      }

      const currentCareer = await tx.careers.get(careerId);

      if (command.type === 'CREATE_CAREER') {
        if (currentCareer !== undefined) {
          return {
            kind: 'rejected',
            error: { code: 'VALIDATION_FAILED', message: 'CREATE_CAREER: career가 이미 있다.' },
          } as const;
        }
      } else if (currentCareer === undefined || currentCareer.revision !== command.expectedRevision) {
        return {
          kind: 'rejected',
          error: {
            code: 'CAREER_REVISION_CONFLICT',
            message: 'expectedRevision이 career.revision과 다르다.',
            details: { serverRevision: currentCareer?.revision ?? 0, expectedRevision: command.expectedRevision },
          },
        } as const;
      }

      if (retirementArtifacts !== null && currentCareer !== undefined) {
        await persistRetirementArchive(tx, currentCareer, simResult.snapshot, retirementArtifacts);
      }
      await tx.snapshots.put(careerSnapshot);
      await tx.commandLog.append({
        careerId,
        revision: simResult.snapshot.revision,
        commandId: command.commandId,
        commandType: command.type,
        payload: command.payload as Record<string, unknown>,
        resultHash: simResult.snapshot.stateHash,
        createdAt,
      });

      const nextCareerRecord: LocalCareerRecord =
        command.type === 'CREATE_CAREER'
          ? {
              id: careerId,
              ownerProfileId: ownerProfileId(),
              status: simResult.snapshot.state.status,
              revision: simResult.snapshot.revision,
              lastSyncedRevision: 0,
              createdServiceSeasonId: request.createdServiceSeasonId as string,
              rulesetVersion: command.payload.rulesetVersion,
              contentPackVersion: command.payload.contentPackVersion,
              createdAt,
              updatedAt: createdAt,
            }
          : { ...currentCareer!, status: simResult.snapshot.state.status, revision: simResult.snapshot.revision, updatedAt: createdAt };

      await tx.careers.put(nextCareerRecord);

      const response: ExecuteSuccess = {
        ok: true,
        snapshot: careerSnapshot,
        domainSnapshot: simResult.snapshot,
        nextAction: simResult.nextAction,
        ...(simResult.roll !== undefined ? { roll: simResult.roll } : {}),
        ...(simResult.outcomeId !== undefined ? { outcomeId: simResult.outcomeId } : {}),
        appliedEffects: simResult.appliedEffects,
        replayed: false,
      };

      await tx.idempotency.put({
        commandId: command.commandId,
        careerId,
        revision: simResult.snapshot.revision,
        resultHash: simResult.snapshot.stateHash,
        response,
        createdAt,
        requestHash,
      });

      return { kind: 'success', response } as const;
    });

    if (writeOutcome.kind === 'idempotent') {
      return { ...writeOutcome.response, replayed: true };
    }
    if (writeOutcome.kind === 'rejected') {
      return { ok: false, error: writeOutcome.error };
    }
    return writeOutcome.response;
  }

  async function execute(request: ExecuteRequest): Promise<ExecuteResult> {
    return runQueued(request.careerId, async () => {
      try {
        return await doExecute(request);
      } catch (error) {
        if (error instanceof ArchiveError) {
          return { ok: false, error: { code: 'VERIFICATION_FAILED', message: error.message } };
        }
        throw error;
      }
    });
  }

  async function loadCareer(careerId: string): Promise<LoadResult> {
    const readOutcome = await store.transaction('readonly', async (tx) => {
      const career = await tx.careers.get(careerId);
      if (career === undefined) {
        return { kind: 'not-found' } as const;
      }

      const latest = await tx.snapshots.getLatest(careerId);
      if (latest !== undefined) {
        const decoded = decodeSnapshot(latest);
        if (decoded.ok) {
          return { kind: 'healthy', career, snapshot: decoded.snapshot } as const;
        }
      }

      const priorSnapshots = await tx.snapshots.listByCareer(careerId);
      const commandLogEntries = await tx.commandLog.listSince(careerId, 0);
      return { kind: 'broken', career, priorSnapshots, commandLogEntries } as const;
    });

    if (readOutcome.kind === 'not-found') {
      return { ok: false, error: { code: 'CAREER_NOT_FOUND', message: `career ${careerId}를 찾을 수 없다.` } };
    }
    if (readOutcome.kind === 'healthy') {
      return { ok: true, career: readOutcome.career, snapshot: readOutcome.snapshot, recovered: null };
    }

    const versions: Versions = {
      rulesetVersion: readOutcome.career.rulesetVersion,
      contentPackVersion: readOutcome.career.contentPackVersion,
    };
    const recovery = await recoverLatestSnapshot(
      simulator,
      readOutcome.priorSnapshots,
      readOutcome.commandLogEntries,
      versions,
      ruleset,
    );
    if (!recovery.ok) {
      return { ok: false, error: verificationFailedError(recovery) };
    }
    if (recovery.snapshot.revision !== readOutcome.career.revision) {
      return {
        ok: false,
        error: verificationFailedError({
          atRevision: recovery.snapshot.revision,
          reason: 'REVISION_MISMATCH',
          details: { careerRevision: readOutcome.career.revision },
        }),
      };
    }

    const createdAt = now();
    const rebuilt = encodeSnapshot(recovery.snapshot, { careerId, createdAt });
    await store.transaction('readwrite', (tx) => tx.snapshots.put(rebuilt));

    return {
      ok: true,
      career: readOutcome.career,
      snapshot: recovery.snapshot,
      recovered: { fromRevision: recovery.fromRevision, replayed: recovery.replayed },
    };
  }

  async function listCareers(): Promise<LocalCareerRecord[]> {
    return store.transaction('readonly', (tx) => tx.careers.list());
  }

  async function deleteCareer(careerId: string): Promise<void> {
    await store.transaction('readwrite', async (tx) => {
      await tx.careers.delete(careerId);
      await tx.snapshots.deleteByCareer(careerId);
      await tx.commandLog.deleteByCareer(careerId);
      await tx.idempotency.deleteByCareer(careerId);
      await tx.kv.delete(retirementArchiveKey(careerId));
      await tx.kv.delete(legacyResultKey(careerId));
    });
  }

  async function buildSyncBody(careerId: string): Promise<PutCareerBody | null> {
    return store.transaction('readonly', async (tx) => {
      const career = await tx.careers.get(careerId);
      if (career === undefined) {
        throw new Error(`buildSyncBody: career ${careerId}를 찾을 수 없다.`);
      }

      const commands = await tx.commandLog.listSince(careerId, career.lastSyncedRevision);
      if (commands.length === 0) {
        return null;
      }

      const latest = await tx.snapshots.getLatest(careerId);
      if (latest === undefined) {
        throw new Error(`buildSyncBody: career ${careerId}의 최신 Snapshot이 없다.`);
      }

      const legacy = career.status === 'RETIRED'
        ? await tx.kv.get<LegacyResult>(legacyResultKey(careerId))
        : undefined;
      const referencePopulationId = legacy?.referencePopulationId ?? null;
      const legacyVersion = legacy === undefined
        ? '1.0.0'
        : legacyVersionForResult(legacy, {
            legacyVersion: legacy.legacyVersion,
          });
      if (career.status === 'RETIRED' && referencePopulationId !== null &&
        (typeof referencePopulationId !== 'string' || referencePopulationId.trim().length === 0)) {
        throw new Error(`buildSyncBody: career ${careerId}의 referencePopulationId가 유효하지 않다.`);
      }

      return {
        baseRevision: career.lastSyncedRevision,
        snapshot: {
          revision: latest.revision,
          checkpoint: latest.checkpoint,
          state: latest.state,
          stateHash: latest.stateHash,
          rulesetVersion: latest.rulesetVersion,
          contentPackVersion: latest.contentPackVersion,
          rngState: latest.rngState,
        },
        commands: commands.map((entry) => ({
          revision: entry.revision,
          commandId: entry.commandId,
          commandType: entry.commandType,
          payload: entry.payload,
          resultHash: entry.resultHash,
        })),
        createdServiceSeasonId: career.createdServiceSeasonId,
        rulesetVersion: career.rulesetVersion,
        contentPackVersion: career.contentPackVersion,
        ...(career.status === 'RETIRED'
          ? { retirementReferencePopulationId: referencePopulationId, retirementLegacyVersion: legacyVersion }
          : {}),
      };
    });
  }

  async function markSynced(careerId: string, revision: number): Promise<void> {
    await store.transaction('readwrite', async (tx) => {
      const career = await tx.careers.get(careerId);
      if (career === undefined) {
        throw new Error(`markSynced: career ${careerId}를 찾을 수 없다.`);
      }
      await tx.careers.put({ ...career, lastSyncedRevision: Math.max(career.lastSyncedRevision, revision) });
    });
  }

  return { execute, loadCareer, listCareers, deleteCareer, buildSyncBody, markSynced };
}
