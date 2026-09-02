import { describe, expect, it } from 'vitest';
import { UI_VERSION } from './index.js';

describe('UI_VERSION', () => {
  it('is exported', () => {
    expect(UI_VERSION).toBe('0.0.0');
  });
});
