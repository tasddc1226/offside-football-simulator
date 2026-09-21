import { readFileSync } from 'node:fs';
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
  startsAt: '2026-09-05T15:00:00Z',
  endsAt: '',
  challengeSetId: 'cs_season_1',
});

describe('production release guards', () => {
  it('keeps non-production seeds and staging expectations on the release target', () => {
    const expectedPair = "'3.3.0', '0.12.0'";
    const synchronizedFiles = [
      '../../apps/api/seeds/bootstrap-non-production.sql',
      '../../apps/api/seeds/local.sql',
      '../../apps/web/playwright.smoke.config.ts',
      '../../apps/web/e2e/staging-rehearsal.spec.ts',
      '../../apps/web/e2e/service-season.spec.ts',
    ];
    for (const path of synchronizedFiles) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      if (path.endsWith('.sql')) {
        expect(source, path).toContain(expectedPair);
      } else {
        expect(source, path).toMatch(/rulesetVersion|expectedRulesetVersion/);
        expect(source, path).toContain("'3.3.0'");
        expect(source, path).toMatch(/contentPackVersion|expectedContentPackVersion/);
        expect(source, path).toContain("'0.12.0'");
      }
    }
  });

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

  it('targets the 3.3.0/0.12.0 manifest from the actual 3.1.0/0.10.0 predecessor', () => {
    expect(PRODUCTION_SEASON.rulesetVersion).toBe('3.3.0');
    expect(PRODUCTION_SEASON.contentPackVersion).toBe('0.12.0');
    expect(PREVIOUS_PRODUCTION_VERSION).toEqual({
      rulesetVersion: '3.1.0',
      contentPackVersion: '0.10.0',
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
    // 두 세대 전 manifest(1.7.0/0.6.4)는 더 이상 승격 출발점이 아니다.
    expect(() =>
      decideSeason(
        [{ ...proposal, rulesetVersion: '1.7.0', contentPackVersion: '0.6.4' }],
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
    expect(decision.sql).toContain("ruleset_version = '3.1.0'");
    expect(decision.sql).toContain("content_pack_version = '0.10.0'");
    expect(decision.sql).toContain(
      "SET ruleset_version = '3.3.0', content_pack_version = '0.12.0'",
    );
    expect(decision.sql).toContain("starts_at = '2026-09-05T15:00:00Z'");
    expect(decision.sql).toContain('ends_at IS NULL');
    expect(decision.sql).not.toMatch(/SET (?:starts_at|ends_at|status|challenge_set_id|is_test)/);
    expect(decision.rollbackSql).toContain(
      "SET ruleset_version = '3.1.0', content_pack_version = '0.10.0'",
    );
    expect(decision.rollbackSql).toContain("ruleset_version = '3.3.0'");
    expect(decision.rollbackSql).toContain("content_pack_version = '0.12.0'");
    expect(decision.rollbackSql).toContain("starts_at = '2026-09-05T15:00:00Z'");
    expect(decision.rollbackSql).toContain('ends_at IS NULL');
    expect(() => decideSeason([{ ...previous, contentPackVersion: '0.4.0' }], proposal)).toThrow(
      'different ACTIVE',
    );
    // 구 룰셋과 대상 팩을 섞은 pair도 출발점으로 인정하지 않는다.
    expect(() =>
      decideSeason(
        [{ ...previous, rulesetVersion: '1.5.0', contentPackVersion: '0.12.0' }],
        proposal,
      ),
    ).toThrow('different ACTIVE');
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
