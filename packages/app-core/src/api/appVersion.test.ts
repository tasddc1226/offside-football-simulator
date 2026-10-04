import { describe, expect, it } from 'vitest';
import { compareVersions, storeUpdateUrl } from './appVersion.js';

const V = {
  ios: { min: '1.1.0', url: 'https://apps.apple.com/kr/app/id1' },
  android: { min: '1.0.0', url: 'https://play.google.com/store/apps/details?id=x' },
};

describe('앱 버전 (T-11-042)', () => {
  it('자리마다 숫자로 비교한다', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('최소 버전보다 낮을 때만 스토어 주소를 준다', () => {
    expect(storeUpdateUrl(V, 'ios', '1.0.0')).toBe(V.ios.url);
    expect(storeUpdateUrl(V, 'ios', '1.1.0')).toBeNull();
    expect(storeUpdateUrl(V, 'ios', '1.2.0')).toBeNull();
    expect(storeUpdateUrl(V, 'android', '1.0.0')).toBeNull();
  });

  it('버전을 모르면 안내하지 않는다', () => {
    expect(storeUpdateUrl(V, 'ios', undefined)).toBeNull();
    expect(storeUpdateUrl(V, 'ios', 'dev')).toBeNull();
  });
});
