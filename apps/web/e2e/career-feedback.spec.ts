import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clearPendingEvent, resumeWithSave, startCareer } from './helpers.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);

test('훈련 후 실제 성장 메모가 갱신되고 새로고침 뒤에도 기존 선수와 안내를 유지한다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCareer(page);
  const memo = page.locator('[data-coach-feedback]');
  await expect(memo).toContainText('아직 표시할 능력치 변화가 없어요.');
  await page.locator('[data-train="dri"]').click();
  await page.locator('[data-act="advance"]').click();
  const skip = page.locator('#an-skip');
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 15000 });
  await clearPendingEvent(page);
  await expect(memo).toContainText('드리블 +');
  const text = await memo.innerText();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(memo).toHaveText(text, { useInnerText: true });
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

test('옛 세이브와 작은 화면에서도 목표와 코치 메모를 읽고 게임 상태는 유지한다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { ...fixture, pending: null });
  await expect(page.locator('[data-coach-feedback]')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.locator('[data-tab="career"]').click();
  const goals = page.locator('[data-career-goals]');
  await expect(goals).toContainText('A매치');
  await expect(goals).toContainText('우승 트로피');
  await expect(goals).toContainText('에서');
  await page.locator('[data-tab="season"]').click();
  await page.locator('[data-tab="career"]').click();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  for (const size of [
    { width: 375, height: 812 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(size);
    const box = await goals.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
  }
});

test('저장된 이적 제의의 조건 설명은 반복 열기에도 제의와 RNG를 바꾸지 않는다', async ({
  page,
}) => {
  const offer = {
    kind: 'offer',
    clubId: 'k2_0',
    name: '구단',
    leagueId: 'k2',
    str: 60,
    years: 2,
    salary: 5000,
    fee: 0,
    role: '벤치 경쟁',
  };
  await resumeWithSave(page, {
    ...fixture,
    pending: {
      type: 'market',
      res: null,
      m: { options: [offer], note: '제의가 도착했습니다.', canRetire: false },
    },
  });
  await expect(page.locator('[data-market-feedback]')).toContainText('지난 시즌 평점');
  await expect(page.locator('[data-offer-feedback]')).toContainText('벤치 경쟁');
  await expect(page.locator('#sheet')).not.toContainText('잠재력');
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  const text = await page.locator('[data-market-feedback]').innerText();
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('[data-market-feedback]')).toHaveText(text);
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

for (const width of [320, 390])
  test(`육성 안내 ${width}px는 저장과 RNG를 바꾸지 않고 훈련 선택을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await startCareer(page);
    await expect(page.locator('[data-train-pick]')).toHaveCount(1);
    await expect(page.locator('[data-training-pick-hint]')).toHaveCount(0);
    const before = await page.evaluate(() => localStorage.getItem('ft_save'));
    const guide = page.locator('[data-position-guide]');
    await guide.locator('summary').click();
    await guide.getByRole('button', { name: '골키퍼', exact: true }).click();
    await expect(guide).toContainText('스위퍼 키퍼');
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(before);
    await guide.locator('summary').click();
    await page.locator('[data-train="pac"]').click();
    await expect(page.locator('[data-train="pac"]')).toHaveAttribute('aria-pressed', 'true');
    const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('ft_save')))!);
    expect(saved.training).toBe('pac');
    expect(saved.rng).toEqual(JSON.parse(before!).rng);
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await expect(page.locator('[data-train="pac"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
