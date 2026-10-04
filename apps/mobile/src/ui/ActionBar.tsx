// 화면 아래 고정 버튼 줄(웹 ActionBar.svelte). 탭바가 아래 있으면 그 위에, 없으면 안전 영역까지 채운다.
import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { Btn } from './Btn';
import { BarBelow } from './Screen';
import { goBack } from '../game/nav';

export function ActionBar({ children, row }: { children: ReactNode; row?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const barBelow = useContext(BarBelow);
  return (
    <View
      style={{
        backgroundColor: alpha(c.bg, 0.97),
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 10 + (barBelow ? 0 : insets.bottom),
        gap: 8,
        flexDirection: row ? 'row' : 'column',
      }}
    >
      {children}
    </View>
  );
}

/** '← 이전으로'(웹 BackBar.svelte): 이전 기록이 있으면 되살리고, 없으면 fallback. */
export function BackBar({ fallback, testID }: { fallback: () => void; testID?: string }) {
  return (
    <ActionBar>
      <Btn block onPress={() => goBack(fallback)} {...(testID ? { testID } : {})}>
        ← 이전으로
      </Btn>
    </ActionBar>
  );
}
