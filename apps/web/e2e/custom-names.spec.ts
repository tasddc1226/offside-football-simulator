import { test, expect, type Route } from '@playwright/test';
import { ok } from './helpers.js';
import AxeBuilder from '@axe-core/playwright';

// T-11-647: 설정에서 대회·수상 이름을 바꾼다. 프로필 세션이 없는 기기에서는 서버로 보내지 않는다(T-11-684).
test('설정에서 대회 이름을 바꾸면 이 기기에 남고 원래대로 되돌릴 수 있다', async ({ page }) => {
  // 바꾼 이름은 어떤 요청에도 실리지 않는다.
  const leaked: string[] = [];
  page.on('request', (r) => {
    if (`${r.url()} ${r.postData() ?? ''}`.includes('오프사이드컵')) leaked.push(r.url());
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="names"]').click();
  const row = page.locator('.name-row[data-name="코리아컵"]');
  await expect(row).toBeVisible();

  const axe = await new AxeBuilder({ page }).include('#settings-names').analyze();
  expect(
    axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);

  const input = row.locator('input[type="text"]');
  await input.fill('오프사이드컵');
  await input.press('Enter');
  await input.blur();
  await expect(page.locator('[data-names-changed="1"]')).toBeVisible();
  // 칸 옆 이름은 원래 이름 그대로 보인다.
  await expect(row.locator('.name-base')).toHaveText('코리아컵');

  // 종류를 바꾸고 찾기로 거른다.
  await page.locator('[data-name-group="award"]').click();
  await page.locator('.name-search').fill('골든부트');
  await expect(page.locator('.name-row[data-name="프리미어리그 골든부트"]')).toBeVisible();

  // 새로고침해도 남는다.
  await page.reload();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="names"]').click();
  const again = page.locator('.name-row[data-name="코리아컵"]');
  await expect(again.locator('input[type="text"]')).toHaveValue('오프사이드컵');
  await again.locator('[data-act="name-reset"]').click();
  await expect(again.locator('input[type="text"]')).toHaveValue('');
  await expect(page.locator('[data-names-changed]')).toHaveCount(0);
  expect(leaked).toEqual([]);
});

// T-11-684: 프로필 세션이 있으면 바꾼 이름 · 로고를 계정과 맞춘다. API는 route로 흉내 낸다.
test('로그인 상태면 계정에 저장된 대회 이름을 받아 오고, 바꾸면 계정으로 보낸다', async ({
  page,
}) => {
  type Body = { names: Record<string, string>; icons: Record<string, string>; updatedAt: string };
  let server: Body = {
    names: { 코리아컵: '서버 컵' },
    icons: {},
    updatedAt: '2026-11-10T00:00:00.000Z',
  };
  const puts: Body[] = [];
  let gets = 0;
  await page.route(/localhost:8787\/v1\/comp-custom/, async (route: Route) => {
    if (route.request().method() === 'PUT') {
      server = route.request().postDataJSON() as Body;
      puts.push(server);
    } else gets++;
    await route.fulfill(ok(server));
  });
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="names"]').click();
  await expect(page.locator('.name-row[data-name="코리아컵"] input[type="text"]')).toHaveValue(
    '서버 컵',
  );
  await expect(page.locator('[data-comp-sync]')).toHaveAttribute('data-comp-sync', 'synced');

  await page.locator('[data-name-group="award"]').click();
  const input = page.locator('.name-row[data-name="프리미어리그 골든부트"] input[type="text"]');
  await input.fill('황금 축구화');
  await input.press('Enter');
  await input.blur();
  await expect.poll(() => puts.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(puts.at(-1)!.names).toEqual({
    코리아컵: '서버 컵',
    '프리미어리그 골든부트': '황금 축구화',
  });
  await expect(page.locator('[data-comp-sync]')).toHaveAttribute('data-comp-sync', 'synced');
  // 부팅 때 한 번만 묻는다.
  expect(gets).toBe(1);
});
