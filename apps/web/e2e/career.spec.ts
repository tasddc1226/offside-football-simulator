import { test, expect, type Page } from '@playwright/test';
import { startCareer } from './helpers.js';

// 프리시즌 → 전반기 → 후반기를 여러 시즌 돌리는 동안 확률 이벤트 선택지, 오퍼/시트 버튼이
// 그때그때 나타난다 — 매 스텝마다 "지금 보이는 걸 하나 고른다"는
// 방식으로 진행한다. 순수 UI 폴링이라 애니메이션 타이밍에 흔들리지 않는다.
async function clickWhateverIsNext(page: Page): Promise<boolean> {
  const candidates = [
    '.choice:visible',
    '[data-opt]:visible',
    '#sheet [data-sheet]:visible',
    '[data-act="resume"]:visible',
    '[data-act="advance"]:visible',
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 1500 });
        return true;
      } catch {
        // 다음 후보로 넘어간다 — 클릭 사이 화면이 바뀌었을 수 있다.
      }
    }
  }
  return false;
}

test('커리어 생성 후 2시즌 이상 진행한다', async ({ page }) => {
  test.setTimeout(120_000);
  await startCareer(page);

  const initialYear = await page.evaluate(() => {
    const raw = localStorage.getItem('ft_save');
    return raw ? (JSON.parse(raw) as { year: number }).year : null;
  });
  expect(initialYear).not.toBeNull();

  let seasonsCompleted = 0;
  for (let i = 0; i < 400 && seasonsCompleted < 2; i++) {
    const acted = await clickWhateverIsNext(page);
    if (!acted) await page.waitForTimeout(200);

    seasonsCompleted = await page.evaluate((startYear) => {
      const raw = localStorage.getItem('ft_save');
      if (!raw) return 0;
      const g = JSON.parse(raw) as { year: number };
      return Math.max(0, g.year - (startYear as number));
    }, initialYear);
  }

  expect(seasonsCompleted).toBeGreaterThanOrEqual(2);
});
