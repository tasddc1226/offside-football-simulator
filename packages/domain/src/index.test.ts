import { describe, expect, it } from 'vitest';
import { clamp, DOMAIN_VERSION } from './index.js';

describe('DOMAIN_VERSION', () => {
  it('is exported', () => {
    expect(DOMAIN_VERSION).toBe('0.1.0');
  });
});

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(50, 0, 99)).toBe(50);
  });

  it('clamps to the minimum', () => {
    expect(clamp(-5, 0, 99)).toBe(0);
  });

  it('clamps to the maximum', () => {
    expect(clamp(150, 0, 99)).toBe(99);
  });

  it('throws when min is greater than max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});
