// Phase 5 deterministic first-season UI regression. The career is created and settled through
// the real engine and IndexedDB; this is not a preloaded fixture or a full 20-season acceptance run.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  planPreseason,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

async function expectNoSeriousOrCriticalViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  console.log(`[retirement-e2e][a11y] ${label}: serious/critical ${seriousOrCritical.length}건`);
  expect(seriousOrCritical).toEqual([]);
}

test('deterministic settled career can retire, reload its Legacy views, and return to the hub', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('offside:e2e-seed', 'e2e-season-result-01');
  });

  await completeOnboardingThroughContract(page);
  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+\/season-result$/);

  const careerId = new URL(page.url()).pathname.split('/')[2]!;
  await page.getByRole('link', { name: '대시보드' }).click();
  const offers = page.getByRole('link', { name: '제안 보기' });
  if (await offers.isVisible()) {
    await offers.click();
    await signFirstOffer(page);
  }

  await page.goto(`/career/${careerId}/retirement`);
  await expect(page.getByRole('button', { name: '선수 생활 마무리' })).toBeVisible();

  await page.getByRole('button', { name: '선수 생활 마무리' }).click();
  await expect(page.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, '은퇴 확인 Dialog');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).not.toBeVisible();

  await page.getByRole('button', { name: '선수 생활 마무리' }).click();
  await page.getByRole('button', { name: '은퇴 확정' }).click();
  await expect(page.getByText('FULL TIME')).toBeVisible({ timeout: 15_000 });
  await expectNoSeriousOrCriticalViolations(page, 'FULL TIME');
  await expect(page.getByRole('button', { name: '선수 생활 마무리' })).not.toBeVisible();

  await page.getByRole('link', { name: 'Legacy Score' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+\/legacy$/);
  await expect(page.getByRole('heading', { name: 'Legacy Score' })).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, 'Legacy Score');
  await page.getByText('5축 점수 자세히 보기').click();
  await expect(page.getByText('성취', { exact: true })).toBeVisible();
  await expect(page.getByText('장기성', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '커리어를 대표하는 기록 보기' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+\/timeline#revision-\d+$/);
  await expect(page.getByRole('list', { name: '커리어 연대기' })).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, 'Timeline');

  await page.getByRole('link', { name: '최종 프로필' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+\/final-profile$/);
  await expect(page.getByRole('link', { name: '선수 보관함 · 새 커리어' })).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, 'Final Profile');
  await page.reload();
  await expect(page.getByRole('link', { name: '선수 보관함 · 새 커리어' })).toBeVisible();
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
});
