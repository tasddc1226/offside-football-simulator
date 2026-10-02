// ───────── 계약서 사인 (T-11-039) ─────────
// 웹(canvas)·앱(react-native-svg) 계약서 시트가 같은 기준·모양으로 사인을 받도록 공용 값을 둔다.

/** 이만큼(화면 px) 그어야 사인으로 친다 — 점 하나 찍고 넘어가지 않게. */
export const MIN_INK = 40;
/** 도장이 찍힌 뒤 계약을 확정하기까지(ms). 감속 모션이면 바로 확정한다. */
export const STAMP_MS = 650;
/** '이름 사인 사용'이 왼쪽부터 써 나가는 시간(ms). */
export const REVEAL_MS = 600;
/** 이름 사인 기울기 — 2D 변환 (1, SKEW_Y, SKEW_X, 1). */
export const SKEW_Y = -0.06,
  SKEW_X = -0.28;

/** 이름 사인 밑의 꼬리 획(원점 = 이름 가운데 글자선). half = 꼬리 반폭, size = 글자 크기. */
export const signFlourish = (half: number, size: number): string => {
  const n = (v: number) => Math.round(v * 10) / 10;
  return (
    `M${n(-half)},${n(size * 0.32)}` +
    `C${n(-half * 0.3)},${n(size * 0.12)} ${n(half * 0.4)},${n(size * 0.5)} ${n(half)},${n(size * 0.05)}` +
    `Q${n(half * 0.8)},${n(size * 0.6)} ${n(half * 0.55)},${n(size * 0.3)}`
  );
};
