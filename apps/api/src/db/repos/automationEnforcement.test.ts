import { callJson, issueAdminCookie, issueGoogleCookie } from '../../test/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { careers, careerSeasons } from '../schema.js';
import {
  autoHideCareer,
  automationEnforcement,
  sweepAutomation,
  AUTOMATION_SWEEP_KEY,
} from './automationEnforcement.js';
import { blockingReasons } from './automation.js';
import { setCareerHidden } from './anomalies.js';
import { recordCareerFirsts } from './firsts.js';
const NOW = Date.parse('2026-10-08T19:00:00.000Z');
const sig = (extra = {}) =>
  JSON.stringify({
    clicks: 25,
    keys: 0,
    touches: 0,
    moves: 100,
    synthetic: 0,
    webdriver: false,
    ms: 40000,
    hiddenMs: 0,
    ...extra,
  });
let ctx: TestD1;
let profileId: string;
beforeEach(async () => {
  ctx = await createTestD1();
  profileId = 'test';
  await ctx.env.DB.prepare(
    "INSERT INTO profiles(id, settings_json, created_at, last_seen_at) VALUES (?, '{}', ?, ?)",
  )
    .bind(profileId, new Date(NOW).toISOString(), new Date(NOW).toISOString())
    .run();
});
afterEach(() => ctx.dispose());
async function seed(id: string, signals: (string | null)[], daysAgo = 20) {
  const at = new Date(NOW - daysAgo * 86400000).toISOString();
  await ctx.db.insert(careers).values({
    id,
    profileId,
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    appVersion: 'test',
    status: 'active',
    createdAt: at,
    updatedAt: at,
  });
  await ctx.db.insert(careerSeasons).values(
    signals.map((signalsJson, i) => ({
      careerId: id,
      year: 2026 + i,
      age: 18 + i,
      club: 'A',
      league: 'L',
      apps: 30,
      goals: 10,
      assists: 5,
      rating: 7,
      rank: '1',
      ovr: 60,
      honorsJson: '[]',
      mil: 0,
      eventsJson: '[]',
      createdAt: at,
      signalsJson,
    })),
  );
}
const hidden = (id: string) =>
  ctx.env.DB.prepare('SELECT hidden FROM careers WHERE id=?').bind(id).first<number>('hidden');

describe('automatic moderation', () => {
  it('backfills old signals, agrees with the upload predicate and excludes weak/missing signals', async () => {
    const inputs = {
      webdriver: [sig({ webdriver: true })],
      headless: [sig({ headless: true })],
      synthetic: [sig({ synthetic: 26 })],
      zero: [sig({ clicks: 0 }), sig({ clicks: 0 })],
      oneIdle: [sig({ clicks: 0 })],
      weak: [sig({ moves: 1 })],
      touch: [sig({ touches: 25, moves: 0 })],
      old: [null],
      invalid: ['broken'],
    };
    for (const [id, signals] of Object.entries(inputs)) await seed(id, signals);
    const result = await sweepAutomation(ctx.env.DB, NOW);
    expect(result).toMatchObject({ status: 'complete', checked: 8, hidden: 4 });
    for (const [id, signals] of Object.entries(inputs))
      expect(await hidden(id)).toBe(Number(blockingReasons(signals).length > 0));
    const report = await automationEnforcement(ctx.db, true);
    expect(report.actions).toHaveLength(4);
    expect(
      report.actions.every(
        (a) => a.source === 'sweep' && a.ruleVersion === '1' && a.reasons.length && a.hidden,
      ),
    ).toBe(true);
    expect((await sweepAutomation(ctx.env.DB, NOW + 86400000))?.hidden).toBe(0);
    expect((await automationEnforcement(ctx.db, true)).actions).toHaveLength(4);
    expect(await ctx.env.DB.prepare('SELECT count(*) AS n FROM career_seasons').first('n')).toBe(
      10,
    );
  });
  it('uses cumulative script-click thresholds and honors the upload pause', async () => {
    await seed('split', [sig({ synthetic: 3, clicks: 2 }), sig({ synthetic: 3, clicks: 2 })]);
    await seed('equal', [sig({ synthetic: 5, clicks: 5 })]);
    await seed('below', [sig({ synthetic: 4, clicks: 0 })]);
    await seed('paused', [sig({ webdriver: true })]);
    await recordCareerFirsts(ctx.db, 'paused', { automaticHiding: false });
    expect(await hidden('paused')).toBe(0);
    expect((await sweepAutomation(ctx.env.DB, NOW))?.hidden).toBe(2);
    expect(await hidden('split')).toBe(1);
    expect(await hidden('equal')).toBe(0);
    expect(await hidden('below')).toBe(0);
  });
  it('incremental candidate uses entire history and includes overwritten seasons', async () => {
    await seed('repeat', [sig({ clicks: 0 })]);
    await sweepAutomation(ctx.env.DB, NOW);
    await ctx.env.DB.prepare('UPDATE career_seasons SET signals_json=? WHERE career_id=?')
      .bind(sig({ clicks: 0 }), 'repeat')
      .run();
    await ctx.env.DB.prepare('UPDATE careers SET updated_at=? WHERE id=?')
      .bind(new Date(NOW + 1000).toISOString(), 'repeat')
      .run();
    const base = (await ctx.db.select().from(careerSeasons))[0]!;
    await ctx.db
      .insert(careerSeasons)
      .values({ ...base, year: 2027, createdAt: new Date(NOW + 1000).toISOString() });
    expect((await sweepAutomation(ctx.env.DB, NOW + 2000))?.hidden).toBe(1);
  });
  it('restore persists history and is exempt from sweep AND upload, even on retry', async () => {
    await seed('bot', [sig({ webdriver: true })]);
    expect(await autoHideCareer(ctx.db, 'bot', ['webdriver'], 1, 'upload', NOW)).toBe(true);
    await setCareerHidden(ctx.env.DB, 'bot', false, NOW + 1000);
    expect(await autoHideCareer(ctx.db, 'bot', ['webdriver'], 1, 'upload', NOW)).toBe(false);
    await recordCareerFirsts(ctx.db, 'bot');
    await sweepAutomation(ctx.env.DB, NOW + 2000);
    expect(await hidden('bot')).toBe(0);
    const report = await automationEnforcement(ctx.db, true);
    expect(report.actions.map((a) => a.action)).toEqual(['restore', 'hide']);
    expect(report.actions.every((a) => !a.hidden)).toBe(true);
  });
  it('bounded pages resume the frozen window without skipping candidates', async () => {
    await seed('a', [sig({ webdriver: true })]);
    await seed('b', [sig({ headless: true })]);
    const budget = { pageSize: 1, maxPages: 1 };
    expect(await sweepAutomation(ctx.env.DB, NOW, false, budget)).toMatchObject({
      status: 'running',
      cursor: 'a',
      checked: 1,
      hidden: 1,
    });
    expect(await sweepAutomation(ctx.env.DB, NOW + 1000, true, budget)).toMatchObject({
      status: 'running',
      cursor: 'b',
      checked: 2,
      hidden: 2,
      through: new Date(NOW).toISOString(),
    });
    expect(await sweepAutomation(ctx.env.DB, NOW + 2000, true, budget)).toMatchObject({
      status: 'complete',
      checked: 2,
      hidden: 2,
    });
    expect((await automationEnforcement(ctx.db, true)).actions).toHaveLength(2);
  });
  it('audit, hidden flag and removal of public holders are one rollbackable transaction', async () => {
    await seed('bot', [sig({ webdriver: true })]);
    await ctx.env.DB.prepare(
      "INSERT INTO server_firsts(season,id,career_id,achieved_at) VALUES(1,'goals10','bot',?)",
    )
      .bind(new Date(NOW).toISOString())
      .run();
    await ctx.env.DB.prepare(
      "CREATE TRIGGER block_hide BEFORE UPDATE OF hidden ON careers BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    ).run();
    await expect(autoHideCareer(ctx.db, 'bot', ['webdriver'], 1, 'upload', NOW)).rejects.toThrow();
    expect(await hidden('bot')).toBe(0);
    expect((await automationEnforcement(ctx.db, true)).actions).toEqual([]);
    expect(await ctx.env.DB.prepare('SELECT count(*) AS n FROM server_firsts').first('n')).toBe(1);
    await ctx.env.DB.prepare('DROP TRIGGER block_hide').run();
    await autoHideCareer(ctx.db, 'bot', ['webdriver'], 1, 'upload', NOW);
    expect(await ctx.env.DB.prepare('SELECT count(*) AS n FROM server_firsts').first('n')).toBe(0);
  });
  it('admin history is authorized, validates cursor, and paginates by indexed keys', async () => {
    await seed('bot', [sig({ webdriver: true })]);
    await autoHideCareer(ctx.db, 'bot', ['webdriver'], 1, 'upload', NOW);
    const denied = await callJson(ctx.env, 'GET', '/v1/admin/automation/enforcement');
    expect(denied.status).toBe(401);
    const user = await issueGoogleCookie(ctx);
    expect(
      (await callJson(ctx.env, 'GET', '/v1/admin/automation/enforcement', { cookie: user.cookie }))
        .status,
    ).toBe(403);
    const admin = await issueAdminCookie(ctx);
    const env = { ...ctx.env, ADMIN_EMAILS: 'admin@example.com' };
    // issueAdminCookie uses the shared admin address.

    expect(
      (
        await callJson(env, 'GET', '/v1/admin/automation/enforcement?before=invalid', {
          cookie: admin.cookie,
        })
      ).status,
    ).toBe(400);
    const response = await callJson(env, 'GET', '/v1/admin/automation/enforcement', {
      cookie: admin.cookie,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { data } = (await response.json()) as { data: { actions: unknown[] } };
    expect(data.actions).toHaveLength(1);
    for (let i = 0; i < 55; i++)
      await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES(?,?)')
        .bind(
          `automation_action:${new Date(NOW + i + 1000).toISOString()}:bot:hide`,
          JSON.stringify({
            careerId: 'bot',
            at: new Date(NOW + i + 1000).toISOString(),
            action: 'hide',
            source: 'admin',
            ruleVersion: '1',
            reasons: [],
            seasons: 0,
          }),
        )
        .run();
    const first = await automationEnforcement(ctx.db, true);
    expect(first.actions).toHaveLength(50);
    expect(first.next).not.toBeNull();
    const second = await automationEnforcement(ctx.db, true, first.next!);
    expect(second.actions).toHaveLength(6);
    expect(second.next).toBeNull();
    expect(new Set([...first.actions, ...second.actions].map((a) => a.key)).size).toBe(56);
  });
  it('continues saved windows, reports failure, never advances failed checkpoints', async () => {
    await seed('bot', [sig({ webdriver: true })]);
    await ctx.env.DB.prepare(`INSERT INTO app_meta(key,value) VALUES(?,?)`)
      .bind(
        AUTOMATION_SWEEP_KEY,
        JSON.stringify({
          since: '',
          through: new Date(NOW).toISOString(),
          cursor: '',
          checked: 0,
          hidden: 0,
          status: 'running',
          updatedAt: new Date(NOW).toISOString(),
          ruleVersion: '1',
        }),
      )
      .run();
    await ctx.env.DB.prepare(
      "CREATE TRIGGER block_hide BEFORE UPDATE OF hidden ON careers BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    ).run();
    await expect(sweepAutomation(ctx.env.DB, NOW, true)).rejects.toThrow();
    expect((await automationEnforcement(ctx.db, true)).sweep).toMatchObject({
      status: 'error',
      cursor: '',
      checked: 0,
    });
    await ctx.env.DB.prepare('DROP TRIGGER block_hide').run();
    expect(await sweepAutomation(ctx.env.DB, NOW, true)).toMatchObject({
      status: 'complete',
      hidden: 1,
    });
    expect(await sweepAutomation(ctx.env.DB, NOW, true)).toBeNull();
  });
});
