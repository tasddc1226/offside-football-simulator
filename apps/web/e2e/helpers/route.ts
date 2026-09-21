// T-7-039: 주소창이 고정(`/` 또는 공개 허용 목록만 그대로)되면서 실제 브라우저 주소(`page.url()`)는
// 더 이상 화면 상태를 반영하지 않는다. e2e는 대신 라우터 위치가 확정될 때마다 앱이 기록하는
// `document.documentElement.dataset.route`(pathname+search, 해시 제외)를 본다.
//
// 기존 `toHaveURL`/`waitForURL`/`page.url()` 호출부의 정규식은 pathname+search 기준으로 그대로
// 재사용되도록 이 헬퍼를 설계했다 — `/\/career\/.+\/style$/` 같은 패턴은 고치지 않고 그대로 넘기면
// 된다. `new URL(page.url()).pathname` 류만 `currentRoute` 기반으로 바꾼다.
import { expect, type Page } from '@playwright/test';

/** 라우터가 확정한 실제 화면(pathname+search, 해시 제외)을 읽는다.
 *
 * `location.assign(...)` 같은 진짜 하드 리로드가 끝나는 순간(예: 프로필·기기 데이터 삭제 뒤
 * `/onboarding`으로 이동) 이전 문서의 실행 컨텍스트가 폴링 중간에 파괴될 수 있다 — 이때
 * `page.evaluate`가 던지는 건 실패가 아니라 "다음 문서가 아직 안 떴다"는 신호이므로 삼키고 빈
 * 문자열을 돌려줘 `expect.poll`이 다음 틱에서 새 문서를 다시 읽게 한다(`expect.poll`은 콜백이
 * 그대로 throw하면 재시도하지 않고 즉시 실패한다). */
export async function currentRoute(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => document.documentElement.dataset.route ?? '');
  } catch {
    return '';
  }
}

export type RouteMatcher = string | RegExp;
export type RoutePredicate = (route: string) => boolean;

function toPredicate(matcher: RouteMatcher | RoutePredicate): RoutePredicate {
  if (typeof matcher === 'function') return matcher;
  if (matcher instanceof RegExp) return (route) => matcher.test(route);
  return (route) => route === matcher;
}

/**
 * `await expect(page).toHaveURL(matcher)`를 대신한다. 문자열은 정확히 일치, 정규식은 `test()`로
 * 검사한다(기존 `toHaveURL` 정규식을 그대로 재사용할 수 있다). `negate: true`는 기존
 * `.not.toHaveURL(...)` 자리를 대신한다.
 */
export async function expectRoute(
  page: Page,
  matcher: RouteMatcher,
  options?: { timeout?: number; negate?: boolean },
): Promise<void> {
  const { negate = false, timeout } = options ?? {};
  const assertion = expect.poll(() => currentRoute(page), timeout === undefined ? {} : { timeout });
  if (matcher instanceof RegExp) {
    await (negate ? assertion.not.toMatch(matcher) : assertion.toMatch(matcher));
  } else {
    await (negate ? assertion.not.toBe(matcher) : assertion.toBe(matcher));
  }
}

// page.waitForURL 기본 타임아웃(액션 타임아웃, 기본 30s)에 맞춘다 — expect.poll 자체 기본값(5s)보다
// 길게 잡아야 기존 긴 도메인 전이(예: {timeout: 60_000}을 안 주던 waitForURL 호출부)가 그대로 통과한다.
const DEFAULT_WAIT_ROUTE_TIMEOUT_MS = 30_000;

/**
 * `await page.waitForURL(matcher)`를 대신한다. 문자열·정규식뿐 아니라 기존
 * `page.waitForURL((url) => url.pathname !== before)` 같은 predicate 형태도 `(route: string) =>
 * boolean`으로 그대로 옮길 수 있다.
 */
export async function waitForRoute(
  page: Page,
  matcher: RouteMatcher | RoutePredicate,
  options?: { timeout?: number },
): Promise<void> {
  const predicate = toPredicate(matcher);
  await expect
    .poll(async () => predicate(await currentRoute(page)), {
      timeout: DEFAULT_WAIT_ROUTE_TIMEOUT_MS,
      ...options,
    })
    .toBe(true);
}
