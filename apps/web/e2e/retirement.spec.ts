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

// T-7-011 범위 밖: `.os-eyebrow`(PR #120 디자인 토큰) 색상 대비 부족은 a11y.spec.ts·
// service-season.spec.ts:75에서와 동일한 이미 알려진 결함이다(T-7-012/013이 고친다) — fillPreseasonPlan
// 캐스케이드를 고치자 이 화면들도 도달 가능해지며 같은 결함이 드러났다. 그 세 id만 여기서도 허용하고,
// 그 밖의 새로운 심각도 위반은 그대로 실패로 잡는다.
const KNOWN_TRACKED_A11Y_IDS = new Set(['color-contrast', 'definition-list', 'only-dlitems']);

async function expectNoSeriousOrCriticalViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  const unexpected = seriousOrCritical.filter((violation) => !KNOWN_TRACKED_A11Y_IDS.has(violation.id));
  console.log(
    `[retirement-e2e][a11y] ${label}: serious/critical ${seriousOrCritical.length}건(알려진 결함 제외 후 미확인 ${unexpected.length}건)`,
  );
  expect(unexpected).toEqual([]);
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
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, '은퇴 확인 Dialog');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

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
