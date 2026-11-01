import { applySeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/client.js';
import {
  appMeta,
  balanceVersions,
  best11Seasons,
  best11Slots,
  careers,
  ownerAchievements,
  ownerTeams,
  profiles,
} from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { closeMetaKey, closeStateOf, runSeasonClose, type CloseStep } from './seasonClose.js';

const NOW = '2026-11-01T00:00:00.000Z';
const BEFORE = '2026-10-10T00:00:00.000Z';
const CUT = '2026-10-31T00:00:00.000Z';
const STEPS = ['records', 'stats', 'ach', 'ranks', 'honors', 'specials', 'division'] as const;
const SETTINGS = JSON.stringify({
  reducedMotion: 'SYSTEM',
  textScale: 100,
  theme: 'SYSTEM',
  defaultSimulationMode: 'CHAPTER',
});
type Fault =
  'before-write' | 'after-write' | 'before-checkpoint' | 'after-checkpoint' | 'batch-rollback';

// Test-only D1 boundary: fail real persisted writes, not a production hook or mocked
// phase implementation. A batch remains one atomic operation.
function faultDb(raw: D1Database, fault: Fault) {
  let fired = false;
  const sqlOf = new WeakMap<D1PreparedStatement, { sql: string; bindings: unknown[] }>();
  const isWrite = (sql: string) => /^\s*(insert|update|delete)\b/i.test(sql);
  const checkpoint = (bindings: unknown[]) => bindings.includes(closeMetaKey(1));
  async function execute<T>(write: boolean, cursor: boolean, fn: () => Promise<T>): Promise<T> {
    const selected = !fired && write && (fault.includes('checkpoint') ? cursor : !cursor);
    if (selected && fault.startsWith('before')) {
      fired = true;
      throw new Error('injected interruption');
    }
    const result = await fn();
    if (selected && fault.startsWith('after')) {
      fired = true;
      throw new Error('injected interruption');
    }
    return result;
  }
  const wrap = (
    statement: D1PreparedStatement,
    sql: string,
    bindings: unknown[] = [],
  ): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, key) {
        if (key === 'bind') return (...args: unknown[]) => wrap(target.bind(...args), sql, args);
        const value: unknown = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        const fn = value as (...args: unknown[]) => Promise<unknown>;
        if (['run', 'all', 'raw', 'first'].includes(String(key)))
          return (...args: unknown[]) =>
            execute(isWrite(sql), checkpoint(bindings), () => fn.apply(target, args));
        return fn.bind(target);
      },
    });
    sqlOf.set(proxy, { sql, bindings });
    return proxy;
  };
  const DB = new Proxy(raw, {
    get(target, key) {
      if (key === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
      if (key === 'batch')
        return (statements: D1PreparedStatement[]) => {
          if (fault === 'batch-rollback' && !fired) {
            fired = true;
            const broken = [...statements];
            // Execute the first write, then fail inside the actual D1 transaction.
            broken.splice(
              1,
              0,
              target.prepare('INSERT INTO nonexistent_recovery_fixture VALUES (1)'),
            );
            return target.batch(broken);
          }
          return execute(
            statements.some((s) => isWrite(sqlOf.get(s)?.sql ?? '')),
            false,
            () => target.batch(statements),
          );
        };
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { db: createDb(DB), fired: () => fired };
}

async function seed(ctx: TestD1) {
  // Migrations initialize this unrelated marker with wall time in each fresh DB.
  await ctx.env.DB.prepare("UPDATE app_meta SET value = ? WHERE key = 'push_tracking_started_at'")
    .bind(BEFORE)
    .run();
  await ctx.db.insert(appMeta).values({
    key: closeMetaKey(0),
    value: JSON.stringify({ step: 'done', cutoff: '2026-10-05T15:00:00.000Z', closedAt: BEFORE }),
  });
  await ctx.db.insert(balanceVersions).values({
    status: 'active',
    note: '',
    valuesJson: JSON.stringify({ teamDivRewardFrom: 1 }),
    createdBy: 'fixture',
    createdAt: BEFORE,
    updatedAt: BEFORE,
    activatedAt: BEFORE,
  });
  for (const [id, score] of [
    ['a', 500],
    ['b', 300],
  ] as const) {
    await ctx.db.insert(profiles).values({
      id,
      googleSub: `sub-${id}`,
      nickname: id,
      settingsJson: SETTINGS,
      createdAt: BEFORE,
      lastSeenAt: BEFORE,
    });
    await ctx.db
      .insert(ownerAchievements)
      .values({
        profileId: id,
        season: 1,
        score: 100,
        done: 1,
        players: 1,
        reachedAt: NOW,
        updatedAt: NOW,
      });
    await ctx.db.insert(careers).values({
      id: `career-${id}`,
      profileId: id,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: BEFORE,
      updatedAt: BEFORE,
      retiredAt: BEFORE,
      retireAge: 34,
      peak: 80,
      apps: 300,
      goals: score,
      assists: 12,
      legendScore: score,
      serviceSeason: 1,
    });
    await ctx.db.insert(ownerTeams).values({
      id: `team-${id}`,
      profileId: id,
      season: 1,
      name: id,
      formation: '4-3-3',
      slotsJson: '[]',
      filled: 11,
      ovr: 80,
      rating: score,
      division: 7,
      wins: 30,
      createdAt: BEFORE,
      updatedAt: BEFORE,
    });
  }
  await ctx.db.insert(best11Seasons).values({ season: 1, finalAt: CUT, updatedAt: CUT });
  await ctx.db
    .insert(best11Slots)
    .values({ season: 1, slot: 'ST', careerId: 'career-a', score: 500, since: CUT });
}

async function complete(db: Db) {
  for (let i = 0; i < 30; i++) if (!(await runSeasonClose(db, NOW, 1))) return;
  throw new Error('season close did not complete');
}
async function atStep(db: Db, step: CloseStep) {
  for (let i = 0; i < 30; i++) {
    if (((await closeStateOf(db, 1))?.step ?? 'records') === step) return;
    await runSeasonClose(db, NOW, 1);
  }
  throw new Error(`missing step: ${step}`);
}
async function snapshot(ctx: TestD1) {
  const tables = [
    'owner_season_records',
    'owner_honors',
    'owner_items',
    'card_specials',
    'owner_title_awards',
    'app_meta',
  ];
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => {
        const rows = await ctx.env.DB.prepare(`SELECT * FROM ${table}`).all();
        return [
          table,
          rows.results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        ];
      }),
    ),
  );
}

describe('season close interruption/replay parity (R7)', () => {
  let ctx: TestD1;
  let baseline: TestD1;
  beforeEach(async () => {
    applySeasonSchedule([
      { id: 1, startsAt: '2026-10-05T15:00:00.000Z', endsAt: CUT, retireAt: 45 },
    ]);
    ctx = await createTestD1();
    baseline = await createTestD1();
    await seed(ctx);
    await seed(baseline);
  });
  afterEach(async () => {
    await ctx.dispose();
    await baseline.dispose();
    applySeasonSchedule([]);
  });

  for (const step of STEPS) {
    it.each(['before-write', 'after-write', 'before-checkpoint', 'after-checkpoint'] as const)(
      `${step}: %s resumes to exactly the uninterrupted records/rewards/meta`,
      async (fault) => {
        await complete(baseline.db);
        await atStep(ctx.db, step);
        const injected = faultDb(ctx.env.DB, fault);
        await expect(runSeasonClose(injected.db, NOW, 1)).rejects.toThrow();
        expect(injected.fired()).toBe(true);
        await complete(ctx.db);
        expect(await snapshot(ctx)).toEqual(await snapshot(baseline));
        const done = await snapshot(ctx);
        await complete(ctx.db);
        expect(await snapshot(ctx)).toEqual(done);
      },
    );
  }
  it.each(['specials', 'division'] as const)(
    '%s: a mid-batch failure rolls back all writes and marker/reward together',
    async (step) => {
      await atStep(ctx.db, step);
      const before = await snapshot(ctx);
      const injected = faultDb(ctx.env.DB, 'batch-rollback');
      await expect(runSeasonClose(injected.db, NOW, 1)).rejects.toThrow();
      expect(injected.fired()).toBe(true);
      expect(await snapshot(ctx)).toEqual(before);
      await complete(ctx.db);
      await complete(baseline.db);
      expect(await snapshot(ctx)).toEqual(await snapshot(baseline));
    },
  );
});
