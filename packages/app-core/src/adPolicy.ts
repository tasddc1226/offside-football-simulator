// T-11-061 광고 위치표와 노출 판단(docs/tracking/web-ads-plan.md 4.1). 웹 AdSlot·앱(AdMob 예정)이 같이 쓴다.
// 화면은 위치 이름만 넘기고 규칙을 직접 검사하지 않는다. 조작 화면·업무 모드에는 칸을 두지 않는다(3.1).

export type AdPlace = 'records-bottom' | 'board-bottom' | 'legend-bottom';

/** 위치별 켜기 스위치 — 지표가 나빠지면 여기서 끈다(기획 6절). 다음 단계 위치는 여기에 더한다(5절). */
export const AD_PLACES: Record<AdPlace, boolean> = {
  'records-bottom': true,
  'board-bottom': true,
  'legend-bottom': true,
};

/** 같은 위치는 세션 안에서 이 간격 안에 다시 요청하지 않는다. */
export const AD_REPEAT_MS = 5 * 60_000;

/** lastShown: 이 세션에서 그 위치를 마지막으로 요청한 시각. 안 채워진 위치는 Infinity로 둬 다시 요청하지 않는다. */
export function shouldShow(place: AdPlace, now: number, lastShown?: number): boolean {
  if (!AD_PLACES[place]) return false;
  return lastShown === undefined || now - lastShown >= AD_REPEAT_MS;
}
