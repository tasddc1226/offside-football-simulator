// T-11-360 홈 출석 체크(웹 HomeAttendance.svelte, 앱 screens/home/HomeAttendance.tsx). 지연 청크에서만 불러 첫 화면 번들에 넣지 않는다.
import { ns } from '../core';

const ko = {
  title: '출석 체크',
  streak: (p: { n: number }) => `${p.n}일 연속`,
  board: (p: { filled: number; total: number }) => `도장 ${p.filled}/${p.total}`,
  todayLabel: '오늘 보상',
  tomorrowLabel: '내일 보상',
  /** T-11-512 클럽 멤버십 구독 중. */
  memberBonus: '멤버십 혜택으로 출석 보상을 2배로 받아요',
  grace:
    '매일 출석하면 그날 칸의 보상을 받아요. 빠진 날이 있어도 도장은 남고, 한 주에 하루는 빠져도 연속 기록이 이어져요.',
  btn: '출석하기',
  busy: '찍는 중…',
  checked: '오늘 도장을 찍었어요',
  stamped: (p: { n: number; reward: string }) =>
    `${p.n}번째 도장을 찍었어요. 받은 아이템: ${p.reward}`,
  fail: '출석하지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  reroll: (p: { n: number }) => `리롤권 ${p.n}장`,
  boost: (p: { n: number }) => `잠재력 강화권 ${p.n}장`,
  scout: (p: { n: number }) => `프리미엄 스카우트권 ${p.n}장`,
  rename: (p: { n: number }) => `선수 이름 변경권 ${p.n}장`,
  itemReroll: '리롤권',
  itemBoost: '잠재력 강화권',
  itemScout: '프리미엄 스카우트권',
  boardLabel: (p: { filled: number; total: number }) =>
    `도장판 ${p.total}칸 중 ${p.filled}칸을 채웠어요`,
  entryToday: (p: { reward: string }) => `오늘 보상 · ${p.reward}`,
  entryDone: '오늘 도장 완료',
  entryGuest: '로그인하면 매일 보상',
  entryLabel: '출석 체크 열기',
  close: '닫기',
  guestLead: (p: { days: number; reward: string }) =>
    `로그인하면 매일 출석하고 보상을 받아요. ${p.days}일 동안 받는 보상: ${p.reward}`,
  // T-11-440 출석 뒤 받은 아이템 · 쓰는 곳 안내, 칸을 눌러 그날 보상 보기
  got: (p: { reward: string }) => `받은 아이템: ${p.reward}`,
  useHint:
    '리롤권과 스카우트권은 선수 만들기 후보 단계에서, 강화권은 선수 탭 잠재력 강화에서 써요.',
  toOwner: '내 구단에서 보기',
  cellReward: (p: { n: number; reward: string }) => `${p.n}일째 보상 · ${p.reward}`,
  cellLabel: (p: { n: number; reward: string; state: string }) =>
    `${p.n}일째, ${p.reward}${p.state ? `, ${p.state}` : ''}`,
  cellDone: '도장 찍음',
  cellToday: '오늘 칸',
  cellHint: '칸을 누르면 그날 보상을 볼 수 있어요.',
};

export type AttendanceMsgs = typeof ko;
export const attendanceText = ns('attendance', ko);
