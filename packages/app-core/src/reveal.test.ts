import { describe, expect, it } from 'vitest';
import {
  candidateTiers,
  gradeSweep,
  gradeTier,
  revealTiming,
  revealTotal,
  sweepAt,
  topGrade,
} from './reveal';

describe('T-11-371 reveal', () => {
  it('grade tier uses the top of a range', () => {
    expect(gradeTier('S')).toBe('jackpot');
    expect(gradeTier('B~S')).toBe('jackpot');
    expect(gradeTier('A')).toBe('good');
    expect(gradeTier('C~A')).toBe('good');
    expect(gradeTier('C~B')).toBe('normal');
    expect(gradeTier('D')).toBe('normal');
    expect(gradeTier('?')).toBe('normal');
    expect(topGrade('C~B')).toBe('B');
    expect(topGrade('x')).toBeNull();
  });

  it('candidate tiers use only visible values', () => {
    expect(candidateTiers([{ ovr: 50 }, { ovr: 55 }, { ovr: 52, pity: 'elite' }])).toEqual([
      'normal',
      'good',
      'jackpot',
    ]);
    // OVR 공동 최고면 좋음을 주지 않는다.
    expect(candidateTiers([{ ovr: 55 }, { ovr: 55 }, { ovr: 50 }])).toEqual([
      'normal',
      'normal',
      'normal',
    ]);
    expect(
      candidateTiers([{ ovr: 50, guaranteed: true }, { ovr: 60 }, { ovr: 40, pity: 'sure' }]),
    ).toEqual(['good', 'good', 'jackpot']);
  });

  it('candidate tier ignores hidden potential (no input for it)', () => {
    // 같은 공개 값이면 잠재력이 무엇이든 같은 강도 — 입력 형식에 잠재력이 없다.
    const a = candidateTiers([{ ovr: 50 }, { ovr: 51 }, { ovr: 49 }]);
    const b = candidateTiers([
      { ovr: 50, potential: { value: 95 } } as never,
      { ovr: 51 },
      { ovr: 49, potential: { value: 60 } } as never,
    ]);
    expect(b).toEqual(a);
  });

  it('timing: off and short show the result only, repeat halves, jackpot stays under 2.5s', () => {
    expect(revealTotal(revealTiming('jackpot', { off: true }))).toBe(0);
    expect(revealTotal(revealTiming('jackpot', { short: true }))).toBe(0);
    expect(revealTotal(revealTiming('jackpot'))).toBeLessThanOrEqual(2500);
    expect(revealTotal(revealTiming('normal'))).toBeLessThanOrEqual(1000);
    expect(revealTiming('good', { repeat: true }).hint).toBe(450);
    expect(revealTiming('good', { repeat: true }).back).toBe(0);
  });

  it('sweep climbs to the result grade and ends on it', () => {
    expect(gradeSweep('A')).toEqual(['D', 'C', 'B', 'A']);
    expect(gradeSweep('C~B')).toEqual(['D', 'C', 'B']);
    expect(gradeSweep('??')).toEqual(['??']);
    const steps = gradeSweep('S');
    expect(sweepAt(steps, 0)).toBe('D');
    expect(sweepAt(steps, 1)).toBe('S');
    expect(sweepAt(steps, 2)).toBe('S');
  });
});
