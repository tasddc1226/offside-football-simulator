import { describe, expect, it } from 'vitest';
import { ENGINE_CLIENT_VERSION } from './index.js';

describe('ENGINE_CLIENT_VERSION', () => {
  it('is exported', () => {
    expect(ENGINE_CLIENT_VERSION).toBe('0.0.0');
  });
});
