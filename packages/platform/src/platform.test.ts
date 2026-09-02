import { describe, expect, it } from 'vitest';
import { webPlatform } from './web/index.js';
import { tossPlatform } from './toss/index.js';

describe('platform adapters', () => {
  it('web adapter reports the web channel', () => {
    expect(webPlatform.channel).toBe('web');
  });

  it('toss adapter reports the toss channel', () => {
    expect(tossPlatform.channel).toBe('toss');
  });
});
