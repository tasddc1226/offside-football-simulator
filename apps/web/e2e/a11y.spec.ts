// TEST-E2E-009(접근성 기준): 허브·온보딩·설정·법적 문서 화면에 axe serious·critical 위반이 없다.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function expectNoSeriousOrCriticalViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  console.log(`[a11y] ${label}: 전체 위반 ${results.violations.length}건, serious/critical ${seriousOrCritical.length}건`);
  if (results.violations.length > 0) {
    console.log(
      JSON.stringify(
        results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })),
        null,
        2,
      ),
    );
  }

  expect(seriousOrCritical).toEqual([]);
}

const STATIC_SCREENS = ['/legal/privacy', '/legal/terms', '/onboarding', '/settings'];

for (const path of STATIC_SCREENS) {
  test(`${path} 화면에 axe serious·critical 위반이 없다`, async ({ page }) => {
    await page.goto(path);
    await expectNoSeriousOrCriticalViolations(page, path);
  });
}

test('빈 허브(첫 방문, 온보딩 건너뛴 뒤) 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: '아직 만든 커리어가 없습니다' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, '/ (빈 허브)');
});

test('카드가 있는 허브 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
  await page.getByRole('link', { name: '허브로 돌아가기' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, '/ (카드 있는 허브)');
});
