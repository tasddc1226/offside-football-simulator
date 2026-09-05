import { runSettledFixture } from '../../__fixtures__/career-06-settled.js';
import { hashState } from '../../hash.js';
import type { DomainSnapshot } from '../../types.js';
import type { ArchiveContext } from '../archive.js';

export type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
export function copy<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>;
}

const settled = runSettledFixture().snapshot;

/** Explicitly synthetic archive-unit-test boundary; actual RETIRE is tested separately. */
export function archiveFixture(): { snapshot: DomainSnapshot; context: ArchiveContext } {
  const snapshot = copy(settled);
  snapshot.revision++;
  snapshot.checkpoint = 'RETIREMENT';
  snapshot.state.status = 'RETIRED';
  snapshot.state.pending = null;
  snapshot.stateHash = hashState(snapshot.state);
  const context: ArchiveContext = {
    binding: {
      careerId: snapshot.state.careerId,
      createdServiceSeasonId: 'svc_archived_fixture',
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
    },
    // Registry fixtures, not production artifact checksums.
    artifacts: {
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
      rulesetChecksum: 'a'.repeat(64),
      contentPackChecksum: 'b'.repeat(64),
    },
  };
  return { snapshot, context };
}

export function rehash(snapshot: DomainSnapshot): DomainSnapshot {
  snapshot.stateHash = hashState(snapshot.state);
  return snapshot;
}
