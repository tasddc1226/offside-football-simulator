// T-11-330 선수 플레이의 시트(ui/Sheet.tsx)와 같은 모양으로 아래에서 올라오는 창. 선수 시트는 게임 진행(sheetState)에
// 묶여 있어서, 감독 커리어처럼 화면이 직접 내용을 그리는 곳은 이 틀만 쓴다(웹 PopSheet.svelte). 고르거나 다음으로
// 넘어가야 닫히는 창이라 배경 누르기 · Android 뒤로로 닫지 않는다. step이 바뀌면(다음 이벤트 등) 맨 위로 올린다.
import { useEffect, useRef, type ReactNode } from 'react';
import { Keyboard, Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';

export function PopSheet({
  label,
  step = '',
  testID,
  children,
}: {
  label: string;
  step?: string;
  testID?: string;
  children: ReactNode;
}) {
  const { motionOK } = useSnapshot(prefs);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  return (
    <Modal
      visible
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={Keyboard.dismiss}
      onRequestClose={() => {}}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim }}>
        <View
          accessibilityViewIsModal
          accessibilityLabel={label}
          testID={testID}
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
          }}
        >
          <ScrollView
            ref={scroll}
            bounces={false}
            contentContainerStyle={{
              paddingTop: 10,
              paddingHorizontal: 18,
              paddingBottom: 18 + insets.bottom,
              gap: 14,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 5,
                borderRadius: 3,
                backgroundColor: c.line,
                marginTop: 10,
                marginBottom: 2,
              }}
            />
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
