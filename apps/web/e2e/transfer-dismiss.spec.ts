import { test, expect } from '@playwright/test';
import { openMarket, startCareer } from './helpers.js';

for (const width of [320, 390]) {
  test(`transfer offers survive dismissal, navigation and reload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openMarket(page, 24);
    const sheet = page.locator('#sheet');
    const offers = await sheet.locator('[data-opt]').allTextContents();
    const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
    const close = page.locator('[data-market-close]');
    const box = await close.boundingBox();
    // CSS는 44px이지만 시트 등장 변환 중에 재면 43.9999처럼 서브픽셀이 깎인다(CI 플레이크). 0.5px 여유.
    expect(box!.width).toBeGreaterThanOrEqual(43.5);
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
    await close.click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-act="resume"]')).toContainText('이적할 팀 선택하기');
    await page.locator('[data-tab="player"]').click();
    await expect(page.locator('[data-act="resume"]')).toBeVisible();
    await page.locator('[data-act="resume"]').click();
    expect(await sheet.locator('[data-opt]').allTextContents()).toEqual(offers);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-act="resume"]')).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await expect(sheet).toBeVisible();
    expect(await sheet.locator('[data-opt]').allTextContents()).toEqual(offers);
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
    await page.locator('#modal').click({ position: { x: 4, y: 4 } });
    await expect(sheet).toBeHidden();
    await page.locator('[data-act="resume"]').click();
    await expect(sheet).toBeVisible();
    await page.locator('[data-opt="0"]').click();
    // Both direct choices and contract choices remain available after reopening.
    await expect(page.locator('[data-market-close]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('임대를 요청하면 임대 계약을 하고, 임대가 끝나면 원소속 구단으로 돌아온다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  const patch = (fn: string) =>
    page.evaluate((src) => {
      const g = JSON.parse(localStorage.getItem('ft_save')!);
      new Function('g', src)(g);
      localStorage.setItem('ft_save', JSON.stringify(g));
    }, fn);
  await startCareer(page);
  await patch(`Object.assign(g, {
    club: { id: 'pl-0', name: '맨체스터 스카이블루', leagueId: 'pl', str: 87 }, leagueId: 'pl', age: 21,
    contract: { years: 2, salary: 5000 }, pending: { type: 'market', res: null, m: null } });
    g.flags.loanReq = g.year - 1;`);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  const sheet = page.locator('#sheet');
  const loan = sheet.locator('[data-opt]', { hasText: '임대 1시즌' }).first();
  await expect(loan).toBeVisible();
  await loan.click();
  await expect(sheet).toContainText('임대 계약서에 사인할까요?');
  await page.locator('[data-sign="name"]').click();
  await page.locator('[data-sign="ok"]').click();
  await expect.poll(async () => (await save()).loan?.club.id).toBe('pl-0');
  const host = (await save()).club;
  expect(host.id).not.toBe('pl-0');

  await patch(`g.career.push({ year: g.year, age: g.age, club: g.club.name, clubId: g.club.id,
    league: '-', apps: 30, goals: 6, assists: 3, cs: 0, rating: 7.1, rank: 3, ovr: 60, honors: [],
    pro: true, loan: true });
    Object.assign(g, { year: g.year + 1, age: g.age + 1, contract: { years: 1, salary: 5000 },
      pending: { type: 'market', res: null, m: null } });`);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(
    sheet.locator('[data-opt]', { hasText: '임대 구단의 완전 이적 제안' }),
  ).toBeVisible();
  const back = sheet.locator('[data-opt]', { hasText: '맨체스터 스카이블루 복귀' });
  await expect(back).toContainText('감독 신뢰 상승');
  await page.locator('[data-market-close]').click();
  await page.locator('[data-tab="career"]').click();
  await expect(page.locator('[data-season-loan]').first()).toHaveText('임대');
  await page.locator('[data-act="resume"]').click();
  await back.click();
  await expect.poll(async () => (await save()).club.id).toBe('pl-0');
  expect((await save()).loan).toBeUndefined();
});
