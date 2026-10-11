import type { ReactNode } from 'react';
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
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Btn, Txt } from '../ui';
export function TeamDialog({
  title,
  children,
  close,
  avoidKeyboard = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  avoidKeyboard?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
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
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 18, paddingBottom: 18 + insets.bottom, gap: 14 }}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
