// TEST-E2E-009(접근성 기준): 허브·온보딩·설정·법적 문서 화면에 axe serious·critical 위반이 없다.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { E2E_META, fulfillJson, triggerConflictAndOpenDialog } from './helpers/sync-conflict.js';

const PROFILE_WITH_CODE = {
  id: 'prf_e2e',
  settings: { reducedMotion: 'SYSTEM' as const, textScale: 100 as const, theme: 'SYSTEM' as const, defaultSimulationMode: 'FAST' as const },
  linked: { google: false, toss: false },
  recoveryCodeIssuedAt: '2026-08-01T08:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
};

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

test('T-1-012 설정: 복구 코드 재발급 확인 대화상자에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, { data: PROFILE_WITH_CODE, meta: E2E_META });
  });

  await page.goto('/settings');
  await page.getByRole('button', { name: '재발급' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '복구 코드 재발급' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 복구 코드 재발급 확인');
});

test('T-1-012 설정: 복구 코드 결과 대화상자에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.route('**/v1/profile/recovery-code', (route) =>
    fulfillJson(route, 200, { data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-03T08:00:00Z' }, meta: E2E_META }),
  );

  await page.goto('/settings');
  await page.getByRole('button', { name: '발급' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '복구 코드' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 복구 코드 결과');
});

test('T-1-012 설정: 프로필 복구 충돌 선택 대화상자에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.route('**/v1/profile/recover', (route) =>
    fulfillJson(route, 409, {
      error: {
        code: 'RECOVERY_CONFLICT',
        message: '이미 진행 중인 커리어가 있습니다.',
        retryable: false,
        details: { currentCareerCount: 2, targetCareerCount: 1 },
      },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  await page.getByLabel('다른 기기에서 발급받은 복구 코드').fill('OFS-ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: '복구' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '이미 커리어가 있는 기기입니다' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 프로필 복구 충돌 선택');
});

test('T-1-012 설정: 이 기기 데이터 삭제 확인 대화상자에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/settings');
  const row = page.locator('li').filter({ hasText: '이 기기 데이터 삭제' });
  await row.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '이 기기 데이터 삭제' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 이 기기 데이터 삭제 확인');
});

test('T-1-012 설정: 프로필 삭제 확인 대화상자에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.route('**/v1/profile/delete', (route) =>
    fulfillJson(route, 200, { data: { confirmToken: 'tok_a11y', expiresAt: '2026-09-03T00:10:00Z' }, meta: E2E_META }),
  );

  await page.goto('/settings');
  const row = page.locator('li').filter({ hasText: '프로필 삭제' });
  await row.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '프로필 삭제' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 프로필 삭제 확인');
});
