import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, PACK_0_1_0 } from './index.ts';

describe('CONTENT_VERSION', () => {
  it('matches the shipped prototype pack version', () => {
    expect(CONTENT_VERSION).toBe('0.1.0');
    expect(PACK_0_1_0).toBe('0.1.0');
  });
});
