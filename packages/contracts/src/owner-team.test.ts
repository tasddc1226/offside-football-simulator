import { describe, expect, it } from 'vitest';
import {
  DETAIL_GROUP,
  FORMATION_IDS,
  FORMATION_ROWS,
  FORMATIONS,
  LINEUP_SIZE,
  YOUTH_OVR,
  fit,
  slotRating,
  teamOvr,
} from './owner-team.js';
import { PutOwnerTeamBodySchema, TeamNameSchema } from './teams.js';

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
    expect(slotRating(90, 'ST', 'FW', null)).toBe(86);
    expect(teamOvr(Array.from({ length: 11 }, () => null))).toBe(YOUTH_OVR);
    expect(teamOvr([83, ...Array.from({ length: 10 }, () => null)])).toBe(53);
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
    const base = { name: '우리 FC', formation: '4-3-3' };
    expect(PutOwnerTeamBodySchema.safeParse({ ...base, slots: Array(11).fill(null) }).success).toBe(
      true,
    );
    expect(PutOwnerTeamBodySchema.safeParse({ ...base, slots: Array(10).fill(null) }).success).toBe(
      false,
    );
    expect(
      PutOwnerTeamBodySchema.safeParse({ ...base, formation: '5-4-1', slots: Array(11).fill(null) })
        .success,
    ).toBe(false);
  });
});
