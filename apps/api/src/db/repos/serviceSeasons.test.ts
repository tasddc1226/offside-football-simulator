import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { getCurrentServiceSeason } from './serviceSeasons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../../seeds/local.sql');

describe('serviceSeasons repo', () => {
  let ctx: TestD1;

  beforeAll(async () => {
    ctx = await createTestD1();
    const seedSql = readFileSync(SEED_PATH, 'utf8');
    for (const statement of splitSqlQuery(seedSql)) {
      const trimmed = statement.replace(/\s+/g, ' ').trim();
      if (trimmed.length > 0) await ctx.db.$client.exec(trimmed);
    }
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('returns svc_kickoff when it is within its active window', async () => {
    const current = await getCurrentServiceSeason(ctx.db, '2026-09-15T00:00:00Z');
    expect(current?.id).toBe('svc_kickoff');
  });

  it('returns undefined when now is outside the season window', async () => {
    const current = await getCurrentServiceSeason(ctx.db, '2027-01-15T00:00:00Z');
    expect(current).toBeUndefined();
  });
});
