// 펼침 화살표(웹 .iv-chev · .more-chev). 펼쳐지면 위를 본다.
import Svg, { Path } from 'react-native-svg';

export function Chevron({ up, color, size = 20 }: { up: boolean; color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: [{ rotate: up ? '180deg' : '0deg' }] }}
    >
      <Path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
