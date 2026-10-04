// 하단 탭바 아이콘(웹 TabIcon.svelte와 같은 선 그림). 색은 color로 받는다(고른 탭 색).
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Tab } from '@offside/app-core/state';

export type TabIconName = Tab | 'home' | 'hof' | 'board' | 'owner' | 'settings' | 'lineup';

export function TabIcon({
  name,
  color,
  size = 20,
}: {
  name: TabIconName;
  color: string;
  size?: number;
}) {
  const p = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'season' ? (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 7.2 15.7 9.8l-1.4 4.4H9.7L8.3 9.8Z" {...p} />
          <Path
            d="M12 3v4.2M12 20.8V17M4.2 9l3.1 1M16.7 10l3.1-1M6.3 17.5l2.4-3.3M15.3 14.2l2.4 3.3"
            {...p}
          />
        </>
      ) : name === 'player' ? (
        <>
          <Circle cx="12" cy="7.2" r="3.2" {...p} />
          <Path d="M4.8 20c.9-3.6 3.8-5.8 7.2-5.8s6.3 2.2 7.2 5.8" {...p} />
        </>
      ) : name === 'career' ? (
        <>
          <Rect x="4.5" y="3.5" width="15" height="17" rx="2" {...p} />
          <Path d="M8.5 3.5v3h7v-3M8 10.5h8M8 14h8M8 17.5h5" {...p} />
        </>
      ) : name === 'home' ? (
        <>
          <Path d="M4 10.5 12 4l8 6.5" {...p} />
          <Path d="M6 9v10.5h4.5V15h3v4.5H18V9" {...p} />
        </>
      ) : name === 'hof' ? (
        <>
          <Path d="m8 3.5 2.6 6.3M16 3.5l-2.6 6.3" {...p} />
          <Circle cx="12" cy="15" r="5.5" {...p} />
          <Path d="m12 12.4.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z" {...p} />
        </>
      ) : name === 'board' ? (
        <>
          <Path d="M4 10v4h3.2L14 18.5v-13L7.2 10Z" {...p} />
          <Path d="M17.5 9.2a4 4 0 0 1 0 5.6M7.5 14.2 9 20h2.5l-1-4.6" {...p} />
        </>
      ) : name === 'owner' ? (
        <>
          <Path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.5-7 9-4.1-1.5-7-4.7-7-9V6Z" {...p} />
          <Circle cx="12" cy="10" r="2.2" {...p} />
          <Path d="M8.7 15.8c.6-1.6 1.8-2.5 3.3-2.5s2.7.9 3.3 2.5" {...p} />
        </>
      ) : name === 'settings' ? (
        <>
          <Circle cx="12" cy="12" r="2.8" {...p} />
          <Path
            d="M10.3 3.5h3.4l.5 2.4 1.7 1 2.3-.8 1.7 2.9-1.8 1.6v2l1.8 1.6-1.7 2.9-2.3-.8-1.7 1-.5 2.4h-3.4l-.5-2.4-1.7-1-2.3.8-1.7-2.9 1.8-1.6v-2L4.1 9l1.7-2.9 2.3.8 1.7-1Z"
            {...p}
          />
        </>
      ) : name === 'lineup' ? (
        <>
          <Rect x="4.5" y="3.5" width="15" height="17" rx="2" {...p} />
          <Path d="M4.5 12h15M9.5 3.5v2.6h5V3.5M9.5 20.5v-2.6h5v2.6" {...p} />
          <Circle cx="12" cy="12" r="2.2" {...p} />
        </>
      ) : (
        <>
          <Path d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5Z" {...p} />
          <Path
            d="M7 5H4.5a1 1 0 0 0-1 1c0 2.6 1.6 4.3 3.6 4.7M17 5h2.5a1 1 0 0 1 1 1c0 2.6-1.6 4.3-3.6 4.7"
            {...p}
          />
          <Path d="M12 13v3.5M9 20.5h6M9.5 20.5c0-1.7.9-2.7 2.5-2.7s2.5 1 2.5 2.7" {...p} />
        </>
      )}
    </Svg>
  );
}
