import { describe, expect, it } from 'vitest';
import {
  decideSeason,
  decideSeasonEnd,
  inspectCounts,
  inspectSchema,
  inspectServiceSeasons,
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

  it('only permits an idempotent exact ACTIVE season', () => {
    expect(decideSeason([{ ...proposal }], proposal)).toEqual({ action: 'noop', sql: null });
    expect(() => decideSeason([{ ...proposal, rulesetVersion: '1.0.0' }], proposal)).toThrow(
      'different ACTIVE',
    );
    expect(() => decideSeason([{ ...proposal }, { ...proposal, id: 'other' }], proposal)).toThrow(
      'at most one',
    );
    expect(() => decideSeason([{ ...proposal, status: 'LOCKED' }], proposal)).toThrow(
      'status LOCKED',
    );
  });

  it('generates INSERT-only SQL when no ACTIVE season exists', () => {
    const decision = decideSeason([], proposal);
    expect(decision.action).toBe('insert');
    expect(decision.sql).toContain('INSERT INTO service_seasons');
    expect(decision.sql).not.toMatch(/UPDATE|REPLACE|DELETE/i);
    expect(decision.sql).toContain(PRODUCTION_SEASON.rulesetVersion);
    expect(decision.sql).toContain('NULL');
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
