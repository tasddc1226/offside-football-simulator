import { describe, expect, it } from 'vitest';
import { detectPlatform } from './install-platform.js';

describe('detectPlatform', () => {
  it('아이폰 Chrome·Safari, 안드로이드, 그 밖을 구분한다', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios-chrome');
    expect(
      detectPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios-safari');
    expect(
      detectPlatform(
        'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      ),
    ).toBe('android');
    expect(
      detectPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      ),
    ).toBe('other');
  });

  // T-10-115
  it('앱 안 브라우저(웹뷰)는 inapp — 홈 화면 추가 메뉴가 없다', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 11.3.0',
      ),
    ).toBe('inapp');
    expect(
      detectPlatform(
        'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Instagram 355.0.0.36.104 Android',
      ),
    ).toBe('inapp');
  });
  it('홈 화면 앱(standalone)의 Safari 토큰 없는 iOS UA는 inapp이 아니다', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(detectPlatform(ua)).toBe('inapp');
    expect(detectPlatform(ua, true)).toBe('ios-safari');
  });
});
