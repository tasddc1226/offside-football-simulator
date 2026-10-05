// 아래에서 올라오는 시트(웹 Sheet.svelte). 선택이 필수인 시트(진행 중·이벤트 대기)는 배경 누르기·끌어 내리기·
// Android 뒤로로 닫히지 않는다. 본문은 SheetBody가 뷰 종류별로 그리고, 버튼은 sheetState.buttons 그대로.
import { Keyboard, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { sheetLabel, type SheetView } from '@offside/app-core/sheets';
import { appState, prefs, sheetState } from '../store';
import { buzz, dismissSheet } from '../game/host';
import { useColors } from '../theme/useColors';
import { SheetBody } from '../sheets/SheetBody';
import { Btn } from './Btn';

export function Sheet() {
  const s = useSnapshot(sheetState);
  const { G } = useSnapshot(appState);
  const { motionOK } = useSnapshot(prefs);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const dismissible = !s.busy && !G?.pending;
  const close = () => dismissible && dismissSheet();
  return (
    <Modal
      visible={s.open}
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={Keyboard.dismiss}
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="닫기"
          onPress={close}
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
          accessibilityLabel={s.view ? sheetLabel(s.view as SheetView) : undefined}
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
          }}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
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
                marginBottom: 2,
              }}
            />
            {/* 스냅숏이 아니라 원본 뷰를 넘긴다 — 본문(미니게임 등)이 뷰를 고치고, 읽을 때는 각자 useSnapshot으로 구독한다. */}
            {s.view ? <SheetBody v={sheetState.view!} /> : null}
            {s.buttons.map((b, i) => (
              <Btn
                key={i}
                block
                cls={b.cls}
                testID={`sheet-${i}`}
                onPress={() => {
                  buzz();
                  sheetState.buttons[i]?.fn();
                }}
              >
                {b.label}
              </Btn>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
