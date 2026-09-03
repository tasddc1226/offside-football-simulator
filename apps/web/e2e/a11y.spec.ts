// TEST-E2E-009(접근성 기준): 허브·온보딩·설정·법적 문서 화면에 axe serious·critical 위반이 없다.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { triggerConflictAndOpenDialog } from './helpers/sync-conflict.js';

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
  // SCR-002는 허브로 돌아가는 링크를 두지 않는다(hub.spec.ts와 같은 이유).
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, '/ (카드 있는 허브)');
});

test('SCR-002 선수 정보 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '선수 정보를 입력하세요' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-002');
});

test('SCR-003 플레이 스타일 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await page.getByLabel('이름').fill('김서준');
  await page.getByRole('radio', { name: '남성' }).click();
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('tab', { name: '공격수' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '플레이 스타일을 고르세요' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-003');
});

test('SCR-004 확인 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await page.getByLabel('이름').fill('김서준');
  await page.getByRole('radio', { name: '남성' }).click();
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('tab', { name: '공격수' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-004');
});

test('T-1-011 충돌 대화상자가 열린 상태에 axe serious·critical 위반이 없다', async ({ page }) => {
  await triggerConflictAndOpenDialog(page);
  await expect(page.getByRole('heading', { level: 2, name: '다른 기기에서 이 커리어가 더 진행됐습니다' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-011 충돌 대화상자');
});
