// T-4-009 D-56: DEV 전용 콘텐츠 팩 오버라이드 단위 테스트. `import.meta.env.DEV`는 vitest에서 항상
// true다(career-actions.test.ts의 e2e-seed 훅과 같은 전제) — 여기서는 override 유무·유효성만 본다.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVE_CONTENT_PACK_VERSION,
  ACTIVE_RULESET_VERSION,
  E2E_CONTENT_PACK_STORAGE_KEY,
  FALLBACK_SERVICE_SEASON,
  resolveActiveContentPackVersion,
  selectContentPackVersion,
} from './versions.js';

afterEach(() => {
  localStorage.removeItem(E2E_CONTENT_PACK_STORAGE_KEY);
});

describe('오프라인 폴백 manifest', () => {
  it('운영 승격 목표 manifest 1.4.0/0.5.1과 같다', () => {
    expect(ACTIVE_RULESET_VERSION).toBe('1.4.0');
    expect(ACTIVE_CONTENT_PACK_VERSION).toBe('0.5.1');
    expect(FALLBACK_SERVICE_SEASON.rulesetVersion).toBe(ACTIVE_RULESET_VERSION);
    expect(FALLBACK_SERVICE_SEASON.contentPackVersion).toBe(ACTIVE_CONTENT_PACK_VERSION);
  });
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

describe('selectContentPackVersion', () => {
  it('dev가 아니면 override 값이 있어도 기본 ACTIVE_CONTENT_PACK_VERSION을 유지한다', () => {
    expect(selectContentPackVersion({ dev: false, devOverride: '0.3.0' })).toBe(
      ACTIVE_CONTENT_PACK_VERSION,
    );
  });

  it('DEV에서는 유효한 override를 유지한다', () => {
    expect(selectContentPackVersion({ dev: true, devOverride: '0.2.0' })).toBe('0.2.0');
  });
});
