import {
  CUP_DIVISIONS,
  CUP_DIVISION_FALLBACK_CAPS,
  CUP_JUNIOR_MIN_FILLED,
  currentCup,
  divisionCaps,
  divisionFor,
  planCup,
  type CupDef,
} from '@offside/contracts/cup';
import { parseTitle, titleIdOf, titlesOf } from '@offside/contracts/owner-title';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cupText } from '../cupText.js';
import { cupEntries, cups, notifications, ownerTeams, profiles } from '../db/schema.js';
import { checkCupLineup } from '../routes/cup.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { cupEntriesOf, cupStateOf, runCup, settleDivisions } from './cup.js';
import { fillDivisionCaps, nextCupsFor } from './cupAutopilot.js';

// T-11-410 OVR 구간별 대회.

const BASE = planCup({ id: '', season: 1, edition: 3, opensOn: '2026-10-09' });
const division = (d: (typeof CUP_DIVISIONS)[number], ovrMax: number | null): CupDef => ({
  ...BASE,
  id: `s1-3-${d}`,
  division: d,
  ovrMax,
});
const EDITION = [division('junior', 80), division('senior', 88), division('master', null)];

describe('T-11-410 구간 규칙', () => {
  it('상한은 시즌 팀 OVR 1/3 · 2/3 지점, 팀이 적으면 기본값', () => {
    const ovrs = Array.from({ length: 90 }, (_, i) => 60 + Math.floor(i / 3));
    expect(divisionCaps(ovrs)).toEqual([70, 80]);
    // 몰려 있으면 한 칸씩 띄운다.
    expect(divisionCaps(Array(40).fill(92))).toEqual([92, 93]);
    expect(divisionCaps([90, 91])).toEqual([...CUP_DIVISION_FALLBACK_CAPS]);
  });

  it('내 OVR로 들어갈 가장 낮은 구간, 상한이 아직 없는 아랫 구간은 건너뛴다', () => {
    expect(divisionFor(EDITION, 75)!.division).toBe('junior');
    expect(divisionFor(EDITION, 80)!.division).toBe('junior');
    expect(divisionFor(EDITION, 81)!.division).toBe('senior');
    expect(divisionFor(EDITION, 99)!.division).toBe('master');
    const capless = EDITION.map((c) => ({ ...c, ovrMax: null }));
    expect(divisionFor(capless, 60)!.division).toBe('master');
  });

  it('지금 보여 줄 대회는 마스터', () => {
    expect(currentCup(BASE.opensAt, EDITION)!.id).toBe('s1-3-master');
  });

  it('칭호 id에 구간이 들어가고, 같은 단계면 윗 구간 · 통합 대회가 먼저', () => {
    expect(titleIdOf(3, 'champion', 'junior')).toBe('cup-3-junior-champion');
    expect(parseTitle('cup-3-master-sf')).toEqual({ edition: 3, stage: 'sf', division: 'master' });
    expect(parseTitle('cup-2-champion')).toEqual({ edition: 2, stage: 'champion' });
    expect(
      titlesOf([
        { edition: 3, stage: 'champion', division: 'junior' },
        { edition: 2, stage: 'champion' },
        { edition: 4, stage: 'runnerup', division: 'master' },
        { edition: 4, stage: 'champion', division: 'senior' },
      ]),
    ).toEqual([
      'cup-2-champion',
      'cup-4-senior-champion',
      'cup-3-junior-champion',
      'cup-4-master-runnerup',
    ]);
  });

  it('서버 문구: 구간 대회 이름도 영어 · 일본어로 옮긴다', () => {
    const ko = '시즌 2 제3회 오프사이드 컵 주니어 우승!';
    expect(cupText(ko, 'en')).toContain('Season 2 OFFSIDE Cup #3 Junior');
    expect(cupText(ko, 'ja')).toContain('ジュニア');
  });
});

describe('T-11-410 다음 회차', () => {
  afterEach(() => void applySeasonSchedule([]));
  const PREV: CupDef = {
    ...planCup({ id: 's1-2', season: 1, edition: 2, opensOn: '2026-10-16' }),
  };

  it('제3회가 다음 시즌으로 넘어가면 개막 이틀 뒤 21:10에 구간 셋을 함께 연다', () => {
    applySeasonSchedule(closeSeasonSchedule(1, '2026-10-30T15:00:00.000Z', false));
    const next = nextCupsFor(PREV);
    expect(next.map((c) => c.id)).toEqual(['s2-3-junior', 's2-3-senior', 's2-3-master']);
    // 10-31 00:00 KST 개막 → 11-02 21:10 KST.
    expect(new Set(next.map((c) => c.opensAt))).toEqual(new Set(['2026-11-02T12:10:00.000Z']));
    expect(next.every((c) => c.ovrMax === null)).toBe(true);
    // T-11-527 주니어만 참가 자격을 낮춘다.
    expect(next.map((c) => c.minFilled)).toEqual([CUP_JUNIOR_MIN_FILLED, 8, 8]);
  });
});

describe('T-11-410 구간 대회 진행', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    for (const c of EDITION)
      await ctx.db.insert(cups).values({
        id: c.id,
        season: c.season,
        edition: c.edition,
        opensAt: c.opensAt,
        closesAt: c.closesAt,
        drawAt: c.drawAt,
        roundsJson: JSON.stringify(c.rounds),
        capacity: c.capacity,
        minFilled: c.minFilled,
        createdAt: c.opensAt,
        division: c.division!,
        ovrMax: c.ovrMax ?? null,
      });
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  async function enter(cup: CupDef, ovrs: readonly number[], filled = 11) {
    const out: { profileId: string; teamId: string }[] = [];
    for (const ovr of ovrs) {
      const profileId = `prf_${crypto.randomUUID()}`;
      await ctx.db.insert(profiles).values({
        id: profileId,
        settingsJson: '{}',
        createdAt: cup.opensAt,
        lastSeenAt: cup.opensAt,
      });
      const teamId = `tem_${crypto.randomUUID()}`;
      await ctx.db.insert(ownerTeams).values({
        id: teamId,
        profileId,
        season: 1,
        name: `팀${ovr}`,
        manager: '감독',
        formation: '4-4-2',
        slotsJson: JSON.stringify(Array(11).fill(null)),
        filled,
        ovr,
        createdAt: cup.opensAt,
        updatedAt: cup.opensAt,
      });
      await ctx.db.insert(cupEntries).values({
        cupId: cup.id,
        teamId,
        profileId,
        name: `팀${ovr}`,
        manager: '감독',
        ovr,
        createdAt: cup.opensAt,
        updatedAt: cup.opensAt,
      });
      out.push({ profileId, teamId });
    }
    return out;
  }
  const [JUNIOR, SENIOR, MASTER] = EDITION as [CupDef, CupDef, CupDef];
  const countIn = async (cup: CupDef) =>
    (await cupEntriesOf(ctx.db, cup.id)).filter((e) => e.status === 'active').length;

  it('추첨 전 정리: 상한을 넘은 팀은 위로, 모자란 구간은 윗 구간에 합친다', async () => {
    // 주니어 10팀 중 2팀은 그사이 OVR이 85 · 95로 올랐다. 시니어 5팀(모자람), 마스터 12팀.
    const juniors = await enter(JUNIOR, [70, 71, 72, 73, 74, 75, 76, 77, 85, 95]);
    await enter(SENIOR, [82, 83, 84, 85, 86]);
    await enter(
      MASTER,
      Array.from({ length: 12 }, (_, i) => 90 + (i % 9)),
    );
    // 주니어에서 85 팀은 시니어로(그 뒤 시니어는 6팀이라 마스터에 합쳐진다), 95 팀은 마스터로.
    expect(await settleDivisions(ctx.db, EDITION, JUNIOR.drawAt)).toEqual({ moved: 7 });
    expect([await countIn(JUNIOR), await countIn(SENIOR), await countIn(MASTER)]).toEqual([
      8, 0, 19,
    ]);
    // 두 번째 cron은 건너뛴다.
    expect(await settleDivisions(ctx.db, EDITION, JUNIOR.drawAt)).toBeNull();
    const moved = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.profileId, juniors[9]!.profileId));
    expect(moved.map((n) => n.title)).toEqual(['시즌 1 제3회 오프사이드 컵 마스터로 옮겼어요']);
  });

  it('T-11-552 신청이 30팀 이상이면 신청 팀 OVR 3등분으로 상한을 다시 정하고 아래로도 옮긴다', async () => {
    // 센 팀이 마스터로 몰렸다: 주니어 2팀, 시니어 4팀, 마스터 30팀(84~93).
    await enter(JUNIOR, [70, 75]);
    await enter(SENIOR, [80, 82, 84, 86]);
    const masters = await enter(
      MASTER,
      Array.from({ length: 30 }, (_, i) => 84 + (i % 10)),
    );
    // 36팀을 OVR 순으로 12팀씩 끊은 경계 OVR: 상한 86 · 89(경계 OVR이 같은 팀은 아랫 구간에 남아 15 · 9 · 12팀).
    expect(await settleDivisions(ctx.db, EDITION, JUNIOR.drawAt)).toEqual({ moved: 22 });
    expect([await countIn(JUNIOR), await countIn(SENIOR), await countIn(MASTER)]).toEqual([
      15, 9, 12,
    ]);
    expect(
      (await ctx.db.select().from(cups))
        .filter((c) => c.edition === 3)
        .map((c) => [c.id, c.ovrMax])
        .sort(),
    ).toEqual([
      ['s1-3-junior', 86],
      ['s1-3-master', null],
      ['s1-3-senior', 89],
    ]);
    const note = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.profileId, masters[0]!.profileId));
    expect(note.map((n) => n.title)).toEqual(['시즌 1 제3회 오프사이드 컵 주니어로 옮겼어요']);
  });

  it('마스터가 모자라면 바로 아랫 구간을 마스터로 올린다', async () => {
    await enter(
      JUNIOR,
      Array.from({ length: 9 }, (_, i) => 70 + i),
    );
    await enter(
      SENIOR,
      Array.from({ length: 8 }, (_, i) => 81 + i),
    );
    await enter(MASTER, [95, 96, 97]);
    await settleDivisions(ctx.db, EDITION, JUNIOR.drawAt);
    expect([await countIn(JUNIOR), await countIn(SENIOR), await countIn(MASTER)]).toEqual([
      9, 0, 11,
    ]);
  });

  it('T-11-527 주니어 자격으로 신청한 팀은 윗 구간에 합쳐져도 추첨에서 떨어지지 않는다', async () => {
    await ctx.db
      .update(cups)
      .set({ minFilled: CUP_JUNIOR_MIN_FILLED })
      .where(eq(cups.id, JUNIOR.id));
    const edition = EDITION.map((c) => ({
      ...c,
      minFilled: c.division === 'junior' ? CUP_JUNIOR_MIN_FILLED : c.minFilled,
    }));
    // 주니어 5팀(선발 6명, 모자람) → 시니어에 합친다. 시니어 8팀 · 마스터 8팀은 그대로.
    await enter(JUNIOR, [70, 71, 72, 73, 74], CUP_JUNIOR_MIN_FILLED);
    await enter(
      SENIOR,
      Array.from({ length: 8 }, (_, i) => 81 + i),
    );
    await enter(
      MASTER,
      Array.from({ length: 8 }, (_, i) => 90 + i),
    );
    await runCup(ctx.db, JUNIOR.drawAt, edition);
    expect([await countIn(JUNIOR), await countIn(SENIOR), await countIn(MASTER)]).toEqual([
      0, 13, 8,
    ]);
    const [senior] = await ctx.db.select().from(cups).where(eq(cups.id, SENIOR.id));
    expect(senior!.minFilled).toBe(CUP_JUNIOR_MIN_FILLED);
    // 마스터는 옮겨 온 팀이 없어 그대로.
    const [master] = await ctx.db.select().from(cups).where(eq(cups.id, MASTER.id));
    expect(master!.minFilled).toBe(8);
  });

  it('cron은 구간마다 추첨하고 경기 예산을 나눠 쓴다, 추첨 뒤에는 상한을 넘는 명단을 막는다', async () => {
    const [j] = await enter(
      JUNIOR,
      Array.from({ length: 16 }, (_, i) => 65 + (i % 15)),
    );
    await enter(
      SENIOR,
      Array.from({ length: 16 }, (_, i) => 81 + (i % 7)),
    );
    await enter(
      MASTER,
      Array.from({ length: 16 }, (_, i) => 89 + (i % 10)),
    );
    await runCup(ctx.db, JUNIOR.drawAt, EDITION);
    for (const c of EDITION) expect((await cupStateOf(ctx.db, c.id))[0]?.groups).toBe(8);
    // 조별 1차전: 구간마다 8경기, 합 24경기는 예산(32) 안이라 cron 한 번에 끝난다.
    const log = await runCup(ctx.db, JUNIOR.rounds[0]!, EDITION);
    expect(log!.filter((l) => l.step === 'play').map((l) => l.n)).toEqual([8, 8, 8]);
    // T-11-552 추첨 전 정리가 상한을 신청 팀 분포(아래 1/3 · 2/3의 가장 높은 OVR)로 다시 정했다: 80 · 88 → 79 · 87.
    expect(
      (await ctx.db.select().from(cups))
        .filter((c) => c.edition === 3)
        .map((c) => [c.id, c.ovrMax])
        .sort(),
    ).toEqual([
      ['s1-3-junior', 79],
      ['s1-3-master', null],
      ['s1-3-senior', 87],
    ]);
    await expect(
      checkCupLineup(ctx.db, j!.profileId, 1, [], 11, JUNIOR.drawAt, 80),
    ).rejects.toMatchObject({ details: { reason: 'CUP_OVR_CAP' } });
    await expect(
      checkCupLineup(ctx.db, j!.profileId, 1, [], 11, JUNIOR.drawAt, 79),
    ).resolves.toBeUndefined();
    // 접수 중에는 막지 않는다(신청을 옮기면 된다).
    await expect(
      checkCupLineup(ctx.db, j!.profileId, 1, [], 11, JUNIOR.opensAt, 90),
    ).resolves.toBeUndefined();
  });

  it('접수가 열리면 비어 있는 아랫 구간 상한을 시즌 팀 분포로 채운다', async () => {
    const capless = EDITION.map((c) => ({ ...c, ovrMax: null }));
    await ctx.db.update(cups).set({ ovrMax: null });
    // 시즌 팀이 30개보다 적으면 기본 상한.
    expect(await fillDivisionCaps(ctx.db, BASE.opensAt, capless)).toEqual([
      's1-3-junior:80',
      's1-3-senior:88',
    ]);
    expect(capless.map((c) => c.ovrMax)).toEqual([80, 88, null]);
    // 이미 채운 대회는 다시 건드리지 않는다.
    expect(await fillDivisionCaps(ctx.db, BASE.opensAt, capless)).toEqual([]);
  });
});
