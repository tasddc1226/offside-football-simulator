import { proxy } from 'valtio';
/** 알림의 친구 링크를 소비할 때만 사용하는 일회성 화면 선택. 게임 저장에 들어가지 않는다.
 *  home은 알림으로 홈을 열 때마다 1씩 늘어 홈 선물이 다시 묻게 한다(T-11-388). */
export const notificationDestination = proxy({
  friends: false,
  history: false,
  market: false,
  home: 0,
});
