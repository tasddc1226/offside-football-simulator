import { describe, expect, it } from 'vitest';
import { CONTROL_BASE, CONTROL_CAP, LEGEND_W_DETAIL } from '@offside/contracts/hof-rules';
import type { CareerSeasonPayload } from '@offside/contracts';
import { boundRetirement, sanitizeSeason, type StoredSeason } from './plausibility.js';

const seasons: StoredSeason[] = Array.from({ length: 10 }, (_, i) => ({
  year: 2030 + i,
  age: 20 + i,
  apps: 30,
  goals: 3,
  assists: 5,
  rating: CONTROL_BASE + CONTROL_CAP,
  cs: 0,
  caps: 0,
  ovr: 80,
  honors: [],
}));
const summary = {
  retireAge: 30,
  peak: 80,
  legendScore: 99_999,
  apps: 300,
  goals: 30,
  assists: 50,
  trophies: 0,
  awards: 0,
  caps: 0,
  ballon: 0,
  lastClub: '테스트 FC',
};

describe('boundRetirement 경기 장악 (T-11-021)', () => {
  it('중앙 미드필더의 레전드 점수 상한은 시즌 평점으로 낸 경기 장악만큼 높다', () => {
    const plain = boundRetirement('MF', summary, seasons)!.legendScore;
    const cm = boundRetirement('MF', summary, seasons, 'CM')!.legendScore;
    // 10시즌 × 30경기 × 평점 초과분(상한)
    expect(Math.abs(cm - plain - 300 * CONTROL_CAP * LEGEND_W_DETAIL.CM!.c!)).toBeLessThanOrEqual(
      1,
    );
    expect(boundRetirement('FW', summary, seasons, 'W')!.legendScore).toBeLessThan(cm);
  });
});

describe('나이별 OVR 상한 (T-11-023)', () => {
  const row = (age: number, ovr: number) =>
    sanitizeSeason({
      year: 2026 + age - 18,
      age,
      club: '테스트 FC',
      league: '리그',
      apps: 30,
      goals: 10,
      assists: 5,
      rating: 7,
      rank: 1,
      ovr,
      honors: [],
    } as unknown as CareerSeasonPayload).ovr;

  it('만 18~23세에 OVR 99로 올라온 기록은 나이별 상한으로 자른다', () => {
    expect([18, 19, 20, 21, 22, 23, 24].map((age) => row(age, 99))).toEqual([
      81, 87, 91, 94, 97, 97, 99,
    ]);
  });

  it('운영 실측 최고(18세 78·19세 84·20세 88)와 성인 OVR은 그대로 둔다', () => {
    expect([row(18, 78), row(19, 84), row(20, 88)]).toEqual([78, 84, 88]);
    expect(row(30, 97)).toBe(97);
  });
});

describe('커리어 은퇴 나이 (T-11-045)', () => {
  // 18세부터 44세까지 뛴 기록.
  const long: StoredSeason[] = Array.from({ length: 27 }, (_, i) => ({
    ...seasons[0]!,
    year: 2026 + i,
    age: 18 + i,
  }));
  const sent = { ...summary, retireAge: 45, apps: 99_999 };

  it('시즌 1 선수(45세)는 44세 시즌까지 생애에 넣는다', () => {
    const r = boundRetirement('MF', sent, long, null, 45)!;
    expect(r.retireAge).toBe(45);
    expect(r.apps).toBe(27 * 30);
  });

  it('프리시즌 선수(41세)는 41세 이후 시즌을 빼고 41세 은퇴로 맞춘다', () => {
    const r = boundRetirement('MF', sent, long, null, 41)!;
    expect(r.retireAge).toBe(41);
    expect(r.apps).toBe(23 * 30);
  });
});
