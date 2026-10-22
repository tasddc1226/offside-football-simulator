import { describe, expect, it } from 'vitest';
import { divisionCapLabel, divisionLabel } from './cupDivision.js';

describe('T-11-410 컵 구간 표시', () => {
  it('구간 이름, 통합 대회는 없음', () => {
    expect(divisionLabel('senior')).toBe('시니어');
    expect(divisionLabel(undefined)).toBeUndefined();
  });
  it('상한 줄: 마스터는 제한 없음, 아직 안 정해졌으면 안내', () => {
    expect(divisionCapLabel({ division: 'junior', ovrMax: 80 })).toBe('OVR 80 이하');
    expect(divisionCapLabel({ division: 'master', ovrMax: null })).toBe('OVR 제한 없음');
    expect(divisionCapLabel({ division: 'senior', ovrMax: null })).toBe(
      '상한은 접수가 열리면 정해져요',
    );
  });
});
