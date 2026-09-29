import { describe, expect, it } from 'vitest';
import { detectInApp, externalOpenUrl, manualOpenGuide } from './inapp.js';

const IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const AND =
  'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36';

const UAS = {
  kakaoIos: `${IOS} Mobile/15E148 KAKAOTALK 11.3.0`,
  kakaoAnd: `${AND} KAKAOTALK/11.3.0 (INAPP)`,
  instaIos: `${IOS} Mobile/22A3354 Instagram 355.0.0.20.104 (iPhone15,2; iOS 18_0; ko_KR; ko-KR; scale=3.00; 1179x2556; 675650978)`,
  instaAnd: `${AND} Instagram 355.0.0.36.104 Android (34/14; 480dpi; 1080x2340; samsung; SM-S921N; e1s; s5e9945; ko_KR; 675650978)`,
  threadsIos: `${IOS} Mobile/22A3354 Barcelona 355.0.0.20.104 (iPhone15,2; iOS 18_0; ko_KR; ko-KR; scale=3.00; 1179x2556; 675650978)`,
  fbIos: `${IOS} Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0.0.35.108;FBBV/613;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0;FBSS/3;FBID/phone;FBLC/ko_KR;FBOP/5]`,
  fbAnd: `${AND} [FB_IAB/FB4A;FBAV/480.0.0.35.108;]`,
  naverIos: `${IOS} Mobile/15E148 Safari/604.1 NAVER(inapp; search; 1210; 12.5.2; 15)`,
  naverAnd: `${AND} NAVER(inapp; search; 1210; 12.5.2)`,
  lineIos: `${IOS} Mobile/15E148 Safari Line/14.9.0`,
  lineAnd: `${AND} Line/14.9.0`,
  otherAnd: AND,
  otherIos: `${IOS} Mobile/15E148`,
  safari: `${IOS} Version/18.0 Mobile/15E148 Safari/604.1`,
  chromeIos: `${IOS} CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1`,
  chromeAnd:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  desktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
};

describe('detectInApp', () => {
  it('앱별로 알아본다(OS 포함)', () => {
    expect(detectInApp(UAS.kakaoIos)).toEqual({ app: 'kakao', os: 'ios' });
    expect(detectInApp(UAS.kakaoAnd)).toEqual({ app: 'kakao', os: 'android' });
    expect(detectInApp(UAS.instaIos)).toEqual({ app: 'instagram', os: 'ios' });
    expect(detectInApp(UAS.instaAnd)).toEqual({ app: 'instagram', os: 'android' });
    expect(detectInApp(UAS.threadsIos)).toEqual({ app: 'threads', os: 'ios' });
    expect(detectInApp(UAS.fbIos)).toEqual({ app: 'facebook', os: 'ios' });
    expect(detectInApp(UAS.fbAnd)).toEqual({ app: 'facebook', os: 'android' });
    expect(detectInApp(UAS.naverIos)).toEqual({ app: 'naver', os: 'ios' });
    expect(detectInApp(UAS.naverAnd)).toEqual({ app: 'naver', os: 'android' });
    expect(detectInApp(UAS.lineIos)).toEqual({ app: 'line', os: 'ios' });
    expect(detectInApp(UAS.lineAnd)).toEqual({ app: 'line', os: 'android' });
  });
  it('이름 없는 웹뷰는 other-webview', () => {
    expect(detectInApp(UAS.otherAnd)).toEqual({ app: 'other-webview', os: 'android' });
    expect(detectInApp(UAS.otherIos)).toEqual({ app: 'other-webview', os: 'ios' });
  });
  it('홈 화면 앱(standalone)의 iOS UA는 웹뷰로 오인하지 않는다', () => {
    expect(detectInApp(UAS.otherIos, true)).toBeNull();
    expect(detectInApp(UAS.kakaoIos, true)?.app).toBe('kakao');
  });
  it('일반 브라우저는 null', () => {
    expect(detectInApp(UAS.safari)).toBeNull();
    expect(detectInApp(UAS.chromeIos)).toBeNull();
    expect(detectInApp(UAS.chromeAnd)).toBeNull();
    expect(detectInApp(UAS.desktop)).toBeNull();
    expect(detectInApp('')).toBeNull();
  });
});

describe('externalOpenUrl', () => {
  const href = 'https://offside-lab.com/settings?a=1&b=2#x';
  it('카카오톡은 두 OS 모두 kakaotalk 스킴', () => {
    const url = `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
    expect(externalOpenUrl({ app: 'kakao', os: 'ios' }, href)).toBe(url);
    expect(externalOpenUrl({ app: 'kakao', os: 'android' }, href)).toBe(url);
  });
  it('안드로이드는 Chrome intent(해시 제외)', () => {
    expect(externalOpenUrl({ app: 'instagram', os: 'android' }, href)).toBe(
      'intent://offside-lab.com/settings?a=1&b=2#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
  it('iOS 그 밖의 웹뷰는 프로그램으로 못 연다', () => {
    expect(externalOpenUrl({ app: 'instagram', os: 'ios' }, href)).toBeNull();
    expect(externalOpenUrl({ app: 'other-webview', os: 'ios' }, href)).toBeNull();
  });
});

describe('manualOpenGuide', () => {
  it('iOS는 Safari, 복사됐으면 붙여넣기 안내를 덧붙인다', () => {
    expect(manualOpenGuide({ app: 'instagram', os: 'ios' }, false)).toContain("'Safari로 열기'");
    expect(manualOpenGuide({ app: 'instagram', os: 'ios' }, true)).toContain('복사해 뒀으니');
  });
});
