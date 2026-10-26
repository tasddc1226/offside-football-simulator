import { describe, expect, it } from 'vitest';
import { BALANCE_SPEC } from './balance-spec.js';
import {
  achGradeAt,
  achGradeCutoff,
  seasonRecordRewardOf,
  type SeasonRecordFacts,
  PAST_SALARY_BUDGET,
  PAST_SALARY_TABLE,
  pastSalarySum,
  salaryOf,
  seasonSalaryOf,
  ACH_GRADES,
  DETAIL_GROUP,
  FORMATION_IDS,
  FORMATION_ROWS,
  FORMATIONS,
  LINEUP_SIZE,
  SHAPE_IDS,
  presetLayout,
  shapeBase,
  shapeLayout,
  matchShape,
  shapeOf,
  LINE_BASE,
  LINES,
  YOUTH_OVR,
  fit,
  lineStrength,
  ratingChange,
  repeatFactor,
  slotFit,
  slotRating,
  teamOvr,
  achGradeOf,
  PAST_SALARY_BUDGET_STEP,
  seasonSalaryBudget,
} from './owner-team.js';
import {
  SCOUT_PITY_S2,
  cupPredictionCap,
  cupReward,
  cupScouts,
  scoutPityGauge,
  scoutPityOf,
  scoutPityView,
} from './cup.js';
import {
  ManagerNameSchema,
  PutOwnerTeamBodySchema,
  TeamLayoutSchema,
  TeamNameSchema,
} from './teams.js';

describe('T-10-092 포메이션', () => {
  it.each(FORMATION_IDS)('%s는 11자리이고 줄 인원 합과 계열 순서가 맞다', (id) => {
    const slots = FORMATIONS[id];
    expect(slots).toHaveLength(LINEUP_SIZE);
    expect(FORMATION_ROWS[id].reduce((a, b) => a + b, 0)).toBe(LINEUP_SIZE);
    expect(slots.filter((s) => s === 'GK')).toHaveLength(1);
    expect(slots[0]).toBe('GK');
    // 줄마다 같은 계열이다(3-5-2의 윙백 FB는 미드필더 줄이라 예외).
    const [, def, mid, fwd] = FORMATION_ROWS[id];
    const groups = slots.map((s) => DETAIL_GROUP[s]);
    expect(groups.slice(1, 1 + def!).every((g) => g === 'DF')).toBe(true);
    expect(groups.slice(-fwd!).every((g) => g === 'FW')).toBe(true);
    expect(mid).toBe(LINEUP_SIZE - 1 - def! - fwd!);
  });
});

describe('fit', () => {
  it('세부 포지션이 같으면 1.0, 모르면 같은 계열 0.95, 같은 계열 다른 자리 0.9', () => {
    expect(fit('ST', 'FW', 'ST')).toBe(1);
    expect(fit('ST', 'FW', null)).toBe(0.95);
    expect(fit('ST', 'FW')).toBe(0.95);
    expect(fit('ST', 'FW', 'W')).toBe(0.9);
    expect(fit('CB', 'DF', 'FB')).toBe(0.9);
  });
  it('필드끼리 다른 계열 0.75, 골키퍼 ↔ 필드 0.3', () => {
    expect(fit('ST', 'MF')).toBe(0.75);
    expect(fit('CB', 'FW', 'ST')).toBe(0.75);
    expect(fit('GK', 'FW')).toBe(0.3);
    expect(fit('ST', 'GK', 'GK')).toBe(0.3);
    expect(fit('GK', 'GK')).toBe(0.95);
  });
  it('실력 = 최고 OVR × 적합도, 팀 OVR은 빈 자리를 유스로 센 평균', () => {
    expect(slotRating('ST', { peak: 90, pos: 'FW', dpos: null })).toBe(86);
    expect(teamOvr(Array.from({ length: 11 }, () => null))).toBe(YOUTH_OVR);
    expect(teamOvr([83, ...Array.from({ length: 10 }, () => null)])).toBe(53);
  });
});

describe('T-10-092 자리별 실력·줄 무게', () => {
  const roles = { GK: 30, CB: 60, FB: 70, DM: 75, CM: 80, AM: 88, W: 85, ST: 83 } as const;
  it('자리별 실력이 있으면 그 값을 쓰되 최고 OVR + 2(T-11-197)를 넘지 않는다', () => {
    expect(slotRating('AM', { peak: 86, pos: 'MF', dpos: 'AM', roles })).toBe(88);
    expect(slotRating('AM', { peak: 85, pos: 'MF', dpos: 'AM', roles })).toBe(87);
    expect(slotFit('AM', { peak: 85, pos: 'MF', dpos: 'AM', roles })).toBe(1.02);
    expect(slotRating('W', { peak: 86, pos: 'MF', dpos: 'AM', roles })).toBe(85);
    expect(slotRating('CB', { peak: 86, pos: 'MF', dpos: 'AM', roles })).toBe(60);
    // T-11-237 타겟맨 유형은 스트라이커 자리(ST·CF·SS)에서 최고 OVR 아래로 내려가지 않는다. 다른 자리·다른 유형은 그대로.
    const tm = { GK: 20, CB: 62, FB: 55, DM: 60, CM: 64, AM: 70, W: 66, ST: 78 } as const;
    const target = { peak: 85, pos: 'FW', dpos: 'ST', roles: tm, type: 'target' } as const;
    expect(slotRating('ST', target)).toBe(85);
    expect(slotRating('CF', target)).toBe(85);
    expect(slotRating('W', target)).toBe(66);
    expect(slotRating('ST', { ...target, type: 'poacher' })).toBe(78);
    expect(slotRating('ST', { ...target, roles: { ...tm, ST: 90 } })).toBe(87);
    // roles가 null이면 옛 적합도 규칙.
    expect(slotRating('W', { peak: 86, pos: 'MF', dpos: 'AM', roles: null })).toBe(65);
  });
  it('T-11-383 윙어 유형은 좌·우 미드필더 자리에서 중앙 미드필더 · 윙어 역할 중 높은 쪽으로 뛴다', () => {
    // 스피드로 키운 측면 미드필더 윙어(최고 OVR = 윙어 역할 80): 예전엔 LM 자리를 중앙 미드필더 역할(70)로 쟀다.
    const wr = { GK: 20, CB: 50, FB: 62, DM: 58, CM: 70, AM: 72, W: 80, ST: 66 } as const;
    const winger = { peak: 80, pos: 'MF', dpos: 'LM', roles: wr, type: 'winger' } as const;
    expect(slotRating('LM', winger)).toBe(80);
    expect(slotRating('RM', winger)).toBe(80);
    expect(slotFit('LM', winger)).toBe(1);
    // W · LW · RW 자리는 원래 윙어 역할이고, 중앙 자리는 그대로다.
    expect(slotRating('LW', winger)).toBe(80);
    expect(slotRating('CM', winger)).toBe(70);
    // 중앙 미드필더 역할이 더 높으면 그쪽, 윙어 유형이 아니면 예전처럼 중앙 미드필더 역할만.
    expect(slotRating('LM', { ...winger, roles: { ...wr, CM: 82 } })).toBe(82);
    expect(slotRating('LM', { ...winger, type: 'maker' })).toBe(70);
    // 최고 OVR + 2를 넘지 않는다.
    expect(slotRating('LM', { ...winger, peak: 75 })).toBe(77);
  });
  it('줄 기준 인원의 합은 필드 10명이라 포메이션은 무게만 옮긴다', () => {
    expect(LINES.reduce((t, l) => t + LINE_BASE[l], 0)).toBeCloseTo(10);
    for (const id of FORMATION_IDS) {
      const l = lineStrength(FORMATIONS[id], Array(11).fill(70));
      expect(l.gk).toBe(70);
      expect(LINES.reduce((t, k) => t + (l[k] - 70), 0)).toBeCloseTo(0);
    }
  });
  it('빈 자리는 유스 선수로 센다', () => {
    const l = lineStrength(FORMATIONS['4-3-3'], Array(11).fill(null));
    expect(l.gk).toBe(YOUTH_OVR);
  });
});

describe('PutOwnerTeamBodySchema', () => {
  it('이름은 앞뒤 공백을 떼고 2~12자', () => {
    expect(TeamNameSchema.parse('  우리 FC ')).toBe('우리 FC');
    expect(TeamNameSchema.safeParse('가').success).toBe(false);
    expect(TeamNameSchema.safeParse('가'.repeat(13)).success).toBe(false);
    expect(TeamNameSchema.safeParse('<b>팀</b>').success).toBe(false);
  });
  it('자리는 정확히 11칸', () => {
    const base = { name: '우리 FC', manager: '홍감독', formation: '4-3-3' };
    expect(PutOwnerTeamBodySchema.safeParse({ ...base, slots: Array(11).fill(null) }).success).toBe(
      true,
    );
    const noManager = { name: base.name, formation: base.formation };
    expect(
      PutOwnerTeamBodySchema.safeParse({ ...noManager, slots: Array(11).fill(null) }).success,
    ).toBe(false);
    expect(PutOwnerTeamBodySchema.safeParse({ ...base, slots: Array(10).fill(null) }).success).toBe(
      false,
    );
    expect(
      PutOwnerTeamBodySchema.safeParse({ ...base, formation: '5-4-1', slots: Array(11).fill(null) })
        .success,
    ).toBe(false);
  });
});

describe('T-10-092 감독 이름 · 팀 레이팅', () => {
  it('감독 이름은 앞뒤 공백을 떼고 2~10자', () => {
    expect(ManagerNameSchema.parse(' 홍감독 ')).toBe('홍감독');
    expect(ManagerNameSchema.safeParse('홍').success).toBe(false);
    expect(ManagerNameSchema.safeParse('가'.repeat(11)).success).toBe(false);
  });
  it('레이팅은 약한 팀이 이기면 더 많이 오르고, 두 팀 합은 그대로다', () => {
    expect(ratingChange(900, 1100, 1).home).toBeGreaterThan(ratingChange(1100, 900, 1).home);
    expect(ratingChange(1100, 900, 1).home).toBeGreaterThan(0);
    for (const s of [0, 0.5, 1] as const) {
      const d = ratingChange(1000, 1080, s);
      expect(d.home + d.away).toBe(0);
    }
  });
  it('T-10-095 건 쪽은 홈 이점만큼 기대가 높고, 최근에 만난 상대면 변화가 줄어든다', () => {
    // 같은 레이팅: 기대 승률 1/(1+10^(-20/400)) ≈ 0.529 → 이기면 +15, 비기면 -1, 지면 -17.
    expect(ratingChange(1000, 1000, 1)).toEqual({ home: 15, away: -15 });
    expect(ratingChange(1000, 1000, 0.5).home).toBe(-1);
    expect(ratingChange(1000, 1000, 0)).toEqual({ home: -17, away: 17 });
    expect(ratingChange(1000, 1000, 1, 1).home).toBe(8);
    expect(ratingChange(1000, 1000, 1, 2).home).toBe(4);
    expect(ratingChange(1000, 1000, 1, 5).home).toBe(4);
    expect([0, 1, 2, 3].map(repeatFactor)).toEqual([1, 0.5, 0.25, 0.25]);
  });
});

describe('T-11-028 시즌 업적 등급', () => {
  it('점수가 등급 기준을 넘으면 그 등급, 다음 등급을 함께 준다', () => {
    expect(achGradeOf(0)).toMatchObject({ grade: { id: 'rookie' }, next: { id: 'bronze' } });
    expect(achGradeOf(199).grade.id).toBe('rookie');
    expect(achGradeOf(200).grade.id).toBe('bronze');
    expect(achGradeOf(1600)).toMatchObject({ grade: { id: 'platinum' }, next: { min: 2400 } });
    expect(achGradeOf(99999)).toMatchObject({ grade: { id: 'legend' }, next: null });
    // 기준은 오름차순이다.
    expect(ACH_GRADES.every((g, i) => i === 0 || g.min > ACH_GRADES[i - 1]!.min)).toBe(true);
  });
});

describe('T-11-216 배치 프리셋', () => {
  it('프리셋마다 세부 포지션 자리가 나오고 저장 검증을 통과한다', () => {
    const slots = Object.fromEntries(
      SHAPE_IDS.map((id) => [
        id,
        shapeLayout(id)
          .map((p) => p.slot)
          .join(' '),
      ]),
    );
    expect(slots).toEqual({
      '4-2-3-1': 'GK LB CB CB RB DM DM LW AM RW ST',
      '4-1-4-1': 'GK LB CB CB RB DM LM CM CM RM ST',
      '4-3-3 F9': 'GK LB CB CB RB CM DM CM LW CF RW',
      '4-4-1-1': 'GK LB CB CB RB LM CM CM RM SS ST',
      '3-4-3': 'GK CB CB CB LWB CM CM RWB LW ST RW',
      '5-3-2': 'GK LWB CB SW CB RWB CM CM CM ST ST',
    });
    for (const id of SHAPE_IDS) {
      expect(TeamLayoutSchema.safeParse(shapeLayout(id)).success).toBe(true);
      expect(FORMATION_IDS).toContain(shapeBase(id));
    }
  });
  it('배치가 프리셋과 같을 때만 그 이름이고, 옮기면 저장된 포메이션', () => {
    expect(shapeOf('4-3-3', shapeLayout('4-2-3-1'))).toBe('4-2-3-1');
    expect(shapeOf('4-3-3', null)).toBe('4-3-3');
    expect(shapeOf('4-4-2', presetLayout('4-4-2'))).toBe('4-4-2');
    const moved = shapeLayout('5-3-2').map((p, i) => (i === 9 ? { ...p, x: 40 } : p));
    expect(shapeOf('3-5-2', moved)).toBe('3-5-2');
    // 칩은 정확히 맞는 프리셋만 켠다 — 손으로 옮긴 배치는 아무것도 아니다.
    expect(matchShape(moved)).toBeNull();
    expect(matchShape(shapeLayout('5-3-2'))).toBe('5-3-2');
  });
});

describe('T-11-244 프리미엄 스카우트 천장 · 컵 스카우트권', () => {
  it('S 없이 29장 뒤 30장째는 sure, 누적 100장째는 elite(밀린 특급은 다음 장)', () => {
    expect(scoutPityView({ used: 0, streak: 0, elites: 0 })).toEqual({
      next: 'normal',
      sureIn: 30,
      eliteIn: 100,
    });
    expect(scoutPityView({ used: 29, streak: 29, elites: 0 }).next).toBe('sure');
    expect(scoutPityView({ used: 99, streak: 3, elites: 0 })).toMatchObject({
      next: 'elite',
      eliteIn: 1,
    });
    expect(scoutPityView({ used: 230, streak: 0, elites: 0 }).next).toBe('elite');
    expect(scoutPityView({ used: 230, streak: 0, elites: 2 })).toMatchObject({
      next: 'normal',
      eliteIn: 70,
    });
  });

  it('T-11-450 시즌 2부터 천장은 S 확정 20장 · 특급 70장(시즌 1 카운트를 그대로 이어 센다)', () => {
    expect(scoutPityOf(0)).toEqual({ sure: 30, elite: 100 });
    expect(scoutPityOf(1)).toEqual({ sure: 30, elite: 100 });
    expect(scoutPityOf(2)).toEqual(SCOUT_PITY_S2);
    expect(scoutPityOf(3)).toEqual({ sure: 20, elite: 70 });
    const s2 = scoutPityOf(2);
    expect(scoutPityView({ used: 0, streak: 0, elites: 0 }, s2)).toEqual({
      next: 'normal',
      sureIn: 20,
      eliteIn: 70,
    });
    expect(scoutPityView({ used: 19, streak: 19, elites: 0 }, s2).next).toBe('sure');
    expect(scoutPityView({ used: 69, streak: 3, elites: 0 }, s2).next).toBe('elite');
    // 시즌 1에 25장 쌓인 S 확정 칸은 시즌 2 첫 장에 바로 확정, 막대는 넘치지 않는다.
    expect(scoutPityView({ used: 25, streak: 25, elites: 0 }, s2)).toMatchObject({
      next: 'sure',
      sureIn: 1,
    });
    expect(scoutPityGauge({ used: 25, streak: 25, elites: 0 }, s2).sure).toEqual({
      have: 19,
      need: 20,
      next: true,
    });
  });

  it('T-11-415 막대는 쌓인 장수, 특급이 먼저 오면 S 확정 칸은 다음이 아니다', () => {
    expect(scoutPityGauge({ used: 12, streak: 12, elites: 0 })).toEqual({
      sure: { have: 12, need: 30, next: false },
      elite: { have: 12, need: 100, next: false },
    });
    expect(scoutPityGauge({ used: 29, streak: 29, elites: 0 }).sure).toEqual({
      have: 29,
      need: 30,
      next: true,
    });
    expect(scoutPityGauge({ used: 99, streak: 29, elites: 0 })).toMatchObject({
      sure: { have: 29, next: false },
      elite: { have: 99, next: true },
    });
    expect(scoutPityGauge({ used: 230, streak: 0, elites: 2 }).elite.have).toBe(30);
  });

  it('제1회 컵은 리롤권만, 제2회부터 8강 이상 스카우트권·4강 이상 강화권', () => {
    expect(cupReward(1, 'champion')).toEqual({ rerolls: 10, scouts: 0, boosts: 0, trophy: true });
    expect(cupReward(2, 'champion')).toEqual({ rerolls: 15, scouts: 3, boosts: 3, trophy: true });
    expect([cupScouts(2, 'runnerup'), cupScouts(2, 'sf'), cupScouts(2, 'qf')]).toEqual([2, 1, 1]);
    expect(cupReward(2, 'qf')).toMatchObject({ boosts: 0, trophy: false });
    expect(cupScouts(2, 'r16')).toBe(0);
    expect([cupPredictionCap(1), cupPredictionCap(2)]).toEqual([null, 10]);
  });
});

describe('T-11-376 지난 시즌 선수 급여', () => {
  it('급여표 경계값', () => {
    const cases: [number, number][] = [
      [50, 1],
      [74, 1],
      [75, 2],
      [79, 2],
      [80, 4],
      [84, 4],
      [85, 6],
      [87, 6],
      [88, 8],
      [89, 8],
      [90, 10],
      [91, 10],
      [92, 13],
      [93, 13],
      [94, 16],
      [95, 16],
      [96, 20],
      [99, 20],
    ];
    for (const [peak, salary] of cases) expect([peak, salaryOf(peak)]).toEqual([peak, salary]);
  });

  it('이번 시즌 선수는 급여가 없고, 시즌을 모르는 옛 카드도 이번 시즌 선수로 본다', () => {
    expect(seasonSalaryOf({ peak: 99, season: 2 }, 2)).toBe(0);
    expect(seasonSalaryOf({ peak: 99 }, 2)).toBe(0);
    expect(seasonSalaryOf({ peak: 99, season: 1 }, 2)).toBe(20);
    expect(
      pastSalarySum(
        [{ peak: 96, season: 0 }, null, { peak: 85, season: 0 }, { peak: 99, season: 1 }],
        1,
      ),
    ).toBe(26);
  });

  it('예산 기본값 80 = 밸런스 기본값, 급여 최대 20 선수 4명까지 예산 안', () => {
    expect(BALANCE_SPEC.pastSalaryBudget.def).toBe(PAST_SALARY_BUDGET);
    expect(BALANCE_SPEC.pastSalaryBudgetStep.def).toBe(PAST_SALARY_BUDGET_STEP);
    const max = Math.max(...PAST_SALARY_TABLE.map((t) => t.salary));
    expect(max * 4).toBeLessThanOrEqual(PAST_SALARY_BUDGET);
    // 예산 정확히 80은 되고 81은 넘는다.
    const four = [...Array(4)].map(() => ({ peak: 96, season: 0 }));
    expect(pastSalarySum(four, 1)).toBe(80);
    expect(pastSalarySum([...four, { peak: 70, season: 0 }], 1)).toBe(81);
  });

  it('T-11-450 급여 예산은 시즌 1이 기준이고 시즌마다 step씩 는다', () => {
    expect(seasonSalaryBudget(80, 10, 0)).toBe(80);
    expect(seasonSalaryBudget(80, 10, 1)).toBe(80);
    expect(seasonSalaryBudget(80, 10, 2)).toBe(90);
    expect(seasonSalaryBudget(80, 10, 4)).toBe(110);
    expect(seasonSalaryBudget(60, 0, 3)).toBe(60);
  });
});

describe('T-11-487 시즌 1 기록 보상', () => {
  const of = (f: Partial<SeasonRecordFacts>) =>
    seasonRecordRewardOf({ hofRank: null, icons: 0, legends: 0, ballonPlayers: 0, ...f });

  it('기록이 없으면 0', () => {
    expect(of({}).total).toEqual({ reroll: 0, scout: 0, boost: 0 });
  });

  it('명예의 전당 순위 경계', () => {
    expect(of({ hofRank: 1 }).parts.hof).toEqual({ reroll: 15, scout: 3, boost: 3 });
    expect(of({ hofRank: 2 }).parts.hof).toEqual({ reroll: 10, scout: 2, boost: 2 });
    expect(of({ hofRank: 10 }).parts.hof).toEqual({ reroll: 10, scout: 2, boost: 2 });
    expect(of({ hofRank: 11 }).parts.hof).toEqual({ reroll: 7, scout: 1, boost: 1 });
    expect(of({ hofRank: 500 }).parts.hof).toEqual({ reroll: 5, scout: 1, boost: 0 });
    expect(of({ hofRank: 1000 }).parts.hof).toEqual({ reroll: 3, scout: 0, boost: 0 });
    expect(of({ hofRank: 1001 }).parts.hof).toEqual({ reroll: 0, scout: 0, boost: 0 });
  });

  it('레전드 점수는 맞는 칸 하나만', () => {
    expect(of({ icons: 5, legends: 9 }).parts.legend).toEqual({ reroll: 0, scout: 1, boost: 3 });
    expect(of({ icons: 4, legends: 9 }).parts.legend).toEqual({ reroll: 0, scout: 0, boost: 2 });
    expect(of({ icons: 0, legends: 1 }).parts.legend).toEqual({ reroll: 0, scout: 0, boost: 1 });
  });

  it('발롱도르는 수상 선수 수로 한 칸', () => {
    expect(of({ ballonPlayers: 1 }).parts.ballon).toEqual({ reroll: 3, scout: 0, boost: 0 });
    expect(of({ ballonPlayers: 4 }).parts.ballon).toEqual({ reroll: 5, scout: 0, boost: 1 });
    expect(of({ ballonPlayers: 12 }).parts.ballon).toEqual({ reroll: 7, scout: 1, boost: 1 });
  });

  it('최대치는 세 갈래 합', () => {
    expect(of({ hofRank: 1, icons: 6, legends: 6, ballonPlayers: 5 }).total).toEqual({
      reroll: 22,
      scout: 5,
      boost: 7,
    });
  });
});

describe('T-11-489 상위 비율 등급(achGradeAt)', () => {
  it('시즌 1까지는 점수 기준, 시즌 2부터 순위 기준이다', () => {
    expect(achGradeAt({ season: 1, score: 3500, rank: 999, ranked: 1000 }).grade.id).toBe('legend');
    expect(achGradeAt({ season: 2, score: 3500, rank: 999, ranked: 1000 }).grade.id).toBe('rookie');
  });
  it('다음 등급에 들려면 올라야 하는 순위를 준다', () => {
    expect(achGradeAt({ season: 2, score: 300, rank: 450, ranked: 1000 })).toMatchObject({
      grade: { id: 'silver' },
      next: { id: 'gold' },
      nextRank: 400,
    });
    expect(achGradeAt({ season: 2, score: 9000, rank: 1, ranked: 1000 })).toMatchObject({
      grade: { id: 'legend' },
      next: null,
      nextRank: null,
    });
  });
  it('인원이 적어도 1위는 레전드다', () => {
    expect(achGradeAt({ season: 2, score: 10, rank: 1, ranked: 3 }).grade.id).toBe('legend');
    expect(achGradeCutoff('legend', 3)).toBe(1);
    expect(achGradeCutoff('bronze', 3)).toBe(2);
  });
});
