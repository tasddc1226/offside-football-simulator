// T-11-753 카드 틀 그림(Blender 렌더, packages/app-core/assets/card-frame). 등급마다 위 · 가운데 · 아래 세 조각이고,
// 가운데만 세로로 늘려 카드 높이가 달라도 테두리 · 장식이 찌그러지지 않는다. 주소만 번들에 들어가고 그림은 그 등급 카드가 보일 때 받는다.
const sources = import.meta.glob('../../../../../packages/app-core/assets/card-frame/*.webp', {
  eager: true,
  query: '?no-inline',
  import: 'default',
}) as Record<string, string>;

const url = (name: string) =>
  sources[`../../../../../packages/app-core/assets/card-frame/${name}.webp`];

type Frame = { top: string; mid: string; bot: string };

/** 그 등급 틀의 그림 주소. 모르는 등급이면 골드 틀. */
export function cardFrameUrls(tier: string): Frame {
  const t = url(`${tier}-top`) ? tier : 'gold';
  return { top: url(`${t}-top`)!, mid: url(`${t}-mid`)!, bot: url(`${t}-bot`)! };
}

/** 그 등급 틀의 CSS 변수 값(url(...)). */
export function cardFrameVars(tier: string): Frame {
  const f = cardFrameUrls(tier);
  return { top: `url(${f.top})`, mid: `url(${f.mid})`, bot: `url(${f.bot})` };
}
