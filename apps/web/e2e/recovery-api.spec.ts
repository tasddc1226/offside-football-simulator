// TEST-E2E(08 문서) T-1-012, D-18: 실제 apps/api(wrangler dev --local, 로컬 D1)로 복구 코드
// 왕복을 검사한다. E2E_WITH_API=1일 때만 실행한다(playwright.config.ts가 이때만 api를 webServer로
// 함께 띄우고 웹도 5173으로 옮긴다 — apps/api의 ALLOWED_ORIGINS가 5173만 허용해서다).
import { test } from '@playwright/test';
import { createCareerAndIssueRecoveryCode, recoverProfile } from './helpers/recovery.js';

const WITH_API = process.env.E2E_WITH_API === '1';

test.describe('프로필 복구 왕복(실제 api)', () => {
  test.skip(!WITH_API, 'E2E_WITH_API=1일 때만 실제 apps/api로 검사한다');

  test('컨텍스트 A에서 발급한 복구 코드로 컨텍스트 B가 같은 커리어를 되찾는다', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const { codeText } = await createCareerAndIssueRecoveryCode(pageA);

      const pageB = await contextB.newPage();
      await recoverProfile(pageB, codeText);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
