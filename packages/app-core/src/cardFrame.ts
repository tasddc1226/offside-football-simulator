// T-11-753 카드 틀 그림(assets/card-frame, Blender 렌더)의 치수 · 방패 모양. 웹 team/PlayerCard.svelte(CSS clip-path)와
// 앱 components/PlayerCard.tsx가 같이 쓴다. 그림은 등급마다 위 · 가운데 · 아래 세 조각이고, 위 · 아래 조각은 너비에 맞춰 비율을 지키며
// 가운데만 세로로 늘린다. 그래서 방패 꼭짓점의 높이도 카드 높이가 아니라 너비에 비례한다.

/** 위 조각 높이 ÷ 너비(360×154). */
export const CARD_FRAME_TOP = 154 / 360;
/** 아래 조각 높이 ÷ 너비(360×161). */
export const CARD_FRAME_BOT = 161 / 360;

/** 위쪽 꼭짓점: [x(너비 %), 위에서부터 높이(너비 배수)]. */
const TOP: readonly (readonly [number, number])[] = [
  [0, 0.15625],
  [15.625, 0.15625],
  [23.958, 0.0625],
  [50, 0.02083],
  [76.042, 0.0625],
  [84.375, 0.15625],
  [100, 0.15625],
];
/** 아래쪽 꼭짓점: [x(너비 %), 아래에서부터 높이(너비 배수)]. 오른쪽에서 왼쪽 순. */
const BOT: readonly (readonly [number, number])[] = [
  [98.958, 0.27083],
  [89.583, 0.14583],
  [50, 0.02083],
  [10.417, 0.14583],
  [1.042, 0.27083],
];

/**
 * 너비 w · 높이 h(px) 카드의 방패 외곽선을 viewBox(vbW × vbH) 좌표의 SVG 경로로. 앱 카드는 viewBox 0 0 100 174를
 * 카드 크기로 늘려 그리므로 그 좌표로 돌려준다.
 */
export function cardShieldPath(w: number, h: number, vbW = 100, vbH = 174): string {
  if (!(w > 0) || !(h > 0)) return '';
  const sx = vbW / 100;
  const sy = vbH / h;
  const pt = (x: number, y: number) =>
    `${Math.round(x * sx * 100) / 100} ${Math.round(Math.min(Math.max(y, 0), h) * sy * 100) / 100}`;
  const pts = [...TOP.map(([x, k]) => pt(x, k * w)), ...BOT.map(([x, k]) => pt(x, h - k * w))];
  return `M${pts.join('L')}Z`;
}
