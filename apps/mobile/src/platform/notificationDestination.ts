import { proxy } from 'valtio';
/** 알림의 친구 링크를 소비할 때만 사용하는 일회성 화면 선택. 게임 저장에 들어가지 않는다. */
export const notificationDestination = proxy({ friends: false, history: false, market: false });
