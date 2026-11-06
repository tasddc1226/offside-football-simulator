import { describe, expect, it } from 'vitest';
import { cupText } from './cupText.js';

describe('리그 이름 알림 (T-11-640)', () => {
  it('새 알림의 리그 이름을 요청 언어로 옮긴다', () => {
    expect(cupText('3부 오리온 리그 최종 2위예요.', 'en')).toBe(
      'Tier 3, Orion League: finished in position 2.',
    );
    expect(cupText('3부 오리온 리그 최종 2위예요.', 'ko')).toBe('3부 오리온 리그 최종 2위예요.');
  });

  it('리그 번호로 저장된 옛 알림도 지금 이름으로 옮긴다', () => {
    expect(cupText('3부 1리그 최종 2위예요.', 'en')).toBe(
      'Tier 3, Orion League: finished in position 2.',
    );
  });
});
