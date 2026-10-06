// 시트·게임 화면이 함께 쓰는 작은 조각: 강조 줄(웹 .hl), 숫자 칸(.stats · .tally), 진행 막대(.prog), 색 섞기.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';

/** 웹 color-mix(in srgb, A pct%, B) — #rrggbb 두 색을 섞는다. */
export function mixColor(a: string, b: string, pctA: number): string {
  const p = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  const k = pctA / 100;
  const m = (x: number, y: number) => Math.round(x * k + y * (1 - k));
  return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

/** 연출 시트 아래 '건너뛰기' 밑줄 링크(웹 .link-btn.skip). */
export function SkipLink({ onPress }: { onPress: () => void }) {
  return (
    <Press
      testID="an-skip"
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 2 }}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.75), textDecorationLine: 'underline' }}>
        {sheetCoreText.skip}
      </Txt>
    </Press>
  );
}

/** 강조 한 줄(웹 .hl): 왼쪽에 금색 세로줄. */
export function Hl({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: c.accent }}>
      {typeof children === 'string' ? (
        <Txt style={{ fontSize: rem(0.875) }}>{children}</Txt>
      ) : (
        children
      )}
    </View>
  );
}

export interface StatItem {
  key: string;
  v: ReactNode;
  l: string;
}

/** 숫자 칸 줄(웹 .stats · .tally) — 큰 숫자 + 작은 이름이 칸마다 하나. */
export function StatGrid({
  items,
  mt = 0,
  style,
}: {
  items: readonly StatItem[];
  mt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[{ flexDirection: 'row', gap: 6, marginTop: mt }, style]}>
      {items.map((x) => (
        <View
          key={x.key}
          accessible
          accessibilityLabel={
            typeof x.v === 'string' || typeof x.v === 'number' ? `${x.l} ${x.v}` : x.l
          }
          style={{
            flex: 1,
            backgroundColor: c.surface2,
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 4,
            alignItems: 'center',
          }}
        >
          {typeof x.v === 'string' || typeof x.v === 'number' ? (
            <Txt
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(1.5),
                lineHeight: rem(1.5) * 1.1,
                fontVariant: ['tabular-nums'],
              }}
            >
              {x.v}
            </Txt>
          ) : (
            x.v
          )}
          <Txt tone="muted" style={{ fontSize: rem(0.6875), lineHeight: rem(0.6875) * 1.5 }}>
            {x.l}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * 진행 막대(웹 .prog): progress(0–1)까지 fill(ms) 동안 고르게 차오른다(T-10-123 — 한 단계 길이와 같게 둬 끊김 없이).
 * 막대 색은 pitch2 → accent 그라디언트. 동작 줄이기면 바로 찬다.
 */
export function ProgBar({ progress, fill }: { progress: number; fill: number }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motionOK || fill <= 0) {
      w.setValue(progress);
      return;
    }
    const a = Animated.timing(w, {
      toValue: progress,
      duration: fill,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [progress, fill, motionOK, w]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.line,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      >
        <LinearGradient
          colors={[c.pitch2, c.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
