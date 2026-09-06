import type { Bindings } from './env.js';

export const PRODUCTION_HOST_PAIRS = {
  'api.offside-lab.com': {
    apiOrigin: 'https://api.offside-lab.com',
    webOrigin: 'https://offside-lab.com',
  },
  'offside-api.tasddc1569.workers.dev': {
    apiOrigin: 'https://offside-api.tasddc1569.workers.dev',
    webOrigin: 'https://offside-web.tasddc1569.workers.dev',
  },
} as const;

export type RequestHostPair = { apiOrigin: string; webOrigin: string; googleRedirectUri: string };

/** Production routing is selected only by the URL Cloudflare gives the Worker. */
export function resolveRequestHostPair(requestUrl: string, env: Bindings): RequestHostPair | null {
  if (env.ENVIRONMENT !== 'production') {
    return {
      apiOrigin: new URL(requestUrl).origin,
      webOrigin: env.WEB_APP_URL,
      googleRedirectUri: env.GOOGLE_REDIRECT_URI,
    };
  }

  const hostname = new URL(requestUrl).hostname;
  if (!Object.hasOwn(PRODUCTION_HOST_PAIRS, hostname)) return null;
  const pair = PRODUCTION_HOST_PAIRS[hostname as keyof typeof PRODUCTION_HOST_PAIRS];
  return { ...pair, googleRedirectUri: `${pair.apiOrigin}/v1/auth/google/callback` };
}
