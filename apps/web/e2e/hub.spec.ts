// TEST-E2E(08 문서): 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT → 허브 카드 → 삭제.
import { expect, test } from '@playwright/test';

test('첫 방문은 온보딩으로 가고, 건너뛰면 빈 허브가 보인다', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { level: 1, name: 'OVR 하나가 아니라 여러 수치로 성장합니다' })).toBeVisible();

  await page.getByRole('button', { name: '건너뛰기' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: '아직 만든 커리어가 없습니다' })).toBeVisible();
  await expect(page.getByRole('button', { name: '커리어 시작' })).toBeVisible();
});

test('KICKOFF로 커리어를 만들면 허브 카드가 보이고, 삭제하면 다시 사라진다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/create$/);
  await expect(page.getByRole('heading', { level: 1, name: '선수 정보를 입력하세요' })).toBeVisible();

  // SCR-002는(자리표시와 달리) 허브로 돌아가는 링크를 두지 않는다(01 문서 "이탈": 다음으로만
  // 나간다) — 허브 카드 확인을 위해 직접 이동한다.
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();
  await expect(page.getByText('만드는 중')).toBeVisible();

  // IndexedDB(platform LocalStore) 영속성 확인: 새로고침 후에도 카드가 그대로 보인다.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();

  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('되돌릴 수 없습니다. 정말 삭제할까요?')).toBeVisible();
  await page.getByRole('button', { name: '삭제 확정' }).click();

  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('이름 없는 선수의 커리어를 삭제했습니다');
});
