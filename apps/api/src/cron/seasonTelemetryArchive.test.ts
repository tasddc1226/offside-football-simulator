import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { DAY_MS } from '../time.js';
import {
  archiveSeasonTelemetry,
  TELEMETRY_ARCHIVE_META_KEY,
  TELEMETRY_KEEP_DAYS,
} from './seasonTelemetryArchive.js';

const NOW = Date.parse('2026-10-20T03:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

let ctx: TestD1;
const bucket = () => ctx.env.BACKUP!;
const insert = (year: number, createdAt: string, events: string | null, growth: string | null) =>
  ctx.env.DB.prepare(
    `INSERT INTO season_telemetry (career_id, year, age, ovr, events_json, growth_json, created_at)
     VALUES ('car_t', ?1, ?2, 60, ?3, ?4, ?5)`,
  )
    .bind(year, year - 2008, events, growth, createdAt)
    .run();
const ids = async () =>
  (
    await ctx.env.DB.prepare('SELECT year FROM season_telemetry ORDER BY id').all<{
      year: number;
    }>()
  ).results.map((r) => r.year);

beforeAll(async () => {
  ctx = await createTestD1();
});
afterAll(() => ctx.dispose());

describe('T-11-207 측정 기록 보관', () => {
  it('보관 기간이 지난 행만 올라온 순서대로 R2에 올리고 지운다. 다시 돌면 할 일이 없다', async () => {
    // 기간 안의 행이 맨 앞이면 아무것도 읽지 않는다.
    await insert(2030, ago(DAY_MS), '[{"k":"ev"}]', null);
    expect(await archiveSeasonTelemetry(ctx.env.DB, bucket(), 'test', NOW)).toBeNull();
    await ctx.env.DB.prepare('DELETE FROM season_telemetry').run();

    const old = ago((TELEMETRY_KEEP_DAYS + 3) * DAY_MS);
    await insert(2026, old, '[{"k":"ev","id":"a"}]', '{"v":1,"o0":55}');
    await insert(2027, old, null, '{"v":1,"o0":56}');
    await insert(2028, ago((TELEMETRY_KEEP_DAYS + 1) * DAY_MS), '[{"k":"ev","id":"b"}]', null);
    await insert(2029, ago(DAY_MS), '[{"k":"ev","id":"c"}]', null); // 아직 보관 기간 안

    const r = await archiveSeasonTelemetry(ctx.env.DB, bucket(), 'test', NOW);
    expect(r).toMatchObject({ objects: 1, rows: 3 });
    expect(await ids()).toEqual([2029]);

    const listed = await bucket().list({ prefix: 'season-telemetry/test/' });
    expect(listed.objects).toHaveLength(1);
    const lines = new TextDecoder()
      .decode(
        gunzipSync(
          new Uint8Array(await (await bucket().get(listed.objects[0]!.key))!.arrayBuffer()),
        ),
      )
      .trim()
      .split('\n')
      .map(
        (l) =>
          JSON.parse(l) as {
            careerId: string;
            year: number;
            events: { id: string }[] | null;
            growth: { o0: number } | null;
          },
      );
    expect(
      lines.map((l) => [l.careerId, l.year, l.events?.[0]?.id ?? null, l.growth?.o0 ?? null]),
    ).toEqual([
      ['car_t', 2026, 'a', 55],
      ['car_t', 2027, null, 56],
      ['car_t', 2028, 'b', null],
    ]);
    const meta = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
      .bind(TELEMETRY_ARCHIVE_META_KEY)
      .first<{ value: string }>();
    expect(JSON.parse(meta!.value)).toMatchObject({ rows: 3 });

    expect(await archiveSeasonTelemetry(ctx.env.DB, bucket(), 'test', NOW)).toBeNull();
  });

  it('T-11-486a 광고 이용 요약도 R2 파일에 그대로 싣는다', async () => {
    await ctx.env.DB.prepare('DELETE FROM season_telemetry').run();
    const ads = '{"af":true,"rw":{"c":0,"p":0,"b":0},"fr":{"c":2,"p":0,"b":1},"it":0}';
    await ctx.env.DB.prepare(
      `INSERT INTO season_telemetry (career_id, year, age, ovr, events_json, growth_json, created_at, ads_json)
       VALUES ('car_ads', 2032, 24, 60, NULL, NULL, ?1, ?2)`,
    )
      .bind(ago((TELEMETRY_KEEP_DAYS + 2) * DAY_MS), ads)
      .run();
    expect(await archiveSeasonTelemetry(ctx.env.DB, bucket(), 'test-ads', NOW)).toMatchObject({
      rows: 1,
    });
    const listed = await bucket().list({ prefix: 'season-telemetry/test-ads/' });
    const line = new TextDecoder()
      .decode(
        gunzipSync(
          new Uint8Array(await (await bucket().get(listed.objects[0]!.key))!.arrayBuffer()),
        ),
      )
      .trim();
    expect((JSON.parse(line) as { ads: unknown }).ads).toEqual(JSON.parse(ads));
  });

  it('R2 업로드가 실패하면 D1 행을 지우지 않는다', async () => {
    await ctx.env.DB.prepare('DELETE FROM season_telemetry').run();
    await insert(2031, ago((TELEMETRY_KEEP_DAYS + 2) * DAY_MS), '[{"k":"ev"}]', null);
    const failing = {
      ...bucket(),
      createMultipartUpload: () => Promise.reject(new Error('r2 down')),
      put: () => Promise.reject(new Error('r2 down')),
    } as unknown as R2Bucket;
    await expect(archiveSeasonTelemetry(ctx.env.DB, failing, 'test', NOW)).rejects.toThrow(
      'r2 down',
    );
    expect(await ids()).toEqual([2031]);
  });
});
