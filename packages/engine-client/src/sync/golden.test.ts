import {
  IDEMPOTENCY_KEY_HEADER,
  IF_MATCH_HEADER,
  type CareerSnapshot,
  type CommandLogEntry,
  type PutCareerBody,
} from '@offside/contracts';
import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../engine.js';
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
