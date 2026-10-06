import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ovrCapAt } from '../../plausibility.js';
import { careers, careerSeasons } from '../schema.js';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { issueCookie } from '../../test/http.js';
import {
  ANOMALY,
  anomalyReport,
  exceedsOvrCap,
  growthTampered,
  seasonReasons,
  setCareerHidden,
  sweepAnomalies,
  SWEPT_AT_KEY,
} from './anomalies.js';

const NOW = Date.parse('2026-10-02T19:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const DAY = 24 * 3_600_000;

describe('seasonReasons', () => {
  it('나이별 상한 안이면 이유가 없다', () => {
    expect(seasonReasons(18, 78, null)).toEqual([]);
    expect(seasonReasons(20, 88, 10)).toEqual([]);
    expect(seasonReasons(30, 99, 3)).toEqual([]);
  });
  it('상한을 조금 넘으면 검토, 크게 넘으면 숨김 이유', () => {
    expect(seasonReasons(19, 88, null)).toEqual(['ovrHigh']);
    expect(seasonReasons(18, ovrCapAt(18) + ANOMALY.farMargin, null)).toEqual(['ovrHigh']);
    expect(seasonReasons(18, 99, null)).toEqual(['ovrFar']);
  });
  it('한 시즌 상승 폭이 정상 최대(22)보다 크면 숨김 이유', () => {
    expect(seasonReasons(25, 80, 22)).toEqual([]);
    expect(seasonReasons(25, 90, ANOMALY.jump)).toEqual(['jump']);
  });
});

describe('growthTampered (T-11-097)', () => {
  const g = (o0: number, ph: number[]) => ({
    v: 1 as const,
    o0,
    ph,
    a0: [],
    a1: [],
    s0: [],
    s1: [],
    pot: { s: 75, b: 0, bl: 0, r: 0 },
  });
  const step = ANOMALY.growthStep;
  it('구간 사이(시작·구간·시즌 끝) 한 번에 growthStep 이상 오르면 참이다', () => {
    expect(growthTampered(g(60, [60, 60 + step - 1, 70]), 70, null)).toBe(false);
    expect(growthTampered(g(60, [60 + step]), 80, null)).toBe(true);
    expect(growthTampered(g(60, [61, 62]), 62 + step, null)).toBe(true);
  });
  it('구간 기록이 없으면 시즌 전체 성장과 구분할 수 없어 보지 않는다', () => {
    expect(growthTampered(g(60, []), 60 + step, null)).toBe(false);
  });
  it('시작 OVR이 지난 시즌 저장값보다 growthCarry 이상 높으면 참이다', () => {
    expect(growthTampered(g(80, [80]), 80, 80 - ANOMALY.growthCarry + 1)).toBe(false);
    expect(growthTampered(g(80, [80]), 80, 80 - ANOMALY.growthCarry)).toBe(true);
  });
  it('성장 기록이 없으면 거짓이다', () => {
    expect(growthTampered(undefined, 99, 50)).toBe(false);
  });
});

describe('exceedsOvrCap', () => {
  it('상한을 farMargin 넘게 넘길 때만 참이다', () => {
    expect(exceedsOvrCap(18, ovrCapAt(18) + ANOMALY.farMargin)).toBe(false);
    expect(exceedsOvrCap(18, ovrCapAt(18) + ANOMALY.farMargin + 1)).toBe(true);
    expect(exceedsOvrCap(30, 99)).toBe(false);
  });
});

describe('비정상 기록 정기 점검', () => {
  let ctx: TestD1;
  let profileId: string;
  const q = <T>(sql: string, ...args: unknown[]) =>
    ctx.env.DB.prepare(sql)
      .bind(...args)
      .all<T>()
      .then((r) => r.results);
  const hiddenOf = async (id: string) =>
    (await q<{ hidden: number }>('SELECT hidden FROM careers WHERE id = ?1', id))[0]!.hidden;

  async function career(id: string, seasons: [age: number, ovr: number][], extra = {}) {
    const now = iso(-DAY);
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
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
    await ctx.db.insert(careerSeasons).values(
      seasons.map(([age, ovr], i) => ({
        careerId: id,
        year: 2026 + i,
        age,
        club: 'A',
        league: 'L',
        apps: 30,
        goals: 10,
        assists: 5,
        rating: 7,
        rank: '1',
        ovr,
        honorsJson: '[]',
        mil: 0,
        eventsJson: '[]',
        createdAt: now,
      })),
    );
  }

  beforeEach(async () => {
    ctx = await createTestD1();
    profileId = (await issueCookie(ctx)).profileId;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('확실한 이상만 숨기고, 정상·애매한 기록은 둔다', async () => {
    await career('honest', [
      [18, 60],
      [19, 72],
      [20, 85],
    ]);
    await career('far', [
      [18, 99],
      [19, 99],
    ]);
    await career('jump', [
      [24, 60],
      [25, 88],
    ]);
    await career('near', [
      [18, 70],
      [19, 88],
    ]); // 19세 상한(87)을 1 넘음 — 검토
    const r = await sweepAnomalies(ctx.env.DB, NOW);
    expect(r).toMatchObject({ hidden: 2, review: 1 });
    expect(await hiddenOf('far')).toBe(1);
    expect(await hiddenOf('jump')).toBe(1);
    expect(await hiddenOf('honest')).toBe(0);
    expect(await hiddenOf('near')).toBe(0);
    const report = await anomalyReport(ctx.env.DB, NOW);
    expect(report.review.map((c) => [c.careerId, c.reasons])).toEqual([['near', ['ovrHigh']]]);
    expect(report.hidden.map((c) => c.careerId).sort()).toEqual(['far', 'jump']);
  });

  it('두 번째부터는 마지막 점검 뒤에 올라온 시즌만 본다', async () => {
    await sweepAnomalies(ctx.env.DB, NOW);
    await career('late', [[18, 99]]);
    // 점검 전에 올라온 기록이라 시각이 마지막 점검(NOW)보다 이르다 — 한 시간 겹침 밖이면 다음 날로 넘어가지 않는다.
    expect((await sweepAnomalies(ctx.env.DB, NOW + DAY)).hidden).toBe(0);
    await ctx.env.DB.prepare('UPDATE career_seasons SET created_at = ?1')
      .bind(iso(DAY - 60_000))
      .run();
    expect((await sweepAnomalies(ctx.env.DB, NOW + 2 * DAY)).hidden).toBe(1);
  });

  it('은퇴 레전드 점수가 높으면 검토 목록에만 올린다', async () => {
    await career('star', [[18, 60]], {
      status: 'retired',
      retireAge: 35,
      legendScore: ANOMALY.legend,
    });
    expect((await sweepAnomalies(ctx.env.DB, NOW)).hidden).toBe(0);
    const report = await anomalyReport(ctx.env.DB, NOW);
    expect(report.review).toMatchObject([{ careerId: 'star', reasons: ['legend'] }]);
  });

  it('은퇴 레전드 점수가 정상 최고보다 크게 높으면 숨긴다', async () => {
    await career('fake', [[18, 60]], {
      status: 'retired',
      retireAge: 35,
      legendScore: ANOMALY.legendHide,
    });
    expect((await sweepAnomalies(ctx.env.DB, NOW)).hidden).toBe(1);
    expect(await hiddenOf('fake')).toBe(1);
  });

  it('숨김 처리하면 쥐고 있던 서버 기록을 비우고, 되돌린 커리어는 다시 걸지 않는다', async () => {
    await career('far', [[18, 99]]);
    await ctx.env.DB.prepare(
      `INSERT INTO server_firsts (id, career_id, achieved_at, year) VALUES ('f1', 'far', ?1, 2026)`,
    )
      .bind(iso(-DAY))
      .run();
    await sweepAnomalies(ctx.env.DB, NOW);
    expect(await q('SELECT * FROM server_firsts')).toEqual([]);

    expect(await setCareerHidden(ctx.env.DB, 'far', false, NOW)).toBe(true);
    expect(await hiddenOf('far')).toBe(0);
    await ctx.env.DB.prepare('DELETE FROM app_meta WHERE key = ?1').bind(SWEPT_AT_KEY).run();
    expect((await sweepAnomalies(ctx.env.DB, NOW + DAY)).hidden).toBe(0); // 전부 다시 훑어도 되돌린 건 둔다
    expect((await anomalyReport(ctx.env.DB, NOW)).review).toEqual([]);

    expect(await setCareerHidden(ctx.env.DB, 'far', true, NOW)).toBe(true);
    expect(await hiddenOf('far')).toBe(1);
    expect(await setCareerHidden(ctx.env.DB, 'nope', true, NOW)).toBe(false);
  });
});
