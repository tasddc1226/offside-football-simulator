// TEST-E2E-008(08 문서), D-19: 복구 코드 발급 → 다른 브라우저 복구 → 두 기기가 각자 한 단계씩
// 진행해 충돌을 만들고 → 충돌 선택. 실제 apps/api(wrangler dev --local, 로컬 D1)에 붙는다.
// E2E_WITH_API=1일 때만 실행한다. 앞부분(코드 발급→복구)은 recovery-api.spec.ts(T-1-012)와
// helpers/recovery.ts를 공유한다.
import { expect, test } from '@playwright/test';
import { advanceOneStep, createCareerAndIssueRecoveryCode, recoverProfile } from './helpers/recovery.js';
import { expectRoute } from './helpers/route.js';

const WITH_API = process.env.E2E_WITH_API === '1';

test.describe('복구 코드 왕복 뒤 진행 충돌(실제 api)', () => {
  test.skip(!WITH_API, 'E2E_WITH_API=1일 때만 실제 apps/api로 검사한다');

  test('"다른 기기 진행 가져오기": A 화면이 B의 진행과 같아진다', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const { codeText } = await createCareerAndIssueRecoveryCode(pageA);

      const pageB = await contextB.newPage();
      await recoverProfile(pageB, codeText);
      await pageB.getByRole('button', { name: '이어하기' }).click();
      await advanceOneStep(pageB, { pickLast: false });
      await expect(pageB.getByText('저장됨')).toBeVisible({ timeout: 15_000 });
      const bPath = new URL(pageB.url()).pathname;

      // A는 B의 진행을 모른 채(새로고침한 적 없음) 자기 화면 그대로, B와는 다른 선택지로 한 단계
      // 진행한다 — 같은 선택이면 결과가 같아(같은 stateHash) 재생(fast-forward)될 뿐 충돌이 나지
      // 않는다. 서버 revision이 이미 B에게 앞서 있어 A의 PUT이 409(CAREER_REVISION_CONFLICT)를 받는다.
      await advanceOneStep(pageA, { pickLast: true });

      await expect(
        pageA.getByRole('heading', { level: 2, name: '다른 기기에서 이 커리어가 더 진행됐습니다' }),
      ).toBeVisible({ timeout: 15_000 });
      await pageA.getByRole('button', { name: '다른 기기 진행 가져오기' }).click();

      await expect(pageA.getByText('다른 기기의 진행을 가져왔습니다')).toBeVisible();
      await expectRoute(pageA, new RegExp(`${bPath}$`));
      await expect(pageA.getByText('저장됨')).toBeVisible({ timeout: 15_000 });

      await pageA.goto('/');
      await expect(pageA.getByRole('heading', { level: 2, name: '김서준' })).toHaveCount(1);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('"이 기기 진행 유지": A에 커리어 카드가 2장 남는다', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const { codeText } = await createCareerAndIssueRecoveryCode(pageA);

      const pageB = await contextB.newPage();
      await recoverProfile(pageB, codeText);
      await pageB.getByRole('button', { name: '이어하기' }).click();
      await advanceOneStep(pageB, { pickLast: false });
      await expect(pageB.getByText('저장됨')).toBeVisible({ timeout: 15_000 });

      await advanceOneStep(pageA, { pickLast: true });

      await expect(
        pageA.getByRole('heading', { level: 2, name: '다른 기기에서 이 커리어가 더 진행됐습니다' }),
      ).toBeVisible({ timeout: 15_000 });
      await pageA.getByRole('button', { name: '이 기기 진행 유지' }).click();

      await expect(
        pageA.getByText('이 기기의 진행을 새 커리어로 복사했습니다. 원래 커리어는 다른 기기의 진행을 따릅니다'),
      ).toBeVisible();

      await pageA.goto('/');
      await expect(pageA.getByRole('heading', { level: 2, name: '김서준' })).toHaveCount(2);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
