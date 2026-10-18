import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve('wrangler'));
type Runtime = {
  dispatchFetch(url: string, init?: RequestInit): Promise<Response>;
  getD1Database(name: string): Promise<D1Database>;
  dispose(): Promise<void>;
};
const { Miniflare, convertV4MiniflareOptions } = sdkRequire('miniflare') as {
  Miniflare: new (options: unknown) => Runtime;
  convertV4MiniflareOptions(options: Record<string, unknown>): unknown;
};
const { buildSync } = sdkRequire('esbuild') as {
  buildSync(options: Record<string, unknown>): { outputFiles: { text: string }[] };
};

it('consumes the shared push Queue in workerd with D1 and never sends a missing delivery', async () => {
  const bundle = buildSync({
    stdin: {
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      contents: `
        import { consumePushWork } from './queue.ts';
        let seen = [], sent = 0;
        export default {
          async fetch(req, env) {
            if (req.method === 'POST') {
              await env.PUSH_QUEUE.send({ version: 1, kind: 'personal', ids: ['missing'] });
            }
            return Response.json({ seen, sent });
          },
          async queue(batch, env) {
            await consumePushWork(batch, env, Date.now(), async () => {
              sent++;
              throw new Error('No delivery expected');
            });
            seen.push(...batch.messages.map(m => m.body));
          }
        };
      `,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  });
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      compatibilityDate: '2026-09-02',
      script: bundle.outputFiles[0]!.text,
      d1Databases: ['DB'],
      queueProducers: { PUSH_QUEUE: 'all-push' },
      queueConsumers: { 'all-push': { maxBatchSize: 1, maxBatchTimeout: 0, maxRetries: 0 } },
      bindings: {
        ENVIRONMENT: 'production',
        PERSONAL_PUSH_ENABLED: '1',
        ADMIN_COMMUNITY_PUSH_ENABLED: '1',
        ADMIN_COMMUNITY_QUEUE_ENABLED: '1',
        ADMIN_EMAILS: 'admin@example.com',
      },
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    const dir = new URL('../../migrations/', import.meta.url);
    const sql = readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .flatMap((n) => splitSqlQuery(readFileSync(new URL(n, dir), 'utf8')))
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
    await db.exec(sql);
    expect((await runtime.dispatchFetch('https://test.invalid/', { method: 'POST' })).status).toBe(
      200,
    );
    await expect
      .poll(
        async () => {
          return (await runtime.dispatchFetch('https://test.invalid/')).json();
        },
        { timeout: 5000 },
      )
      .toEqual({
        seen: [{ version: 1, kind: 'personal', ids: ['missing'] }],
        sent: 0,
      });
  } finally {
    await runtime.dispose();
  }
});
