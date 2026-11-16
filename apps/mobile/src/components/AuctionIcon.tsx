// T-11-735 소장품 아이콘(웹 auction/AuctionIcon.svelte) — app-core 선 그림을 등급색으로 그린다.
import Svg, { Path } from 'react-native-svg';

export function AuctionIcon({ d, size = 28, color }: { d: string; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** 등급색: 일반 muted · 고급 r2 · 명품 r3 · 전설 accent. */
export function gradeColor(
  c: { muted: string; r2: string; r3: string; accent: string },
  g: number,
): string {
  return g >= 4 ? c.accent : g === 3 ? c.r3 : g === 2 ? c.r2 : c.muted;
}
