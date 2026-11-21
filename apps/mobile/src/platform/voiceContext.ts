// T-11-802 '의견 보내기' 맥락(앱). 기기 대략값은 Platform.OS · Platform.Version만 쓴다 — 새 네이티브 의존성 없이 OTA로 나간다.
// 버전은 오류 보고와 같은 꼴 '버전 (빌드) · OTA 앞 8자'. config.ts의 APP_VERSION은 버전 값이 아니라서 쓰지 않는다.
// 선수 이름 · 닉네임 · 구단 이름 · 커리어 id는 보내지 않는다.
import { Platform } from 'react-native';
import {
  appVoiceVersion,
  voiceDevice,
  type VoiceContext,
  type VoiceScreen,
} from '@offside/app-core/voice';
import { appBuildInfo } from './updates';

export function appVoiceContext(screen: VoiceScreen): VoiceContext {
  return {
    screen,
    platform: Platform.OS,
    version: appVoiceVersion(appBuildInfo()),
    device: voiceDevice(Platform.OS, Platform.Version),
  };
}
