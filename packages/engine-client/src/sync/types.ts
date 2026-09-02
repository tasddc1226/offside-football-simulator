import type { CareerSnapshot, CheckpointType } from '@offside/contracts';
import type { DomainSnapshot } from '@offside/domain';
import type { EngineClient } from '../engine.js';
import type { LocalStore } from '../ports/local-store.js';
import type { EngineError } from '../types.js';

export type SyncTransportResponse = { status: number; headers: Headers; json(): Promise<unknown> };

export type SyncPolicy = {
  debounceMs: number;
  immediateCheckpoints: readonly CheckpointType[];
  retryBaseMs: number;
  retryMaxMs: number;
  retryMaxAttempts: number;
};

export type SyncDeps = {
  engine: Pick<EngineClient, 'buildSyncBody' | 'markSynced' | 'loadCareer'>;
  store: LocalStore;
  fetch: (url: string, init: RequestInit) => Promise<SyncTransportResponse>;
  baseUrl: string;
  now: () => string;
  newId: () => string;
  timers?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
  policy?: Partial<SyncPolicy>;
  online?: () => boolean;
};

export type CareerSyncState =
  | { kind: 'IDLE'; lastSyncedRevision: number; lastSyncedAt: string | null }
  | { kind: 'SCHEDULED'; dueAt: number }
  | { kind: 'SYNCING'; attempt: number }
  | { kind: 'RETRYING'; attempt: number; nextAt: number; lastError: EngineError }
  | { kind: 'OFFLINE'; pendingSince: string }
  | { kind: 'LOCAL_ONLY'; reason: 'NO_SESSION' | 'COOKIE_BLOCKED' }
  | {
      kind: 'CONFLICT';
      local: { revision: number; stateHash: string };
      server: { revision: number; stateHash: string; snapshot: CareerSnapshot };
    }
  | { kind: 'FAILED'; error: EngineError };

export interface SyncClient {
  notifyCommitted(careerId: string, snapshot: DomainSnapshot): void;
  flush(careerId?: string): Promise<void>;
  getState(careerId: string): CareerSyncState;
  subscribe(listener: (careerId: string, state: CareerSyncState) => void): () => void;
  resolveConflict(careerId: string, choice: 'REMOTE'): Promise<void>;
  dispose(): void;
}

export const DEFAULT_SYNC_POLICY: SyncPolicy = {
  debounceMs: 1500,
  immediateCheckpoints: ['CAREER_CREATED', 'SEASON_SETTLED', 'CONTRACT_CONFIRMED', 'RETIREMENT'],
  retryBaseMs: 2000,
  retryMaxMs: 60000,
  retryMaxAttempts: 0,
};
