import { expect, test } from '@playwright/test';
import { currentRoute, expectRoute, waitForRoute } from './helpers/route.js';
import {
  advanceUntilOffers,
  completeOnboardingAndConfirm,
  fulfillJson,
  goToConfirm,
  planPreseason,
  resolveCurrentEventScreen,
  signFirstOffer,
  META,
} from './helpers/player-creation.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

for (const choice of [0, 2]) {
  test(`진로 ${choice === 0 ? '프로 테스트' : '하부리그'}: 사용자용 서사와 실제 선택지만 표시한다 (#58, #59)`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem('offside:e2e-seed', 'e2e-season-result-01'),
    );
    await completeOnboardingAndConfirm(page);

    let sawPath = false;
    let sawTryout = false;
    for (let step = 0; step < 10; step += 1) {
      await waitForRoute(page, /\/career\/.+\/(path|tryout|event|offers)$/);
      const pathname = (await currentRoute(page)).split('?')[0]!;
      if (pathname.endsWith('/offers')) break;
      if (pathname.endsWith('/path')) {
        sawPath = true;
        await expect(page.getByRole('radio')).toHaveCount(3);
        await expect(page.getByText(/^정찰 범위 \d+~\d+$/)).toHaveCount(1);
        await expect(page.getByText(/네 갈래/)).toHaveCount(0);
        await expect(page.getByText(/각 경로는 서로 다른 기회/)).toBeVisible();
        await page.getByRole('radio').nth(choice).click();
        await page.getByRole('button', { name: '확정' }).click();
        await expectRoute(page, /\/event\/result\?rev=\d+$/);
        const title =
          choice === 0 ? '프로 입단 테스트에 도전한다' : '하부리그에서 첫 기회를 찾는다';
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await expect(page.getByText(/EVT-P10/)).toHaveCount(0);
        await page.reload();
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await page.getByRole('button', { name: '다음' }).click();
      } else {
        if (pathname.endsWith('/tryout')) {
          sawTryout = true;
          await expect(page.getByText(/입단 테스트에서 갈고닦은 실력/)).toBeVisible();
          await expect(page.getByText(/제안 수 =|결과는 화면 진입/)).toHaveCount(0);
        }
        await resolveCurrentEventScreen(page);
      }
    }
    expect(sawPath).toBe(true);
    expect(sawTryout).toBe(true);
    await expectRoute(page, /\/offers$/);
  });
}

test.describe('저장 성공 전환', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('포인터 확정과 시즌 시작은 완료를 보여준 뒤 실제 목적 화면으로 자동 이동한다', async ({
    page,
  }) => {
    test.slow();
    await page.addInitScript(() =>
      window.localStorage.setItem('offside:e2e-seed', 'e2e-season-result-01'),
    );
    await goToConfirm(page);
    await page.route('**/v1/profile', (route) =>
      fulfillJson(route, 503, {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: '서비스를 이용할 수 없습니다.',
          retryable: true,
        },
        meta: META,
      }),
    );

    await page.getByRole('button', { name: /이 선수로 시작/ }).click();
    // UX-012: ScreenTransition은 3초 고정이다 — role=progressbar가 뜨고, 그 3초를 실제로 채운
    // 뒤에야(reducedMotion:'no-preference'라 즉시 완료로 빠지지 않는다) 다음 화면으로 넘어간다.
    await expect(page.getByText('선수 등록을 완료합니다')).toBeVisible();
    await expect(page.getByText('복구 코드는 설정에서 언제든 발급할 수 있습니다.')).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expectRoute(page, /\/career\/.+\/confirm$/);
    await expectRoute(page, /\/career\/.+\/(path|tryout|event)$/);
    await advanceUntilOffers(page);
    await signFirstOffer(page);
    await planPreseason(page, '역할 집중');

    await page.getByRole('button', { name: '시즌 시작' }).click();
    await expect(page.getByText('시즌 준비 완료')).toBeVisible();
    await expectRoute(page, /\/career\/[^/]+(?:\/role)?$/);
  });
});
