import { canonicalize, type JsonValue } from '../canonical.js';
import { hashState, sha256Hex } from '../hash.js';
import type { CareerState, DomainSnapshot } from '../types.js';
import { aggregateCareerRecords, type CareerRecords } from './career-records.js';

export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

/** Supplied by the owning Career repository, never the current ACTIVE service-season pointer. */
export type ArchiveCareerBinding = Readonly<{
  careerId: string;
  createdServiceSeasonId: string;
  rulesetVersion: string;
  contentPackVersion: string;
}>;

/** Resolved from the immutable artifact registry, not trusted from a client upload. */
export type ArchiveArtifacts = Readonly<{
  rulesetVersion: string;
  rulesetChecksum: string;
  contentPackVersion: string;
  contentPackChecksum: string;
}>;

export type ArchiveContext = Readonly<{
  binding: ArchiveCareerBinding;
  artifacts: ArchiveArtifacts;
}>;

/** Internal evidence only: source.state contains private simulation data, not a public player DTO. */
export type CareerArchiveCore = DeepReadonly<{
  archiveSchemaVersion: 1;
  archiveBuilderVersion: '1.0.0';
  archiveId: string;
  binding: ArchiveCareerBinding;
  artifacts: ArchiveArtifacts;
  source: { revision: number; checkpoint: 'RETIREMENT'; stateHash: string; state: string };
  records: CareerRecords;
  hash: string;
}>;

export type ArchiveErrorCode =
  | 'INVALID_BINDING'
  | 'VERSION_MISMATCH'
  | 'UNSUPPORTED_SCHEMA'
  | 'UNSUPPORTED_BUILDER'
  | 'INVALID_SNAPSHOT'
  | 'RETIREMENT_REQUIRED'
  | 'UNFINISHED_CAREER'
  | 'INCOMPLETE_HISTORY'
  | 'ARCHIVE_MISMATCH'
  | 'ARCHIVE_CONFLICT'
  | 'LEGACY_DEFINITION_CONFLICT';

export class ArchiveError extends Error {
  constructor(readonly code: ArchiveErrorCode) {
    super(`Archive: ${code}`);
    this.name = 'ArchiveError';
  }
}

function requireThat(condition: boolean, code: ArchiveErrorCode): asserts condition {
  if (!condition) throw new ArchiveError(code);
}

function canonical(value: unknown): string {
  return canonicalize(value as JsonValue);
}

function freezeTree<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function detached<T>(value: T): DeepReadonly<T> {
  return freezeTree(JSON.parse(canonical(value)) as T);
}

export function requireArchiveVersion(version: string): void {
  requireThat(typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version), 'INVALID_BINDING');
}

export function requireArtifactChecksum(checksum: string): void {
  requireThat(typeof checksum === 'string' && /^[a-f0-9]{64}$/.test(checksum), 'INVALID_BINDING');
}

function validateContext({ binding, artifacts }: ArchiveContext): void {
  requireThat(
    typeof binding.careerId === 'string' && binding.careerId.trim().length > 0,
    'INVALID_BINDING',
  );
  requireThat(
    typeof binding.createdServiceSeasonId === 'string' &&
      binding.createdServiceSeasonId.trim().length > 0,
    'INVALID_BINDING',
  );
  for (const version of [
    binding.rulesetVersion,
    binding.contentPackVersion,
    artifacts.rulesetVersion,
    artifacts.contentPackVersion,
  ])
    requireArchiveVersion(version);
  requireArtifactChecksum(artifacts.rulesetChecksum);
  requireArtifactChecksum(artifacts.contentPackChecksum);
  requireThat(
    binding.rulesetVersion === artifacts.rulesetVersion &&
      binding.contentPackVersion === artifacts.contentPackVersion,
    'VERSION_MISMATCH',
  );
}

/** Fail closed if a settled season disappeared, duplicated, or disagrees with timeline revisions. */
function validateHistory(state: CareerState, retirementRevision: number): void {
  let previousRevision = 0;
  for (const entry of state.timeline) {
    requireThat(
      Number.isSafeInteger(entry.revision) &&
        entry.revision >= previousRevision &&
        entry.revision > 0 &&
        entry.revision <= retirementRevision,
      'INCOMPLETE_HISTORY',
    );
    previousRevision = entry.revision;
  }
  const starts = state.timeline.filter((entry) => entry.kind === 'SEASON_STARTED');
  const settlements = state.timeline.filter((entry) => entry.kind === 'SEASON_SETTLED');
  requireThat(
    starts.length === state.seasonHistory.length &&
      settlements.length === state.seasonHistory.length,
    'INCOMPLETE_HISTORY',
  );
  let previousSettlement = 0;
  state.seasonHistory.forEach((season, index) => {
    const start = starts[index]!;
    const settlement = settlements[index]!;
    requireThat(
      season.index === index + 1 &&
        start.revision > previousSettlement &&
        settlement.revision > start.revision &&
        settlement.revision === season.settledAtRevision &&
        settlement.revision < retirementRevision,
      'INCOMPLETE_HISTORY',
    );
    previousSettlement = settlement.revision;
  });
}

/**
 * Builds from a contracts-validated retirement Snapshot. Does not retire an active Career, look up
 * current service season, mint rewards, use a clock/RNG, or persist anything. RETIRE remains T-5-003.
 */
export function createCareerArchiveCore(
  snapshot: DomainSnapshot,
  context: ArchiveContext,
): CareerArchiveCore {
  validateContext(context);
  const { state } = snapshot;
  requireThat(state.schemaVersion === 1, 'UNSUPPORTED_SCHEMA');
  requireThat(Number.isSafeInteger(snapshot.revision) && snapshot.revision > 0, 'INVALID_SNAPSHOT');
  requireThat(state.careerId === context.binding.careerId, 'INVALID_BINDING');
  requireThat(
    snapshot.rulesetVersion === state.rulesetVersion &&
      state.rulesetVersion === context.binding.rulesetVersion &&
      snapshot.contentPackVersion === state.contentPackVersion &&
      state.contentPackVersion === context.binding.contentPackVersion,
    'VERSION_MISMATCH',
  );
  requireThat(hashState(state) === snapshot.stateHash, 'INVALID_SNAPSHOT');
  requireThat(
    snapshot.checkpoint === 'RETIREMENT' && state.status === 'RETIRED',
    'RETIREMENT_REQUIRED',
  );
  requireThat(
    state.pending === null && state.season === null && state.player.profile !== null,
    'UNFINISHED_CAREER',
  );
  validateHistory(state, snapshot.revision);
  const records = aggregateCareerRecords(state.seasonHistory);
  const body = {
    archiveSchemaVersion: 1 as const,
    archiveBuilderVersion: '1.0.0' as const,
    archiveId: `arc_${sha256Hex(canonical({ careerId: state.careerId, archiveSchemaVersion: 1 }))}`,
    binding: {
      careerId: context.binding.careerId,
      createdServiceSeasonId: context.binding.createdServiceSeasonId,
      rulesetVersion: context.binding.rulesetVersion,
      contentPackVersion: context.binding.contentPackVersion,
    },
    artifacts: {
      rulesetVersion: context.artifacts.rulesetVersion,
      rulesetChecksum: context.artifacts.rulesetChecksum,
      contentPackVersion: context.artifacts.contentPackVersion,
      contentPackChecksum: context.artifacts.contentPackChecksum,
    },
    source: {
      revision: snapshot.revision,
      checkpoint: 'RETIREMENT' as const,
      stateHash: snapshot.stateHash,
      state: canonical(state),
    },
    records,
  };
  return detached({ ...body, hash: sha256Hex(canonical(body)) });
}

/** Rebuilds derived totals from the original state; a recomputed outer hash cannot bless false totals. */
export function verifyCareerArchiveCore(
  archive: CareerArchiveCore,
  context: ArchiveContext,
): { ok: true } | { ok: false; code: ArchiveErrorCode } {
  try {
    requireThat(archive.archiveSchemaVersion === 1, 'UNSUPPORTED_SCHEMA');
    requireThat(archive.archiveBuilderVersion === '1.0.0', 'UNSUPPORTED_BUILDER');
    const state = JSON.parse(archive.source.state) as CareerState;
    const rebuilt = createCareerArchiveCore(
      {
        state,
        revision: archive.source.revision,
        checkpoint: archive.source.checkpoint,
        stateHash: archive.source.stateHash,
        rulesetVersion: archive.binding.rulesetVersion,
        contentPackVersion: archive.binding.contentPackVersion,
      },
      context,
    );
    requireThat(canonical(rebuilt) === canonical(archive), 'ARCHIVE_MISMATCH');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof ArchiveError ? error.code : 'INVALID_SNAPSHOT' };
  }
}

export type ArchiveWritePlan = Readonly<{ kind: 'INSERT' | 'REUSE'; archive: CareerArchiveCore }>;

/**
 * Pure write policy, NOT a database lock. Adapter must INSERT IF ABSENT atomically, then reload and
 * re-evaluate this policy on a unique-key conflict. Different content never overwrites the first row.
 */
export function planCareerArchiveWrite(
  existing: CareerArchiveCore | null,
  candidate: CareerArchiveCore,
  context: ArchiveContext,
): ArchiveWritePlan {
  for (const archive of existing === null ? [candidate] : [existing, candidate]) {
    const verified = verifyCareerArchiveCore(archive, context);
    if (!verified.ok) throw new ArchiveError(verified.code);
  }
  if (existing === null) return Object.freeze({ kind: 'INSERT', archive: detached(candidate) });
  requireThat(canonical(existing) === canonical(candidate), 'ARCHIVE_CONFLICT');
  return Object.freeze({ kind: 'REUSE', archive: detached(existing) });
}
