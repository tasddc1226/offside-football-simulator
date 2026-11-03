import { proxy } from 'valtio';
/** 알림의 친구 링크를 소비할 때만 사용하는 일회성 화면 선택. 게임 저장에 들어가지 않는다.
 *  home은 알림으로 홈을 열 때마다 1씩 늘어 홈 선물이 다시 묻게 한다(T-11-388). */
export const notificationDestination = proxy({
  friends: false,
  history: false,
  market: false,
  home: 0,
  /** T-11-622 초대 링크로 받은 친구 코드. 신청하거나 닫을 때까지 둔다(로그인을 거쳐도 남는다). */
  invite: null as string | null,
});
