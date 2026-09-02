import { describe, expect, it } from 'vitest';
import { CONTRACTS_VERSION } from './index.js';

describe('CONTRACTS_VERSION', () => {
  it('is exported', () => {
    expect(CONTRACTS_VERSION).toBe('0.0.0');
  });
});
