import { describe, expect, it } from 'vitest';
import { runCareerFixture } from '../__fixtures__/career-01.js';
import { canonicalize, utf8Encode, type JsonValue } from '../canonical.js';
import { hashState, sha256Hex } from '../hash.js';
import { hashSeasonResult } from '../settlement.js';
import type { CareerState, CareerStatus, DomainSnapshot } from '../types.js';
import { archiveFixture, copy, rehash } from './__fixtures__/archive.js';
import {
  ArchiveError,
  createCareerArchiveCore,
  planCareerArchiveWrite,
  verifyCareerArchiveCore,
  type CareerArchiveCore,
} from './archive.js';

function canonical(value: unknown): string {
  return canonicalize(value as JsonValue);
}
function outerRehash(archive: CareerArchiveCore): CareerArchiveCore {
  const { hash: _hash, ...body } = archive;
  void _hash;
  return { ...body, hash: sha256Hex(canonical(body)) };
}

describe('Phase 5 — immutable retirement Archive core', () => {
  it('preserves original service season, artifacts, raw source and record evidence', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    expect(archive.binding).toEqual(context.binding);
    expect(archive.artifacts).toEqual(context.artifacts);
    expect(archive.source).toEqual({
      revision: snapshot.revision,
      checkpoint: 'RETIREMENT',
      stateHash: snapshot.stateHash,
      state: canonical(snapshot.state),
    });
    expect(archive.records.totals.seasons).toBe(1);
    expect(archive.records.sources[0]?.resultHash).toBe(
      snapshot.state.seasonHistory[0]?.result.hash,
    );
    expect(verifyCareerArchiveCore(archive, context)).toEqual({ ok: true });
  });

  it('fully detaches and recursively freezes the output', () => {
    const { snapshot, context } = archiveFixture();
    const before = canonical(snapshot);
    const archive = createCareerArchiveCore(snapshot, context);
    expect(Object.isFrozen(archive)).toBe(true);
    expect(Object.isFrozen(archive.records.clubs[0]?.seasonIndices)).toBe(true);
    expect(Object.isFrozen(archive.artifacts)).toBe(true);
    expect(canonical(snapshot)).toBe(before);
    snapshot.state.seasonHistory[0]!.result.playerStats.minutes++;
    expect(archive.source.state).toBe(canonical((JSON.parse(before) as DomainSnapshot).state));
    expect(archive.records.totals.minutes).not.toBe(
      snapshot.state.seasonHistory[0]!.result.playerStats.minutes,
    );
  });

  it.each(['ACTIVE', 'DRAFT', 'ARCHIVED'] as CareerStatus[])(
    'rejects %s instead of retiring as a side effect',
    (status) => {
      const { snapshot, context } = archiveFixture();
      snapshot.state.status = status;
      expect(() => createCareerArchiveCore(rehash(snapshot), context)).toThrow(
        'RETIREMENT_REQUIRED',
      );
      expect(snapshot.state.status).toBe(status);
    },
  );

  it('requires the retirement checkpoint and valid source hash', () => {
    const { snapshot, context } = archiveFixture();
    snapshot.checkpoint = 'SEASON_SETTLED';
    expect(() => createCareerArchiveCore(snapshot, context)).toThrow('RETIREMENT_REQUIRED');
    snapshot.checkpoint = 'RETIREMENT';
    snapshot.state.age++;
    expect(() => createCareerArchiveCore(snapshot, context)).toThrow('INVALID_SNAPSHOT');
  });

  it('refuses pending choices, an unconfirmed player, and an unfinished season', () => {
    const { snapshot, context } = archiveFixture();
    snapshot.state.pending = { kind: 'SETTLEMENT', step: 12 };
    expect(() => createCareerArchiveCore(rehash(snapshot), context)).toThrow('UNFINISHED_CAREER');
    snapshot.state.pending = null;
    snapshot.state.player.profile = null;
    expect(() => createCareerArchiveCore(rehash(snapshot), context)).toThrow('UNFINISHED_CAREER');
    const other = archiveFixture();
    // Only null-ness is under test; invalid structured season data would also require contracts rejection.
    other.snapshot.state.season = {} as NonNullable<CareerState['season']>;
    expect(() => createCareerArchiveCore(rehash(other.snapshot), other.context)).toThrow(
      'UNFINISHED_CAREER',
    );
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid retirement revision %s', (revision) => {
    const { snapshot, context } = archiveFixture();
    snapshot.revision = revision;
    expect(() => createCareerArchiveCore(snapshot, context)).toThrow('INVALID_SNAPSHOT');
  });

  it('rejects unknown schema rather than applying current defaults', () => {
    const { snapshot, context } = archiveFixture();
    snapshot.state.schemaVersion = 2 as 1;
    expect(() => createCareerArchiveCore(rehash(snapshot), context)).toThrow('UNSUPPORTED_SCHEMA');
  });

  it('rejects a different Career identity and missing service-season identity', () => {
    const { snapshot, context } = archiveFixture();
    expect(() =>
      createCareerArchiveCore(snapshot, {
        ...context,
        binding: { ...context.binding, careerId: 'another' },
      }),
    ).toThrow('INVALID_BINDING');
    expect(() =>
      createCareerArchiveCore(snapshot, {
        ...context,
        binding: { ...context.binding, createdServiceSeasonId: '' },
      }),
    ).toThrow('INVALID_BINDING');
  });

  it.each(['rulesetVersion', 'contentPackVersion'] as const)(
    'requires snapshot/state/repository/registry %s agreement',
    (field) => {
      const { snapshot, context } = archiveFixture();
      expect(() => createCareerArchiveCore({ ...snapshot, [field]: '9.0.0' }, context)).toThrow(
        'VERSION_MISMATCH',
      );
      expect(() =>
        createCareerArchiveCore(snapshot, {
          ...context,
          binding: { ...context.binding, [field]: '9.0.0' },
        }),
      ).toThrow('VERSION_MISMATCH');
      expect(() =>
        createCareerArchiveCore(snapshot, {
          ...context,
          artifacts: { ...context.artifacts, [field]: '9.0.0' },
        }),
      ).toThrow('VERSION_MISMATCH');
      snapshot.state[field] = '9.0.0';
      expect(() => createCareerArchiveCore(rehash(snapshot), context)).toThrow('VERSION_MISMATCH');
    },
  );

  it('rejects malformed artifact identities', () => {
    const { snapshot, context } = archiveFixture();
    for (const bad of ['', 'a'.repeat(63), 'g'.repeat(64)])
      expect(() =>
        createCareerArchiveCore(snapshot, {
          ...context,
          artifacts: { ...context.artifacts, rulesetChecksum: bad },
        }),
      ).toThrow('INVALID_BINDING');
    expect(() =>
      createCareerArchiveCore(snapshot, {
        ...context,
        binding: { ...context.binding, rulesetVersion: 'latest' },
      }),
    ).toThrow('INVALID_BINDING');
  });

  it('rejects duplicate, missing, renumbered and stale-season history evidence', () => {
    const duplicate = archiveFixture();
    duplicate.snapshot.state.seasonHistory.push(copy(duplicate.snapshot.state.seasonHistory[0]!));
    expect(() => createCareerArchiveCore(rehash(duplicate.snapshot), duplicate.context)).toThrow(
      'INCOMPLETE_HISTORY',
    );
    const missing = archiveFixture();
    missing.snapshot.state.seasonHistory = [];
    expect(() => createCareerArchiveCore(rehash(missing.snapshot), missing.context)).toThrow(
      'INCOMPLETE_HISTORY',
    );
    const renumbered = archiveFixture();
    renumbered.snapshot.state.seasonHistory[0]!.index = 2;
    expect(() => createCareerArchiveCore(rehash(renumbered.snapshot), renumbered.context)).toThrow(
      'INCOMPLETE_HISTORY',
    );
    const future = archiveFixture();
    future.snapshot.state.seasonHistory[0]!.settledAtRevision = future.snapshot.revision;
    expect(() => createCareerArchiveCore(rehash(future.snapshot), future.context)).toThrow(
      'INCOMPLETE_HISTORY',
    );
  });

  it('rejects timeline disagreement, unclosed starts and future revisions', () => {
    const removed = archiveFixture();
    removed.snapshot.state.timeline = removed.snapshot.state.timeline.filter(
      (entry) => entry.kind !== 'SEASON_SETTLED',
    );
    expect(() => createCareerArchiveCore(rehash(removed.snapshot), removed.context)).toThrow(
      'INCOMPLETE_HISTORY',
    );
    const future = archiveFixture();
    future.snapshot.state.timeline[0]!.revision = future.snapshot.revision + 1;
    expect(() => createCareerArchiveCore(rehash(future.snapshot), future.context)).toThrow(
      'INCOMPLETE_HISTORY',
    );
  });

  it('accepts an empty, genuinely never-started history without fabricating a season', () => {
    const { context } = archiveFixture();
    const snapshot: DomainSnapshot = copy(runCareerFixture());
    snapshot.revision++;
    snapshot.checkpoint = 'RETIREMENT';
    snapshot.state.status = 'RETIRED';
    const archive = createCareerArchiveCore(rehash(snapshot), {
      ...context,
      binding: { ...context.binding, careerId: snapshot.state.careerId },
    });
    expect(archive.records.totals.seasons).toBe(0);
    expect(archive.records.totals.averageRatingTenths).toBeNull();
  });

  it('verifies a JSON round trip and gives 100 identical retry hashes without a clock', () => {
    const { snapshot, context } = archiveFixture();
    const hashes = Array.from(
      { length: 100 },
      () => createCareerArchiveCore(copy(snapshot), copy(context)).hash,
    );
    expect(new Set(hashes).size).toBe(1);
    expect(
      verifyCareerArchiveCore(copy(createCareerArchiveCore(snapshot, context)), context),
    ).toEqual({ ok: true });
  });

  it('rejects changed derived totals even after an attacker recomputes the outer hash', () => {
    const { snapshot, context } = archiveFixture();
    const corrupted = copy(createCareerArchiveCore(snapshot, context));
    corrupted.records.totals.minutes++;
    expect(verifyCareerArchiveCore(outerRehash(corrupted), context)).toEqual({
      ok: false,
      code: 'ARCHIVE_MISMATCH',
    });
  });

  it('rejects modified source, invalid JSON, schema, ID, service season and same-version checksum drift', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    for (const value of [
      { ...archive, source: { ...archive.source, state: 'invalid JSON' } },
      { ...archive, source: { ...archive.source, stateHash: '0'.repeat(64) } },
      { ...archive, archiveSchemaVersion: 2 as 1 },
      { ...archive, archiveBuilderVersion: '2.0.0' as '1.0.0' },
      { ...archive, archiveId: 'wrong' },
      { ...archive, binding: { ...archive.binding, createdServiceSeasonId: 'svc_new_active' } },
      { ...archive, artifacts: { ...archive.artifacts, contentPackChecksum: 'c'.repeat(64) } },
    ])
      expect(verifyCareerArchiveCore(outerRehash(value), context).ok).toBe(false);
  });

  it('reuses identical inserts, returns detached data, and rejects changed retirement contents', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    expect(planCareerArchiveWrite(null, archive, context).kind).toBe('INSERT');
    const row = copy(archive);
    const retry = planCareerArchiveWrite(row, archive, context);
    expect(retry.kind).toBe('REUSE');
    row.records.totals.minutes++;
    expect(retry.archive.records.totals.minutes).toBe(archive.records.totals.minutes);
    snapshot.state.age++;
    const changed = createCareerArchiveCore(rehash(snapshot), context);
    expect(changed.archiveId).toBe(archive.archiveId);
    expect(changed.hash).not.toBe(archive.hash);
    expect(() => planCareerArchiveWrite(archive, changed, context)).toThrow('ARCHIVE_CONFLICT');
    expect(() => planCareerArchiveWrite(null, row, context)).toThrow(ArchiveError);
  });

  it('never treats a bad existing row as permission to overwrite it', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    const corrupted = { ...archive, hash: '0'.repeat(64) };
    expect(() => planCareerArchiveWrite(corrupted, archive, context)).toThrow('ARCHIVE_MISMATCH');
  });

  it('preserves twenty synthetic season records; measures bytes without claiming real 20-year progression', () => {
    const { snapshot, context } = archiveFixture();
    const template = copy(snapshot.state.seasonHistory[0]!);
    snapshot.state.timeline = [];
    snapshot.state.seasonHistory = Array.from({ length: 20 }, (_, i) => {
      const season = copy(template);
      season.index = i + 1;
      season.result.index = season.index;
      season.result.hash = hashSeasonResult(season.result);
      season.settledAtRevision = 102 + i * 2;
      snapshot.state.timeline.push(
        { kind: 'SEASON_STARTED', revision: 101 + i * 2, age: 18 + i, step: 1, refId: null },
        {
          kind: 'SEASON_SETTLED',
          revision: season.settledAtRevision,
          age: 19 + i,
          step: 12,
          refId: null,
        },
      );
      return season;
    });
    snapshot.revision = 141;
    snapshot.state.age = 38;
    rehash(snapshot);
    const archive = createCareerArchiveCore(snapshot, context);
    const bytes = utf8Encode(canonical(archive)).length;
    expect(archive.records.sources).toHaveLength(20);
    expect(hashState(JSON.parse(archive.source.state) as CareerState)).toBe(snapshot.stateHash);
    expect(verifyCareerArchiveCore(copy(archive), context)).toEqual({ ok: true });
    // This synthetic core fits; it does not establish the size of a real twenty-year Career.
    expect(bytes).toBeLessThanOrEqual(262144);
  });
});
