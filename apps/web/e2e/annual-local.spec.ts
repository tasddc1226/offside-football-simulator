import { expect, test } from '@playwright/test';
import { createServerAnnualCareer, finishFirstAnnualYear } from './helpers/annual-career.js';

const withApi = process.env.E2E_WITH_API === '1';
function localOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Annual local integration only permits plain HTTP loopback origins');
  }
  return url.origin;
}
const api = localOrigin(process.env.E2E_API_URL ?? 'http://127.0.0.1:8787');
// Match the actual API host so local SameSite cookies are not split across
// localhost and 127.0.0.1. The repository runner can still reuse its local server.
test.use({ baseURL: `http://${new URL(api).hostname}:${Number(process.env.E2E_PORT) || 5173}` });
test('local authoritative annual career: creation, important decisions, fixed year and persisted recovery', async ({
  page,
  baseURL,
}) => {
  test.skip(!withApi, 'Explicit E2E_WITH_API=1 required; no remote fallback');
  test.setTimeout(120_000);
  localOrigin(baseURL!);
  const cohort = await page.request.get(`${api}/v1/service-seasons/current`);
  expect(cohort.status()).toBe(200);
  expect((await cohort.json()).data).toMatchObject({
    isTest: true,
    rulesetVersion: '3.5.0',
    contentPackVersion: '0.14.0',
  });
  const puts: string[] = [];
  const remoteRequests: string[] = [];
  await page.route('**/v1/**', async (route) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)) {
      remoteRequests.push(route.request().url());
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/v1/careers/'))
      puts.push(request.url());
  });
  await createServerAnnualCareer(page);
  await finishFirstAnnualYear(page);
  expect(puts).toEqual([]);
  expect(remoteRequests).toEqual([]);
  await expect(page.getByRole('button', { name: '1년 진행', exact: true })).toBeVisible();
});
