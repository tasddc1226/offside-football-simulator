/* global vi, beforeEach, describe, it, expect */
// T-11-802 '의견 보내기' 앱 맥락 — 기기 대략값은 Platform.OS · Platform.Version만, 버전은 오류 보고와 같은 꼴.
const f = vi.hoisted(() => ({
  platform: { OS: 'ios', Version: '18.1' },
  build: { version: '1.1.7', build: '42', updateId: null },
}));
vi.mock('react-native', () => ({ Platform: f.platform }));
vi.mock('./updates', () => ({ appBuildInfo: () => f.build }));

const { appVoiceContext } = await import('./voiceContext');

describe('appVoiceContext', () => {
  beforeEach(() => {
    f.platform.OS = 'ios';
    f.platform.Version = '18.1';
    f.build = { version: '1.1.7', build: '42', updateId: null };
  });

  it('iOS 내장 번들: 버전 (빌드), 기기는 OS와 버전', () => {
    expect(appVoiceContext('settings')).toEqual({
      screen: 'settings',
      platform: 'ios',
      version: '1.1.7 (42)',
      device: 'ios 18.1',
    });
  });

  it('Android OTA: 업데이트 id 앞 8자를 붙이고, API 레벨 숫자를 그대로 쓴다', () => {
    f.platform.OS = 'android';
    f.platform.Version = 34;
    f.build = { version: '1.1.7', build: '120', updateId: 'abcdef12' };
    expect(appVoiceContext('home')).toEqual({
      screen: 'home',
      platform: 'android',
      version: '1.1.7 (120) · abcdef12',
      device: 'android 34',
    });
  });
});
