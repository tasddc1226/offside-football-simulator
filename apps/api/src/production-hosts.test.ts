import { describe, expect, it } from 'vitest';
import type { Bindings } from './env.js';
import { resolveRequestHostPair } from './production-hosts.js';

const production = {
  ENVIRONMENT: 'production',
  WEB_APP_URL: 'https://offside-web.tasddc1569.workers.dev',
  GOOGLE_REDIRECT_URI: 'https://offside-api.tasddc1569.workers.dev/v1/auth/google/callback',
} as Bindings;

describe('production request host pairs', () => {
  it.each([
    ['https://api.offside-lab.com/v1/auth/google/start', 'https://offside-lab.com'],
    ['https://offside-api.tasddc1569.workers.dev/v1/auth/google/start', 'https://offside-web.tasddc1569.workers.dev'],
  ])('maps %s to its matching web origin', (url, webOrigin) => {
    const pair = resolveRequestHostPair(url, production);
    expect(pair?.webOrigin).toBe(webOrigin);
    expect(pair?.googleRedirectUri).toBe(`${new URL(url).origin}/v1/auth/google/callback`);
  });

  it('rejects unknown production hosts instead of trusting request headers', () => {
    expect(resolveRequestHostPair('https://api.attacker.example/v1/auth/google/start', production)).toBeNull();
    expect(resolveRequestHostPair('https://constructor/v1/auth/google/start', production)).toBeNull();
  });
});
