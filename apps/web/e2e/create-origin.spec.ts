import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resumeWithSave } from './helpers.js';

// T-10-096: 선수 생성에서 국적(전 세계)·키·몸무게를 고른다. 이상한 체격은 막고, 고른 값이 선수 정보에 남는다.
test('국적·키·몸무게를 입력하고, 범위를 벗어나면 다음으로 넘어가지 못한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  const next = page.locator('[data-act="next-candidates"]');
  const note = page.locator('[data-body-note]');

  // 기본값: 대한민국 · 포지션 평균 체격
  const nation = page.locator('#f-nation');
  await expect(nation).toHaveValue('대한민국');
  await expect(page.locator('[data-nation-note]')).toContainText('병역');
  await expect(page.locator('#f-height')).toHaveValue('180');
  await expect(note).toContainText('포지션 평균 체격');

  // T-10-099 한글·초성으로 찾는다. 타이핑 중인 글자(블)도 맞고, 키보드로 고를 수 있다.
  await nation.click();
  await expect(page.getByRole('option', { name: /대한민국/ })).toHaveAttribute('aria-selected', 'true');
  await nation.fill('ㅂㄹㅈ');
  await expect(page.getByRole('option', { name: '브라질' })).toBeVisible();
  await expect(page.getByRole('option', { name: '대한민국' })).toHaveCount(0);
  await nation.fill('없는나라');
  await expect(page.locator('.combo-empty')).toBeVisible();
  await nation.fill('블');
  await expect(page.getByRole('option', { name: /브라질/ })).toBeVisible();
  await nation.fill('브라질');
  await nation.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(nation).toHaveValue('브라질');
  await expect(nation).toHaveAttribute('data-value', 'BR');
  await expect(page.locator('[data-nation-note]')).toContainText('코파 아메리카');
  await expect(page.locator('.live-card')).toContainText('브라질');

  await page.locator('#f-height').fill('210');
  await expect(note).toContainText('160~200cm');
  await expect(next).toBeDisabled();
  await page.locator('#f-height').fill('192');
  await page.locator('#f-weight').fill('60');
  await expect(note).toContainText('가벼워요');
  await expect(next).toBeDisabled();
  await page.locator('#f-weight').fill('86');
  await expect(note).toContainText('헤딩 정확도 +');
  await expect(next).toBeEnabled();

  const { violations } = await new AxeBuilder({ page }).include('.create-form').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await next.click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-nation]')).toContainText('브라질');
  await expect(page.locator('[data-body]')).toContainText('192cm · 86kg');
});

// 체격 입력 이전 저장본(국적·체격 없음)은 대한민국 · 포지션 표준 체격으로 보인다(표시만).
test('옛 저장본은 대한민국 국적에 포지션 표준 체격으로 보인다', async ({ page }) => {
  await resumeWithSave(page, { nation: undefined, body: undefined, pos: 'GK' });
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-nation]')).toContainText('대한민국');
  await expect(page.locator('[data-body]')).toContainText('189cm · 83kg');
});
