import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { getServiceSeasonById, upsertServiceSeason } from './serviceSeasons.js';

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

  it('id로 찾으면 svc_kickoff 행을 돌려준다', async () => {
    const current = await getServiceSeasonById(ctx.db, 'svc_kickoff');
    expect(current?.id).toBe('svc_kickoff');
    expect(current?.isTest).toBe(0);
  });

  it('모르는 id는 undefined', async () => {
    const current = await getServiceSeasonById(ctx.db, 'svc_missing');
    expect(current).toBeUndefined();
  });

  it('upsertServiceSeason: isTest를 생략하면 0, true면 1로 저장한다', async () => {
    const row = await upsertServiceSeason(ctx.db, {
      id: 'svc_line_test_repo',
      name: 'LINE TEST',
      status: 'PRESEASON',
      startsAt: '2026-09-08T00:00:00Z',
      endsAt: '2026-10-31T23:59:59Z',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      challengeSetId: 'cs_line_test',
      isTest: true,
    });
    expect(row.isTest).toBe(1);

    const fetched = await getServiceSeasonById(ctx.db, 'svc_line_test_repo');
    expect(fetched?.isTest).toBe(1);
    expect(fetched?.status).toBe('PRESEASON');
  });
});
