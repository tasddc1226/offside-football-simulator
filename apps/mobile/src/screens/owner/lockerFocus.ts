// T-11-728 (웹 ui/team/lockerFocus.ts와 같다) 내 구단 메뉴의 '카드 강화'로 팀 화면을 열면 라커룸(강화 버튼이 있는 곳)까지 내려 준다. 한 번 쓰면 지운다.
let wanted = false;
export const askLockerFocus = () => void (wanted = true);
export function takeLockerFocus(): boolean {
  const w = wanted;
  wanted = false;
  return w;
}
