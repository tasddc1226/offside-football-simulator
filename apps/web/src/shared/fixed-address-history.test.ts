// T-7-039: 순수 함수(초기 href 결정, 주소창 미러 규칙)와 sessionStorage 예외 내성을 검증한다.
// 뒤로가기 가드 자체(엔트리 적재)는 packages/platform/src/platform.test.ts에 있다.
import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeInitialHref,
  createBackButtonGuardHandler,
  isPublicAllowlistedPathname,
  mirroredAddressHref,
  resolveInitialHref,
  routeDatasetValue,
} from './fixed-address-history.js';

describe('resolveInitialHref', () => {
  it('딥링크(navigate)는 실제 주소를 그대로 쓴다', () => {
    expect(
      resolveInitialHref({
        realHref: '/career/abc123/style',
        navigationType: 'navigate',
        storedHref: '/settings',
      }),
    ).toBe('/career/abc123/style');
  });

  it('실제 주소가 /가 아니면 navigation type과 무관하게 복원하지 않는다', () => {
    expect(
      resolveInitialHref({
        realHref: '/settings?legal=terms',
        navigationType: 'reload',
        storedHref: '/career/abc/style',
      }),
    ).toBe('/settings?legal=terms');
  });

  it('실제 주소가 검색·해시 없는 /이고 reload면 저장된 href로 복원한다', () => {
    expect(
      resolveInitialHref({
        realHref: '/',
        navigationType: 'reload',
        storedHref: '/career/abc/style',
      }),
    ).toBe('/career/abc/style');
  });

  it('실제 주소가 /이고 back_forward여도 복원한다', () => {
    expect(
      resolveInitialHref({
        realHref: '/',
        navigationType: 'back_forward',
        storedHref: '/settings',
      }),
    ).toBe('/settings');
  });

  it('실제 주소가 /이고 navigate(주소 직접 입력·새 탭)면 저장된 값이 있어도 복원하지 않는다', () => {
    expect(
      resolveInitialHref({
        realHref: '/',
        navigationType: 'navigate',
        storedHref: '/career/abc/style',
      }),
    ).toBe('/');
  });

  it('저장된 값이 없으면 reload여도 실제 주소(/) 그대로다', () => {
    expect(resolveInitialHref({ realHref: '/', navigationType: 'reload', storedHref: null })).toBe(
      '/',
    );
  });
});

describe('isPublicAllowlistedPathname / mirroredAddressHref', () => {
  it.each(['/', '/guide', '/faq', '/legal/terms', '/legal/privacy'])(
    '허용 목록 %s는 pathname+search+hash를 그대로 비춘다',
    (pathname) => {
      expect(isPublicAllowlistedPathname(pathname)).toBe(true);
      expect(mirroredAddressHref({ pathname, search: '?a=1', hash: '#x' })).toBe(
        `${pathname}?a=1#x`,
      );
    },
  );

  it('끝 슬래시가 있어도 허용 목록으로 취급하고 원본 그대로(슬래시 포함) 비춘다', () => {
    expect(isPublicAllowlistedPathname('/guide/')).toBe(true);
    expect(mirroredAddressHref({ pathname: '/guide/', search: '', hash: '' })).toBe('/guide/');
  });

  // T-7-038(#271) 후속: 공개 커리어 기사 공유 링크(`/articles/$articleId`) — 정확히 한 세그먼트만
  // 허용한다.
  it.each(['/articles/abc', '/articles/abc/'])(
    '공개 기사 %s는 허용 목록으로 취급하고 원본 그대로 비춘다',
    (pathname) => {
      expect(isPublicAllowlistedPathname(pathname)).toBe(true);
      expect(mirroredAddressHref({ pathname, search: '', hash: '' })).toBe(pathname);
    },
  );

  it.each([
    '/career/abc/style',
    '/settings',
    '/onboarding',
    '/locker-room',
    '/articles',
    '/articles/a/b',
  ])('그 밖의 라우트 %s는 검색·해시를 지우고 /로 고정한다', (pathname) => {
    expect(isPublicAllowlistedPathname(pathname)).toBe(false);
    expect(mirroredAddressHref({ pathname, search: '?legal=terms', hash: '#x' })).toBe('/');
  });
});

describe('routeDatasetValue', () => {
  it('해시는 제외하고 pathname+search만 돌려준다', () => {
    expect(routeDatasetValue({ pathname: '/career/abc/style', search: '?tab=1' })).toBe(
      '/career/abc/style?tab=1',
    );
    expect(routeDatasetValue({ pathname: '/settings', search: '' })).toBe('/settings');
  });
});

describe('computeInitialHref: sessionStorage·performance 접근은 전부 try/catch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sessionStorage.getItem이 던져도(사생활 보호 모드 등) 앱 부팅용 href 계산이 죽지 않는다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => computeInitialHref({ pathname: '/settings', search: '', hash: '' })).not.toThrow();
    expect(computeInitialHref({ pathname: '/settings', search: '', hash: '' })).toBe('/settings');
  });

  it('performance.getEntriesByType이 던져도 실제 주소를 그대로 쓴다', () => {
    vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(computeInitialHref({ pathname: '/career/abc/style', search: '', hash: '' })).toBe(
      '/career/abc/style',
    );
  });
});

describe('createBackButtonGuardHandler', () => {
  it('메모리 히스토리가 안에서 더 갈 수 있으면 그리로 back()하고 true를 돌려준다', () => {
    const history = createMemoryHistory({ initialEntries: ['/', '/career/abc'] });
    const handler = createBackButtonGuardHandler(history);

    expect(handler()).toBe(true);
    expect(history.location.pathname).toBe('/');
  });

  it('안에서 더 못 가지만 지금이 /가 아니면 /로 replace하고 true를 돌려준다', () => {
    const history = createMemoryHistory({ initialEntries: ['/career/abc/style'] });
    const handler = createBackButtonGuardHandler(history);

    expect(history.canGoBack()).toBe(false);
    expect(handler()).toBe(true);
    expect(history.location.pathname).toBe('/');
  });

  it('이미 /면 false를 돌려준다(가드 재적재·실제 이탈 허용은 platform/web 몫)', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const handler = createBackButtonGuardHandler(history);

    expect(handler()).toBe(false);
    expect(history.location.pathname).toBe('/');
  });
});
