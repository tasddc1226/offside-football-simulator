import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resumeWithSave } from './helpers.js';

// T-10-026 칭호: 조건을 채우고 구간을 진행하면 리포트에 "새 칭호"가 뜨고, 선수 카드에 대표 칭호가 붙고,
// 트로피 탭 도감에서 대표 칭호를 바꿀 수 있다.
test('구간 진행 후 새 칭호 → 선수 카드 대표 칭호 → 도감에서 대표 칭호 변경', async ({ page }) => {
  // 인기 조건(50·100)을 채운 저장본으로 다시 불러온다.
  await resumeWithSave(page, { fame: 120 });
  await expect(page.locator('.player h1')).toBeVisible();

  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 10_000 });
  const fresh = page.locator('[data-report] [data-new-titles]');
  await expect(fresh).toContainText('국민 스타');
  await expect(fresh).toContainText('떠오르는 스타');

  // 대표 칭호는 가장 높은 등급(희귀 · 국민 스타)이 자동으로 붙는다.
  const cardTitle = page.locator('.player [data-act="titles"]');
  await expect(cardTitle).toHaveText('국민 스타');
  await cardTitle.click();
  const dex = page.locator('[data-title-dex]');
  await expect(dex).toBeVisible();
  await expect(dex.locator('.title-main')).toContainText('자동');

  await dex.locator('[data-title="fame50"]').click();
  await expect(dex.locator('[data-title="fame50"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cardTitle).toHaveText('떠오르는 스타');
  await expect(dex.locator('.title-main')).toContainText('직접 고름');
  // 새로 고쳐도 유지된다(저장). 구간 진행 중 랜덤 이벤트가 대기로 남았으면 이어하기가 이벤트 시트를
  // 먼저 여니, 칭호만 보도록 대기 이벤트를 비운다.
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    if (g.pending?.type === 'event') g.pending = null;
    localStorage.setItem('ft_save', JSON.stringify(g));
  });
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player [data-act="titles"]')).toHaveText('떠오르는 스타');

  // 잠긴 칭호 목록: 숨김 칭호는 이름이 가려지고, 셀 수 있는 조건은 진행도가 보인다.
  await page.locator('.player [data-act="titles"]').click();
  await dex.getByText(/아직 얻지 못한 칭호/).click();
  await expect(dex.locator('[data-title-locked="st_rival_second"]')).toContainText('???');
  await expect(dex.locator('[data-title-locked="fame300"] [role="progressbar"]')).toHaveAttribute('aria-valuenow', /\d+/);

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const axe = await new AxeBuilder({ page }).include('[data-title-dex]').include('.player').analyze();
    expect(axe.violations.map((v) => `${scheme}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
