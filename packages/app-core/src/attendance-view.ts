// T-11-360 출석 카드 그리기 값(웹 HomeAttendance.svelte · 앱 HomeAttendance.tsx가 같이 쓴다).
import {
  ATTENDANCE_BIG,
  ATTENDANCE_BOARD,
  boardFilled,
  dayReward,
  nextStamp,
  type AttendanceReward,
} from '@offside/contracts/attendance';
import { OWNER_ITEMS, type OwnerItem } from '@offside/contracts/cup';
import { kstDay } from '@offside/contracts/kst';
import { storage } from '@offside/game/storage';
import type { AttendanceCard } from './api/attendance';
import { hasSessionHint } from './api/client.js';
import { attendanceText as L } from './i18n/ko/attendance';

/** 받은 · 받을 아이템을 한 줄로. 아무것도 없으면 빈 문자열. */
export const rewardText = (r: AttendanceReward) =>
  OWNER_ITEMS.filter((k) => r[k])
    .map((k) => L[k]({ n: r[k]! }))
    .join(', ');

/** 칸에 그릴 아이템 하나(가장 비싼 것: 스카우트권 > 강화권 > 리롤권)와 장수. */
function mainItem(r: AttendanceReward): { item: OwnerItem; qty: number } {
  const item = (['scout', 'boost', 'reroll'] as const).find((k) => r[k])!;
  return { item, qty: r[item]! };
}

/**
 * 도장판 칸(1~28): 채웠는지 · 오늘 칸인지 · 큰 보상 칸인지 · 그 칸의 아이템. 오늘 출석 전이면 다음 칸이 오늘 칸이다.
 * 판을 다 채운 다음 날(출석 전)은 새 판으로 보인다. next = 오늘 출석 전이면 오늘 보상, 출석했으면 내일 보상.
 */
export function attendanceBoard(stamps: number, checkedIn: boolean) {
  const filled = boardFilled(stamps) === ATTENDANCE_BOARD && !checkedIn ? 0 : boardFilled(stamps);
  const next = nextStamp(stamps);
  return {
    filled,
    total: ATTENDANCE_BOARD,
    cells: Array.from({ length: ATTENDANCE_BOARD }, (_, i) => ({
      n: i + 1,
      on: i < filled,
      today: !checkedIn && i === filled,
      big: (ATTENDANCE_BIG as readonly number[]).includes(i + 1),
      ...mainItem(dayReward(i + 1)),
    })),
    next: { today: !checkedIn, cell: next.cell, text: rewardText(next.reward) },
  };
}

/** 한 판(28일)을 다 채우면 받는 보상 합계(로그인 안내 카드). */
export function boardTotal() {
  const sum: AttendanceReward = {};
  for (let n = 1; n <= ATTENDANCE_BOARD; n++)
    for (const [k, v] of Object.entries(dayReward(n)) as [OwnerItem, number][])
      sum[k] = (sum[k] ?? 0) + v;
  return { days: ATTENDANCE_BOARD, reward: rewardText(sum) };
}

// 출석 창은 하루(KST) 한 번 홈에서 저절로 뜬다 — 오늘 출석 전인 구단주와, 한 번이라도 플레이해 세션이 있는 비로그인 기기만
// (처음 온 방문자에게 첫 화면부터 로그인 창을 띄우지 않는다). 띄운 날을 기기에 적어 그날은 다시 뜨지 않는다(홈의 한 줄 입구로는
// 언제든 연다).
const POPUP_KEY = 'ft_att_popup';
const todayKst = () => kstDay(new Date().toISOString());

export function attendancePopupDue(card: AttendanceCard): boolean {
  if (card.kind === 'owner' ? card.att.checkedIn : !hasSessionHint()) return false;
  try {
    return storage().getItem(POPUP_KEY) !== todayKst();
  } catch {
    return false;
  }
}
export function markAttendancePopup() {
  try {
    storage().setItem(POPUP_KEY, todayKst());
  } catch {
    // 저장소를 못 쓰면 다음에 홈에 올 때 한 번 더 뜬다.
  }
}
