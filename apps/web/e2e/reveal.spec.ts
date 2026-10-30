import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openMarket, resumeWithSave } from './helpers.js';

// T-11-371 팩 오픈식 결과 공개 연출. 기본 설정(연출 짧게)을 끄고 연출을 본다. 결과 · 저장값은 연출과 관계없이 같다.
const PORT = Number(process.env.E2E_PORT) || (process.env.E2E_DEV === '1' ? 5174 : 5175);
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: `http://localhost:${PORT}`,
        localStorage: [
          { name: 'ft_first_guide', value: '["items","save"]' },
          { name: 'ft_tutorial', value: '{"i":-1}' },
        ],
      },
    ],
  },
});

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);

async function toCandidates(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await expect(page.locator('[data-cand="0"]')).toBeVisible();
}

test('후보 카드는 단서 → 결과로 열리고, 누르면 바로 결과로 간다', async ({ page }) => {
  await toCandidates(page);
  const card = page.locator('[data-cand="0"]');
  await card.click();
  await expect(card).toHaveAttribute('data-reveal', 'hint');
  // 연출 중에 다시 누르면 결과 단계로 건너뛴다.
  await card.click();
  await expect(card).toHaveAttribute('data-reveal', 'done');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  // 강도는 공개된 값(OVR · 보장 표시)으로만 정해진다.
  await expect(card).toHaveAttribute('data-reveal-tier', /^(normal|good|jackpot)$/);
  // 두 번째 카드도 끝나면 결과가 남는다(짧게).
  const second = page.locator('[data-cand="1"]');
  await second.click();
  await expect(second).toHaveAttribute('data-reveal', 'done', { timeout: 3000 });
});

test('감속 모션이면 연출 없이 결과만 보인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toCandidates(page);
  const card = page.locator('[data-cand="0"]');
  await card.click();
  await expect(card).toHaveAttribute('data-reveal', 'done');
});

test('"연출 짧게"는 설정에서 켜고, 다시 열어도 유지된다', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="settings"]').first().click();
  const sw = page.locator('[data-setting="reveal-short"]');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await page.locator('[data-act="settings"]').first().click();
  await expect(page.locator('[data-setting="reveal-short"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await toCandidates(page);
  const card = page.locator('[data-cand="0"]');
  await card.click();
  await expect(card).toHaveAttribute('data-reveal', 'done');
});

test('이번 시즌 평가를 열면 등급이 훑고 올라간 뒤 같은 결과 글자가 남는다', async ({ page }) => {
  await resumeWithSave(page, { ...fixture, pending: null });
  await page.locator('[data-tab="player"]').click();
  await page.locator('[data-act="pot-peek"]').click();
  const pot = page.locator('[data-pot]');
  await expect(pot.locator('[data-reveal]')).not.toHaveAttribute('data-reveal', 'done');
  await expect(pot.locator('[data-reveal]')).toHaveAttribute('data-reveal', 'done', {
    timeout: 4000,
  });
  await expect(pot).toHaveText(/등급 · 2034 시즌 스카우트 평가/);
  // 탭을 다시 열면 연출 없이 글자만.
  await page.locator('[data-tab="season"]').click();
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-pot] [data-reveal]')).toHaveCount(0);
  await expect(page.locator('[data-pot]')).toHaveText(/등급 · 2034 시즌 스카우트 평가/);
});

test('은퇴 직후 실제 잠재력은 장면에 들어오면 공개되고, 한 번 본 커리어로 남는다', async ({
  page,
}) => {
  await openMarket(page, 34);
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  const pot = page.locator('[data-legend-pot]');
  await pot.scrollIntoViewIfNeeded();
  await expect(pot.locator('[data-reveal]')).toHaveAttribute('data-reveal', 'done', {
    timeout: 5000,
  });
  await expect(pot).toContainText(/은퇴 시점 잠재력 평가\s*[SABCD]/);
  // 이 커리어의 공개 연출은 한 번만 — 본 커리어 id를 이 기기에 남긴다.
  const seen = await page.evaluate(() => ({
    cid: JSON.parse(localStorage.getItem('ft_save')!).cid,
    seen: JSON.parse(localStorage.getItem('ft_reveal_pot')!),
  }));
  expect(seen.seen).toBe(seen.cid);
});
