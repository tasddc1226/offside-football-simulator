import { describe, expect, it } from 'vitest';
import { OPERATOR, operatorFieldOrPending } from './operator.js';

describe('OPERATOR', () => {
  it('공개 승인된 운영 문의 이메일을 제공한다', () => {
    expect(OPERATOR.contactEmail).toBe('tasddc1569@gmail.com');
  });
});

describe('operatorFieldOrPending', () => {
  it('빈 문자열은 "준비 중"으로 표시한다', () => {
    expect(operatorFieldOrPending('')).toBe('준비 중');
  });

  it('공백만 있는 값도 "준비 중"으로 표시한다', () => {
    expect(operatorFieldOrPending('   ')).toBe('준비 중');
  });

  it('값이 있으면 그대로 돌려준다', () => {
    expect(operatorFieldOrPending('OFFSIDE 운영팀')).toBe('OFFSIDE 운영팀');
  });
});
