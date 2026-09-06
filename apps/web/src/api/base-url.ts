const PRODUCTION_WEB_API_ORIGINS: Readonly<Record<string, string>> = {
  'offside-lab.com': 'https://api.offside-lab.com',
  'offside-web.tasddc1569.workers.dev': 'https://offside-api.tasddc1569.workers.dev',
};

export function resolveApiBaseUrl(configured: string | undefined, hostname: string | undefined): string {
  if (hostname && Object.hasOwn(PRODUCTION_WEB_API_ORIGINS, hostname)) {
    return PRODUCTION_WEB_API_ORIGINS[hostname]!;
  }
  return configured ?? 'http://localhost:8787';
}

export function isLegacyProductionHost(hostname: string | undefined): boolean {
  return hostname === 'offside-web.tasddc1569.workers.dev';
}
