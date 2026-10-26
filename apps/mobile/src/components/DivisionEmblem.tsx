// T-11-375 디비전 엠블럼(웹 team/DivisionEmblem.svelte와 같은 좌표 · 색, app-core divisionEmblem.ts). 장식이라 접근성에서 숨긴다.
import Svg, { Path } from 'react-native-svg';
import {
  DIVISION_INNER,
  DIVISION_SHIELD,
  DIVISION_VIEWBOX,
  divisionEmblem,
} from '@offside/app-core/divisionEmblem';

export function DivisionEmblem({ division, size = 28 }: { division: number; size?: number }) {
  const e = divisionEmblem(division);
  return (
    <Svg
      viewBox={DIVISION_VIEWBOX}
      width={size}
      height={Math.round((size * 36) / 32)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`division-emblem-${division}`}
    >
      <Path d={DIVISION_SHIELD} fill={e.rim} />
      <Path d={DIVISION_INNER} fill={e.fill} />
      {e.chevrons.map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={e.mark}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {e.star ? <Path d={e.star} fill={e.mark} /> : null}
    </Svg>
  );
}
