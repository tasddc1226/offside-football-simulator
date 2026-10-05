// T-11-005 기록실·소식·운영 도구가 함께 쓰는 작은 부품 — 입력 칸(웹 input·textarea·.field), 두 칸·세 칸 선택 줄(.seg),
// 가로 칩 줄(.hof-sorts), 확인 창(웹 confirm). 키트에 없는 것만 여기 둔다.
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Opt } from '../../ui/bits';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { revealFocusedInput } from '../../ui/scroll';
import { boardText as L } from '@offside/app-core/i18n/ko/board';

/** 입력 칸(웹 input[type=text] · textarea) — 16px 글자(iOS가 작은 칸에 초점이 가면 확대한다), surface-2 바탕. */
export function TextBox({ style, multiline, onFocus, ...rest }: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      multiline={multiline}
      {...rest}
      onFocus={(e) => {
        onFocus?.(e);
        revealFocusedInput();
      }}
      style={[
        {
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface2,
          borderRadius: 10,
          paddingVertical: 11,
          paddingHorizontal: 12,
          fontSize: 16,
          color: c.ink,
          minHeight: multiline ? 96 : 46,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

/** 라벨 + 입력(웹 .field). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

/** n칸 선택 줄(웹 .seg + grid-template-columns). 마지막 줄이 모자라면 빈 칸으로 폭을 맞춘다. */
export function Seg({
  cols,
  gap = 8,
  children,
  style,
  label,
}: {
  cols: number;
  gap?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((child, i) => (
            <View key={i} style={{ flex: 1 }}>
              {child}
            </View>
          ))}
          {Array.from({ length: cols - row.length }, (_, k) => (
            <View key={`pad${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export interface ChipItem {
  key: string;
  label: string;
  /** 라벨 옆 'NEW' 표시. */
  isNew?: boolean;
}

/**
 * 순위 유형 칩 줄(웹 .hof-sorts · .hof-sort). 모바일은 한 줄 가로 스크롤 — 고른 칩이 보이게 가운데로 밀고, 양끝을
 * 흐려 더 있음을 알린다. fade는 줄이 놓인 바탕(카드) 색.
 */
export function SortChips({
  items,
  value,
  onPick,
  testIDPrefix,
  label,
  bleed = 12,
  bg,
}: {
  items: readonly ChipItem[];
  value: string;
  onPick: (key: string) => void;
  testIDPrefix: string;
  label: string;
  /** 카드 안쪽 여백만큼 바깥으로 뻗어 끝까지 스크롤된다(웹 margin-inline:-12px). */
  bleed?: number;
  /** 흐림 색(기본 카드 surface). */
  bg?: string;
}) {
  const c = useColors();
  const fade = bg ?? c.surface;
  const ref = useRef<ScrollView>(null);
  const [box, setBox] = useState(0);
  const xs = useRef<Record<string, { x: number; w: number }>>({});
  const center = (animated: boolean) => {
    const it = xs.current[value];
    if (it && box) ref.current?.scrollTo({ x: Math.max(0, it.x - (box - it.w) / 2), animated });
  };
  // 유형이 바뀌면 고른 칩이 가운데로(상세에서 돌아와도).
  useEffect(() => center(false), [value, box]);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ marginHorizontal: -bleed, marginTop: 10, marginBottom: 6 }}
      onLayout={(e: LayoutChangeEvent) => setBox(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: bleed, paddingVertical: 2 }}
      >
        {items.map((it) => {
          const on = it.key === value;
          return (
            <Press
              key={it.key}
              scale={0.96}
              testID={`${testIDPrefix}-${it.key}`}
              accessibilityState={{ selected: on }}
              onPress={() => onPick(it.key)}
              onLayout={(e) => {
                xs.current[it.key] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
                if (on) center(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 34,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: on ? c.ink : c.surface2,
                borderWidth: 1,
                borderColor: on ? c.ink : c.line,
              }}
            >
              <Txt
                style={{
                  fontSize: rem(0.8125),
                  lineHeight: rem(0.8125) * 1.4,
                  fontWeight: '600',
                  color: on ? c.surface : c.ink,
                }}
              >
                {it.label}
              </Txt>
              {it.isNew ? (
                <View
                  accessibilityElementsHidden
                  style={{
                    marginLeft: 4,
                    paddingVertical: 1,
                    paddingHorizontal: 5,
                    borderRadius: 999,
                    backgroundColor: c.accent,
                  }}
                >
                  <Txt
                    style={{
                      fontSize: rem(0.5625),
                      lineHeight: rem(0.5625) * 1.3,
                      fontWeight: '800',
                      letterSpacing: 0.04 * rem(0.5625),
                      color: c.accentInk,
                    }}
                  >
                    NEW
                  </Txt>
                </View>
              ) : null}
            </Press>
          );
        })}
      </ScrollView>
      <LinearGradient
        pointerEvents="none"
        colors={[fade, alpha(fade, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: bleed }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(fade, 0), fade]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 28 }}
      />
    </View>
  );
}

/** 웹 confirm() — 확인/취소 창. 취소·바깥 탭은 false. */
export function confirmAsync(title: string, message?: string, ok = L.confirm): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: L.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: ok, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** 웹 grid-template-columns: repeat(auto-fill, minmax(min, 1fr)) — 폭을 재서 칸 수를 정하고 남는 폭을 나눠 갖는다. */
export function AutoGrid({
  min,
  gap = 8,
  items,
  style,
}: {
  min: number;
  gap?: number;
  items: readonly ReactNode[];
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const cols = Math.max(1, Math.floor((w + gap) / (min + gap)));
  const cell = (w - gap * (cols - 1)) / cols;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}
    >
      {w > 0
        ? items.map((it, i) => (
            <View key={i} style={{ width: cell }}>
              {it}
            </View>
          ))
        : null}
    </View>
  );
}

/**
 * 탭처럼 쓰는 선택 버튼(웹 .opt + aria-pressed + data-*). 키트 Opt에는 testID가 없어 바깥 View에 붙인다 —
 * 가운데 정렬·44px 높이는 웹 .board-tabs .opt와 같다.
 */
export function TabOpt({
  title,
  selected,
  onPress,
  testID,
  tight,
  fit,
  children,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  /** 좌우 여백을 줄인다(칸이 좁은 탭). */
  tight?: boolean;
  /** T-11-028 글자를 작게(웹 .hof-tabs .opt 0.8125rem). */
  fit?: boolean;
  children?: ReactNode;
}) {
  return (
    <View testID={testID}>
      <Opt
        accessibilityLabel={title}
        selected={selected}
        onPress={onPress}
        style={{
          alignItems: 'center',
          ...(tight || fit ? { paddingHorizontal: 4, paddingVertical: 8 } : null),
        }}
      >
        {/* T-11-038 한 줄 고정, 확대 1.3배까지 — 그래도 칸보다 길면 글자가 줄어든다. */}
        <Txt
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{ fontWeight: '600', ...(fit ? { fontSize: rem(0.8125) } : null) }}
        >
          {title}
        </Txt>
        {children}
      </Opt>
    </View>
  );
}
