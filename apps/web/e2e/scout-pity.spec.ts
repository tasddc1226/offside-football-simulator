import { test, expect, type Page } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

// T-11-415 프리미엄 스카우트 천장 막대: S 확정 · 특급 S 두 칸에 쌓인 장수를 막대로 보이고, 다음 장이 확정이면 표시한다.
// 스카우트권이 없어도 한 번이라도 썼으면 막대를 보이고, S가 그냥 나와 S 확정 칸이 0으로 돌아가면 그렇게 알린다.

const SHOTS = process.env.PITY_SHOTS;

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/**`, (r) => r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', 'offline')));
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
});

// PITY_SHOTS=<폴더>면 PR에 붙일 화면을 찍는다(막대를 화면 가운데에 두고 휴대폰 크기 화면 그대로).
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.locator('[data-scout-pity]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function openCandidates(page: Page) {
  if (SHOTS) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await expect(page.locator('[data-scout-scan]')).toBeHidden();
}

test('쌓인 장수를 막대로 보이고, 다음 장이 확정인 칸에 표시한다 · S가 나오면 다시 센다고 알린다', async ({
  page,
}) => {
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 2, pity: { used: 57, streak: 29, elites: 0 } })),
  );
  await openCandidates(page);
  const gauge = page.locator('[data-scout-pity]');
  const sure = gauge.locator('[data-pity-row="sure"]');
  const elite = gauge.locator('[data-pity-row="elite"]');
  await expect(sure).toContainText('29 / 30장');
  await expect(sure).toHaveAttribute('data-pity-next', 'true');
  await expect(sure.getByRole('progressbar')).toHaveAttribute('aria-label', '다음 장은 S 확정');
  await expect(elite).toContainText('57 / 100장');
  await expect(elite).not.toHaveAttribute('data-pity-next');
  await expect(elite.getByRole('progressbar')).toHaveAttribute('aria-label', '특급 S까지 43장');
  await expect(gauge.locator('[data-pity-keep]')).toHaveCount(0);
  await shot(page, 'web-next-sure');

  // 이번 장에서 S가 그냥 나왔다: 서버가 S 확정 칸을 0으로 돌린다.
  await page.route(`${API}/v1/items/scout/use`, (r) =>
    r.fulfill(
      ok({
        reroll: 0,
        boost: 0,
        scout: 1,
        pity: { used: 58, streak: 0, elites: 0 },
        scoutMode: 'normal',
      }),
    ),
  );
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-act="premium-scout"]').click();
  await expect(page.getByText('S 후보가 나와서 S 확정 칸을 처음부터 다시 세요.')).toBeVisible();
  await expect(sure).toContainText('0 / 30장');
  await expect(sure).not.toHaveAttribute('data-pity-next');
  await expect(elite).toContainText('58 / 100장');
  await shot(page, 'web-reset');
});

test('스카우트권이 없어도 쓴 적이 있으면 막대와 이어서 센다는 안내를 보인다', async ({ page }) => {
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, pity: { used: 12, streak: 12, elites: 0 } })),
  );
  await openCandidates(page);
  const gauge = page.locator('[data-scout-pity]');
  await expect(gauge.locator('[data-pity-row="sure"]')).toContainText('12 / 30장');
  await expect(gauge.locator('[data-pity-keep]')).toBeVisible();
  await expect(page.locator('[data-act="premium-scout"]')).toHaveCount(0);
  await shot(page, 'web-empty');
});

test('한 번도 쓰지 않았고 스카우트권도 없으면 막대를 보이지 않는다', async ({ page }) => {
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, pity: { used: 0, streak: 0, elites: 0 } })),
  );
  await openCandidates(page);
  await expect(page.locator('[data-cand="2"]')).toBeVisible();
  await expect(page.locator('[data-scout-pity]')).toHaveCount(0);
});
