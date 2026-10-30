import { expect, test } from '@playwright/test';

// T-11-473 첫 커리어 따라가기 안내. 기본 설정(playwright.config storageState)은 안내가 끝난 채로 시작하므로 여기서만 지운다.
const fresh = () =>
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__tu_seeded')) return;
      sessionStorage.setItem('__tu_seeded', '1');
      localStorage.removeItem('ft_tutorial');
    });
  });

test.describe('처음 온 기기', () => {
  fresh();

  test('새 커리어 버튼부터 비추고, 누르면 선수 만들기 단계로 이어진다', async ({ page }) => {
    await page.goto('/');
    const bubble = page.locator('.coach-bubble');
    await expect(bubble).toHaveAttribute('data-coach-step', 'new');
    await expect(bubble).toContainText('첫 선수를 만들어요');
    await expect(page.locator('[data-first-guide]')).toHaveCount(0);
    await page.locator('[data-coach="new"]').click();
    await expect(bubble).toHaveAttribute('data-coach-step', 'pos');
    await page.locator('[data-act="coach-next"]').click();
    await expect(bubble).toHaveAttribute('data-coach-step', 'focus');
    await page.locator('[data-act="coach-next"]').click();
    await expect(bubble).toHaveAttribute('data-coach-step', 'candidates');
    await page.locator('[data-coach="candidates"]').click();
    await expect(bubble).toHaveAttribute('data-coach-step', 'cands', { timeout: 15_000 });
    // 본 단계를 적어 둬 다시 열면 거기서 이어진다.
    expect(await page.evaluate(() => localStorage.getItem('ft_tutorial'))).toBe('{"i":4}');
  });

  test('T-11-481 동의 창 같은 다른 창이 떠 있으면 그 뒤 자리를 비추지 않고, 닫히면 뜬다', async ({
    page,
  }) => {
    // 처음 방문자에게 뜨는 이용 분석 동의 창처럼, 시트 상태를 거치지 않는 aria-modal 창을 홈 위에 띄운다.
    await page.addInitScript(() => {
      addEventListener('DOMContentLoaded', () => {
        const d = document.createElement('div');
        d.setAttribute('role', 'dialog');
        d.setAttribute('aria-modal', 'true');
        d.setAttribute('aria-label', 'consent');
        d.id = 'fake-consent';
        d.style.cssText = 'position:fixed;inset:20% 0 0;background:#fff;z-index:10';
        document.body.append(d);
      });
    });
    await page.goto('/');
    await expect(page.locator('[data-act="home-market"]')).toBeAttached();
    await page.waitForTimeout(500);
    await expect(page.locator('.coach-bubble')).toHaveCount(0);
    await expect(page.locator('.coach-dim')).toHaveCount(0);
    await page.evaluate(() => document.getElementById('fake-consent')?.remove());
    await expect(page.locator('.coach-bubble')).toHaveAttribute('data-coach-step', 'new');
  });

  test('건너뛰면 다시 열어도 뜨지 않고, 설정에서 다시 볼 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-act="coach-skip"]').click();
    await expect(page.locator('.coach-bubble')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-act="home-market"]')).toBeVisible();
    await expect(page.locator('.coach-bubble')).toHaveCount(0);
    await page.locator('[data-act="settings"]').click();
    await page.locator('[data-act="tutorial-replay"]').click();
    await expect(page.locator('.coach-bubble')).toHaveAttribute('data-coach-step', 'new');
  });
});

test.describe('커리어를 해 본 기기', () => {
  test('명예의 전당 기록이 있으면 안내를 띄우지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__tu_seeded')) return;
      sessionStorage.setItem('__tu_seeded', '1');
      localStorage.removeItem('ft_tutorial');
      localStorage.setItem('ft_hof', '[]');
    });
    await page.goto('/');
    await expect(page.locator('[data-act="home-market"]')).toBeVisible();
    await expect(page.locator('.coach-bubble')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('ft_tutorial'))).toBe('{"i":-1}');
  });
});
