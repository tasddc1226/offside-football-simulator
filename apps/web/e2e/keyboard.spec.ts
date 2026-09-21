// 08 "출시 차단 기준"(키보드로 P0 흐름 완료 불가) 검사: first-contract.spec.ts와 같은 여정(온보딩→
// SCR-002~004→이벤트 반복→SCR-009→SCR-010→SCR-029)을 page.keyboard(Tab·Shift+Tab·Enter·Space·
// 화살표)만으로 완주한다. click() 금지, 각 이동은 toBeFocused로 확인한다.
//
// SCR-002의 포지션 구분 탭(TabsList: 골키퍼/수비수/미드필더/공격수)은 이제 포지션 RadioGroup의
// 형제로 렌더된다(T-1-017, career.$careerId.create.tsx) — 예전엔 `<RadioGroup>` 안에 `<Tabs>`가
// 중첩돼 Radix의 두 roving-tabindex 관리자가 충돌해 트리거 4개 전부가 Tab으로 도달 불가능했다.
// 이 스펙은 실제 탭 전환 경로(공격수 탭 → 윙어)로 완주해 그 수정을 검증한다.
//
// 대화상자 포커스 트랩·복귀: 이 여정 자체(온보딩→계약)에는 실제 대화상자가 없다(복구 코드는 같은
// 라우트에 ?step=recovery로 인라인 표시된다 — career.$careerId.confirm.tsx). 그래서 허브의 삭제
// 확인 대화상자(hub.spec.ts와 같은 컴포넌트, packages/ui Dialog)로 확인한다. Escape는 브리프가 허용한
// 키 목록(Tab·Shift+Tab·Enter·Space·화살표)에 없어 쓰지 않고, 대화상자의 "닫기" 버튼을 Tab+Enter로
// 눌러서 닫는다.
import { expect, type Locator, type Page, test } from '@playwright/test';
import { expectFirstContractHeading, fulfillJson, META } from './helpers/player-creation.js';
import { currentRoute, expectRoute, waitForRoute } from './helpers/route.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

/** Tab(또는 Shift+Tab)을 반복 눌러 `target`이 포커스를 받을 때까지 이동한다. click() 없이 버튼·링크·
 * 입력 필드로 이동하는 유일한 수단 — 정확한 탭스톱 개수를 하드코딩하지 않아 화면이 조금 바뀌어도
 * 버티지만, 실제로 도달 불가능하면(버그) maxPresses 안에 못 찾고 마지막 toBeFocused에서 실패한다. */
async function tabTo(
  page: Page,
  target: Locator,
  options?: { shift?: boolean; maxPresses?: number },
): Promise<void> {
  const key = options?.shift === true ? 'Shift+Tab' : 'Tab';
  const maxPresses = options?.maxPresses ?? 25;
  for (let i = 0; i < maxPresses; i += 1) {
    const isFocused = await target
      .evaluate((el) => el === document.activeElement)
      .catch(() => false);
    if (isFocused) {
      await expect(target).toBeFocused();
      return;
    }
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

test('키보드만으로 온보딩→계약→대시보드까지 완주한다(마우스·click 금지)', async ({ page }) => {
  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '서비스를 이용할 수 없습니다.',
        retryable: true,
      },
      meta: META,
    }),
  );

  await page.goto('/onboarding');

  // T-7-039 후속(스킵 링크 접근성 회귀 수정): 스킵 링크는 라우터 이동이 아니라 순수 앵커 +
  // preventDefault·focus()다 — 활성화하면 포커스가 #game-content로 옮겨가고, 실제 주소창(hash
  // 포함)은 그대로다.
  const beforeSkipLinkUrl = page.url();
  await tabTo(page, page.getByRole('link', { name: '본문으로 건너뛰기' }));
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-content')).toBeFocused();
  expect(page.url()).toBe(beforeSkipLinkUrl);

  await tabTo(page, page.getByLabel('이름'));
  await page.keyboard.type('김서준');
  await tabTo(page, page.getByRole('radio', { name: '오른발' }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '왼발' })).toBeChecked();
  await tabTo(page, page.getByRole('radio', { name: /스트라이커/ }));
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: /윙어/ })).toBeChecked();
  await tabTo(page, page.getByRole('button', { name: /다음 · 후보 카드 열기/ }));
  await page.keyboard.press('Enter');
  await expectRoute(page, /\/career\/.+\/style$/);
  await tabTo(page, page.getByRole('button', { name: '후보 1 공개' }));
  await page.keyboard.press('Space');
  await expect(page.getByRole('meter')).toHaveCount(6);
  await tabTo(page, page.getByRole('button', { name: /이 후보로 진행/ }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '이번 생의 주인공' })).toBeVisible();

  // SCR-004: KICKOFF → 비차단 복구 안내 전환 → 첫 이벤트.
  await tabTo(page, page.getByRole('button', { name: /이 선수로 시작/ }));
  await page.keyboard.press('Enter');
  await expectRoute(page, /\/career\/.+\/(path|tryout|event)$/);

  // SCR-007/008/013(반복) → SCR-014 → ... → SCR-009. 안전 상한 10회(first-contract.spec.ts와 동일).
  let reachedOffers = false;
  for (let step = 0; step < 10 && !reachedOffers; step += 1) {
    await waitForRoute(page, /\/career\/.+\/(path|tryout|event|offers)$/);
    if ((await currentRoute(page)).split('?')[0]!.endsWith('/offers')) {
      reachedOffers = true;
      break;
    }
    await tabTo(page, page.getByRole('radio').first());
    await page.keyboard.press('Space');
    await tabTo(page, page.getByRole('button', { name: '확정' }));
    await page.keyboard.press('Enter');
    await expectRoute(page, /\/event\/result\?rev=\d+$/);
    await tabTo(page, page.getByRole('button', { name: '다음' }));
    await page.keyboard.press('Enter');
  }
  if (!reachedOffers) throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');

  await expectFirstContractHeading(page);

  // SCR-009: 제안 링크 → Enter(링크는 클릭 없이 Enter로 활성화된다).
  const offerLink = page.getByRole('link', { name: '제안 상세·결정' }).first();
  await tabTo(page, offerLink);
  await page.keyboard.press('Enter');
  await expectRoute(page, /\/career\/.+\/contract\?offerId=.+$/);

  // SCR-010: 키보드 대체 서명 → 계약 확정 → 첫 계약 완료 카드.
  await tabTo(page, page.getByRole('button', { name: '이름 입력' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('textbox', { name: '서명할 이름' }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('김서준');
  await tabTo(page, page.getByRole('button', { name: '서명 적용', exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: '서명하고 계약 확정' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '프로의 첫 유니폼' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: '커리어 시작' }));
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
  ).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: '계속' }));
  await page.keyboard.press('Enter');
  await expectRoute(page, /\/career\/[^/]+$/);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();

  // UX-014(2026-09-14): 대시보드 탭은 이제 상단 커리어 헤더(레이아웃 라우트)의 독립 tablist다 —
  // Radix Tabs가 아니라 role="tab" 버튼 + 직접 구현한 화살표 키 이동(CareerTabs.tsx)이지만, 폼 안
  // 포지션 탭과 달리 RadioGroup에 중첩되지 않아 Tab으로 정상 도달하는 점은 그대로다(직접 확인).
  // 화살표 키와 Enter로 "시즌"에서 "커리어"를 거쳐 "선수"까지 이동한다(시즌·커리어·선수·우승 연혁 순).
  const seasonTab = page.getByRole('tab', { name: '시즌' });
  await tabTo(page, seasonTab);
  await expect(seasonTab).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  const careerTab = page.getByRole('tab', { name: '커리어' });
  await page.keyboard.press('Enter');
  await expect(careerTab).toBeFocused();
  await expect(careerTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('팀')).toBeVisible();
  await expect(page.getByText('주급')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  const playerTab = page.getByRole('tab', { name: '선수' });
  await page.keyboard.press('Enter');
  await expect(playerTab).toBeFocused();
  await expect(playerTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: '선수 성장' })).toBeVisible();

  // 대화상자 포커스 트랩·복귀: 허브의 삭제 확인 대화상자(hub.spec.ts와 같은 컴포넌트)로 확인한다.
  await tabTo(page, page.getByRole('link', { name: '허브로' }));
  await page.keyboard.press('Enter');
  await expectRoute(page, /\/$/);

  // "최근 선수"(resume) 탭의 기본 카드는 featured=true라 상세 관리 disclosure를 두지 않는다 —
  // "선수단 관리"(squad 탭)로 이동해야 상세 관리·삭제 버튼에 닿는다.
  await tabTo(page, page.getByRole('link', { name: '선수단 관리' }));
  await page.keyboard.press('Enter');
  await expectRoute(page, /\?tab=squad$/);

  const detailSummary = page.locator('summary').filter({ hasText: '상세 관리' });
  await tabTo(page, detailSummary);
  await page.keyboard.press('Enter');

  const deleteButton = page.getByRole('button', { name: '커리어 삭제' });
  await tabTo(page, deleteButton);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const focusInsideDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
  expect(focusInsideDialog).toBe(true);

  await tabTo(page, page.getByRole('button', { name: '닫기' }));
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();
});
