// 밸런스 편집 화면의 입력 부품 — 숫자 입력 칸(웹 input[type=number])과 고르기 칸(웹 <select>).
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { alpha } from '../../../theme/colors';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Press } from '../../../ui/Press';
import { Txt } from '../../../ui/Txt';
import { TextBox } from '../../board/parts';

/**
 * 숫자 입력 칸. 웹은 칸을 벗어날 때(change) 값을 확정하지만 앱은 키보드가 열린 채 저장 버튼을 누를 수 있어, 칸에 쓰는 대로 바로
 * 넘긴다(onCommit). 초점이 있는 동안엔 쓰는 글자를 그대로 두고, 벗어나면 확정된(끝값·단위로 맞춘) 값을 다시 보인다.
 */
export function NumberBox({
  value,
  onCommit,
  editable,
  testID,
  accessibilityLabel,
  negative,
  width = 96,
}: {
  value: number;
  onCommit: (raw: string) => void;
  editable: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** 음수를 쓸 수 있는 범위(숫자 키패드에 −가 있어야 한다). */
  negative?: boolean;
  width?: number;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <TextBox
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      keyboardType={negative ? 'numbers-and-punctuation' : 'decimal-pad'}
      returnKeyType="done"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(String(value));
      }}
      onChangeText={(t) => {
        setText(t);
        onCommit(t);
      }}
      style={{ width, paddingVertical: 8, opacity: editable ? 1 : 0.6 }}
    />
  );
}

/** 고르기 칸(웹 <select>) — 누르면 목록이 뜬다. value ''는 아무것도 안 고른 상태(placeholder). */
export function PickerField({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  accessibilityLabel,
  testID,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.value === value);
  return (
    <>
      <Press
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="눌러서 고르기"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 46,
          justifyContent: 'center',
          paddingVertical: 11,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 10,
          backgroundColor: c.surface2,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Txt numberOfLines={1} style={{ fontSize: 16, color: picked ? c.ink : c.muted }}>
          {picked ? picked.label : placeholder}
        </Txt>
      </Press>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Press
          accessibilityLabel="닫기"
          onPress={() => setOpen(false)}
          scale={1}
          style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}
        >
          <View
            // 안쪽을 눌러도 닫히지 않게 눌림을 삼킨다.
            onStartShouldSetResponder={() => true}
            style={{
              maxHeight: '70%',
              backgroundColor: c.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingTop: 8,
              paddingBottom: 20,
            }}
          >
            <Txt bold style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              {accessibilityLabel}
            </Txt>
            <FlatList
              data={[{ value: '', label: placeholder }, ...options]}
              keyExtractor={(o) => o.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Press
                  scale={1}
                  accessibilityState={{ selected: item.value === value }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    backgroundColor: item.value === value ? alpha(c.accent, 0.14) : 'transparent',
                  }}
                >
                  <Txt
                    style={{
                      fontSize: rem(0.9375),
                      color: item.value === '' ? c.muted : c.ink,
                      fontWeight: item.value === value ? '700' : '400',
                    }}
                  >
                    {item.label}
                  </Txt>
                </Press>
              )}
            />
          </View>
        </Press>
      </Modal>
    </>
  );
}
