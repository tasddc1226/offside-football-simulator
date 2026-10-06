// 명예의 전당 1~3위 월계관(웹 Laurel.svelte) + 순위 숫자 배지(웹 .hof-rank). 왼쪽 가지의 잎을 원호를 따라 놓고
// 오른쪽은 좌우 반전해 그린다. 장식이라 스크린 리더에는 숨긴다(순위 숫자는 따로 읽힌다).
import { View } from 'react-native';
import Svg, { Ellipse, G, Circle, Path } from 'react-native-svg';
import { DISPLAY, rem } from '../theme/type';
import { useColors, useIsDark } from '../theme/useColors';
import { Txt } from '../ui/Txt';
import { hofText as L } from '@offside/app-core/i18n/ko/hof';

const CX = 20;
const CY = 21;
const R = 15.5;
const r1 = (n: number) => Math.round(n * 10) / 10;
const leaves = Array.from({ length: 6 }, (_, k) => {
  const deg = 118 + k * 25; // 아래(90°)에서 위쪽으로 왼편 원호를 따라 올라간다.
  const a = (deg * Math.PI) / 180;
  return [
    // 원호 바깥쪽 잎(바깥으로 벌어짐)과 안쪽 잎(안으로 기욺)을 한 쌍으로.
    { x: CX + (R + 1.6) * Math.cos(a), y: CY + (R + 1.6) * Math.sin(a), rot: deg - 30 },
    { x: CX + (R - 1.4) * Math.cos(a), y: CY + (R - 1.4) * Math.sin(a), rot: deg + 30 },
  ];
}).flat();

/** 웹 --medal(잎) · --medal-text(숫자). 라이트/다크 값은 style.css 그대로. */
const MEDAL = {
  gold: { light: ['#d9a21b', '#8a5c0a'], dark: ['#f0b437', '#f5c45a'] },
  silver: { light: ['#a7b1ba', '#56616b'], dark: ['#bfc8d0', '#d5dce2'] },
  bronze: { light: ['#c27a3e', '#8a4a1a'], dark: ['#d98a4e', '#e8a270'] },
} as const;
export type MedalName = keyof typeof MEDAL;
export const MEDAL_NAMES: readonly MedalName[] = ['gold', 'silver', 'bronze'];
/** 옅은 메달 빛(행 배경)은 라이트·다크 같은 색(#d9a21b·#a7b1ba·#c27a3e)이다. */
export const MEDAL_GLOW: Record<MedalName, string> = {
  gold: '#d9a21b',
  silver: '#a7b1ba',
  bronze: '#c27a3e',
};

export function useMedal(name: MedalName): { leaf: string; text: string } {
  const dark = useIsDark();
  const [leaf, text] = MEDAL[name][dark ? 'dark' : 'light'];
  return { leaf, text };
}

/** #rrggbb 두 색을 t(0~1) 비율로 섞는다 — 웹 color-mix(in srgb, A 72%, B). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [x, y] = [p(a), p(b)];
  const c = (i: 0 | 1 | 2) => Math.round(x[i] * t + y[i] * (1 - t));
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

export function Laurel({ medal }: { medal: MedalName }) {
  const c = useColors();
  const { leaf } = useMedal(medal);
  const inner = mix(leaf, c.ink, 0.72);
  return (
    <Svg
      viewBox="0 0 40 40"
      width="100%"
      height="100%"
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[false, true].map((mirror) => (
        <G
          key={String(mirror)}
          {...(mirror ? { transform: `translate(${2 * CX} 0) scale(-1 1)` } : {})}
        >
          <Path
            d={`M ${CX - 4} ${CY + R - 0.5} A ${R} ${R} 0 0 1 ${CX - R + 1} ${CY - 9}`}
            fill="none"
            stroke={leaf}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.7}
          />
          {leaves.map((l, i) => (
            <Ellipse
              key={i}
              cx={r1(l.x)}
              cy={r1(l.y)}
              rx={1.6}
              ry={3.8}
              transform={`rotate(${l.rot} ${r1(l.x)} ${r1(l.y)})`}
              fill={i % 2 ? inner : leaf}
            />
          ))}
        </G>
      ))}
      <Circle cx={CX} cy={CY + R - 0.5} r={1.6} fill={leaf} />
    </Svg>
  );
}

/**
 * 순위 숫자 칸(웹 .hof-rank). rank는 1부터 — 1~3위는 금·은·동 월계관을 두르고, 나머지는 금색 숫자.
 * width는 줄에서 차지하는 칸 폭 — 웹의 40px(모바일 기록실 줄은 34px, 월계관은 40px로 그려 오른쪽으로 넘친다).
 */
export function RankBadge({ rank, width = 40 }: { rank: number; width?: number }) {
  const c = useColors();
  const medalName = MEDAL_NAMES[rank - 1];
  const { text } = useMedal(medalName ?? 'gold');
  if (medalName)
    return (
      <View
        style={{
          width: 40,
          height: 40,
          marginRight: width - 40,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessible
        accessibilityLabel={L.rankN({ rank })}
      >
        <Laurel medal={medalName} />
        <Txt
          accessibilityElementsHidden
          style={{
            fontFamily: DISPLAY[700],
            fontVariant: ['tabular-nums'],
            fontSize: rem(1.0625),
            lineHeight: rem(1.0625),
            fontWeight: '700',
            color: text,
          }}
        >
          {rank}
        </Txt>
      </View>
    );
  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <Txt
        accessibilityLabel={L.rankN({ rank })}
        style={{
          fontFamily: DISPLAY[700],
          fontVariant: ['tabular-nums'],
          fontSize: rem(1.375),
          lineHeight: rem(1.375) * 1.2,
          color: c.accentText,
          textAlign: 'center',
        }}
      >
        {rank}
      </Txt>
    </View>
  );
}
