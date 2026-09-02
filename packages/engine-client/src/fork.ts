import type { Command } from '@offside/domain';
import type { CommandLogEntry } from '@offside/contracts';
import type { EngineClient, ExecuteRequest } from './engine.js';
import type { LocalStore } from './ports/local-store.js';
import type { EngineCommand, EngineError } from './types.js';

export type ForkResult =
  | { ok: true; newCareerId: string; revision: number }
  | { ok: false; error: EngineError };

export type ForkDeps = {
  engine: EngineClient;
  store: LocalStore;
  newId: () => string;
};

/**
 * 로그가 revision 1부터 빈틈없이 이어지고 첫 항목이 CREATE_CAREER인지 확인한다. 문제가 있는
 * 가장 앞선 revision을 돌려주고(없다고 봐야 하는 경우 1), 이상 없으면 null.
 */
function findLogGap(entries: readonly CommandLogEntry[]): number | null {
  if (entries.length === 0) return 1;
  if (entries[0]!.revision !== 1 || entries[0]!.commandType !== 'CREATE_CAREER') return 1;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.revision !== i + 1) return i + 1;
  }
  return null;
}

function forkLogIncompleteError(atRevision: number): EngineError {
  return {
    code: 'VERIFICATION_FAILED',
    message: '이 기기에 명령 기록이 다 남아 있지 않아 복사할 수 없다.',
    details: { reason: 'FORK_LOG_INCOMPLETE', atRevision },
  };
}

/**
 * 로컬 명령 로그 전체를 새 careerId로 엔진에서 재실행한다(결정론이라 결과 state는 careerId만
 * 다르다). 원본은 어떤 경우에도 건드리지 않는다. `execute`는 자체 트랜잭션을 여므로 읽기
 * 트랜잭션 밖에서 호출한다.
 */
export async function forkCareerByReplay(deps: ForkDeps, careerId: string): Promise<ForkResult> {
  const read = await deps.store.transaction('readonly', async (tx) => {
    const career = await tx.careers.get(careerId);
    if (career === undefined) {
      return { kind: 'not-found' } as const;
    }
    const entries = (await tx.commandLog.listSince(careerId, 0)).slice().sort((a, b) => a.revision - b.revision);
    return { kind: 'found', career, entries } as const;
  });

  if (read.kind === 'not-found') {
    return { ok: false, error: { code: 'CAREER_NOT_FOUND', message: `career ${careerId}를 찾을 수 없다.` } };
  }

  const { career, entries } = read;
  const gapAt = findLogGap(entries);
  if (gapAt !== null) {
    return { ok: false, error: forkLogIncompleteError(gapAt) };
  }

  const newCareerId = deps.newId();

  for (const entry of entries) {
    const payload =
      entry.commandType === 'CREATE_CAREER' ? { ...entry.payload, careerId: newCareerId } : entry.payload;
    const command = { type: entry.commandType, payload } as Command;
    const engineCommand: EngineCommand = {
      ...command,
      commandId: deps.newId(),
      expectedRevision: entry.revision - 1,
    };
    const request: ExecuteRequest = {
      careerId: newCareerId,
      command: engineCommand,
      ...(entry.commandType === 'CREATE_CAREER' ? { createdServiceSeasonId: career.createdServiceSeasonId } : {}),
    };

    const result = await deps.engine.execute(request);
    if (!result.ok) {
      await deps.engine.deleteCareer(newCareerId);
      return { ok: false, error: result.error };
    }
  }

  return { ok: true, newCareerId, revision: entries[entries.length - 1]!.revision };
}
