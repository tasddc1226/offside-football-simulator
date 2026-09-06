import { describe, expect, it } from 'vitest';
import { buildCareerClock } from './career-clock.js';

describe('buildCareerClock', () => {
  it('uses the stored season index and step without inventing calendar time', () => {
    expect(
      buildCareerClock({
        age: 23,
        status: 'ACTIVE',
        currentStep: 7,
        season: { index: 5, currentStep: 7 },
        seasonHistory: [{}, {}, {}, {}],
      }),
    ).toEqual({ headline: '23세 · 시즌 5', detail: '시즌 5', progress: '7/12 단계' });
  });

  it('marks a finished career from its real completed-season count', () => {
    expect(
      buildCareerClock({
        age: 36,
        status: 'RETIRED',
        currentStep: 0,
        season: null,
        seasonHistory: [{}, {}, {}],
      }),
    ).toEqual({ headline: '36세 · 선수 생활 종료', detail: '3시즌 완료', progress: '은퇴 기록' });
  });

  it('does not describe a pre-contract opening story as a completed settlement', () => {
    expect(
      buildCareerClock({
        age: 17,
        status: 'ACTIVE',
        currentStep: 0,
        season: null,
        seasonHistory: [],
        seasonPhase: 'SETTLEMENT',
        pending: { kind: 'EVENT' },
      }),
    ).toEqual({ headline: '17세 · 커리어 시작', detail: '첫 시즌 전', progress: '시작 이야기' });
  });
});
