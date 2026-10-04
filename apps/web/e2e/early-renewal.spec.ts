import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);
const pending = { type: 'market', res: null, m: null };

test('조기 연장 조건·취소·복원·중복 사인과 다음 시즌 계약을 보존한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, {
    ...fixture,
    age: 31,
    contract: { years: 1, salary: 1000 },
    pending,
  });
  const option = page.locator('[data-opt]').filter({ hasText: '연장 계약' });
  await expect(option).toContainText('1년 남음 · 1년 연장 · 총 2년');
  await expect(option).toContainText('새 연봉은 이번 시즌부터');
  const saved = await page.evaluate(() => localStorage.getItem('ft_save')!);
  const before = JSON.parse(saved);
  await option.click();
  await expect(page.locator('#sheet')).toContainText('연장 계약서에 사인할까요?');
  await expect(page.locator('#sheet')).toContainText('추가 연장');
  await expect(page.locator('#sheet')).toContainText('총 계약 기간');
  await page.locator('[data-sign="close"]').click();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  await option.click();
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(option).toContainText('총 2년');
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  for (const size of [
    { width: 375, height: 812 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(size);
    const box = await option.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await option.click();
  await page.locator('[data-sign="name"]').click();
  await expect(page.locator('[data-sign="ok"]')).toBeEnabled();
  await page.locator('[data-sign="ok"]').evaluate((el: HTMLButtonElement) => {
    el.click();
    el.click();
  });
  await expect(page.locator('#sheet')).toBeHidden();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  const r = before.pending.m.options.find((o: { kind: string }) => o.kind === 'renew');
  expect(after.contract).toEqual({ years: r.years, salary: r.salary });
  expect(after.trust).toBe(before.trust + 1);
  expect(after.money).toBe(before.money);
  expect(after.pending).toBeNull();
  expect(after.phase).toBe(0);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).contract)).toEqual(
    after.contract,
  );
  await expect(page.locator('#sheet')).toBeHidden();
});

for (const transfer of [false, true]) {
  test(`조기 연장 계약서를 닫은 뒤 ${transfer ? '타 구단으로 이적' : '기존 계약으로 잔류'}한다`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const offer = {
      kind: 'offer',
      clubId: 'k2-0',
      name: '이적 구단',
      leagueId: 'k2',
      str: 60,
      years: 2,
      salary: 5000,
      fee: 1000,
      role: '로테이션',
    };
    const club = fixture.club;
    const renewal = {
      kind: 'renew',
      name: `${club.name} 연장 계약`,
      years: 2,
      salary: 2000,
      desc: '새 연봉은 이번 시즌부터 적용돼요.',
      extension: { years: 1, clubId: club.id, year: fixture.year },
    };
    await resumeWithSave(page, {
      ...fixture,
      age: 31,
      contract: { years: 1, salary: 1000 },
      pending: {
        type: 'market',
        res: null,
        m: {
          options: [
            { kind: 'stay', name: `${club.name} 잔류`, desc: '계약 1년 남음' },
            renewal,
            offer,
          ],
          note: '',
          canRetire: true,
        },
      },
    });
    await page.locator('[data-opt="1"]').click();
    await page.locator('[data-sign="close"]').click();
    await page.locator(`[data-opt="${transfer ? 2 : 0}"]`).click();
    if (transfer) {
      await page.locator('[data-sign="name"]').click();
      await page.locator('[data-sign="ok"]').click();
    }
    await expect(page.locator('#sheet')).toBeHidden({ timeout: 15000 });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
    expect(after.contract).toEqual(
      transfer ? { years: 2, salary: 5000 } : { years: 1, salary: 1000 },
    );
    expect(after.club.id).toBe(transfer ? offer.clubId : club.id);
    expect(after.pending).toBeNull();
  });
}
