import { describe, expect, it } from 'vitest';
import { CLUBS, LAST_PHASE } from './data.js';
import { ovr } from './attributes.js';
import { newGame, newSeason, simBlock, dominance, scoreBoost, DOMINANCE_KNEE } from './engine.js';
import { SANGMU } from './military.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-10-039: 득점 기대값이 리그 평균 대비 우위에 지수로 붙어, OVR 90 공격수가 평균 63인 K리그1(김천 상무)에서
// 한 시즌 26경기 81골을 넣었다. 우위가 DOMINANCE_KNEE를 넘는 몫은 조금만 반영한다.
const elite = (seed: number, leagueId: string, club: GameState['club']): GameState => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: '홍길동', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  for (const k of Object.keys(s.attrs) as (keyof typeof s.attrs)[]) s.attrs[k] = 95;
  for (const k of Object.keys(s.sub)) s.sub[k] = 95;
  Object.assign(s, { leagueId, club: { ...club }, age: 26, trust: 1 });
  return s;
};
/** 리그 경기만 시즌 수만큼 돌려 경기당 득점을 낸다(부상·체력 저하는 매 구간 되돌려 출전 수를 맞춘다). */
const goalsPerApp = (s: GameState, seasons: number) => {
  let goals = 0,
    apps = 0,
    best = 0;
  for (let y = 0; y < seasons; y++) {
    s.season = newSeason(s);
    for (let ph = 1; ph <= LAST_PHASE; ph++) {
      s.phase = ph;
      Object.assign(s, { cond: 90, morale: 70, injury: 0 });
      simBlock(s);
    }
    goals += s.season.goals;
    apps += s.season.apps;
    best = Math.max(best, s.season.goals);
  }
  return { rate: goals / apps, best };
};

describe('상무 득점 폭증 (T-10-039)', () => {
  it('우위가 기준 이하면 그대로, 넘으면 넘는 몫만 줄인다', () => {
    expect(dominance(-5)).toBe(-5);
    expect(dominance(DOMINANCE_KNEE)).toBe(DOMINANCE_KNEE);
    expect(dominance(DOMINANCE_KNEE + 10)).toBeGreaterThan(DOMINANCE_KNEE);
    expect(dominance(DOMINANCE_KNEE + 10)).toBeLessThan(DOMINANCE_KNEE + 3);
    // 보통 시즌(우위 기준 이하 — T-10-042부터 공격 우위는 ATTACK_KNEE 8)의 기대값은 이전 공식과 같다.
    expect(scoreBoost(70, 72, 1.1, 63)).toBeCloseTo(
      Math.exp((70 - 63) / 20) * Math.exp(1.1 * 0.2),
      12,
    );
  });

  it('OVR 90대 공격수가 상무에서 경기당 2골씩 넣지 않는다', () => {
    const s = elite(11, SANGMU.leagueId, SANGMU);
    expect(ovr(s)).toBeGreaterThanOrEqual(90);
    const { rate, best } = goalsPerApp(s, 10);
    expect(rate).toBeLessThan(1.3);
    expect(best).toBeLessThanOrEqual(55);
  });

  it('같은 선수가 상무에서 넣는 골은 프리미어리그 강팀에서와 크게 다르지 않다', () => {
    const pl = CLUBS.find((c) => c.leagueId === 'pl')!;
    const sangmu = goalsPerApp(elite(12, SANGMU.leagueId, SANGMU), 10).rate;
    const top = goalsPerApp(elite(12, 'pl', pl), 10).rate;
    expect(sangmu / top).toBeLessThan(1.5);
  });
});
