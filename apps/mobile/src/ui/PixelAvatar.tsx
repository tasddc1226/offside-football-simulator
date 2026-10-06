// T-11-120 도트 선수(24×32칸) 한 명(웹 PixelAvatar.svelte와 같다). 장식 그림이라 화면 읽기에서는 숨긴다.
// width는 24의 정수배로 넘긴다(avatarWidth) — 그래야 칸이 고르게 보인다.
import { memo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import {
  AVATAR_H,
  AVATAR_W,
  avatarPixels,
  avatarRects,
  type AvatarSpec,
} from '@offside/game/avatar';

// spec이 같으면 다시 그리지 않는다(은퇴 리포트는 장면이 올라올 때마다 다시 렌더된다).
export const PixelAvatar = memo(function PixelAvatar({
  spec,
  width,
}: {
  spec: AvatarSpec;
  width: number;
}) {
  const rects = avatarRects(avatarPixels(spec));
  return (
    <Svg
      width={width}
      height={(width / AVATAR_W) * AVATAR_H}
      viewBox={`0 0 ${AVATAR_W} ${AVATAR_H}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {rects.map((r, i) => (
        <Rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
          {...(r.opacity ? { fillOpacity: r.opacity } : {})}
        />
      ))}
    </Svg>
  );
});
