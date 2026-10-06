import { expect, test } from '@playwright/test';
import { API, ok, startCareer } from './helpers.js';

const BEFORE = new Date('2026-10-05T14:59:59.999Z');
const OPEN = new Date('2026-10-05T15:00:00.000Z');

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/**`, (r) => r.fulfill(ok({})));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: false, toss: false },
        googleEmailMasked: null,
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: null,
      }),
    ),
  );
});

test('개막 직전 선수는 자정 뒤 새로고침해도 프리시즌 규칙을 유지한다', async ({ page }) => {
  await page.clock.setFixedTime(BEFORE);
  await startCareer(page);
  const readRules = () =>
    page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ft_save')!);
      return { cid: s.cid, dpos: s.dpos ?? null, retireAt: s.retireAt ?? 41 };
    });
  const saved = await readRules();
  expect(saved).toMatchObject({ dpos: null, retireAt: 41 });
  await page.clock.setFixedTime(OPEN);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  expect(await readRules()).toEqual(saved);
});

test('정각에 새로 만든 선수는 세부 포지션과 45세 규칙을 받는다', async ({ page }) => {
  await page.clock.setFixedTime(OPEN);
  await startCareer(page);
  expect(
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ft_save')!);
      return { dpos: s.dpos, retireAt: s.retireAt };
    }),
  ).toEqual({ dpos: 'ST', retireAt: 45 });
});

test('생성 화면을 열어 둔 채 개막하면 선택지가 열리고 선택한 후보를 보존한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T14:59:00.000Z') });
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(page.locator('[data-set="dpos"]')).toHaveCount(0);
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.clock.fastForward(60_000);
  await expect(page.locator('[data-act="start"]')).toBeEnabled();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  expect(
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ft_save')!);
      return { dpos: s.dpos, retireAt: s.retireAt };
    }),
  ).toEqual({ dpos: 'ST', retireAt: 45 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('개막 때 프로필 입력값과 주력 선택을 유지하며 세부 포지션을 연다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T14:59:00.000Z') });
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(page.locator('[data-act="next-candidates"]')).toBeVisible();
  await expect(page.locator('[data-set="dpos"]')).toHaveCount(0);
  const before = await page
    .locator('input')
    .evaluateAll((inputs) => inputs.map((e) => (e as HTMLInputElement).value));
  await page.clock.fastForward(60_000);
  await expect(page.locator('[data-set="dpos"]')).toHaveCount(2);
  await expect(page.locator('[data-set="dpos"][data-val="ST"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    await page
      .locator('input')
      .evaluateAll((inputs) => inputs.map((e) => (e as HTMLInputElement).value)),
  ).toEqual(before);
  await expect(page.locator('[data-act="next-candidates"]')).toBeEnabled();
});
