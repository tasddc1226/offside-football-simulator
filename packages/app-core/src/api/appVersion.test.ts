import { describe, expect, it } from 'vitest';
import { compareVersions, storeUpdateNeed } from './appVersion.js';

const V = {
  ios: { min: '1.1.0', latest: '1.1.4', url: 'https://apps.apple.com/kr/app/id1' },
  android: {
    min: '1.0.0',
    latest: '1.0.0',
    url: 'https://play.google.com/store/apps/details?id=x',
  },
};

describe('앱 버전 (T-11-042)', () => {
  it('자리마다 숫자로 비교한다', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('최소 버전보다 낮으면 강제, 최신 버전보다 낮으면 권장 업데이트다 (T-11-464)', () => {
    expect(storeUpdateNeed(V, 'ios', '1.0.0')).toEqual({
      kind: 'force',
      url: V.ios.url,
      latest: '1.1.4',
    });
    expect(storeUpdateNeed(V, 'ios', '1.1.0')).toEqual({
      kind: 'suggest',
      url: V.ios.url,
      latest: '1.1.4',
    });
    expect(storeUpdateNeed(V, 'ios', '1.1.4')).toBeNull();
    expect(storeUpdateNeed(V, 'ios', '1.2.0')).toBeNull();
    expect(storeUpdateNeed(V, 'android', '1.0.0')).toBeNull();
  });

  it('버전을 모르면 안내하지 않는다', () => {
    expect(storeUpdateNeed(V, 'ios', undefined)).toBeNull();
    expect(storeUpdateNeed(V, 'ios', 'dev')).toBeNull();
  });
});
