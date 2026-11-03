import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_DEFAULT_FROM,
  consentByDefault,
  consentRegion,
  consentRegionCookie,
} from './consent-region.js';

describe('T-11-597 동의 지역', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('유럽경제지역 · 영국 · 스위스와 모르는 나라는 먼저 묻는다', () => {
    for (const c of ['DE', 'FR', 'GB', 'CH', 'NO', 'IS', 'CY', 'RE', 'XX', '', undefined, 'kr'])
      expect(consentRegion(c), String(c)).toBe('ask');
    for (const c of ['KR', 'JP', 'US', 'TW', 'HK', 'BR'])
      expect(consentRegion(c), c).toBe('notice');
  });

  it('쿠키가 notice이고 방침 시행일이 지났을 때만 기본으로 켠다', () => {
    const after = CONSENT_DEFAULT_FROM + 1;
    vi.stubGlobal('document', { cookie: `a=1; ${consentRegionCookie('notice').split(';')[0]}` });
    expect(consentByDefault(after)).toBe(true);
    expect(consentByDefault(CONSENT_DEFAULT_FROM - 1)).toBe(false);
    vi.stubGlobal('document', { cookie: consentRegionCookie('ask').split(';')[0] });
    expect(consentByDefault(after)).toBe(false);
    vi.stubGlobal('document', { cookie: '' });
    expect(consentByDefault(after)).toBe(false);
  });
});
