import { describe, expect, it } from 'vitest';
import { FIXTURES_VERSION } from './index.js';

describe('FIXTURES_VERSION', () => {
  it('is exported', () => {
    expect(FIXTURES_VERSION).toBe('0.0.0');
  });
});
