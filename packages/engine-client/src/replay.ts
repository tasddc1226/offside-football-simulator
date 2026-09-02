import type { CommandLogEntry } from '@offside/contracts';
import type { DomainSnapshot } from '@offside/domain';
import type { Simulator } from './simulator/index.js';
import type { EngineCommand } from './types.js';

export type ReplayResult =
  | { ok: true; snapshot: DomainSnapshot; replayed: number }
  | { ok: false; atRevision: number; reason: 'GAP' | 'SIMULATION_FAILED' | 'RESULT_HASH_MISMATCH'; details?: unknown };

/**
 * `CommandLogEntry`는 domain `Command`보다 넓은 `commandType`(12종)을 허용하지만 domain
 * `simulate`는 현재 3종만 구현한다. 로그에 실제로 쓰이는 항목은 항상 성공적으로 처리된
 * 명령이므로(엔진이 성공한 명령만 append한다) 이 경계에서 되돌리는 캐스팅은 안전하다.
 */
function toEngineCommand(entry: CommandLogEntry): EngineCommand {
  return {
    type: entry.commandType,
    payload: entry.payload,
    commandId: entry.commandId,
    expectedRevision: entry.revision - 1,
  } as unknown as EngineCommand;
}

/**
 * `entries`는 `(start?.revision ?? 0) + 1`부터 연속이어야 한다(아니면 GAP). 각 항목을 명령으로
 * 바꿔 순서대로 `simulate`하고, 결과 `stateHash`가 로그의 `resultHash`와 다르면
 * RESULT_HASH_MISMATCH다. ADR-003 리플레이 검증과 Snapshot 복구가 이 함수를 함께 쓴다.
 */
export async function replayCommandLog(
  simulator: Simulator,
  start: DomainSnapshot | null,
  entries: readonly CommandLogEntry[],
  versions: { rulesetVersion: string; contentPackVersion: string },
): Promise<ReplayResult> {
  let current = start;
  let expectedRevision = (start?.revision ?? 0) + 1;
  let replayed = 0;

  if (entries.length === 0) {
    if (current !== null) {
      return { ok: true, snapshot: current, replayed: 0 };
    }
    return { ok: false, atRevision: expectedRevision, reason: 'GAP' };
  }

  for (const entry of entries) {
    if (entry.revision !== expectedRevision) {
      return { ok: false, atRevision: expectedRevision, reason: 'GAP' };
    }

    const result = await simulator.simulate({
      snapshot: current,
      command: toEngineCommand(entry),
      rulesetVersion: versions.rulesetVersion,
      contentPackVersion: versions.contentPackVersion,
    });

    if (!result.ok) {
      return { ok: false, atRevision: entry.revision, reason: 'SIMULATION_FAILED', details: result.error };
    }
    if (result.snapshot.stateHash !== entry.resultHash) {
      return {
        ok: false,
        atRevision: entry.revision,
        reason: 'RESULT_HASH_MISMATCH',
        details: { expected: entry.resultHash, actual: result.snapshot.stateHash },
      };
    }

    current = result.snapshot;
    expectedRevision += 1;
    replayed += 1;
  }

  if (current === null) {
    return { ok: false, atRevision: expectedRevision, reason: 'GAP' };
  }

  return { ok: true, snapshot: current, replayed };
}
