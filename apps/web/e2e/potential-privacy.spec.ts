import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resumeWithSave, retireFromMarket } from './helpers.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);

test('옛 진행 세이브의 재평가 로그를 가리며 능력치·훈련은 계속 보여 준다', async ({ page }) => {
  const reassessment = {
    t: '2029 프리시즌',
    text: '스카우트 재평가: 잠재력 S → A등급. 성장 곡선이 예상보다 일찍 꺾였다는 평가입니다.',
    kind: 'bad',
  };
  await resumeWithSave(page, {
    ...fixture,
    log: [reassessment, { t: '2029 프리시즌', text: '팀 훈련을 마쳤습니다.', kind: '' }],
    pending: null,
  });
  await expect(page.locator('.player')).not.toContainText('잠재력');
  await expect(page.getByText('팀 훈련을 마쳤습니다.', { exact: true })).toBeVisible();
  await expect(page.getByText(/스카우트 재평가/)).toHaveCount(0);
  await expect(page.locator('[data-train]').first()).toBeVisible();
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-pot]')).toHaveText('잠재력 평가는 은퇴할 때 공개돼요.');
  // 표시 필터가 원본 로그를 삭제하지 않는다.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).log[0].text)).toBe(
    reassessment.text,
  );
});

test('옛 저장본의 첫 시즌 결산·재평가 notes에서 등급이 새지 않는다', async ({ page }) => {
  const rec = fixture.career[0];
  await resumeWithSave(page, {
    career: [rec],
    pending: {
      type: 'market',
      m: null,
      res: {
        rec,
        trophies: [],
        awards: [],
        notes: ['스카우트 재평가 · 잠재력 S → A', '군 복무 종료'],
        gala: [],
        tours: [],
        miles: [],
        titles: [],
      },
    },
  });
  const sheet = page.locator('#sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('군 복무 종료');
  await expect(sheet.locator('[data-scout-first]')).toHaveCount(0);
  await expect(sheet).not.toContainText('스카우트 재평가');
  await expect(sheet).not.toContainText('잠재력');
});

test('은퇴 기록은 재접속 후 기록실에서도 같은 잠재력과 최고 OVR을 표시한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await retireFromMarket(page, 34);
  const original = await page.locator('[data-legend-pot]').innerText();
  await page.evaluate(() => localStorage.removeItem('ft_save'));
  await page.reload();
  await page.locator('.main-nav [data-act="owner"]').click();
  await page.locator('[data-my-player]').first().click();
  expect(await page.locator('[data-legend-pot]').innerText()).toBe(original);
});

test('잠재력이 기록되지 않은 옛 은퇴 선수는 평가 카드를 만들지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await retireFromMarket(page, 34);
  await page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem('ft_hof')!);
    delete entries[0].pot;
    localStorage.setItem('ft_hof', JSON.stringify(entries));
    localStorage.removeItem('ft_save');
  });
  await page.reload();
  await page.locator('.main-nav [data-act="owner"]').click();
  await page.locator('[data-my-player]').first().click();
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
  await expect(page.locator('[data-legend-pot]')).toHaveCount(0);
});
