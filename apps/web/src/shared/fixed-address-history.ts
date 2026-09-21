// T-7-039: 원작(slbcareer.com)처럼 주소창을 고정한다. 라우트 구조·`navigate` 호출은 그대로 두고
// 히스토리 계층만 브라우저 히스토리 대신 메모리 히스토리로 바꾼다. main.tsx는 이 모듈이 만든
// history를 `createRouter({ routeTree, history })`에 넘기고 `wireFixedAddressHistory` ·
// `wireBackButtonGuard`를 부팅 시 한 번 호출하는 조립만 한다.
//
// - 초기 위치(딥링크/새로고침 복원/`navigate` 비복원)와 주소창 미러 규칙(허용 목록 vs `/`)은 순수
//   함수로 뽑아 `fixed-address-history.test.ts`에서 검증한다.
// - 뒤로가기 가드 자체(브라우저 히스토리에 가드 엔트리를 쌓고 재적재하는 부분)는
//   `packages/platform/src/web/index.ts`가 `lifecycle.onBackPressed` 포트로 소유한다. 여기서는
//   "라우터가 뒤로 갔거나 홈으로 보냈으면 true"만 판단하는 핸들러를 등록한다.
import { createMemoryHistory, type RouterHistory } from '@tanstack/react-router';
import { platform } from '../platform/index.js';

export const LAST_LOCATION_STORAGE_KEY = 'offside:last-location';

/** 브리프 3번: 주소창에 그대로 비추는 공개 화면 — SEO canonical·공유 링크 유지 대상. */
const PUBLIC_ALLOWLIST_PATHNAMES = ['/', '/guide', '/faq', '/legal/terms', '/legal/privacy'];

/** 허용 목록 비교용: 끝 슬래시가 있어도(예: `/guide/`) 같은 경로로 취급한다(표시용 원본은 안 건든다). */
function normalizePathnameForAllowlist(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export function isPublicAllowlistedPathname(pathname: string): boolean {
  return PUBLIC_ALLOWLIST_PATHNAMES.includes(normalizePathnameForAllowlist(pathname));
}

export interface FixedAddressLocation {
  pathname: string;
  search: string;
  hash: string;
}

function hrefOf(location: FixedAddressLocation): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

/**
 * 주소창 미러 규칙(브리프 4번). 허용 목록은 pathname+search+hash를 그대로(끝 슬래시 포함) 비추고,
 * 그 밖의 모든 라우트는 검색·해시까지 지우고 `/`로 고정한다.
 */
export function mirroredAddressHref(location: FixedAddressLocation): string {
  return isPublicAllowlistedPathname(location.pathname) ? hrefOf(location) : '/';
}

/** e2e·테스트가 실제 화면을 읽는 값(브리프 8번). 해시는 제외한다. */
export function routeDatasetValue(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`;
}

function isBareRootHref(href: string): boolean {
  const [withoutHash] = href.split('#');
  const [pathname, search] = (withoutHash ?? '').split('?');
  return pathname === '/' && (search === undefined || search === '');
}

export type BootNavigationType = 'navigate' | 'reload' | 'back_forward' | 'prerender';

/**
 * 초기 href 결정(브리프 2·3번, 순수 함수). 딥링크·Google 로그인 복귀 쿼리·`location.assign` 이동은
 * 실제 주소를 그대로 쓴다. 실제 주소가 검색·해시 없는 `/`이고(=우리가 마지막으로 감춘 화면이었을
 * 수 있다) navigation type이 `reload`·`back_forward`일 때만 저장된 href로 복원한다. 직접 주소
 * 입력·새 탭(`navigate`)이면 저장된 값이 있어도 복원하지 않는다.
 */
export function resolveInitialHref(options: {
  realHref: string;
  navigationType: BootNavigationType | undefined;
  storedHref: string | null;
}): string {
  const { realHref, navigationType, storedHref } = options;
  const canRestore = navigationType === 'reload' || navigationType === 'back_forward';
  if (canRestore && storedHref !== null && isBareRootHref(realHref)) {
    return storedHref;
  }
  return realHref;
}

function readNavigationType(): BootNavigationType | undefined {
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entry?.type as BootNavigationType | undefined;
  } catch {
    return undefined;
  }
}

function readStoredHref(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_LOCATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredHref(href: string): void {
  try {
    window.sessionStorage.setItem(LAST_LOCATION_STORAGE_KEY, href);
  } catch {
    // 사생활 보호 모드 등으로 sessionStorage를 못 써도 앱은 계속 뜬다.
  }
}

/** main.tsx가 부팅 시 실제 주소에서 초기 href를 계산한다(딥링크 그대로 + 새로고침·뒤로가기 복원). */
export function computeInitialHref(realLocation: FixedAddressLocation): string {
  return resolveInitialHref({
    realHref: hrefOf(realLocation),
    navigationType: readNavigationType(),
    storedHref: readStoredHref(),
  });
}

/** main.tsx 조립 지점: 실제 주소를 시드로 메모리 히스토리를 만든다(브리프 1·2번). */
export function createFixedAddressHistory(
  realLocation: FixedAddressLocation = window.location,
): RouterHistory {
  return createMemoryHistory({ initialEntries: [computeInitialHref(realLocation)] });
}

/**
 * 라우터 위치가 확정될 때마다(부팅 직후 1회 포함): sessionStorage에 실제 위치 저장, 주소창 미러
 * 적용, 테스트용 `dataset.route` 갱신. 세 가지 모두 실제 라우터 위치(허용 목록이 아니어도 실제
 * pathname)를 기준으로 하고, 주소창만 허용 목록 밖이면 `/`로 감춘다.
 */
export function applyFixedAddressLocation(location: FixedAddressLocation): void {
  writeStoredHref(hrefOf(location));
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.route = routeDatasetValue(location);
  }
  if (typeof window !== 'undefined') {
    // 기존 state(뒤로가기 가드 마커 포함)는 그대로 두고 주소만 바꾼다 — pushState가 아니라
    // replaceState라 가드용 엔트리는 늘지 않는다(브리프 4번: "pushState로 주소를 바꾸지 않는다").
    window.history.replaceState(window.history.state, '', mirroredAddressHref(location));
  }
}

/** history가 바뀔 때마다 위 세 가지를 적용한다. 부팅 직후 1회도 여기서 호출한다. */
export function wireFixedAddressHistory(history: RouterHistory): () => void {
  applyFixedAddressLocation(history.location);
  return history.subscribe(({ location }) => applyFixedAddressLocation(location));
}

/**
 * 뒤로가기 가드(브리프 5번)의 "라우터가 뒤로 갔으면 true" 판단만 순수하게 뽑은 핸들러.
 * (a) 메모리 히스토리가 안에서 더 갈 수 있으면 그리로 back().
 * (b) 못 가지만 지금이 `/`가 아니면 `/`로 replace(=앱 안에서 "홈으로").
 * (c) 이미 `/`면 false — 가드 엔트리 재적재·실제 이탈 허용은 platform/web이 맡는다.
 */
export function createBackButtonGuardHandler(history: RouterHistory): () => boolean {
  return () => {
    if (history.canGoBack()) {
      history.back();
      return true;
    }
    if (history.location.pathname !== '/') {
      history.replace('/');
      return true;
    }
    return false;
  };
}

/** `platform.lifecycle.onBackPressed` 포트에 위 핸들러를 등록한다(채널 분기 없음 — web만 실제로 쓴다). */
export function wireBackButtonGuard(history: RouterHistory): () => void {
  return platform.lifecycle.onBackPressed(createBackButtonGuardHandler(history));
}
