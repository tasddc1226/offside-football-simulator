// T-4-009 D-56: DEV 전용 콘텐츠 팩 오버라이드 단위 테스트. `import.meta.env.DEV`는 vitest에서 항상
// true다(career-actions.test.ts의 e2e-seed 훅과 같은 전제) — 여기서는 override 유무·유효성만 본다.
import { afterEach, describe, expect, it } from 'vitest';
import { ACTIVE_CONTENT_PACK_VERSION, E2E_CONTENT_PACK_STORAGE_KEY, resolveActiveContentPackVersion } from './versions.js';

afterEach(() => {
  localStorage.removeItem(E2E_CONTENT_PACK_STORAGE_KEY);
});

describe('resolveActiveContentPackVersion', () => {
  it('오버라이드가 없으면 ACTIVE_CONTENT_PACK_VERSION을 돌려준다', () => {
    expect(resolveActiveContentPackVersion()).toBe(ACTIVE_CONTENT_PACK_VERSION);
  });

  it('PACK_VERSIONS에 있는 오버라이드는 그 값을 돌려준다', () => {
    localStorage.setItem(E2E_CONTENT_PACK_STORAGE_KEY, '0.2.0');
    expect(resolveActiveContentPackVersion()).toBe('0.2.0');
  });

  it('PACK_VERSIONS에 없는 값(오타·미지원 버전)은 무시하고 ACTIVE_CONTENT_PACK_VERSION을 돌려준다', () => {
    localStorage.setItem(E2E_CONTENT_PACK_STORAGE_KEY, '9.9.9');
    expect(resolveActiveContentPackVersion()).toBe(ACTIVE_CONTENT_PACK_VERSION);
  });

  it('빈 문자열도 무시한다(PACK_VERSIONS에 없는 값)', () => {
    localStorage.setItem(E2E_CONTENT_PACK_STORAGE_KEY, '');
    expect(resolveActiveContentPackVersion()).toBe(ACTIVE_CONTENT_PACK_VERSION);
  });
});
