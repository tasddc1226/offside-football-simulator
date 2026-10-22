import { describe, expect, it } from 'vitest';
import { hofBasisNote } from './hofBasis.js';

describe('hofBasisNote (T-11-441)', () => {
  it('뜻이 바로 보이지 않는 기준만 설명한다', () => {
    expect(hofBasisNote('score')).toContain('레전드 점수는');
    expect(hofBasisNote('value')).toContain('은퇴 가치는');
    expect(hofBasisNote('ga')).toContain('공격포인트(P)');
    expect(hofBasisNote('peak')).toContain('최고 OVR은');
    expect(hofBasisNote('goals')).toBeNull();
    expect(hofBasisNote('apps')).toBeNull();
  });
});
