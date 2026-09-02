import type { CareerSnapshot, ErrorCode, NextAction } from '@offside/contracts';
import type { Command, DomainSnapshot, Effect } from '@offside/domain';

export type LocalCareerRecord = {
  id: string;
  ownerProfileId: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED' | 'ARCHIVED';
  revision: number;
  lastSyncedRevision: number;
  createdServiceSeasonId: string;
  rulesetVersion: string;
  contentPackVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type IdempotencyRecord = {
  commandId: string;
  careerId: string;
  revision: number;
  resultHash: string;
  response: ExecuteSuccess;
  createdAt: string;
};

export type EngineCommand = Command & { commandId: string; expectedRevision: number };

export type EngineError = { code: ErrorCode; message: string; details?: unknown };

export type ExecuteSuccess = {
  ok: true;
  snapshot: CareerSnapshot;
  domainSnapshot: DomainSnapshot;
  nextAction: NextAction;
  roll?: number;
  outcomeId?: string;
  appliedEffects: Effect[];
  replayed: boolean;
};

export type ExecuteResult = ExecuteSuccess | { ok: false; error: EngineError };
