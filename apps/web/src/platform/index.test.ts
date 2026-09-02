import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('apps/web 채널 조립', () => {
  it('MODE가 toss가 아니면 web 채널이다', async () => {
    vi.stubEnv('MODE', 'production');
    vi.resetModules();
    const { platform } = await import('./index.js');
    expect(platform.channel).toBe('web');
  });

  it('MODE가 toss면 toss 채널이다', async () => {
    vi.stubEnv('MODE', 'toss');
    vi.resetModules();
    const { platform } = await import('./index.js');
    expect(platform.channel).toBe('toss');
  });
});
