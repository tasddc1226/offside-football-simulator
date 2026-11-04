// 화면 한 장(웹 .wrap): 세로 스크롤 + 좌우 16 여백 + 줄 간격 14. 위는 상태 막대만큼 비우고, 아래는 footer(ActionBar)나
// 탭바가 안전 영역을 맡는다. 탭바가 있으면 화면 위에 떠 있어 그 높이만큼 아래를 비운다(navBar.ts). 스크롤은 scroll.ts에 등록해 진행 액션·뒤로 가기가 옮긴다.
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/useColors';
import { dropScrollBack, noteContentH, noteScrollY, noteViewH, revealFocusedInput } from './scroll';
import { BarBelow, noteBarScroll, showBar, useBarFollow, useBarInset } from './navBar';
import { useFormKeyboardScroll } from './useFormKeyboardScroll';
import { useRefreshControl } from './refresh';

export { BarBelow };

export function Screen({
  children,
  footer,
  gap = 14,
  style,
  refreshControl,
  fixed,
  scrollEnabled = true,
}: {
  children: ReactNode;
  /** 화면 아래 고정 버튼 줄(ActionBar). */
  footer?: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  /** 화면을 스크롤하지 않고 한 화면에 맞춘다(채팅처럼 안쪽 목록만 스크롤할 때). 키보드가 오르면 그만큼 줄인다. */
  fixed?: boolean;
  scrollEnabled?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const barBelow = useContext(BarBelow);
  const barInset = useBarInset();
  const [footerH, setFooterH] = useState(0);
  const overlayH = barInset + (footer ? footerH : 0);
  const size = useRef({ view: 0, content: 0 });
  useEffect(() => {
    if (!barBelow) return;
    showBar();
    return showBar;
  }, [barBelow]);
  useEffect(() => {
    if (size.current.view) noteViewH(size.current.view - overlayH);
  }, [overlayH]);
  const footerSlide = useBarFollow();
  const keyboardScroll = useFormKeyboardScroll();
  // T-11-111 이 화면에 useRefresh로 불러오는 컴포넌트가 있으면 당겨서 새로고침(화면이 따로 넘긴 것이 먼저).
  const pull = useRefreshControl(!fixed && !refreshControl);
  const pad = {
    paddingTop: insets.top,
    paddingHorizontal: 16,
    paddingBottom:
      24 +
      (footer || barBelow ? 0 : insets.bottom) +
      keyboardScroll.bottomInset +
      (fixed ? 0 : overlayH),
    gap,
  };
  if (fixed)
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: c.bg, marginBottom: barInset }}
      >
        <View style={[{ flex: 1 }, pad, style]}>{children}</View>
        {footer}
      </KeyboardAvoidingView>
    );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: Platform.OS === 'ios' ? insets.top : 0,
      }}
    >
      <ScrollView
        ref={keyboardScroll.ref}
        scrollEnabled={scrollEnabled}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          noteScrollY(y);
          if (barBelow) noteBarScroll(y, size.current.content - size.current.view);
        }}
        onLayout={(e) => {
          size.current.view = e.nativeEvent.layout.height;
          noteViewH(size.current.view - overlayH);
          keyboardScroll.onLayout();
        }}
        onContentSizeChange={(_w, contentH) => {
          revealFocusedInput();
          size.current.content = contentH;
          noteContentH(contentH);
        }}
        onScrollBeginDrag={dropScrollBack}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={refreshControl ?? pull}
        contentContainerStyle={[pad, Platform.OS === 'ios' && { paddingTop: 0 }, style]}
      >
        {children}
      </ScrollView>
      {/* 안드로이드는 상태 막대가 투명이라 스크롤한 글이 시계 뒤로 비친다 — 그 자리를 배경색으로 덮는다(iOS는 위 패딩이 맡는다). */}
      {Platform.OS === 'android' && insets.top > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: c.bg,
          }}
        />
      ) : null}
      {footer && barBelow ? (
        <Reanimated.View
          onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
          style={[
            { position: 'absolute', left: 0, right: 0, bottom: barInset, backgroundColor: c.bg },
            footerSlide,
          ]}
        >
          {footer}
          {/* 메뉴가 내려가면 버튼 줄은 안전 영역 위에 멈춘다. 그 아래로 글이 비치지 않게 덮는다. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              height: insets.bottom,
              backgroundColor: c.bg,
            }}
          />
        </Reanimated.View>
      ) : (
        footer
      )}
    </View>
  );
}
