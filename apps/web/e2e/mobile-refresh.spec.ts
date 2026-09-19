// Presentation-only regression coverage. Every test uses Playwright's isolated browser context,
// mocked API responses and fresh local career data; it never touches the user's running session.
import { expect, type Page, test, type TestInfo } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  fillPlayerInfo,
  fulfillJson,
  META,
  planPreseason,
  resolveRoleProposal,
  startNewCareer,
} from './helpers/player-creation.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/**', (route) =>
    fulfillJson(route, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '화면 테스트의 격리된 API입니다.',
        retryable: true,
      },
      meta: META,
    }),
  );
});

async function attachScreen(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await testInfo.attach(name, {
    path,
    contentType: 'image/png',
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    // The pitch SVG is intentionally clipped inside the hero. Measure its readable content,
    // not the decorative wrapper's scrollWidth, while still checking the full document width.
    const selectors =
      '#game-content [role="radio"], #game-content [role="tab"], #game-content input, #game-content select, .os-game-hero-content, .os-panel';
    return {
      page: document.documentElement.scrollWidth - viewportWidth,
      controls: [...document.querySelectorAll<HTMLElement>(selectors)].flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          element.getAttribute('aria-hidden') === 'true' ||
          getComputedStyle(element).opacity === '0'
        )
          return [];
        const clipped = element.scrollWidth > element.clientWidth + 1;
        return rect.left < -1 || rect.right > viewportWidth + 1 || clipped
          ? [
              {
                label:
                  element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 70),
                left: rect.left,
                right: rect.right,
                clipped,
              },
            ]
          : [];
      }),
    };
  });
  expect(overflow.page, 'The document must not scroll horizontally').toBeLessThanOrEqual(1);
  expect(
    overflow.controls,
    'Visible controls and panels must fit without clipping their contents',
  ).toEqual([]);
}

test('큰 화면에서도 게임 프레임은 560px로 중앙 정렬된다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const shell = await page.locator('.os-shell').boundingBox();
  expect(shell).not.toBeNull();
  // packages/ui/src/tokens.css의 --os-content-max: 560px(디자인 토큰)가 game.css의 .os-shell
  // max-width를 정한다(480px는 그 이전 값이다).
  expect(shell!.width).toBeLessThanOrEqual(560);
  expect(shell!.width).toBeGreaterThanOrEqual(558);
  expect(Math.abs(shell!.x - (1440 - shell!.width) / 2)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'desktop-onboarding-1440');
});

test('빈 허브는 화면 제목 하나와 하위 빈 상태 제목으로 구성된다', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/onboarding');
  await page.getByRole('link', { name: '선수 생성 닫기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '커리어 허브' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'empty-hub-light-360');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme}: 360px·320px에서 온보딩과 선수 생성이 가로로 넘치지 않는다`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/settings');
    await page.getByText('화면·플레이 설정', { exact: true }).click();
    await page
      .getByRole('radio', { name: colorScheme === 'dark' ? '다크' : '라이트', exact: true })
      .click();
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto('/onboarding');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await startNewCareer(page);
      await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const summaryBox = await page.locator('.creation-extra summary').boundingBox();
      const actionBox = await page
        .getByRole('button', { name: /다음 · 후보 카드 열기/ })
        .boundingBox();
      expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(actionBox!.y);
      const gender = page.getByRole('radiogroup', { name: '주발' });
      const boxes = await gender.getByRole('radio').evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, width: rect.width, height: rect.height };
        }),
      );
      expect(boxes).toHaveLength(3);
      expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
      expect(
        Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width)),
      ).toBeLessThanOrEqual(1);
      expect(Math.min(...boxes.map((box) => box.height))).toBeGreaterThanOrEqual(44);
      await attachScreen(page, testInfo, `create-${colorScheme}-${width}`);
    }
  });

  test(`${colorScheme}: 글자 150%에서도 320px·360px의 선택과 확인 화면을 읽을 수 있다`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto('/settings');
    const settingsHeading = page.getByRole('heading', { level: 1 });
    await expect(settingsHeading).toBeVisible();
    const initialFontSize = await settingsHeading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    // UX-013: 텍스트 크기 라디오는 "화면·플레이 설정" 접이식 안에 있다.
    await page.getByText('화면·플레이 설정', { exact: true }).click();
    await page
      .getByRole('radio', { name: colorScheme === 'dark' ? '다크' : '라이트', exact: true })
      .click();
    await page.getByRole('radio', { name: '150%', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-text-scale', '150');
    await expect
      .poll(() =>
        settingsHeading.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      )
      .toBeCloseTo(initialFontSize * 1.5, 1);
    await startNewCareer(page);
    await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await fillPlayerInfo(page, '긴이름선수박준서');
    await expectNoHorizontalOverflow(page);
    await attachScreen(page, testInfo, `create-${colorScheme}-320-text150`);
    await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
    await expect(page.getByRole('heading', { name: '세 가지 가능성' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '3장 모두 열기' }).click();
    await expect(page.getByRole('meter')).toHaveCount(6);
    await expectNoHorizontalOverflow(page);
    await attachScreen(page, testInfo, `style-${colorScheme}-320-text150`);
    await page.getByRole('button', { name: '인사이드 포워드 후보 선택' }).click();
    await page.getByRole('button', { name: /이 후보로 진행/ }).click();
    await expect(page.getByRole('heading', { name: '이번 생의 주인공' })).toBeVisible();
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 780 });
      await expectNoHorizontalOverflow(page);
    }
    await attachScreen(page, testInfo, `confirm-${colorScheme}-360-text150`);
  });
}

test('세그먼트 키보드 선택은 크기를 바꾸지 않고 하단 동작은 모션 감소를 따른다', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await startNewCareer(page);
  await page.getByLabel('이름').fill('김서준');
  await page.keyboard.press('Tab');
  const first = page.getByRole('radio', { name: '오른발', exact: true });
  const second = page.getByRole('radio', { name: '왼발', exact: true });
  await expect(first).toBeFocused();
  const before = await first.boundingBox();
  await page.keyboard.press('Space');
  await expect(first).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(second).toBeFocused();
  await expect(second).toBeChecked();
  await expect(first).not.toBeChecked();
  const after = await first.boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(after?.width).toBe(before?.width);
  // game.css의 .os-segmented > .os-radio-item[data-state='checked']는 border-color를 transparent로
  // 되돌리고 대신 background(os-surface-raised)·box-shadow로 선택 상태를 표시한다(PR #120 UI 개편) —
  // border 색은 checked·unchecked 모두 투명해 더 이상 구분 신호가 아니다.
  const backgrounds = await Promise.all(
    [first, second].map((radio) =>
      radio.evaluate((element) => getComputedStyle(element).backgroundColor),
    ),
  );
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
  await page.getByRole('radio', { name: /윙어/ }).click();
  const next = page.getByRole('button', { name: /다음 · 후보 카드 열기/ });
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeInViewport();
  expect(
    await page
      .locator('.creation-action')
      .evaluate((element) => getComputedStyle(element).position),
  ).toBe('sticky');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  const box = await next.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  expect(await next.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await attachScreen(page, testInfo, 'create-keyboard-selected');
});

test('허브 삭제 대화상자는 프레임 위에 표시되고 Escape로 포커스가 복귀한다', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expect(page).toHaveURL(/\/style$/);
  await page.goto('/');
  // "최근 선수"(resume) 탭의 기본 카드는 featured=true라 상세 관리 disclosure를 두지 않는다 —
  // "선수단 관리"(squad 탭)로 이동해야 상세 관리·삭제 버튼에 닿는다.
  await page.getByRole('link', { name: '선수단 관리' }).click();
  await expect(page).toHaveURL(/\?tab=squad$/);
  await page.getByText('상세 관리').click();
  const trigger = page.getByRole('button', { name: '커리어 삭제' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '커리어 삭제' });
  await expect(dialog).toBeVisible();
  const layers = await page.evaluate(() => ({
    overlay: Number(getComputedStyle(document.querySelector('.os-dialog-overlay')!).zIndex),
    dialog: Number(getComputedStyle(document.querySelector('.os-dialog')!).zIndex),
  }));
  expect(layers.overlay).toBeGreaterThan(10);
  expect(layers.dialog).toBeGreaterThan(layers.overlay);
  for (let keypress = 0; keypress < 5; keypress += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  const centered = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return element.contains(
      document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
    );
  });
  expect(centered).toBe(true);
  await attachScreen(page, testInfo, 'hub-dark-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId('career-card')).toHaveCount(1);
});

test('계약 대시보드와 시즌 결과도 모바일 프레임을 유지한다', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    window.localStorage.setItem('offside:e2e-seed', 'e2e-season-result-01'),
  );
  await completeOnboardingThroughContract(page);
  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'dashboard-light-360');
  await page.setViewportSize({ width: 1440, height: 960 });
  const desktopShell = await page.locator('.os-shell').boundingBox();
  expect(desktopShell!.width).toBeLessThanOrEqual(560);
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '프로 시즌 결과' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'season-result-light-360');
});
