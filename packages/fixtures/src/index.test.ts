import { describe, expect, it } from 'vitest';
import { career01, career02Season, career03Underdog, career04Gk, FIXTURES_VERSION } from './index.js';

describe('FIXTURES_VERSION', () => {
  it('is exported', () => {
    expect(FIXTURES_VERSION).toBe('0.0.0');
  });
});

describe('네 픽스처(career-01·02·03·04)가 모두 export된다', () => {
  it('career01·career02Season·career03Underdog·career04Gk가 각각 자기 골든을 들고 있다', () => {
    expect(career01.golden).toBeDefined();
    expect(career02Season.golden).toBeDefined();
    expect(career03Underdog.golden).toBeDefined();
    expect(career04Gk.golden).toBeDefined();
  });
});
