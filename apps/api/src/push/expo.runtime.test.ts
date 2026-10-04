import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Wrangler의 고정된 실제 workerd 런타임으로 Node fetch mock이 놓치는 요청 옵션을 검증한다.
const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve('wrangler'));
type Runtime = { dispatchFetch(url: string): Promise<Response>; dispose(): Promise<void> };
const { Miniflare, convertV4MiniflareOptions } = sdkRequire('miniflare') as {
  Miniflare: new (options: unknown) => Runtime;
  convertV4MiniflareOptions(options: Record<string, unknown>): unknown;
};
const { buildSync } = sdkRequire('esbuild') as {
  buildSync(options: Record<string, unknown>): { outputFiles: { text: string }[] };
};

it('constructs the actual sender request in workerd without following redirects', async () => {
  const bundle = buildSync({
    stdin: {
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      contents: `
        import { sendPushTest } from './expo.ts';
        export default { async fetch() {
          const calls = [];
          const transport = async (url, options) => {
            // Cloudflare의 실제 Request 생성자는 redirect:'error'를 즉시 거절한다.
            const request = new Request(url, options);
            calls.push({ url: request.url, redirect: request.redirect, method: request.method });
            return Response.json({ data: { status: 'ok', id: 'fixture-ticket' } });
          };
          await sendPushTest('ExpoPushToken[fixture]', undefined, transport);
          return Response.json(calls);
        } };
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
    }),
  );
  try {
    const response = await runtime.dispatchFetch('https://test.invalid/');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { url: 'https://exp.host/--/api/v2/push/send', redirect: 'manual', method: 'POST' },
    ]);
  } finally {
    await runtime.dispose();
  }
});
