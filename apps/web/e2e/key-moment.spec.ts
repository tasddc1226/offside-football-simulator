import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail } from './helpers.js';
import { resumeFixture } from './fixtures/career-save.js';

// Start at the league block: random preseason injuries/events can legitimately prevent a moment.
async function openLeague(page: Page) {
  await page.route(`${API}/**`, (r) => r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', 'offline')));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeFixture(page, {
    phase: 1,
    trust: 95,
    cond: 100,
    injury: 0,
    pending: null,
    rng: { seed: 1 },
  });
}

// T-11-390 리그 구간 중계가 결정적 장면에서 멈추고 선택 카드를 띄운다. 고르면 결과 줄이 나오고 남은 경기가 이어진다.
test('리그 구간 중계가 결정적 장면에서 멈추고, 고른 결과가 나온 뒤 이어진다', async ({ page }) => {
  test.setTimeout(60_000);
  await openLeague(page);
  const sheet = page.locator('#sheet');

  await page.locator('[data-act="advance"]').click(); // 전반기
  const card = sheet.locator('[data-key-moment="league"]');
  // 건너뛰기도 장면에서는 멈춘다.
  await page.locator('#an-skip').click();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#an-skip')).toHaveCount(0);
  await expect(card).toContainText(/결정적 찬스|실점 위기/);
  await expect(card).toContainText('초 뒤 감독에게 맡겨요');
  // T-11-479 맡김 결과가 이미 상태에 들어가 있으므로 중계 동안 뒤 화면(순위표 · 대회 결과)을 불투명하게 덮는다.
  await expect(page.locator('#modal')).toHaveClass(/modal-solid/);
  const backdrop = await page
    .locator('#modal')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(backdrop).not.toMatch(/rgba\(.*,\s*0?\.\d+\)/);
  const choices = card.locator('[data-key-moment-choice]');
  expect(await choices.count()).toBeGreaterThanOrEqual(3); // 선택지 2~3개 + 맡기기
  await expect(choices.first()).toContainText(/성공 \d+%/);
  // T-11-438 실패하면 무엇을 잃는지 한 줄로 보인다.
  await expect(card.locator('[data-key-moment-stake]')).toHaveText(
    /실패하면 하나 줄 수 있어요|막지 못하면 실점/,
  );
  const a11y = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(a11y.violations).toEqual([]);

  await choices.first().click();
  const result = card.locator('[data-key-moment-result]');
  await expect(result).toBeVisible();
  await expect(result).toContainText('선택:');
  // 결과 줄이 지나면 남은 경기를 채우고 확인 버튼이 뜬다(건너뛴 상태 그대로).
  const ok = sheet.locator('[data-sheet="0"]');
  await expect(ok).toHaveText('확인', { timeout: 10_000 });
  await expect(card).toHaveCount(0);
  const wdl = (await sheet.locator('[data-block-wdl]').textContent())!;
  await ok.click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-report]')).toContainText(wdl.replace(/\s+/g, ' ').trim());
  // 고른 결과로 다시 진행한 상태가 저장된다(구간이 끝나 전반기를 지났다).
  const phase = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase);
  expect(phase).toBe(2);
});

test('장면에서 고르지 않으면 15초 뒤 감독에게 맡기고 이어진다', async ({ page }) => {
  test.setTimeout(60_000);
  const now = new Date('2026-10-19T12:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1_000));
  await openLeague(page);
  const sheet = page.locator('#sheet');
  await page.locator('[data-act="advance"]').click();
  await page.locator('#an-skip').click();
  // Let the two paint frames run before the paused clock reaches the choice timer.
  await page.clock.runFor(100);
  const card = sheet.locator('[data-key-moment="league"]');
  await expect(card).toBeVisible();
  // Browser work cannot spend the timeout budget while assertions or chunks are loading.
  await page.clock.runFor(14_000);
  await expect(card.locator('[data-key-moment-result]')).toHaveCount(0);
  await expect(card.locator('[data-key-moment-choice="auto"]')).toBeVisible();
  await page.clock.runFor(1_000);
  await expect(card.locator('[data-key-moment-result]')).toContainText('감독에게 맡기기');
  await page.clock.runFor(3_000);
  await expect(sheet.locator('[data-sheet="0"]')).toHaveText('확인');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  expect(saved.phase).toBe(2);
});

// T-11-438 구간 결과는 중계 전에 저장된다. 중계 도중 새로고침(앱 종료)해도 그 구간 리포트를 다시 보여 준다.
test('중계 도중 새로고침해도 구간 리포트가 시즌 탭에 남는다', async ({ page }) => {
  test.setTimeout(60_000);
  await openLeague(page);
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet [data-key-moment="league"]')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  // 이어 하기는 대기 중인 이벤트 시트를 띄울 수 있다. 리포트는 그 뒤 시즌 탭 맨 위에 있다.
  await page.locator('[data-act="continue"]').click();
  const report = page.locator('[data-report]');
  await expect(report).toBeVisible();
  await expect(report).toContainText('전반기');
  // 한 번 보여 준 뒤에는 보관을 지운다.
  expect(await page.evaluate(() => localStorage.getItem('ft_phase_report'))).toBe('null');
});
