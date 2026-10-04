import { describe, expect, it } from 'vitest';
import {
  ATTRS,
  dbCommandArgs,
  estimateAttrs,
  planBackfill,
  protectedHash,
  rollbackSql,
  updateSql,
} from './backfill-career-attrs.mjs';

const profile = (attrs) => JSON.stringify({ attrs, roles: {} });
const values = (n) => Object.fromEntries(ATTRS.map((k) => [k, n]));
const reference = (n, over = {}) => ({
  id: `reference-${n}`,
  pos: 'FW',
  type: 'poacher',
  dpos: null,
  peak: 80,
  peak_profile: profile({ ...values(70), sho: 90, def: 35 }),
  card_attrs_json: null,
  ...over,
});
const legacy = (over = {}) => ({
  id: 'old-player',
  pos: 'FW',
  type: 'poacher',
  dpos: null,
  peak: 85,
  peak_profile: null,
  card_attrs_json: null,
  ...over,
});
const refs = (over = {}) => Array.from({ length: 10 }, (_, n) => reference(n, over));

describe('retired career display-attribute backfill', () => {
  it('uses remote queries and rejects remote imports while allowing local files', () => {
    const args = dbCommandArgs('production', 'UPDATE careers SET card_attrs_json=NULL WHERE 0;');
    expect(args).toContain('--remote');
    expect(args).toContain('--command');
    expect(args).not.toContain('--file');
    expect(() => dbCommandArgs('production', null, 'batch.sql')).toThrow('not SQL imports');
    expect(dbCommandArgs('local', null, 'batch.sql')).toContain('--file');
  });

  it('verifies original ability, OVR, LS and retirement summaries while allowing display attrs', () => {
    const row = legacy({ legend_score: 100, goals: 40 });
    expect(protectedHash([row])).toBe(protectedHash([{ ...row, card_attrs_json: '{}' }]));
    for (const key of ['peak', 'peak_profile', 'legend_score', 'goals', 'apps', 'retired_at']) {
      expect(protectedHash([row])).not.toBe(protectedHash([{ ...row, [key]: 'changed' }]));
    }
  });

  it('uses median offsets from actual peers, deterministic values and an estimated marker', () => {
    const rows = [...refs(), legacy()];
    const { changes, summary } = planBackfill(rows);
    expect(summary).toMatchObject({ originalPreserved: 10, estimated: 1 });
    expect(changes).toHaveLength(1);
    const p = JSON.parse(changes[0].value);
    expect(p).toMatchObject({
      source: 'estimated',
      attrs: { ...values(75), sho: 95, def: 40 },
      samples: 10,
    });
    expect(p.roles).toBeUndefined();
    expect(planBackfill([...rows].reverse()).changes[0].value).toEqual(changes[0].value);
  });

  it('prefers matching type and nearby OVR without mixing field and goalkeeper attributes', () => {
    const mixed = [
      ...refs(),
      ...refs({ pos: 'GK', type: 'shot', peak_profile: profile(values(20)) }),
    ];
    const { changes } = planBackfill([...mixed, legacy({ pos: 'GK', type: 'shot' })]);
    expect(JSON.parse(changes[0].value).attrs).toEqual(values(25));
    const nearby = refs().map((r) => ({ ...r, attrs: JSON.parse(r.peak_profile).attrs }));
    const far = nearby.map((r) => ({ ...r, peak: 30, attrs: values(30) }));
    expect(estimateAttrs(legacy(), [...nearby, ...far]).samples).toBe(10);
  });

  it('preserves previous backfills and bad originals and skips unsupported input', () => {
    const rows = [
      ...refs(),
      legacy({ id: 'filled', card_attrs_json: '{}' }),
      legacy({ id: 'bad-original', peak_profile: '{bad' }),
      legacy({ id: 'bad-peak', peak: 150 }),
      legacy({ id: 'unknown-position', pos: 'X' }),
    ];
    expect(planBackfill(rows)).toMatchObject({
      changes: [],
      summary: {
        previousBackfillPreserved: 1,
        invalidOriginal: 1,
        invalidPeak: 2,
        estimated: 0,
      },
    });
    expect(planBackfill([legacy()]).summary.insufficientReference).toBe(1);
  });

  it('clamps every value to the stored range and resuming a completed run does no work', () => {
    const rows = [...refs({ peak: 10, peak_profile: profile(values(99)) }), legacy({ peak: 99 })];
    const { changes } = planBackfill(rows);
    expect(JSON.parse(changes[0].value).attrs).toEqual(values(99));
    expect(
      planBackfill([...rows.slice(0, -1), { ...rows.at(-1), card_attrs_json: changes[0].value }])
        .changes,
    ).toEqual([]);
    const low = [...refs({ peak: 99, peak_profile: profile(values(0)) }), legacy({ peak: 0 })];
    expect(JSON.parse(planBackfill(low).changes[0].value).attrs).toEqual(values(0));
  });

  it('SQL changes only empty display attributes with metadata guards and a value-specific rollback', () => {
    const change = planBackfill([...refs(), legacy({ id: "quoted'id" })]).changes[0];
    const sql = updateSql(change);
    expect(sql).toContain("id='quoted''id'");
    expect(sql).toContain("status='retired' AND peak_profile IS NULL AND card_attrs_json IS NULL");
    expect(sql).toContain("peak=85 AND pos='FW' AND type='poacher' AND dpos IS NULL");
    expect(sql).not.toContain('SET peak_profile');
    expect(rollbackSql(change)).toContain(`AND card_attrs_json='${change.value}'`);
  });
});
