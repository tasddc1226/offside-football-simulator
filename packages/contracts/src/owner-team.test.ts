import { describe, expect, it } from 'vitest';
import {
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
} from './owner-team.js';
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
    // roles가 null이면 옛 적합도 규칙.
    expect(slotRating('W', { peak: 86, pos: 'MF', dpos: 'AM', roles: null })).toBe(65);
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
