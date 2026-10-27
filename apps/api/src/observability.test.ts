import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';

describe('production Worker observability', () => {
  it('redacts request query strings while preserving logs and traces', () => {
    const config = unstable_readConfig({
      config: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)),
      env: 'production',
    });
    expect(config.observability).toMatchObject({
      enabled: true,
      redact_query_string: true,
      logs: { enabled: true, invocation_logs: false },
      traces: { enabled: true, head_sampling_rate: 0.01 },
    });
  });
});
