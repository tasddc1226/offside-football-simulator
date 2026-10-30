// 아래에서 올라오는 시트(웹 Sheet.svelte). 선택이 필수인 시트(진행 중·이벤트 대기)는 배경 누르기·끌어 내리기·
// Android 뒤로로 닫히지 않는다. 본문은 SheetBody가 뷰 종류별로 그리고, 버튼은 sheetState.buttons 그대로.
import { PanResponder, Keyboard, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { canDismissSheet } from '@offside/app-core/sheet-controller';
import { sheetLabel, type SheetView } from '@offside/app-core/sheets';
import { appState, prefs, sheetState } from '../store';
import { buzz, dismissSheet } from '../game/host';
import { useColors } from '../theme/useColors';
import { SheetBody } from '../sheets/SheetBody';
import { CoachLayer, Coachmark } from '../components/Coachmark';
import { countTouch } from '../platform/playSignals';
import { Btn } from './Btn';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

export function Sheet() {
  const s = useSnapshot(sheetState);
  const { G } = useSnapshot(appState);
  const { motionOK } = useSnapshot(prefs);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const v = sheetState.view;
  const solid = v?.kind === 'block';
  const dismissible = canDismissSheet(
    { busy: s.busy, view: s.view as SheetView | null },
    G?.pending as Parameters<typeof canDismissSheet>[1],
  );
  const close = () => dismissible && dismissSheet();
  const handlePan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      dismissible && v?.kind === 'market' && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 90) close();
    },
  });
  return (
    <Modal
      visible={s.open}
      transparent
      // 불투명한 막이 시트와 함께 아래에서 밀려 올라오지 않게 중계는 페이드로 연다.
      animationType={!motionOK ? 'none' : solid ? 'fade' : 'slide'}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={Keyboard.dismiss}
      onRequestClose={close}
    >
      {/* 모달은 앱 루트 뷰 밖에 그려져 자동 플레이 탐지 터치를 여기서 따로 센다(T-11-590). */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }} onTouchStart={countTouch}>
        <Pressable
          accessibilityLabel={shellMoreText.close}
          onPress={close}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // T-11-479 구간 진행 중계는 불투명하게 덮는다(뒤 화면에 장면을 고르기 전 결과가 보였다, 웹 .modal-solid).
            // T-11-479b 화면 배경색(밝은 테마는 거의 흰색)이 아니라 scrim과 같은 어두운 색 — 진행할 때마다 하얗게 번쩍였다.
            backgroundColor: solid ? c.scrimSolid : c.scrim,
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
            <View {...handlePan.panHandlers} style={{ minHeight: 24, justifyContent: 'center' }}>
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
            </View>
            {/* 스냅숏이 아니라 원본 뷰를 넘긴다 — 본문(미니게임 등)이 뷰를 고치고, 읽을 때는 각자 useSnapshot으로 구독한다. */}
            {s.view ? (
              <CoachLayer value="sheet">
                <SheetBody v={sheetState.view!} />
              </CoachLayer>
            ) : null}
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
        {/* T-11-473 시트는 다른 창이라 첫 커리어 안내도 시트 안에 따로 둔다. */}
        <Coachmark layer="sheet" />
      </View>
    </Modal>
  );
}
