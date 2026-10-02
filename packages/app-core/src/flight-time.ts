// ───────── 이적 비행 장면 시간표 (T-11-039) ─────────
// 시트 컨트롤러(첫 화면 번들)도 쓰므로 육지 지도 데이터(flight.ts → land.ts)와 떼어 둔다.

/** 비행 장면 길이(ms). 지도가 뜨고 → 날아가고 → 도착 표시가 퍼진다. 감속 모션이면 도착한 정지 장면만 FLIGHT_STILL_MS. */
export const FLIGHT_MS = 3000;
export const FLIGHT_STILL_MS = 1500;
/** 이륙·착륙 시각(ms) — FLIGHT_MS 안에서 앞뒤로 지도·도착 표시를 보여 줄 틈을 둔다. */
const LIFT = 300,
  LAND = 2550;
/** 경과 시간 → 비행 진행률(0–1, 이륙·착륙에서 느려진다). */
export function flightProgress(elapsed: number): number {
  const t = Math.min(1, Math.max(0, (elapsed - LIFT) / (LAND - LIFT)));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
