// T-11-033 시즌 업적 등급 엠블럼(웹 team/GradeEmblem.svelte · 모양은 app-core/gradeEmblem.ts). 장식이라 접근성 트리에서 숨긴다.
import Svg, { Path } from 'react-native-svg';
import { gradeEmblem } from '@offside/app-core/gradeEmblem';

export function GradeEmblem({ id, size = 20 }: { id: string; size?: number }) {
  const { layers, palette } = gradeEmblem(id);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {layers.map((l, i) => (
        <Path key={i} d={l.d} fill={palette[l.tone]} />
      ))}
    </Svg>
  );
}
