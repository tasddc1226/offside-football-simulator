import Svg, { Path } from 'react-native-svg';
import { CAREER_TROPHY_PATH, type CareerTrophy as Art } from '@offside/app-core/career-trophy';
export function CareerTrophy({
  art,
  color,
  size = 48,
}: {
  art: Art;
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={CAREER_TROPHY_PATH[art]}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
