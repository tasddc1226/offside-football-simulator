// SCR-031 D-30 스코어보드 순수 계산: 판단 시간 라벨·분 계산·표시 전용 스코어 규칙을 검증한다.
import { describe, expect, it } from 'vitest';
import { decisionMinute, decisionTimeLabel, scoreAtDecision } from './chapter-scoreboard.js';

describe('decisionTimeLabel', () => {
  it('판단 1~3은 전반·후반·종료 직전이다', () => {
    expect(decisionTimeLabel(1)).toBe('전반');
    expect(decisionTimeLabel(2)).toBe('후반');
    expect(decisionTimeLabel(3)).toBe('종료 직전');
  });

  it('목록 밖 인덱스는 방어적으로 "판단 N"을 돌려준다', () => {
    expect(decisionTimeLabel(4)).toBe('판단 4');
  });
});

describe('decisionMinute', () => {
  it('판단 k(1-based)는 k × 90 / (decisionsTotal + 1)을 내림한 분이다', () => {
    expect(decisionMinute(1, 1)).toBe(45);
    expect(decisionMinute(1, 2)).toBe(30);
    expect(decisionMinute(2, 2)).toBe(60);
    expect(decisionMinute(1, 3)).toBe(22);
    expect(decisionMinute(3, 3)).toBe(67);
  });
});

describe('scoreAtDecision', () => {
  it('득점을 90분에 걸쳐 고르게 편 뒤 minute까지 일어난 득점만 센다', () => {
    // goalMinute(1,2)=30, goalMinute(2,2)=60 — 골 두 개짜리 팀
    expect(scoreAtDecision(2, 0, 29)).toEqual({ for: 0, against: 0 });
    expect(scoreAtDecision(2, 0, 30)).toEqual({ for: 1, against: 0 });
    expect(scoreAtDecision(2, 0, 60)).toEqual({ for: 2, against: 0 });
  });

  it('양 팀 득점을 독립적으로 센다', () => {
    // goalsFor=1 → goalMinute(1,1)=45. goalsAgainst=3 → goalMinute(1..3,3)=22,45,67
    expect(scoreAtDecision(1, 3, 45)).toEqual({ for: 1, against: 2 });
  });

  it('같은 입력이면 항상 같은 값이다(상태 저장 없음 — 새로고침해도 동일)', () => {
    const first = scoreAtDecision(2, 1, 40);
    const second = scoreAtDecision(2, 1, 40);
    expect(first).toEqual(second);
  });

  it('득점이 0이면 항상 0:0이다', () => {
    expect(scoreAtDecision(0, 0, 90)).toEqual({ for: 0, against: 0 });
  });
});
