// Native-like presentation checks use fresh browser contexts and a stub API. The animation
// recorder observes real Web Animations rather than replacing them or racing their short duration.
import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  completeOnboardingThroughContract,
  fulfillJson,
  META,
  startNewCareer,
} from './helpers/player-creation.js';

type RecordedAnimation = { animation: Animation; target: Element };
type MotionWindow = Window & { offsideMotionRecords: RecordedAnimation[] };

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/v1/**', (route) =>
    fulfillJson(route, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '모션 테스트의 격리된 API입니다.',
        retryable: true,
      },
      meta: META,
    }),
  );
  await page.addInitScript(() => {
    const records: RecordedAnimation[] = [];
    (window as unknown as MotionWindow).offsideMotionRecords = records;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      records.push({ animation, target: this });
      return animation;
    };
  });
});

async function routeAnimations(page: Page) {
  return page.evaluate(() =>
    (window as unknown as MotionWindow).offsideMotionRecords
      .filter(
        ({ animation, target }) =>
          animation.id === 'offside-screen-transition' &&
          target.classList.contains('os-route-motion'),
      )
      .map(({ animation }) => ({
        duration: animation.effect?.getTiming().duration,
        frames: (animation.effect as KeyframeEffect).getKeyframes(),
      })),
  );
}

async function latestCareerRevision(page: Page): Promise<number> {
  const careerId = /\/career\/([^/?]+)/.exec(page.url())?.[1];
  if (!careerId) throw new Error('현재 URL에서 careerId를 찾지 못했다');
  return page.evaluate(
    (id) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('offside');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const index = request.result.transaction('snapshots', 'readonly').objectStore('snapshots').index('careerId');
          const revisions: number[] = [];
          const cursor = index.openCursor(IDBKeyRange.only(id));
          cursor.onerror = () => reject(cursor.error);
          cursor.onsuccess = () => {
            if (cursor.result) {
              revisions.push((cursor.result.value as { revision: number }).revision);
              cursor.result.continue();
            } else resolve(Math.max(...revisions));
          };
        };
      }),
    careerId,
  );
}

async function clearAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as MotionWindow).offsideMotionRecords.length = 0;
  });
}

async function openEmptyHub(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '커리어 허브' })).toBeVisible();
}

/** Real Chromium touches exercise pointer capture and native pan-y scrolling. A sequence of
 * synthetic PointerEvents cannot capture a pointer, so it would only test the cancel path. */
async function swipe(
  target: Locator,
  deltaX: number,
  deltaY = 0,
  startAtLeftEdge = false,
): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const page = target.page();
  const point = await target.evaluate((element, fromEdge) => {
    const rect = element.getBoundingClientRect();
    return {
      x: fromEdge ? rect.left + 22 : rect.left + rect.width / 2,
      y: Math.max(1, Math.min(rect.top + Math.min(44, rect.height / 2), window.innerHeight - 80)),
    };
  }, startAtLeftEdge);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...point, id: 81 }],
    });
    for (let frame = 1; frame <= 6; frame += 1) {
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: point.x + (deltaX * frame) / 6, y: point.y + (deltaY * frame) / 6, id: 81 },
        ],
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

test('페이지 이동은 방향 있는 짧은 모션을 쓰고 공통 레이어를 재마운트하지 않는다', async ({
  page,
}) => {
  await openEmptyHub(page);
  const layer = page.locator('.os-route-motion');
  await layer.evaluate((element) => element.setAttribute('data-persistent-check', 'same-layer'));
  await clearAnimations(page);
  await page.getByRole('link', { name: '게임 설정', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(layer).toHaveAttribute('data-direction', 'forward');
  await expect.poll(async () => (await routeAnimations(page)).length).toBe(1);
  const forward = (await routeAnimations(page))[0]!;
  expect(Number(forward.duration)).toBeGreaterThan(0);
  expect(Number(forward.duration)).toBeLessThanOrEqual(300);
  expect(forward.frames[0]?.transform).not.toEqual(forward.frames.at(-1)?.transform);
  expect(forward.frames.every((frame) => Number(frame.opacity) === 1)).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: '커리어 허브' })).toBeVisible();
  await expect(layer).toHaveAttribute('data-direction', 'back');
  await expect.poll(async () => (await routeAnimations(page)).length).toBe(2);
  const back = (await routeAnimations(page))[1]!;
  expect(back.frames[0]?.transform).not.toEqual(forward.frames[0]?.transform);
  await expect(layer).toHaveAttribute('data-persistent-check', 'same-layer');
});

test('키보드로 실행한 화면 이동에는 슬라이드 효과를 넣지 않는다', async ({ page }) => {
  await openEmptyHub(page);
  await clearAnimations(page);
  await page.getByRole('link', { name: '게임 설정', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await routeAnimations(page)).toEqual([]);
});

// UX-012: 전역 화면 전환(ScreenTransition)은 프로그레스 바 연출로 3초를 채운 뒤에만 다음 화면으로
// 넘어간다. 모션이 켜진(이 파일 beforeEach의 no-preference) 상태에서 허브 "커리어 시작"을 눌러
// 실제 3초 연출 자체를 검증한다 — 키보드 입력 모달리티도 더 이상 스킵 조건이 아니다(D-70).
test('허브 "커리어 시작"은 3초 고정 진행 바 연출을 보여준 뒤에만 SCR-002로 이동한다', async ({
  page,
}) => {
  await openEmptyHub(page);
  const startButton = page.getByRole('button', { name: '커리어 시작' });
  await expect(startButton).toBeVisible();

  const clickedAt = Date.now();
  await startButton.click();

  const progressbar = page.getByRole('progressbar');
  await expect(progressbar).toBeVisible();
  await expect(progressbar).toHaveAttribute('aria-valuemin', '0');
  await expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  await expect(page.getByText('새 인생을 준비합니다')).toBeVisible();

  // 3초가 다 차기 전에는 아직 허브에 머문다(스킵 불가 — 바로 계속 버튼도, 키보드 스킵도 없다).
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/$/);

  // 그러나 3초 안팎에는 반드시 다음 화면(SCR-002 자리표시)으로 넘어간다.
  await expect(page).toHaveURL(/\/career\/.+\/create$/, { timeout: 4000 });
  expect(Date.now() - clickedAt).toBeGreaterThanOrEqual(2700);
});

for (const preference of ['OS', '앱'] as const) {
  test(`${preference} 모션 감소 설정에서 화면 전환 슬라이드를 생략한다`, async ({ page }) => {
    if (preference === 'OS') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    await page.goto('/settings');
    if (preference === '앱') {
      await page
        .getByRole('radiogroup', { name: '모션 감소' })
        .getByRole('radio', { name: '켜기', exact: true })
        .click();
    }
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await clearAnimations(page);
    await page.getByRole('link', { name: '온보딩 다시 보기', exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole('heading', { level: 1, name: '한 명의 선수로, 축구 인생 전체를 플레이하세요' }),
    ).toBeVisible();
    expect(await routeAnimations(page)).toEqual([]);
  });
}

test('공통 팝업은 배경을 블러 처리하고 Escape 뒤 원래 버튼으로 포커스를 돌린다', async ({
  page,
}) => {
  await startNewCareer(page);
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
  const blur = await page.locator('.os-dialog-overlay').evaluate((element) => {
    const style = getComputedStyle(element);
    return style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
  });
  expect(blur).toMatch(/blur\([\d.]+px\)/);
  expect(Number(blur.match(/blur\(([\d.]+)px\)/)?.[1])).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId('career-card')).toHaveCount(1);
});

test('온보딩은 좌우로 넘기되 마지막 장을 밀어도 커리어를 생성하지 않는다', async ({ page }) => {
  await page.goto('/onboarding');
  const surface = page.locator('.os-onboarding-motion .os-swipe-surface');
  await expect(surface).toBeVisible();
  await swipe(surface, -150);
  await expect(
    page.getByRole('heading', { level: 1, name: '선택은 되돌릴 수 없습니다' }),
  ).toBeVisible();
  await swipe(surface, 150);
  await expect(
    page.getByRole('heading', { level: 1, name: '한 명의 선수로, 축구 인생 전체를 플레이하세요' }),
  ).toBeVisible();
  await swipe(surface, -150);
  await expect(
    page.getByRole('heading', { level: 1, name: '선택은 되돌릴 수 없습니다' }),
  ).toBeVisible();
  await swipe(surface, -150);
  await expect(
    page.getByRole('heading', { level: 1, name: '커리어를 다시 찾을 방법을 준비하세요' }),
  ).toBeVisible();
  await swipe(surface, -150);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('button', { name: /KICKOFF · 새 인생 시작/ })).toBeVisible();
  await page.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '아직 만든 커리어가 없습니다' })).toBeVisible();
  await expect(page.getByTestId('career-card')).toHaveCount(0);
});

test('세로 드래그와 버튼 위 드래그는 온보딩 단계를 바꾸지 않는다', async ({ page }) => {
  await page.goto('/onboarding');
  const heading = page.getByRole('heading', {
    level: 1,
    name: '한 명의 선수로, 축구 인생 전체를 플레이하세요',
  });
  const surface = page.locator('.os-onboarding-motion .os-swipe-surface');
  await expect(surface).toBeVisible();
  await swipe(surface, -12, 150);
  await expect(heading).toBeVisible();
  await swipe(page.getByRole('button', { name: '다음', exact: true }), -150);
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: '선택은 되돌릴 수 없습니다' }),
  ).toBeVisible();
});

test('문서의 가장자리 뒤로 가기는 외부 방문 기록 대신 설정으로 돌아간다', async ({ page }) => {
  await page.goto('/legal/privacy');
  await expect(page.getByRole('heading', { level: 1, name: '개인정보 처리방침' })).toBeVisible();
  await swipe(page.locator('.os-route-motion > .os-swipe-surface'), 170, 0, true);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('.os-route-motion')).toHaveAttribute('data-direction', 'back');
});

test('대시보드 스와이프는 구역만 바꾸고 경기 진행을 실행하지 않는다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    window.localStorage.setItem('offside:e2e-seed', 'e2e-season-result-01'),
  );
  await completeOnboardingThroughContract(page);
  const pathname = new URL(page.url()).pathname;
  const revision = await latestCareerRevision(page);
  const surface = page.locator('.os-dashboard-tabs-motion .os-swipe-surface');
  await expect(surface).toBeVisible();
  await expect(page.getByRole('tab', { name: '홈', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await swipe(surface, -150);
  await expect.poll(() => page.locator('[role="tab"][aria-selected="true"]').textContent()).toBe('일정');
  await swipe(surface, -150);
  await expect(page.getByRole('tab', { name: '선수', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('player');
  await expect.poll(() => latestCareerRevision(page)).toBe(revision);
});
