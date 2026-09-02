import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from './index.js';

describe('CONTENT_VERSION', () => {
  it('is exported', () => {
    expect(CONTENT_VERSION).toBe('0.0.0');
  });
});
