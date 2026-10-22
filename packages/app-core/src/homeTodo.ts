// T-11-435 홈 '받을 것' 불러오기. 선물 · 출석 블록이 부르는 것과 같은 메모 조회(fetchHomeGift · fetchAttendance)라 새 요청이
// 생기지 않는다(동시에 불러도 하나로 합친다). 웹은 첫 화면 번들 밖에서 import()로 부른다.
import { fetchAttendance } from './api/attendance';
import { fetchHomeGift } from './api/gift';
import { homeTodoOf, type HomeTodo } from './homeOrder';

export async function loadHomeTodo(): Promise<HomeTodo> {
  const [gift, attendance] = await Promise.all([fetchHomeGift(), fetchAttendance()]);
  return homeTodoOf(gift, attendance);
}
