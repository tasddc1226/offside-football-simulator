// 화면 한 장(웹 .wrap): 세로 스크롤 + 좌우 16 여백 + 줄 간격 14. 위는 상태 막대만큼 비우고, 아래는 footer(ActionBar)나
// 화면 밖 탭바가 안전 영역을 맡는다. 스크롤은 scroll.ts에 등록해 진행 액션·뒤로 가기가 옮긴다.
import { createContext, useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/useColors';
import { noteScrollY, noteViewH, registerScroll } from './scroll';

/** 화면 아래에 탭바가 붙어 있다(탭바가 아래 안전 영역을 채운다). 루트·게임 화면이 넣는다. */
export const BarBelow = createContext(false);

export function Screen({
  children,
  footer,
  gap = 14,
  style,
  refreshControl,
  fixed,
}: {
  children: ReactNode;
  /** 화면 아래 고정 버튼 줄(ActionBar). */
  footer?: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  /** 화면을 스크롤하지 않고 한 화면에 맞춘다(채팅처럼 안쪽 목록만 스크롤할 때). 키보드가 오르면 그만큼 줄인다. */
  fixed?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const barBelow = useContext(BarBelow);
  const pad = {
    paddingTop: insets.top,
    paddingHorizontal: 16,
    paddingBottom: 24 + (footer || barBelow ? 0 : insets.bottom),
    gap,
  };
  if (fixed)
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: c.bg }}
      >
        <View style={[{ flex: 1 }, pad, style]}>{children}</View>
        {footer}
      </KeyboardAvoidingView>
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        ref={registerScroll}
        onScroll={(e) => noteScrollY(e.nativeEvent.contentOffset.y)}
        onLayout={(e) => noteViewH(e.nativeEvent.layout.height)}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={refreshControl}
        contentContainerStyle={[pad, style]}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
