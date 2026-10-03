// 설정·구단주 화면이 함께 쓰는 작은 부품(웹 .settings-* · .switch · .field · .link-btn · <select> 자리).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { revealFocusedInput } from '../../ui/scroll';

/** 설정 카드(웹 .card.settings-card: 안쪽 여백 16×18). */
export function SettingsCard({
  children,
  style,
  gap = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return (
    <Card gap={gap} style={[{ paddingVertical: 16 }, style]}>
      {children}
    </Card>
  );
}

/** 눈썹 · 굵은 제목 · 흐린 설명(웹 .settings-label). */
export function SettingsLabel({
  eyebrow,
  title,
  muted,
  titleId,
}: {
  eyebrow?: string;
  title: string;
  muted?: string;
  titleId?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 3 }} testID={titleId}>
      {eyebrow ? (
        <Txt tone="accent" style={{ fontSize: rem(0.6875), lineHeight: rem(0.6875) * 1.5 }}>
          {eyebrow.toUpperCase()}
        </Txt>
      ) : null}
      <Txt style={{ fontSize: rem(1.0625), lineHeight: rem(1.0625) * 1.4, fontWeight: '700' }}>
        {title}
      </Txt>
      {muted ? (
        <Txt tone="muted" style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5 }}>
          {muted}
        </Txt>
      ) : null}
    </View>
  );
}

/** 라벨 왼쪽 + 오른쪽 자리 한 줄(웹 .settings-row). 두 번째 줄부터 위에 구분선. */
export function SettingsRow({ children, first = true }: { children: ReactNode; first?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
        !first && { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line },
      ]}
    >
      {children}
    </View>
  );
}

/** 눌러 여는 줄(웹 .settings-trigger). 오른쪽 화살표 칸. */
export function SettingsTrigger({
  children,
  chev = '›',
  expanded,
  onPress,
  testID,
  label,
}: {
  children: ReactNode;
  chev?: string;
  expanded?: boolean;
  onPress: () => void;
  testID?: string;
  label?: string;
}) {
  const c = useColors();
  return (
    <Press
      scale={0.985}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? {} : { expanded }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 44,
      }}
    >
      {children}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt
          tone="accent"
          accessible={false}
          style={{
            fontSize: rem(0.75),
            lineHeight: rem(0.75) * 1.2,
            transform: [{ rotate: expanded ? '180deg' : '0deg' }],
          }}
        >
          {chev}
        </Txt>
      </View>
    </Press>
  );
}

/** 스위치(웹 .switch 48×28). 동작 줄이기면 미끄러지지 않고 바로 바뀐다. */
export function Switch({
  value,
  onChange,
  label,
  testID,
}: {
  value: boolean;
  onChange: (on: boolean) => void;
  label: string;
  testID?: string;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const x = useRef(new Animated.Value(value ? 20 : 0)).current;
  useEffect(() => {
    if (!motionOK) return x.setValue(value ? 20 : 0);
    Animated.timing(x, { toValue: value ? 20 : 0, duration: 200, useNativeDriver: true }).start();
  }, [value, motionOK, x]);
  return (
    <Press
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      testID={testID}
      scale={0.94}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        backgroundColor: value ? c.good : c.line,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
          transform: [{ translateX: x }],
        }}
      />
    </Press>
  );
}

/** 입력 칸(웹 input[type=text] · textarea). 글자 크기는 iOS 확대를 피하려고 16 이상. */
export function TextField({
  style,
  multiline,
  onFocus,
  ...rest
}: TextInputProps & { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      returnKeyType="done"
      autoCapitalize="none"
      autoCorrect={false}
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
          minHeight: 44,
          ...(multiline ? { textAlignVertical: 'top' as const } : {}),
        },
        style as never,
      ]}
    />
  );
}

/** 라벨 + 입력(웹 .field). */
export function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

/** 밑줄 글자 버튼(웹 .link-btn). 눌리는 자리는 44 이상으로 넓힌다. */
export function LinkBtn({
  children,
  onPress,
  bad,
  testID,
}: {
  children: string;
  onPress: () => void;
  bad?: boolean;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Press
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      style={{ paddingVertical: 6, paddingHorizontal: 2 }}
    >
      <Txt
        style={{
          fontSize: rem(0.75),
          color: bad ? c.bad : c.muted,
          textDecorationLine: 'underline',
        }}
      >
        {children}
      </Txt>
    </Press>
  );
}

export type SelectOption<V extends string | number> = { value: V; label: string };

/** 고르기 칸(웹 <select>): 누르면 아래에서 올라오는 목록. */
export function SelectField<V extends string | number>({
  value,
  options,
  onChange,
  label,
  testID,
  style,
}: {
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (v: V) => void;
  label: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <>
      <Press
        scale={0.985}
        testID={testID}
        accessibilityLabel={`${label}, ${cur?.label ?? ''}`}
        accessibilityHint="눌러서 바꿔요"
        onPress={() => {
          // 리그·시즌을 고르는 동안 이전 입력칸의 키보드가 되살아나지 않게 한다.
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: 44,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 10,
            backgroundColor: c.surface,
          },
          style,
        ]}
      >
        <Txt numberOfLines={1} style={{ flexShrink: 1 }}>
          {cur?.label ?? ''}
        </Txt>
        <Txt tone="muted" accessible={false} style={{ fontSize: rem(0.75) }}>
          ▼
        </Txt>
      </Press>
      <Modal
        visible={open}
        transparent
        animationType={motionOK ? 'slide' : 'none'}
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: c.scrim,
            }}
          />
          <View
            accessibilityViewIsModal
            accessibilityLabel={label}
            style={{
              backgroundColor: c.surface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              maxHeight: '70%',
              paddingTop: 12,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            <Txt
              tone="muted"
              style={{ paddingHorizontal: 18, paddingBottom: 6, fontWeight: '600' }}
            >
              {label}
            </Txt>
            <ScrollView>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Press
                    key={o.value}
                    scale={0.99}
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setOpen(false);
                      if (!on) onChange(o.value);
                    }}
                    style={{
                      minHeight: 48,
                      justifyContent: 'center',
                      paddingHorizontal: 18,
                      backgroundColor: on ? c.surface2 : 'transparent',
                    }}
                  >
                    <Txt style={{ fontWeight: on ? '700' : '400' }}>{o.label}</Txt>
                  </Press>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
