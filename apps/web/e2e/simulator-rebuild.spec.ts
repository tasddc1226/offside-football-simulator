import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  markServiceSeasonPinned,
  planPreseason,
  readCurrentCareerState,
  resolveRoleProposal,
} from './helpers/player-creation.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('새 육성 시즌: 짧은 허브, 훈련 선택, 경기 진행, 실제 성장, 저장 유지', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('offside:e2e-seed', 'simulator-rebuild-1'));
  await page.route('**/v1/service-seasons/current', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'svc_simulator_preview',
          name: '선수 육성 프리뷰',
          status: 'ACTIVE',
          isTest: true,
          startsAt: '2026-09-19T00:00:00.000Z',
          endsAt: null,
          rulesetVersion: '2.0.0',
          contentPackVersion: '0.7.0',
          notice: null,
        },
        meta: { requestId: 'simulator-test' },
      }),
    }),
  );
  markServiceSeasonPinned(page);
  await completeOnboardingThroughContract(page);
  await expect(page.getByRole('region', { name: '이번 시즌 기록' })).toBeVisible();
  await expect(page.locator('.sim-hub')).toHaveAttribute('data-ruleset-version', '2.0.0');
  await expect(page.locator('.sim-hub')).toHaveAttribute('data-content-pack-version', '0.7.0');
  const action = page.getByRole('link', { name: '계획하러 가기' });
  await expect(action).toBeInViewport();
  await page.getByRole('tab', { name: '선수', exact: true }).click();
  await expect(page.getByLabel('선수 성장')).toBeVisible();
  await page.getByRole('tab', { name: '시즌', exact: true }).click();
  await expect(page.getByLabel('시즌 진행 12 step')).not.toBeVisible();
  await page.getByRole('tab', { name: '커리어', exact: true }).click();
  const details = page.locator('summary').filter({ hasText: '이번 시즌 일정 · 경기 기록' });
  await expect(details.locator('..')).toHaveAttribute('open', '');
  await details.focus();
  await details.press('Enter');
  await expect(details.locator('..')).not.toHaveAttribute('open', '');
  await details.press('Enter');
  await expect(details.locator('..')).toHaveAttribute('open', '');
  await page.getByRole('tab', { name: '시즌', exact: true }).click();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await planPreseason(page, '기술');
  await page.getByRole('button', { name: '시즌 시작', exact: true }).click();
  await resolveRoleProposal(page);
  const progress = page.getByRole('progressbar', { name: '시즌 진행', exact: true });
  const value = await progress.getAttribute('aria-valuenow');
  await page.reload();
  await expect(progress).toHaveAttribute('aria-valuenow', value!);
  await advanceThroughSeasonToSettlement(page);
  expect((await readCurrentCareerState(page)).season?.matches.length).toBeGreaterThan(0);
  await page.getByRole('tab', { name: '커리어', exact: true }).click();
  await expect(page.getByText(/\d+:\d+ · (선발|교체|결장|부상)/).first()).toBeVisible();
  await page.getByRole('tab', { name: '시즌', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('season-played.png'), fullPage: true });
  await expect(page.getByRole('button', { name: '결산하기' })).toBeInViewport();
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page.getByLabel('이번 시즌 성장')).toBeVisible();
  const hash = await page.getByTestId('season-result').getAttribute('data-result-hash');
  const growth = await page.getByLabel('이번 시즌 성장').textContent();
  await page.reload();
  await expect(page.getByTestId('season-result')).toHaveAttribute('data-result-hash', hash!);
  await expect(page.getByLabel('이번 시즌 성장')).toHaveText(growth!);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.evaluate(() => (document.documentElement.style.fontSize = '150%'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('첫 화면은 밝은 테마와 바로 보이는 선수 생성 버튼으로 시작한다', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: /이번 생은\s*프리미어리거\./})).toBeVisible();
  await expect(page.getByRole('link', {name:'내 선수 만들기'})).toBeInViewport();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('welcome.png'),fullPage:true});
});
