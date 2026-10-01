// T-11-025 시즌 탭 결과 안내(웹 tabs/SeasonTab.svelte · 앱 screens/game/SeasonTab.tsx 공용 순서·시간).
// 중계 시트를 닫고 새 리포트가 뜨면 아래 카드들을 차례로 비추며 내려간다. 숫자는 그 카드에 머무는 시간(ms)이고,
// 'train'·'invest'는 시간 대신 사용자가 하나를 고를 때까지 기다리는 카드다.

export type TourGate = 'train' | 'invest';
export type TourSpot = 'report' | 'prep' | 'invest' | 'status' | 'stories' | 'feed' | 'go';

export const RESULT_TOUR: readonly (readonly [TourSpot, number | TourGate])[] = [
  ['report', 2600],
  ['prep', 'train'],
  ['invest', 'invest'],
  ['status', 1600],
  ['stories', 1000],
  ['feed', 1000],
  ['go', 1400],
];
/** 고른 선택지가 톡 튀는 동안 기다렸다가 다음 카드로 넘어간다(웹 opt-pick 0.6s · 앱 PickPop 600ms). */
export const TOUR_PICK_MS = 650;
/** 시즌 현황 카드를 비춘 뒤 순위 변동 연출을 시작하기까지. */
export const TOUR_RANK_DELAY = 500;
/** 순위 변동 연출(RANK_SLIDE_MS)이 있는 구간이면 시즌 현황에 이만큼 더 머문다. */
export const TOUR_RANK_MS = 1000;
/** 순위표에서 내 팀 줄이 미끄러지는 시간. */
export const RANK_SLIDE_MS = 900;

/**
 * 순위 변동 연출의 범위 — 보이는 줄 목록(접힌 '⋯' 줄은 rank 없음)에서 내 팀 줄(me)과, 그 줄이 출발할 이전 순위
 * 자리(from)를 찾는다. 접힌 표에서는 보이는 줄 안에서 이전 순위에 가장 가까운 자리부터 움직인다. 움직일 게 없으면 null.
 * me~from 사이 줄들은 내 팀 줄과 반대로 한 칸씩 밀려난다.
 */
export function rankSlideSpan(
  rows: readonly { rank?: number; me?: boolean }[],
  before: number,
  after: number,
): { me: number; from: number; up: boolean } | null {
  const me = rows.findIndex((r) => r.me);
  if (me < 0 || before === after) return null;
  const up = before > after;
  const passed = (r: { rank?: number }) => r.rank === undefined || (up ? r.rank <= before : r.rank >= before);
  let from = me;
  for (let i = me + (up ? 1 : -1); i >= 0 && i < rows.length && passed(rows[i]!); i += up ? 1 : -1) from = i;
  return from === me ? null : { me, from, up };
}
