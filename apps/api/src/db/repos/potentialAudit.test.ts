import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { appMeta, careers, scoutPity } from '../schema.js';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { issueCookie } from '../../test/http.js';
import {
  POTENTIAL_AUDIT,
  farmedOnUpload,
  hideFarmedPotential,
  potentialFarmed,
  sweepFarmedPotential,
} from './potentialAudit.js';

const NOW = '2026-10-22T12:00:00.000Z';
const HIGH = POTENTIAL_AUDIT.high;

describe('potentialFarmed', () => {
  it('운영 실측의 정상 구단주는 넘지 않는다', () => {
    // 높은 잠재력이 가장 많던 정상 구단주들(2026-09-22~10-22).
    expect(potentialFarmed({ careers: 6279, high: 59, scouts: 0, rerolls: 2 })).toBe(false);
    expect(potentialFarmed({ careers: 880, high: 61, scouts: 367, rerolls: 2842 })).toBe(false);
    expect(potentialFarmed({ careers: 717, high: 19, scouts: 5, rerolls: 2 })).toBe(false);
    expect(potentialFarmed({ careers: 96, high: 13, scouts: 43, rerolls: 189 })).toBe(false);
  });
  it('스카우트권 · 리롤권 없이 높은 잠재력만 모은 계정은 넘는다', () => {
    expect(potentialFarmed({ careers: 473, high: 386, scouts: 0, rerolls: 0 })).toBe(true);
    expect(potentialFarmed({ careers: 18, high: 13, scouts: 0, rerolls: 0 })).toBe(true);
  });
  it('여유(margin) 안의 운은 넘지 않는다', () => {
    expect(
      potentialFarmed({ careers: 10, high: POTENTIAL_AUDIT.margin, scouts: 0, rerolls: 0 }),
    ).toBe(false);
  });
});

describe('잠재력 조작 숨김 (T-11-462)', () => {
  let ctx: TestD1;
  let profileId: string;
  beforeEach(async () => {
    ctx = await createTestD1();
    profileId = (await issueCookie(ctx)).profileId;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  async function addCareers(n: number, pot: number, createdAt = NOW) {
    const ids = Array.from({ length: n }, () => crypto.randomUUID());
    for (const id of ids)
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
        pot,
        createdAt,
        updatedAt: createdAt,
      });
    return ids;
  }
  const hiddenOf = async (id: string) =>
    (await ctx.db.select({ h: careers.hidden }).from(careers).where(eq(careers.id, id)))[0]!.h;

  it('넘으면 최근 높은 잠재력 커리어만 숨기고, 운영자가 되돌린 커리어와 보통 선수는 둔다', async () => {
    const high = await addCareers(12, 96);
    const [normal] = await addCareers(1, 75);
    await ctx.db.insert(appMeta).values({ key: `anomaly_cleared:${high[0]}`, value: NOW });
    expect(await hideFarmedPotential(ctx.db, profileId, NOW)).toBe(11);
    expect(await hiddenOf(high[0]!)).toBe(0);
    expect(await hiddenOf(high[1]!)).toBe(1);
    expect(await hiddenOf(normal!)).toBe(0);
  });

  it('스카우트권으로 설명되면 숨기지 않는다', async () => {
    const high = await addCareers(12, 96);
    await ctx.db.insert(scoutPity).values({ profileId, used: 12, updatedAt: NOW });
    expect(await hideFarmedPotential(ctx.db, profileId, NOW)).toBe(0);
    expect(await hiddenOf(high[0]!)).toBe(0);
  });

  it('기간 밖 커리어는 세지 않는다', async () => {
    await addCareers(12, 96, '2026-08-01T00:00:00.000Z');
    expect(await hideFarmedPotential(ctx.db, profileId, NOW)).toBe(0);
  });

  it('첫 업로드 판정은 높은 잠재력일 때만 묻고, 올라오는 커리어를 더해 센다', async () => {
    await addCareers(POTENTIAL_AUDIT.margin, HIGH);
    expect(await farmedOnUpload(ctx.db, profileId, HIGH - 1, NOW)).toBe(false);
    expect(await farmedOnUpload(ctx.db, profileId, undefined, NOW)).toBe(false);
    expect(await farmedOnUpload(ctx.db, profileId, HIGH, NOW)).toBe(true);
  });

  it('매일 점검은 훑은 커리어의 구단주를 다시 판정한다', async () => {
    const high = await addCareers(12, 96);
    expect(await sweepFarmedPotential(ctx.db, [high[0]!], NOW)).toBe(12);
    expect(await sweepFarmedPotential(ctx.db, [], NOW)).toBe(0);
  });
});
