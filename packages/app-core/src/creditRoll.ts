// ───────── 커리어 재생 계산 (웹·앱 공용, T-10-129 · 공용 T-11-005) ─────────
// 은퇴 선수 상세의 '커리어 재생'은 엔딩 크레딧처럼 일정한 속도로 천천히 내려간다. 장면은 화면 아래쪽에 들어올 때
// 올라오므로(LegendReport reveal) 끊어서 끌어오지 않고 계속 흘려야 글·그림이 스크롤과 함께 뜬다.
// 처음엔 서서히 빨라지고 마지막 휘슬(finale)이 가운데쯤 오면 서서히 멈춘다. 여기는 순수 계산만 — 스크롤을 실제로
// 옮기는 루프(웹 window · 앱 ScrollView)와 손대면 멈추는 입력 처리는 각 클라이언트가 한다.

/** 흐르는 속도(px/초). */
export const ROLL_SPEED = 64;
export const RAMP_MS = 700;
/** 끝나기 이만큼(px) 전부터 느려진다. */
export const EASE_OUT = 160;

/** 재생을 멈출 스크롤 위치: 마지막 휘슬 가운데가 화면 45% 높이에 올 때. 문서 끝을 넘지 않는다. */
export function rollEnd(
  finale: { top: number; height: number } | null,
  vh: number,
  maxY: number,
): number {
  return finale ? Math.max(0, Math.min(maxY, finale.top + finale.height / 2 - vh * 0.45)) : maxY;
}

/** 이번 프레임의 속도(px/초): 출발할 때 서서히 오르고, 끝 가까이에서 서서히 줄되 아주 멈추지는 않는다. */
export function rollSpeed(sinceStart: number, left: number): number {
  return (
    ROLL_SPEED * Math.min(1, sinceStart / RAMP_MS) * Math.min(1, Math.max(0.15, left / EASE_OUT))
  );
}
