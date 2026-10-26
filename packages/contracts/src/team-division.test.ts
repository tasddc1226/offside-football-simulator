import { describe, expect, it } from 'vitest';
import { resolveBalance } from './balance-spec.js';
import {
  bandOf,
  divisionProgress,
  divisionRerolls,
  divisionRules,
  nextDivision,
  TEAM_DIVISION_KEYS,
  TEAM_DIVISION_TOP,
} from './team-division.js';

// 경계 규칙은 기본값과 상관없이 고정한 경계(T-11-375 가안)로 본다.
const fixed = {
  ...resolveBalance(),
  teamDiv1: 950,
  teamDiv2: 1000,
  teamDiv3: 1050,
  teamDiv4: 1100,
  teamDiv5: 1175,
  teamDiv6: 1250,
  teamDiv7: 1350,
};
const rules = divisionRules(fixed);

describe('T-11-375 구단 디비전', () => {
  it('기본 경계는 T-11-510 RP 사다리 시뮬레이션 값이고 디비전은 8개다', () => {
    const d = divisionRules(resolveBalance());
    expect(d.bounds).toEqual([1050, 1200, 1400, 1700, 1800, 1900, 2000]);
    expect(d.guard).toBe(30);
    expect(TEAM_DIVISION_KEYS).toHaveLength(8);
    expect(TEAM_DIVISION_TOP).toBe(7);
  });

  it('경계 값이면 위 디비전, 1 모자라면 아래 디비전', () => {
    expect(bandOf(949, rules.bounds)).toBe(0);
    expect(bandOf(950, rules.bounds)).toBe(1);
    expect(bandOf(1000, rules.bounds)).toBe(2);
    expect(bandOf(1349, rules.bounds)).toBe(6);
    expect(bandOf(1350, rules.bounds)).toBe(7);
    expect(bandOf(2000, rules.bounds)).toBe(7);
  });

  it('오를 때는 레이팅 구간 그대로, 두 디비전도 한 번에 오른다', () => {
    expect(nextDivision(1050, 2, rules)).toBe(3);
    expect(nextDivision(1100, 2, rules)).toBe(4);
  });

  it('강등 보호: 경계보다 30점 아래까지는 그대로, 그보다 떨어지면 내려간다', () => {
    // 프로 II(경계 1,050)에 있는 팀.
    expect(nextDivision(1049, 3, rules)).toBe(3);
    expect(nextDivision(1020, 3, rules)).toBe(3);
    expect(nextDivision(1019, 3, rules)).toBe(2);
    // 크게 떨어지면 두 디비전 아래로(1,000 − 30 아래면 세미프로 II).
    expect(nextDivision(960, 3, rules)).toBe(1);
  });

  it('저장된 디비전이 범위를 벗어나도 0~7로 맞춘다', () => {
    expect(nextDivision(1000, 99, rules)).toBe(2);
    expect(nextDivision(1000, -3, rules)).toBe(2);
  });

  it('경계를 거꾸로 두면 앞 경계 값을 써서 오름차순을 지킨다', () => {
    const r = divisionRules({ ...fixed, teamDiv3: 900 });
    expect(r.bounds).toEqual([950, 1000, 1000, 1100, 1175, 1250, 1350]);
    expect(bandOf(1000, r.bounds)).toBe(3);
  });

  it('다음 디비전까지 남은 점수와 막대 비율, 강등 보호 중 남은 점수', () => {
    expect(divisionProgress(1025, 2, rules)).toEqual({
      division: 2,
      gap: 25,
      ratio: 0.5,
      guardLeft: null,
    });
    // 아마추어 막대는 첫 경계 − 100부터.
    expect(divisionProgress(900, 0, rules)).toMatchObject({ gap: 50, ratio: 0.5 });
    // 마스터는 남은 점수 없음.
    expect(divisionProgress(1400, 7, rules)).toMatchObject({ gap: null, ratio: 1 });
    // 프로 II인데 레이팅 1,035(경계 1,050 아래) — 1,020까지 15점 더 떨어져도 버틴다.
    expect(divisionProgress(1035, 3, rules)).toMatchObject({ gap: 65, ratio: 0, guardLeft: 15 });
  });

  it('시즌 보상 리롤권은 프로 II부터(가안 1 · 2 · 3 · 4 · 6)', () => {
    const b = resolveBalance();
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((d) => divisionRerolls(d, b))).toEqual([
      0, 0, 0, 1, 2, 3, 4, 6,
    ]);
  });
});
