// 1.0.2 호환 번들: 알림 모듈이 없어 홈 알림 안내를 띄우지 않는다.
import { proxy } from 'valtio';

export const pushOffer = proxy({ handled: true, eligible: false });
export async function checkPushOffer() {}
export function dismissPushOffer() {}
