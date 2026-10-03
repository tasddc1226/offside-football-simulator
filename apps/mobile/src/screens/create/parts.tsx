// 선수 생성 화면 안에서만 쓰는 작은 부품 — 입력 칸·격자·두 색 섞기.
import { useState, type ReactNode } from 'react';
import { TextInput, View, type TextStyle } from 'react-native';
import { revealFocusedInput } from '../../ui/scroll';
import { useColors } from '../../theme/useColors';
import { Txt } from '../../ui';

/** 두 #rrggbb 색을 섞는다(웹 color-mix(in srgb, A n%, B)) — a가 w 비율. */
export function mixHex(a: string, b: string, w: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * w + ((pb >> shift) & 255) * (1 - w));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** 라벨 + 내용(웹 .field). */
export function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt tone="muted" style={{ fontSize: 13, fontWeight: '600', lineHeight: 13 * 1.5 }}>
          {label}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

/** 웹 .seg — 같은 폭의 칸 격자(간격 8). 칸은 SegCell로 감싼다. */
export function Seg({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -4 }}>{children}</View>;
}
export function SegCell({
  cols,
  testID,
  children,
}: {
  cols: 2 | 3;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View
      {...(testID ? { testID } : {})}
      style={{ width: cols === 2 ? '50%' : '33.3333%', padding: 4 }}
    >
      {children}
    </View>
  );
}

/** 웹 input[type=text|number] 모양. */
export function useInputStyle(): TextStyle {
  const c = useColors();
  return {
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface2,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    // iOS는 16px보다 작은 입력 칸에 초점이 가면 화면을 확대한다.
    fontSize: 16,
    color: c.ink,
  };
}

/**
 * 키·몸무게 입력 칸. 비워 두면 포지션 기본 체격을 따른다(value=null). 보이는 값은 평소엔 실제 적용되는 값(기본값 포함)이고,
 * 고치는 동안에는 쓰고 있는 글자 그대로라서 다 지워도 기본값이 바로 되살아나지 않는다.
 */
export function BodyInput({
  label,
  unit,
  value,
  fallback,
  onChange,
  invalid,
  testID,
}: {
  label: string;
  unit: string;
  value: number | null;
  fallback: number;
  onChange: (v: number | null) => void;
  invalid: boolean;
  testID: string;
}) {
  const c = useColors();
  const input = useInputStyle();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={invalid ? '입력값을 확인해 주세요' : undefined}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={3}
        placeholder={String(fallback)}
        placeholderTextColor={c.muted}
        value={text ?? String(value ?? fallback)}
        onFocus={() => {
          setText(String(value ?? fallback));
          revealFocusedInput();
        }}
        onBlur={() => setText(null)}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '');
          setText(digits);
          onChange(digits === '' ? null : Math.round(+digits));
        }}
        style={[input, { flex: 1, minWidth: 0 }]}
      />
      <Txt tone="muted" style={{ fontWeight: '600' }} accessibilityElementsHidden>
        {unit}
      </Txt>
    </View>
  );
}
