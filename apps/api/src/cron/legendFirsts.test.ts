import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { recordCareerFirsts } from '../db/repos/firsts.js';
import { setCareerHidden } from '../db/repos/anomalies.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { putRetirement } from '../db/repos/careers.js';
import { deleteProfile, issueCookie, RETIREMENT } from '../test/http.js';
import { repairNextFirsts } from './firstsRepair.js';

let ctx: TestD1;
let db: D1Database;
let owner: Awaited<ReturnType<typeof issueCookie>>;
beforeEach(async () => {
  ctx = await createTestD1();
  db = ctx.env.DB;
  owner = await issueCookie(ctx);
});
afterEach(async () => {
  await ctx.dispose();
});

async function retire(
  id: string,
  score: number,
  at: string,
  season: number | null = 2,
  profile = owner.profileId,
) {
  await db
    .prepare(
      `INSERT INTO careers
    (id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at,retired_at,legend_score,service_season)
    VALUES (?,?,'FW','오른발','x','x',2026,'retired','1',?,?,?,?,?)`,
    )
    .bind(id, profile, at, at, at, score, season)
    .run();
}
const rescore = (id: string, legendScore: number) =>
  putRetirement(ctx.db, {
    careerId: id,
    summary: { ...RETIREMENT, legendScore },
    bonusRate: 0,
    now: '2026-11-27',
  });
const first = (stage: number, season = 2) =>
  db
    .prepare('SELECT career_id FROM server_firsts WHERE season=? AND id=?')
    .bind(season, 'legend' + stage)
    .first<string>('career_id');
const record = (season = 2) =>
  db
    .prepare("SELECT career_id,value FROM server_records WHERE season=? AND id='legend'")
    .bind(season)
    .first();
const repair = async () => {
  while (await repairNextFirsts(db));
};

it('repairs the existing empty stage on upgrade, then transfers firsts and the high score after departure', async () => {
  const leader = await issueCookie(ctx);
  await retire('leader', 4120, '2026-11-01', 2, leader.profileId);
  await retire('first', 3910, '2026-11-02');
  await retire('best', 3946, '2026-11-03');
  await retire('other-season', 4700, '2026-10-01', 1);
  await repair();
  expect(await first(4100)).toBe('leader');
  expect((await deleteProfile(ctx.env, leader.cookie, 'legend-holder-delete')).status).toBe(204);
  await repair();
  expect(await first(3900)).toBe('first');
  expect(await first(4000)).toBeNull();
  expect(await record()).toEqual({ career_id: 'best', value: 3946 });
  expect(await first(3900, 1)).toBeNull();
  expect(
    await db.prepare("SELECT key FROM app_meta WHERE key='legend_repair:2'").first(),
  ).toBeNull();
});

it('repairs score decreases, hidden holders and restoration across both preseason encodings', async () => {
  await repair(); // consume the migration repair for season 2
  await retire('older', 3901, '2026-09-10', null);
  await retire('later', 3920, '2026-09-20', 0);
  await rescore('older', 3950);
  await repair();
  expect(await first(3900, 0)).toBe('older');
  expect(await record(0)).toEqual({ career_id: 'older', value: 3950 });
  await rescore('older', 3800);
  await repair();
  expect(await first(3900, 0)).toBe('later');
  expect(await first(3800, 0)).toBe('older');
  expect(await record(0)).toEqual({ career_id: 'later', value: 3920 });
  await setCareerHidden(db, 'later', true, Date.now());
  await repair();
  expect(await first(3900, 0)).toBeNull();
  expect(await record(0)).toEqual({ career_id: 'older', value: 3800 });
  await setCareerHidden(db, 'later', false, Date.now());
  await repair();
  expect(await first(3900, 0)).toBe('later');
  expect(await record(0)).toEqual({ career_id: 'later', value: 3920 });
});

it('does not reinsert an ineligible claim from an in-flight full scan after repair', async () => {
  await retire('departed', 4130, '2026-11-01');
  await retire('next', 3946, '2026-11-03');
  const batch = ctx.db.batch.bind(ctx.db);
  const writes = vi
    .spyOn(ctx.db, 'batch')
    .mockImplementationOnce(batch) // read existing firsts and records
    .mockImplementationOnce(async (statements) => {
      await rescore('departed', 3790);
      await repair();
      return batch(statements);
    });
  try {
    await recordCareerFirsts(ctx.db, 'departed', { legendOnly: true });
  } finally {
    writes.mockRestore();
  }
  expect(await first(4100)).toBeNull();
  expect(await first(3900)).toBe('next');
  expect(await record()).toEqual({ career_id: 'next', value: 3946 });
});
