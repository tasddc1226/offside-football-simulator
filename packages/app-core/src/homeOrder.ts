// T-11-435 홈 블록 순서(웹 Home.svelte · 앱 screens/home/Home.tsx가 같이 쓴다). 히어로(커리어 카드)와 아래 타일 사이에 놓이는
// 블록의 순서를 이 한 곳에서 정한다. 받을 선물이 있거나 오늘 출석 전인 구단주면 그 블록을 히어로 바로 아래 '받을 것' 자리로
// 올리고, 받을 게 없으면 원래 자리(컵 · 리그 배너 아래)에 둔다. 판단 값은 홈이 이미 부르는 선물 · 출석 응답(메모를 같이 쓴다)에서
// 나온다. 이 모듈은 API를 부르지 않는다(웹 첫 화면 번들에 실린다). 불러오기는 homeTodo.ts.
import type { AttendanceCard } from './api/attendance';

/** 히어로 아래 블록. 앱에만 있는 블록(pushOptIn)은 웹이 건너뛴다. */
export type HomeBlock =
  | 'gift'
  | 'attendance'
  | 'pushOptIn'
  | 'ownerConflict'
  | 'managerResume'
  | 'seasonGauge'
  | 'cup'
  | 'league'
  | 'firstGuide'
  | 'live';

/** 받을 게 없을 때의 순서(T-11-435 전 홈 순서 그대로). */
export const HOME_BLOCKS: readonly HomeBlock[] = [
  'pushOptIn',
  'ownerConflict',
  'managerResume',
  'seasonGauge',
  'cup',
  'league',
  'gift',
  'attendance',
  'firstGuide',
  'live',
];

/** 지금 받을 수 있는 것. 모르면(아직 응답 전 · 실패) false로 두어 원래 자리에 둔다. */
export interface HomeTodo {
  gift: boolean;
  attendance: boolean;
}
export const NO_HOME_TODO: HomeTodo = { gift: false, attendance: false };

/** 선물 · 출석 응답으로 받을 것을 정한다. 출석은 로그인한 구단주가 오늘 아직 출석하지 않았을 때만(비로그인 기기는 받을 수 없다). */
export function homeTodoOf(gift: unknown, attendance: AttendanceCard | null): HomeTodo {
  return {
    gift: gift != null,
    attendance: attendance?.kind === 'owner' && !attendance.att.checkedIn,
  };
}

/** 블록 순서. 받을 것은 맨 앞(히어로 바로 아래)으로, 선물이 출석보다 먼저다. 나머지는 원래 순서를 지킨다. */
export function homeOrder(todo: HomeTodo): HomeBlock[] {
  const up = (['gift', 'attendance'] as const).filter((k) => todo[k]);
  return [...up, ...HOME_BLOCKS.filter((b) => !(up as readonly HomeBlock[]).includes(b))];
}
