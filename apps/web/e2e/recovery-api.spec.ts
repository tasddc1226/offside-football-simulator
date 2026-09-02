// TEST-E2E(08 문서) T-1-012, D-18: 실제 apps/api(wrangler dev --local, 로컬 D1)로 복구 코드
// 왕복을 검사한다. E2E_WITH_API=1일 때만 실행한다(playwright.config.ts가 이때만 api를 webServer로
// 함께 띄우고 웹도 5173으로 옮긴다 — apps/api의 ALLOWED_ORIGINS가 5173만 허용해서다).
import { expect, test } from '@playwright/test';

const WITH_API = process.env.E2E_WITH_API === '1';

test.describe('프로필 복구 왕복(실제 api)', () => {
  test.skip(!WITH_API, 'E2E_WITH_API=1일 때만 실제 apps/api로 검사한다');

  test('컨텍스트 A에서 발급한 복구 코드로 컨텍스트 B가 같은 커리어를 되찾는다', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      await pageA.goto('/onboarding');
      await pageA.getByRole('button', { name: '다음' }).click();
      await pageA.getByRole('button', { name: '다음' }).click();
      await pageA.getByRole('button', { name: 'KICKOFF' }).click();
      await expect(pageA).toHaveURL(/\/career\/.+\/create$/);

      await pageA.getByLabel('이름').fill('김서준');
      await pageA.getByLabel('국적').selectOption('KR');
      await pageA.getByRole('radio', { name: '왼발' }).click();
      await pageA.getByRole('tab', { name: '공격수' }).click();
      await pageA.getByRole('radio', { name: /윙어/ }).click();
      await pageA.getByRole('radio', { name: /클럽 아카데미/ }).click();
      await pageA.getByRole('button', { name: '다음' }).click();
      await expect(pageA).toHaveURL(/\/career\/.+\/style$/);

      await pageA.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
      await pageA.getByRole('button', { name: '다음' }).click();
      await expect(pageA).toHaveURL(/\/career\/.+\/confirm$/);

      await pageA.getByRole('button', { name: 'KICKOFF' }).click();
      await expect(pageA).toHaveURL(/\/career\/.+\/confirm\?step=recovery$/);
      // 실제 서버로 확정 상태(revision 2)가 저장된 뒤에 코드를 발급해야 컨텍스트 B가 받는 GET이
      // 최신 상태를 돌려준다 — 디바운스된 PUT을 기다린다.
      await expect(pageA.getByText('저장됨')).toBeVisible({ timeout: 15_000 });

      const codeText = await pageA.getByText(/^OFS-/).innerText();
      expect(codeText).toMatch(/^OFS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      await pageA.getByRole('button', { name: '저장했어요' }).click();
      await expect(pageA).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);

      const pageB = await contextB.newPage();
      await pageB.goto('/settings');
      await pageB.getByLabel('다른 기기에서 발급받은 복구 코드').fill(codeText);
      await pageB.getByRole('button', { name: '복구' }).click();

      await expect(pageB.getByText(/프로필을 복구했습니다\. 커리어 \d+개/)).toBeVisible({ timeout: 15_000 });
      await expect(pageB).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(pageB.getByRole('heading', { level: 2, name: '김서준' })).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
