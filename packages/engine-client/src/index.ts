export const ENGINE_CLIENT_VERSION = '0.1.0';

export type {
  EngineCommand,
  EngineError,
  ExecuteResult,
  ExecuteSuccess,
  IdempotencyRecord,
  LocalCareerRecord,
} from './types.js';

export { LocalStoreConstraintError, type LocalStore, type LocalStoreTx, type StoreMode } from './ports/local-store.js';

export { MemoryLocalStore } from './store/memory.js';

export { decodeSnapshot, encodeSnapshot, type DecodeFailure, type DecodeResult } from './snapshot.js';

export { inlineSimulator, type Simulator } from './simulator/index.js';

export {
  attachSimulatorHandler,
  type MessagePortLike,
  type SimulateReply,
  type SimulateRequest,
} from './worker/protocol.js';

export { createWorkerSimulator } from './worker/host.js';

export { replayCommandLog, type ReplayResult } from './replay.js';

export { forkCareerByReplay, type ForkDeps, type ForkResult } from './fork.js';

export { importCareerFromServer, type ImportCareerResult } from './import.js';

export {
  createEngineClient,
  type EngineClient,
  type EngineClientDeps,
  type ExecuteRequest,
  type LoadResult,
} from './engine.js';

export {
  createSyncClient,
  DEFAULT_SYNC_POLICY,
  type CareerSyncState,
  type SyncClient,
  type SyncDeps,
  type SyncPolicy,
  type SyncTransportResponse,
} from './sync/index.js';
