import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);

for (const [name, service, expected] of [
  ['복무 중', { monthsLeft: 22, lastYear: 2029 }, '체육요원 복무 중'],
  ['완료', { monthsLeft: 0, lastYear: 2031 }, '체육요원 복무 완료'],
  ['기존 저장', undefined, '체육요원 특례 · 기존 기록'],
] as const) {
  test(`체육요원 ${name} 표시·공용 안내와 저장 복원을 확인한다`, async ({ page }) => {
    await resumeWithSave(page, {
      ...fixture,
      pending: null,
      mil: { ...fixture.mil, exempt: '올림픽 동메달', sportsService: service },
    });
    await page.locator('[data-tab="player"]').click();
    await expect(page.locator('#app')).toContainText(expected);
    const guide = page.locator('[data-military-guide]');
    await expect(guide).toContainText('상무나 현역 입대 없이');
    await expect(guide).toContainText('출전 경기 수는 조건이 아니고');
    await expect(guide).toContainText('34개월');
    await expect(guide).toContainText('544시간');
    await expect(guide).toContainText('상무에서 전환하면');
    if (!service) await expect(page.locator('[data-military-legacy]')).toBeVisible();
    else await expect(page.locator('[data-military-legacy]')).toHaveCount(0);
    const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await page.locator('[data-tab="player"]').click();
    await expect(guide).toContainText('34개월');
    await expect(page.locator('#app')).toContainText(expected);
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
    for (const width of [360, 812]) {
      await page.setViewportSize({ width, height: 780 });
      const box = await guide.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  });
}

test('외국 선수의 선수 탭에는 병역 특례 안내를 표시하지 않는다', async ({ page }) => {
  await resumeWithSave(page, { ...fixture, pending: null, nation: 'JP' });
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-nation]')).toContainText('일본');
  await expect(page.locator('[data-military-guide]')).toHaveCount(0);
});

test('T-11-077 아시안게임 시즌을 앞둔 상무 합격자는 입대를 미루고 이적 시장으로 돌아갈 수 있다', async ({
  page,
}) => {
  await resumeWithSave(page, {
    ...fixture,
    year: 2030,
    age: 23,
    pending: { type: 'market', res: null, m: null },
    mil: {
      exempt: null,
      served: false,
      serving: false,
      left: 0,
      type: null,
      prevClub: null,
      accepted: true,
      applied: false,
    },
  });
  const sheet = page.locator('#sheet');
  await expect(sheet).toContainText('복무 기간에 2030 아시안게임이 열립니다');
  await expect(sheet.locator('[data-opt="0"]')).toContainText('김천 상무 입대');
  await sheet
    .locator('[data-opt="1"]')
    .filter({ hasText: '입대를 미루고 2030 아시안게임에 도전' })
    .click();
  await expect(sheet).toContainText('입대를 미뤘습니다');
  await sheet.getByRole('button', { name: '이적 시장으로 →' }).click();
  await expect(sheet).toContainText('다음 시즌, 어디서 뛸까요?');
  await expect(sheet).not.toContainText('김천 상무 입대');
  const mil = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).mil);
  expect(mil).toMatchObject({ accepted: false, serving: false });
});
