import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
async function check(id: string, configured: string, actual: string) {
  vi.stubEnv('VITE_GA4_MEASUREMENT_ID', id);
  vi.stubEnv('VITE_GA4_HOSTNAME', configured);
  vi.stubGlobal('window', { location: { hostname: actual } });
  vi.resetModules();
  return (await import('./config.js')).enabled();
}
it('requires an explicit valid ID and exact host; rejects preview/subdomain traffic', async () => {
  expect(await check('', 'localhost', 'localhost')).toBe(false);
  expect(await check('not-an-id', 'localhost', 'localhost')).toBe(false);
  expect(await check('G-00CVJ30Y60', '', 'localhost')).toBe(false);
  expect(await check('G-00CVJ30Y60', 'localhost', 'preview.localhost')).toBe(false);
  expect(await check('G-00CVJ30Y60', 'localhost', 'localhost')).toBe(true);
});
it('keeps production and test measurement IDs isolated even with wrong build variables', async () => {
  expect(await check('G-BZPYZFDE9M', 'localhost', 'localhost')).toBe(false);
  expect(await check('G-00CVJ30Y60', 'offside-lab.com', 'offside-lab.com')).toBe(false);
  expect(await check('G-BZPYZFDE9M', 'offside-lab.com', 'offside-lab.com')).toBe(true);
});
