import { SeasonRecapResponseSchema, successEnvelope } from '@offside/contracts';
import { applySeasonSchedule, seasonSchedule } from '@offside/contracts/service-seasons';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeta } from '../db/repos/firsts.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { careersByIds, teamPlayerCard } from '../db/repos/ownerTeams.js';
import { careers } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';
import { closeMetaKey, closeStateOf, runSeasonClose } from './seasonClose.js';

const RecapRes = successEnvelope(SeasonRecapResponseSchema);
/** 시즌 1 마감(테스트 일정). */
const END = '2026-10-06T12:00:00.000Z';
const BEFORE = '2026-10-06T00:00:00.000Z';
const AFTER = '2026-10-06T13:00:00.000Z';

type Pos = 'GK' | 'DF' | 'MF' | 'FW';

describe('T-11-372 시즌 특별 카드', () => {
  let ctx: TestD1;
  let saved: ReturnType<typeof seasonSchedule>;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T00:00:00.000Z'));
    saved = seasonSchedule();
    // 요청마다 app_meta의 일정을 다시 입히므로(seasonSchedule.ts) 저장해 둔다.
    await saveSeasonSchedule(ctx.env.DB, [
      { id: 1, startsAt: saved[0]!.startsAt, endsAt: END, retireAt: 45 },
      { id: 2, startsAt: END, endsAt: null, retireAt: 45 },
    ]);
  });
  afterEach(async () => {
    applySeasonSchedule(saved);
    forgetSeasonSchedule();
    vi.useRealTimers();
    await ctx.dispose();
  });

  async function addCareer(
    profileId: string,
    o: {
      pos?: Pos;
      score: number;
      goals?: number;
      assists?: number;
      season?: number;
      retiredAt?: string;
      hidden?: boolean;
      retireAge?: number;
    },
  ) {
    const id = crypto.randomUUID();
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: o.pos ?? 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: BEFORE,
      updatedAt: BEFORE,
      retiredAt: o.retiredAt ?? BEFORE,
      retireAge: o.retireAge ?? 34,
      peak: 85,
      apps: 300,
      goals: o.goals ?? 0,
      assists: o.assists ?? 0,
      legendScore: o.score,
      lastClub: '서울',
      serviceSeason: o.season ?? 1,
      hidden: o.hidden ? 1 : 0,
    });
    // 카드도 함께(소유는 키운 사람). 팀 화면 · 시장의 카드 응답이 표식을 싣는지 본다.
    await ctx.db.run(sql`
      insert into cards (career_id, owner_id, pos, peak, legend_score, service_season, card_value, retire_value, created_at, updated_at)
      values (${id}, ${profileId}, ${o.pos ?? 'FW'}, 85, ${o.score}, ${o.season ?? 1}, 1000, 1000, ${BEFORE}, ${BEFORE})`);
    return id;
  }

  async function closeAll() {
    const steps: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await runSeasonClose(ctx.db, new Date().toISOString());
      if (!r) break;
      steps.push(`${r.season}:${r.step}`);
    }
    return steps;
  }

  const specials = () =>
    ctx.db.all<{ career_id: string; kind: string; rank: number; rule_version: number }>(
      sql`select career_id, kind, rank, rule_version from card_specials where season = 1 order by kind, rank`,
    );

  it('마감 전 은퇴한 로그인 구단주의 선수로 베스트 11 · 개인상을 고르고, 다시 돌려도 같다', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const anon = await issueCookie(ctx);
    // FW 네 명 중 위 셋이 베스트 11. 같은 점수면 먼저 은퇴한 선수가 앞선다.
    const fw1 = await addCareer(a.profileId, { score: 900, goals: 50, assists: 5 });
    const fw2 = await addCareer(b.profileId, {
      score: 800,
      goals: 200,
      retiredAt: '2026-10-05T00:00:00.000Z',
    });
    const fw3 = await addCareer(a.profileId, { score: 800, goals: 10 });
    const fw4 = await addCareer(b.profileId, { score: 700 });
    const gk = await addCareer(a.profileId, { pos: 'GK', score: 600 });
    const gk2 = await addCareer(b.profileId, { pos: 'GK', score: 500 });
    const mf = await addCareer(b.profileId, { pos: 'MF', score: 650, assists: 120 });
    const df = await addCareer(a.profileId, { pos: 'DF', score: 400 });
    // 후보가 아닌 선수: 로그인 안 한 구단주 · 숨김 · 마감 뒤 은퇴 · 은퇴 나이 미달 · 프리시즌.
    const anonId = await addCareer(anon.profileId, { score: 5000, goals: 999 });
    const hidden = await addCareer(a.profileId, { score: 4000, goals: 900, hidden: true });
    const late = await addCareer(a.profileId, { score: 3000, retiredAt: AFTER });
    const young = await addCareer(a.profileId, { score: 2500, retireAge: 25 });
    const pre = await addCareer(a.profileId, { score: 2000, season: 0 });

    const steps = await closeAll();
    expect(steps.filter((s) => s.startsWith('1:'))).toEqual([
      '1:records',
      '1:stats',
      '1:stats',
      '1:ach',
      '1:ranks',
      '1:honors',
      '1:specials',
      '1:division',
    ]);
    expect(await closeStateOf(ctx.db, 1)).toMatchObject({ step: 'done', cutoff: END });

    const rows = await specials();
    const of = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => r.career_id);
    expect(of('mvp')).toEqual([fw1]);
    expect(of('top_scorer')).toEqual([fw2]);
    expect(of('top_assist')).toEqual([mf]);
    expect(new Set(of('best11'))).toEqual(new Set([fw1, fw2, fw3, gk, mf, df]));
    // 포지션 안의 순위: FW는 900 → 800(먼저 은퇴) → 800.
    const fwRanks = rows.filter(
      (r) => r.kind === 'best11' && [fw1, fw2, fw3].includes(r.career_id),
    );
    expect(fwRanks.map((r) => [r.career_id, r.rank])).toEqual(
      expect.arrayContaining([
        [fw1, 1],
        [fw2, 2],
        [fw3, 3],
      ]),
    );
    expect(rows.every((r) => r.rule_version === 1)).toBe(true);
    for (const out of [fw4, gk2, anonId, hidden, late, young, pre])
      expect(rows.some((r) => r.career_id === out)).toBe(false);

    // 다시 돌려도(배포 전에 끝난 결산을 나중에 돌려도) 같은 결과.
    await setMeta(ctx.db, closeMetaKey(1), JSON.stringify({ step: 'specials', cutoff: END }));
    await closeAll();
    expect(await specials()).toEqual(rows);

    // 카드 응답에 표식이 실린다(최근 시즌 · 종류 순). 팔려도 카드를 따라간다.
    await ctx.db.run(sql`update cards set owner_id = ${b.profileId} where career_id = ${fw1}`);
    const [lite] = await careersByIds(ctx.db, [fw1]);
    expect(teamPlayerCard(lite!).specials).toEqual([
      { season: 1, kind: 'mvp', rank: 1 },
      { season: 1, kind: 'best11', rank: 1 },
    ]);
    const [plain] = await careersByIds(ctx.db, [fw4]);
    expect(teamPlayerCard(plain!)).not.toHaveProperty('specials');

    // 결산 화면: 그 시즌 특별 카드 전체(내 카드 표시)와 내 선수단 카드의 표식.
    const recap = RecapRes.parse(
      await (
        await callJson(ctx.env, 'GET', '/v1/owner/season-recap?season=1', { cookie: a.cookie })
      ).json(),
    );
    expect(recap.data.status).toBe('ready');
    const best = recap.data.recap!.seasonBest!;
    expect(best.map((x) => x.special.kind)).toEqual([
      'mvp',
      'top_scorer',
      'top_assist',
      ...Array(6).fill('best11'),
    ]);
    expect(best.find((x) => x.special.kind === 'mvp')).toMatchObject({
      card: { careerId: fw1 },
      mine: true,
    });
    expect(best.find((x) => x.special.kind === 'top_scorer')?.mine).toBe(false);
    const squad = recap.data.recap!.squad!;
    expect(squad.find((m) => m.card.careerId === gk)?.card.specials).toEqual([
      { season: 1, kind: 'best11', rank: 1 },
    ]);
  });

  it('후보가 없거나 프리시즌이면 표식을 매기지 않고 결산은 끝난다', async () => {
    const a = await issueGoogleCookie(ctx);
    await addCareer(a.profileId, { score: 900, season: 0 });
    await closeAll();
    expect(await closeStateOf(ctx.db, 0)).toMatchObject({ step: 'done' });
    expect(await closeStateOf(ctx.db, 1)).toMatchObject({ step: 'done' });
    expect(await ctx.db.all(sql`select * from card_specials`)).toEqual([]);
    const recap = RecapRes.parse(
      await (
        await callJson(ctx.env, 'GET', '/v1/owner/season-recap?season=0', { cookie: a.cookie })
      ).json(),
    );
    expect(recap.data.recap?.seasonBest).toEqual([]);
  });
});
