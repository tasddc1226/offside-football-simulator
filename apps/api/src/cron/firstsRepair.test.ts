import { retireAtOf } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { CareerMetaSchema, CareerSeasonPayloadSchema } from '@offside/contracts';
import { putCareerSeason } from '../db/repos/careers.js';
import { setCareerHidden } from '../db/repos/anomalies.js';
import { issueCookie, seasonBody } from '../test/http.js';
import { ensureFirstsBackfilled, recordCareerFirsts } from '../db/repos/firsts.js';
import { repairNextFirsts } from './firstsRepair.js';

let ctx: TestD1;
let db: D1Database;
let owner: string;
beforeEach(async () => {
  ctx = await createTestD1();
  db = ctx.env.DB;
  owner = (await issueCookie(ctx)).profileId;
  await drain();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await ctx.dispose();
});

async function drain(size = 40) {
  for (let n = 0; n < 100; n++) if (!(await repairNextFirsts(db, true, size))) return;
  throw new Error('repair queue did not drain');
}

async function player(id: string, season: number, goals: number, at: string, assists = 0) {
  await db
    .prepare(
      `INSERT INTO careers(id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at,service_season)
    VALUES(?,?,'FW','오른발','x','x',2026,'active','1',?,?,?)`,
    )
    .bind(id, owner, at, at, season)
    .run();
  await db
    .prepare(
      `INSERT INTO career_seasons(career_id,year,age,club,league,apps,goals,assists,rating,rank,ovr,honors_json,mil,events_json,created_at)
    VALUES(?,2030,22,'x','x',10,?,?,7,'1',60,'[]',0,'[]',?)`,
    )
    .bind(id, goals, assists, at)
    .run();
  await recordCareerFirsts(ctx.db, id);
}
async function upload(
  id: string,
  goals: number,
  assists = 0,
  year = 2030,
  revision = 0,
  events = '[]',
) {
  const body = seasonBody({
    goals,
    assists,
    club: 'x',
    league: 'x',
    age: 22,
    apps: 10,
    rating: 7,
    ovr: 60,
  });
  await putCareerSeason(ctx.db, {
    careerId: id,
    profileId: owner,
    year,
    meta: CareerMetaSchema.parse(body.career),
    season: CareerSeasonPayloadSchema.parse(body.season),
    eventsJson: events,
    uploadRevision: revision,
    now: '2026-11-05',
  });
}
const first = (id: string, season = 2) =>
  db
    .prepare('SELECT career_id FROM server_firsts WHERE season=? AND id=?')
    .bind(season, id)
    .first<string>('career_id');
const record = (id: string, season = 2) =>
  db
    .prepare('SELECT career_id,value FROM server_records WHERE season=? AND id=?')
    .bind(season, id)
    .first();
const cursor = () =>
  db.prepare("SELECT value FROM app_meta WHERE key='server_firsts_cursor'").first<string>('value');

it('queues exactly the lost slots, pages the affected season, and leaves the independent full cursor intact', async () => {
  await player('leader', 2, 55, '2026-11-01');
  await player('runner', 2, 46, '2026-11-02', 22);
  await player('another', 1, 70, '2026-10-01');
  await db.prepare("INSERT INTO app_meta VALUES('server_firsts_cursor','711')").run();
  const lost = (
    await db
      .prepare(
        `SELECT 'first' kind,id FROM server_firsts WHERE career_id='leader'
    UNION ALL SELECT 'record',id FROM server_records WHERE career_id='leader' ORDER BY kind,id`,
      )
      .all()
  ).results;
  await db.prepare("DELETE FROM careers WHERE id='leader'").run();
  expect(
    (await db.prepare('SELECT kind,id FROM firsts_repairs WHERE season=2 ORDER BY kind,id').all())
      .results,
  ).toEqual(lost);
  expect(await first('sassists20')).toBe('runner');
  await drain(1);
  expect(await cursor()).toBe('711');
  expect(await first('sgoals50')).toBeNull();
  expect(await first('sgoals40')).toBe('runner');
  expect(await record('goals')).toEqual({ career_id: 'runner', value: 46 });
  expect(await first('sgoals50', 1)).toBe('another');
  const plan = await db
    .prepare(
      'EXPLAIN QUERY PLAN SELECT id FROM careers WHERE hidden=0 AND coalesce(service_season,0)=? AND rowid>? ORDER BY rowid LIMIT 40',
    )
    .bind(2, 0)
    .all<{ detail: string }>();
  expect(plan.results.map((r) => r.detail).join(' ')).toMatch(
    /SEARCH careers USING INDEX careers_firsts_season_idx.*rowid>/,
  );
});

it('rejudges only changed holdings and compares restored players even after full backfill completion', async () => {
  await player('early', 2, 50, '2026-11-01', 25);
  await player('other', 2, 45, '2026-11-02');
  await db.prepare("INSERT INTO app_meta VALUES('server_firsts_backfill','2')").run();
  await upload('early', 20, 25);
  await repairNextFirsts(db); // single-career rejudgement
  expect(
    (await db.prepare("SELECT id FROM firsts_repairs WHERE id LIKE '%assist%'").all()).results,
  ).toEqual([]);
  await drain(1);
  expect(await first('sgoals40')).toBe('other');
  expect(await first('sgoals50')).toBeNull();
  expect(await record('sgoals')).toEqual({ career_id: 'other', value: 45 });
  await setCareerHidden(db, 'early', true, Date.now());
  await drain();
  expect(await first('sassists20')).toBeNull();
  await setCareerHidden(db, 'early', false, Date.now());
  await drain();
  expect(await first('sassists20')).toBe('early');
  expect(
    await db
      .prepare("SELECT value FROM app_meta WHERE key='server_firsts_backfill'")
      .first('value'),
  ).toBe('2');
});

it('rejects a stale full page after a partial repair without rewinding the previous checkpoint', async () => {
  await player('prefix', 2, 1, '2026-11-01');
  await player('winner', 2, 60, '2026-11-02');
  await player('next', 2, 45, '2026-11-03');
  await db.prepare("DELETE FROM server_firsts WHERE season=2 AND id='sgoals40'").run();
  await db.prepare("DELETE FROM server_records WHERE season=2 AND id='sgoals'").run();
  await db.prepare("INSERT INTO app_meta VALUES('server_firsts_cursor','1')").run();
  const realBatch = ctx.db.batch.bind(ctx.db);
  vi.spyOn(ctx.db, 'batch')
    .mockImplementationOnce(realBatch)
    .mockImplementationOnce(realBatch)
    .mockImplementationOnce(async (statements) => {
      await upload('winner', 10);
      await drain(1);
      return realBatch(statements);
    });
  await ensureFirstsBackfilled(ctx.db, 2);
  expect(await cursor()).toBe('1');
  expect(await first('sgoals40')).toBe('next');
  expect(await record('sgoals')).toEqual({ career_id: 'next', value: 45 });
  await ensureFirstsBackfilled(ctx.db, 2);
  expect(await cursor()).toBe('3');
});

it('restores the earliest equal record after unhide and transfers the indexed retirement-age milestone', async () => {
  await player('early', 2, 50, '2026-11-01');
  await player('later', 2, 50, '2026-11-02');
  for (const id of ['early', 'later']) {
    await db
      .prepare(
        "UPDATE careers SET status='retired', retired_at=created_at, retire_age=? WHERE id=?",
      )
      .bind(retireAtOf(2), id)
      .run();
    await recordCareerFirsts(ctx.db, id, { legendOnly: true });
  }
  expect(await first('retirecap')).toBe('early');
  await setCareerHidden(db, 'early', true, Date.now());
  await drain(1);
  expect(await first('retirecap')).toBe('later');
  expect(await record('sgoals')).toEqual({ career_id: 'later', value: 50 });
  await setCareerHidden(db, 'early', false, Date.now());
  await drain(1);
  expect(await first('retirecap')).toBe('early');
  expect(await record('sgoals')).toEqual({ career_id: 'early', value: 50 });
});

it('restarts only the lost slot if its interim winner leaves midway through a season scan', async () => {
  await player('prefix', 2, 40, '2026-11-03');
  await player('interim', 2, 50, '2026-11-02');
  await player('holder', 2, 60, '2026-11-01');
  await db.prepare("INSERT INTO app_meta VALUES('server_firsts_cursor','777')").run();
  await setCareerHidden(db, 'holder', true, Date.now());
  await repairNextFirsts(db, false, 2);
  expect(await first('sgoals40')).toBe('interim');
  const readJob = () =>
    db
      .prepare(
        "SELECT seq,cursor FROM firsts_repairs WHERE season=2 AND kind='first' AND id='sgoals40'",
      )
      .first<{ seq: number; cursor: number }>();
  const previous = await readJob();
  expect(previous?.cursor).toBeGreaterThan(0);
  await setCareerHidden(db, 'interim', true, Date.now());
  const next = await readJob();
  expect(next?.seq).toBeGreaterThan(previous!.seq);
  expect(next?.cursor).toBe(0);
  await drain(1);
  expect(await first('sgoals40')).toBe('prefix');
  expect(await record('sgoals')).toEqual({ career_id: 'prefix', value: 40 });
  expect(await cursor()).toBe('777');
});

it('queues only accepted corrections and late seasons, leaving ordinary appends, replays and cleanup alone', async () => {
  const queued = () =>
    db
      .prepare("SELECT seq FROM firsts_repairs WHERE kind='career' AND id='history'")
      .first<number>('seq');
  await upload('history', 5, 0, 2031);
  await upload('history', 6, 0, 2032, 5);
  await upload('history', 6, 0, 2032, 5); // replay
  await upload('history', 30, 0, 2032, 4); // stale revision
  await upload('history', 6, 0, 2032, 6, '[1]'); // telemetry only
  expect(await queued()).toBeNull();
  await upload('history', 3, 0, 2030);
  const firstJob = await queued();
  expect(firstJob).toBeGreaterThan(0);
  await upload('history', 9, 0, 2030);
  expect(await queued()).toBeGreaterThan(firstJob!);
  await drain();
  await db.prepare("UPDATE careers SET status='retired' WHERE id='history'").run();
  await upload('history', 25, 0, 2032, 7);
  expect(await queued()).toBeNull();
  await upload('history', 2, 0, 2029);
  expect(await queued()).toBeGreaterThan(0);
  await drain();
  await db.prepare("DELETE FROM career_seasons WHERE career_id='history'").run();
  await db.prepare("DELETE FROM careers WHERE id='history'").run();
  expect(await queued()).toBeNull();
  expect(
    (
      await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('careers','career_seasons') AND name LIKE 'firsts_%'",
        )
        .all()
    ).results,
  ).toEqual([]);
});
