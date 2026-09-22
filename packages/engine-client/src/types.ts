import type { CareerSnapshot, ErrorCode, NextAction } from '@offside/contracts';
import type { Command, DomainSnapshot, Effect } from '@offside/domain';

export type LocalCareerRecord = {
  id: string;
  /** Absent only on historical client-owned saves. */
  authority?: 'CLIENT_LOCAL' | 'SERVER_ANNUAL';
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

export function isServerAnnual(career: {
  authority?: string;
  rulesetVersion: string;
  contentPackVersion: string;
}): boolean {
  return (
    career.authority === 'SERVER_ANNUAL' ||
    career.rulesetVersion === '3.5.0' ||
    career.contentPackVersion === '0.14.0'
  );
}

export type IdempotencyRecord = {
  commandId: string;
  careerId: string;
  revision: number;
  resultHash: string;
  response: ExecuteSuccess;
  createdAt: string;
  /** New records bind the ID to its full request. Absent only on pre-Phase-5 local records. */
  requestHash?: string;
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
