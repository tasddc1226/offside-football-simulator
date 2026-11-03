import Svg, { Path } from 'react-native-svg';

/** 공유 아이콘(웹 그라운드 공유 버튼과 같은 모양). */
export function ShareIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" accessible={false}>
      <Path
        d="M10 13V2m-4 4 4-4 4 4M5 9H3v8h14V9h-2"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}
