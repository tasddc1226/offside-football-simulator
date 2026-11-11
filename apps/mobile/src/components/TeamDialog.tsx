import { Toast } from '../ui/Toast';
import { useEffect, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { holdAchCheck } from '@offside/app-core/achDirty';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Btn, Txt } from '../ui';
/** 모달이 닫히는 움직임보다 조금 길게 — 닫히는 중에 다음 모달을 열면 iOS가 띄우지 못한다. */
const DISMISS_MS = 450;

export function TeamDialog({
  title,
  children,
  close,
  avoidKeyboard = false,
  footer,
  overlay,
  pinned,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  avoidKeyboard?: boolean;
  footer?: ReactNode;
  /** 창 전체를 덮는 층(연출용). 모달을 겹치지 않으려고 이 모달 안에 그린다. 눌림을 막지 않게 넘겨야 한다. */
  overlay?: ReactNode;
  /** 스크롤과 상관없이 창 위쪽에 붙여 두는 칸(자동 강화 진행처럼 아래를 눌러 놓고 위를 봐야 할 때). */
  pinned?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
  // 이 창 위에 업적 시트 모달이 겹치면 iOS에서 닫은 뒤 터치가 먹지 않는다. 창이 다 닫힌 뒤 확인한다.
  useEffect(() => {
    const release = holdAchCheck();
    return () => void setTimeout(release, DISMISS_MS);
  }, []);
  return (
    <Modal
      visible
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      onShow={Keyboard.dismiss}
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        enabled={avoidKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          accessibilityLabel={L.close}
          onPress={close}
          style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.surface,
            maxHeight: '90%',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          {pinned ? <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>{pinned}</View> : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 18,
              paddingBottom: footer ? 18 : 18 + insets.bottom,
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Txt v="h2" style={{ flex: 1 }}>
                {title}
              </Txt>
              <Btn sm onPress={close}>
                {L.close}
              </Btn>
            </View>
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                padding: 18,
                paddingBottom: 18 + insets.bottom,
                borderTopWidth: 1,
                borderColor: c.line,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      {overlay}
      {/* 모달은 앱 위 별도 층이라 알림을 이 안에서도 그린다. */}
      <Toast />
    </Modal>
  );
}
