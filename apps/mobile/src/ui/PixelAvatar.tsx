// T-11-120 도트 선수(24×32칸) 한 명(웹 PixelAvatar.svelte와 같다). 장식 그림이라 화면 읽기에서는 숨긴다.
// width는 24의 정수배로 넘긴다(avatarWidth) — 그래야 칸이 고르게 보인다.
import { memo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import {
  AVATAR_H,
  AVATAR_W,
  AVATAR_PORTRAIT_H,
  avatarPortraitRects,
  avatarPixels,
  avatarRects,
  type AvatarSpec,
} from '@offside/game/avatar';

// spec이 같으면 다시 그리지 않는다(은퇴 리포트는 장면이 올라올 때마다 다시 렌더된다).
export const PixelAvatar = memo(function PixelAvatar({
  spec,
  width,
  portrait = false,
}: {
  spec: AvatarSpec;
  width: number;
  portrait?: boolean;
}) {
  const rects = portrait ? avatarPortraitRects(spec) : avatarRects(avatarPixels(spec));
  const height = portrait ? AVATAR_PORTRAIT_H : AVATAR_H;
  return (
    <Svg
      width={width}
      height={(width / AVATAR_W) * height}
      viewBox={`0 0 ${AVATAR_W} ${height}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {rects.map((r, i) => (
        <Rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={r.fill}
          {...(r.opacity ? { fillOpacity: r.opacity } : {})}
        />
      ))}
    </Svg>
  );
});
