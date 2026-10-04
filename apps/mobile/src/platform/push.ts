// 1.0.2 호환 번들: 이 빌드에는 알림(expo-notifications) 네이티브 모듈이 없어 푸시를 끈다.
import { proxy } from 'valtio';

export const pushState = proxy({ enabled: false, busy: false, blocked: false, message: '', failed: false });
export const pushRegistration = {
  async setEnabled(_: boolean) {},
  async restore() {},
};
export function startPush() {}
export async function testOwnPush() {
  throw new Error('이 앱 버전에서는 알림을 받을 수 없어요.');
}
