import { expect, test } from '@playwright/test';

// T-11-437 선수 생성 · 첫 안내 다듬기(UX 점검 중간 지적 A2~A5 · A7).
test('비주력 능력치도 성장 감소를 보이고, 후보 단계는 안내를 소개 아래에 두고 도구 안내를 접는다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  // A3 공격수 기본 주력(슈팅 · 드리블) 밖의 능력치는 시작 보정과 함께 성장 -10%를 보인다.
  await expect(page.locator('[data-set="focus"][data-val="sho"] small')).toContainText('성장 +20%');
  await expect(page.locator('[data-set="focus"][data-val="pas"] small')).toContainText('성장 -10%');
  await page.locator('[data-act="next-candidates"]').click();

  // A2 능력치가 킥오프 때 달라질 수 있다는 안내는 후보 소개 바로 아래에 있다.
  const note = page.locator('[data-candidate-stats-note]');
  await expect(note).toBeVisible();
  const order = await page.evaluate(() => {
    const intro = document.querySelector('.cand-intro')!;
    const n = document.querySelector('[data-candidate-stats-note]')!;
    const list = document.querySelector('.cand-list')!;
    return [intro.nextElementSibling === n, n.nextElementSibling === list];
  });
  expect(order).toEqual([true, true]);

  // A4 로그인 흔적이 없으면 무엇을 쓸 수 있는지 한 줄과 로그인 입구를 보인다.
  await expect(page.locator('[data-login-tools]')).toContainText('로그인하면');
  // A5 쓸 도구가 없으면 상점 위치 · 능력치 설명은 '더 보기' 안에 접혀 있다.
  const more = page.locator('[data-more-tools]');
  await expect(more).toHaveCount(1);
  await expect(more).not.toHaveAttribute('open');
  await expect(page.locator('[data-act="ovr-guide-toggle"]')).toHaveCount(0);
  await page.locator('[data-act="more-tools-toggle"]').click();
  await expect(more.getByTestId('ovr-guide')).toBeVisible();

  await page.locator('[data-act="login-tools-go"]').click();
  // 계정 패널(로그인 버튼)이 있는 구단주 화면으로 간다.
  await expect(page.getByRole('heading', { level: 1, name: '내 구단' })).toBeVisible();
});

test('첫 커리어를 시작하면 저장 위치 안내가 한 번 뜨고, 백업 코드 카드로 데려간다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__sh_seeded')) return;
    sessionStorage.setItem('__sh_seeded', '1');
    localStorage.setItem('ft_first_guide', '["items"]');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  const hint = page.locator('[data-save-hint]');
  await expect(hint).toContainText('이 브라우저에만 저장돼요');
  await page.locator('[data-act="save-hint-backup"]').click();
  await expect(page.locator('[data-settings="backup"]')).toBeInViewport();
  // 한 번 눌러 확인했으면 다시 뜨지 않는다.
  await page.goto('/');
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  await expect(hint).toHaveCount(0);
});
