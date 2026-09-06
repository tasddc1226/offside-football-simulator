import { describe, expect, it } from 'vitest';
import { isLegacyProductionHost, resolveApiBaseUrl } from './base-url.js';

describe('web API base URL', () => {
  it('keeps each production web hostname on its matching API hostname', () => {
    expect(resolveApiBaseUrl('https://api.offside-lab.com', 'offside-lab.com')).toBe('https://api.offside-lab.com');
    expect(resolveApiBaseUrl('https://api.offside-lab.com', 'offside-web.tasddc1569.workers.dev')).toBe('https://offside-api.tasddc1569.workers.dev');
  });

  it('preserves configured non-production environments', () => {
    expect(resolveApiBaseUrl('https://offside-api-staging.tasddc1569.workers.dev', 'preview.example')).toBe('https://offside-api-staging.tasddc1569.workers.dev');
    expect(resolveApiBaseUrl('https://safe.example', 'constructor')).toBe('https://safe.example');
  });

  it('shows the migration notice only on the legacy production hostname', () => {
    expect(isLegacyProductionHost('offside-web.tasddc1569.workers.dev')).toBe(true);
    expect(isLegacyProductionHost('offside-lab.com')).toBe(false);
  });
});
