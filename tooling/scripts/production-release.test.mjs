import { describe, expect, it } from 'vitest';
import {
  decideSeason,
  decideSeasonEnd,
  inspectCounts,
  inspectSchema,
  inspectServiceSeasons,
  PREVIOUS_PRODUCTION_VERSION,
  PRODUCTION_SEASON,
  validateProposal,
} from './production-release.mjs';

const proposal = validateProposal({
  startsAt: '2026-09-06T00:00:00Z',
  endsAt: '',
  challengeSetId: 'cs_season_1',
});

describe('production release guards', () => {
  it('recognizes an empty production schema without treating it as an error', () => {
    expect(inspectSchema([{ results: [] }])).toEqual({
      tableCount: 0,
      tables: [],
      hasServiceSeasons: false,
    });
  });

  it('fails closed when Wrangler does not return a valid results envelope', () => {
    expect(() => inspectSchema({ success: true })).toThrow('results array');
    expect(() => inspectSchema({ success: false, errors: ['redacted'] })).toThrow('unsuccessful');
    expect(() => inspectServiceSeasons([{ results: [{ id: 'svc_season_1' }] }])).toThrow(
      'required metadata',
    );
  });

  it('retains only aggregate table counts from D1 output', () => {
    expect(
      inspectCounts([
        { results: [{ table_name: 'profiles', row_count: 3 }] },
        { results: [{ table_name: 'careers', row_count: 2 }] },
      ]),
    ).toEqual([
      { table: 'profiles', rows: 3 },
      { table: 'careers', rows: 2 },
    ]);
  });

  it('targets the 1.5.0/0.6.0 manifest from the 1.4.0/0.5.1 predecessor', () => {
    expect(PRODUCTION_SEASON.rulesetVersion).toBe('1.5.0');
    expect(PRODUCTION_SEASON.contentPackVersion).toBe('0.6.0');
    expect(PREVIOUS_PRODUCTION_VERSION).toEqual({
      rulesetVersion: '1.4.0',
      contentPackVersion: '0.5.1',
    });
  });

  it('only permits an idempotent exact ACTIVE season', () => {
    expect(decideSeason([{ ...proposal }], proposal)).toEqual({
      action: 'noop',
      sql: null,
      rollbackSql: null,
    });
    expect(() => decideSeason([{ ...proposal, rulesetVersion: '1.0.0' }], proposal)).toThrow(
      'different ACTIVE',
    );
    // 두 세대 전 manifest(1.3.0/0.5.0)는 더 이상 승격 출발점이 아니다.
    expect(() =>
      decideSeason(
        [{ ...proposal, rulesetVersion: '1.3.0', contentPackVersion: '0.5.0' }],
        proposal,
      ),
    ).toThrow('different ACTIVE');
    expect(() => decideSeason([{ ...proposal }, { ...proposal, id: 'other' }], proposal)).toThrow(
      'at most one',
    );
    expect(() => decideSeason([{ ...proposal, status: 'LOCKED' }], proposal)).toThrow(
      'status LOCKED',
    );
  });

  it('activates only from the exact previous manifest and emits a guarded inverse', () => {
    const previous = { ...proposal, ...PREVIOUS_PRODUCTION_VERSION };
    const decision = decideSeason([previous], proposal);
    expect(decision.action).toBe('activate');
    expect(decision.sql).toContain("ruleset_version = '1.4.0'");
    expect(decision.sql).toContain("content_pack_version = '0.5.1'");
    expect(decision.sql).toContain("SET ruleset_version = '1.5.0', content_pack_version = '0.6.0'");
    expect(decision.rollbackSql).toContain(
      "SET ruleset_version = '1.4.0', content_pack_version = '0.5.1'",
    );
    expect(decision.rollbackSql).toContain("ruleset_version = '1.5.0'");
    expect(decision.rollbackSql).toContain("content_pack_version = '0.6.0'");
    expect(() => decideSeason([{ ...previous, contentPackVersion: '0.4.0' }], proposal)).toThrow(
      'different ACTIVE',
    );
    // 1.5.0 룰셋만 먼저 올라간 혼합 pair도 출발점으로 인정하지 않는다.
    expect(() => decideSeason([{ ...previous, rulesetVersion: '1.5.0' }], proposal)).toThrow(
      'different ACTIVE',
    );
  });

  it('never creates a replacement production season when the existing row is absent', () => {
    expect(() => decideSeason([], proposal)).toThrow('existing ACTIVE svc_season_1');
  });

  it('allows an open end and rejects incomplete or inverted release periods', () => {
    expect(proposal.endsAt).toBeNull();
    expect(() =>
      validateProposal({
        startsAt: '',
        endsAt: '2026-12-31T23:59:59Z',
        challengeSetId: 'cs_season_1',
      }),
    ).toThrow('provided together');
    expect(() =>
      validateProposal({
        startsAt: '2027-01-01T00:00:00Z',
        endsAt: '2026-12-31T23:59:59Z',
        challengeSetId: 'cs_season_1',
      }),
    ).toThrow('before');
  });

  it('changes only ends_at with an exact metadata compare-and-set', () => {
    const dated = { ...proposal, endsAt: '2026-12-31T23:59:59Z' };
    const decision = decideSeasonEnd([{ ...proposal }], dated);
    expect(decision.action).toBe('update-end');
    expect(decision.sql).toMatch(/^UPDATE service_seasons SET ends_at = /);
    expect(decision.sql).not.toMatch(/SET (?!ends_at)/);
    expect(decideSeasonEnd([{ ...proposal }], proposal)).toEqual({ action: 'noop', sql: null });
    expect(() => decideSeasonEnd([{ ...proposal, isTest: 1 }], proposal)).toThrow(
      'metadata differs',
    );
  });
});
