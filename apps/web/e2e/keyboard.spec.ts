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
import { fulfillJson, META } from './helpers/player-creation.js';

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

  // SCR-034 온보딩: "다음" 두 번 → "KICKOFF · 새 인생 시작".
  await page.goto('/onboarding');
  await tabTo(page, page.getByRole('button', { name: '다음' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: '다음' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: /KICKOFF · 새 인생 시작/ }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/create$/);

  // SCR-002: 배경 → 이름 → 성별 → 국적 → 주발 → 포지션 구분 탭 → 포지션 → 다음. 필드 사이 Tab
  // 한 번씩만으로 정확히 이어지는 순서를 직접 확인했다(중간에 다른 포커스 가능한 요소가 없다) —
  // 배경·성별·주발 라디오 그룹 진입은 Radix roving-tabindex의 기본(첫) 항목에 떨어지므로 어떤
  // 값인지는 보지 않고 Space로 확정만 한다(다른 스펙의 "선택지 자체는 안 본다"와 같은 원칙 — 이후
  // 화면에서 특정 값에 의존하지 않는다). 포지션만은 실제 탭 전환 경로(공격수 → 윙어)로 검증한다.
  const backgroundRadio = page.getByRole('radio').first();
  await tabTo(page, backgroundRadio);
  await page.keyboard.press('Space');
  await expect(backgroundRadio).toHaveAttribute('aria-checked', 'true');
  await tabTo(page, page.getByRole('button', { name: '다음', exact: true }));
  await page.keyboard.press('Enter');

  const nameInput = page.getByLabel('이름');
  await tabTo(page, nameInput);
  await page.keyboard.type('김서준');
  await expect(nameInput).toHaveValue('김서준');

  await page.keyboard.press('Tab');
  const genderRadio = page.locator(':focus');
  await expect(genderRadio).toHaveAttribute('role', 'radio');
  await page.keyboard.press('Space');
  await expect(genderRadio).toHaveAttribute('aria-checked', 'true');

  await page.keyboard.press('Tab');
  const nationalitySelect = page.getByLabel('국적');
  await expect(nationalitySelect).toBeFocused();
  // 네이티브 <select> 자체는 실제 브라우저에서 포커스 상태로 화살표 키를 누르면 값이 바뀌는,
  // 완전히 키보드로 조작 가능한 표준 컨트롤이다 — 다만 헤드리스 Chromium은 CDP로 보낸 합성
  // ArrowDown/Enter 키 이벤트로 OS 네이티브 select 팝업을 조작하지 못한다(Playwright·CDP의 알려진
  // 자동화 한계이며, 이 앱의 키보드 접근성 문제가 아니다). 그래서 이 한 필드만 selectOption으로
  // 값을 정한다(click() 아님) — 포커스는 계속 이 select에 남아 다음 Tab이 정상 진행된다.
  await nationalitySelect.selectOption('KR');
  await expect(nationalitySelect).toHaveValue('KR');
  await expect(nationalitySelect).toBeFocused();

  await page.keyboard.press('Tab');
  const footRadio = page.locator(':focus');
  await expect(footRadio).toHaveAttribute('role', 'radio');
  await page.keyboard.press('Space');
  await expect(footRadio).toHaveAttribute('aria-checked', 'true');

  const identityNextButton = page.getByRole('button', { name: '다음', exact: true });
  await tabTo(page, identityNextButton);
  await page.keyboard.press('Enter');

  // 포지션 구분 탭: Tab으로 도달(기본 선택된 골키퍼 트리거) → 화살표 세 번으로 공격수까지 이동
  // (Radix Tabs 기본 activationMode="automatic"이라 포커스 이동이 곧 선택이다) → Tab으로 포지션
  // RadioGroup 진입 → 그 그룹의 첫 항목(윙어)에 Space로 확정.
  const gkTab = page.getByRole('tab', { name: '골키퍼' });
  await tabTo(page, gkTab);
  await expect(gkTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const forwardTab = page.getByRole('tab', { name: '공격수' });
  await expect(forwardTab).toBeFocused();
  await expect(forwardTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Tab');
  const positionRadio = page.locator(':focus');
  await expect(positionRadio).toHaveAttribute('role', 'radio');
  await expect(positionRadio).toContainText('윙어');
  await page.keyboard.press('Space');
  await expect(positionRadio).toHaveAttribute('aria-checked', 'true');

  const styleButton = page.getByRole('button', { name: '플레이 스타일 고르기' });
  await tabTo(page, styleButton);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  // SCR-003: 아키타입 카드(어떤 것인지는 안 봄) 하나 선택 → 다음.
  await tabTo(page, page.getByRole('radio').first());
  await page.keyboard.press('Space');
  await tabTo(page, page.getByRole('button', { name: '다음' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' }),
  ).toBeVisible();

  // SCR-004: KICKOFF → 복구 코드 발급 실패(인라인 안내, 대화상자 아님) → 계속.
  await tabTo(page, page.getByRole('button', { name: 'KICKOFF' }));
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
  ).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: '계속' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);

  // SCR-007/008/013(반복) → SCR-014 → ... → SCR-009. 안전 상한 10회(first-contract.spec.ts와 동일).
  let reachedOffers = false;
  for (let step = 0; step < 10 && !reachedOffers; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    if (new URL(page.url()).pathname.endsWith('/offers')) {
      reachedOffers = true;
      break;
    }
    await tabTo(page, page.getByRole('radio').first());
    await page.keyboard.press('Space');
    await tabTo(page, page.getByRole('button', { name: '확정' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
    await tabTo(page, page.getByRole('button', { name: '다음' }));
    await page.keyboard.press('Enter');
  }
  if (!reachedOffers) throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');

  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();

  // SCR-009: 제안 링크 → Enter(링크는 클릭 없이 Enter로 활성화된다).
  const offerLink = page.getByRole('link', { name: '제안 상세·결정' }).first();
  await tabTo(page, offerLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);

  // SCR-010: 키보드 대체 서명 → 계약 확정 → 첫 계약 완료 카드.
  await tabTo(page, page.getByRole('button', { name: '이름 입력' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('textbox', { name: '서명할 이름' }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('김서준');
  await tabTo(page, page.getByRole('button', { name: '서명하고 계약 확정' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '프로의 첫 유니폼' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: '커리어 시작' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();

  // SCR-029 대시보드 탭: 폼 안 포지션 탭과 달리 RadioGroup에 중첩되지 않아 Tab으로 정상 도달한다
  // (직접 확인). 화살표 키와 Enter로 "홈"에서 "선수"를 거쳐 "계약"까지 이동한다.
  const homeTab = page.getByRole('tab', { name: '홈' });
  await tabTo(page, homeTab);
  await expect(homeTab).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const playerTab = page.getByRole('tab', { name: '선수' });
  await page.keyboard.press('Enter');
  await expect(playerTab).toBeFocused();
  await expect(playerTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('전술 적합도', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  const contractTab = page.getByRole('tab', { name: '계약' });
  await page.keyboard.press('Enter');
  await expect(contractTab).toBeFocused();
  await expect(contractTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('팀')).toBeVisible();
  await expect(page.getByText('주급')).toBeVisible();

  // 대화상자 포커스 트랩·복귀: 허브의 삭제 확인 대화상자(hub.spec.ts와 같은 컴포넌트)로 확인한다.
  await tabTo(page, page.getByRole('link', { name: '허브로' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);

  // "최근 선수"(resume) 탭의 기본 카드는 featured=true라 상세 관리 disclosure를 두지 않는다 —
  // "선수단 관리"(squad 탭)로 이동해야 상세 관리·삭제 버튼에 닿는다.
  await tabTo(page, page.getByRole('link', { name: '선수단 관리' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\?tab=squad$/);

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
