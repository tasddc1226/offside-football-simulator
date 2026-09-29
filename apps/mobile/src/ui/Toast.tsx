// 토스트(웹 Toast.svelte · .toast): 화면 아래 가운데 잉크색 알약, 2.2초.
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { toastState } from '../store';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Txt } from './Txt';

export function Toast({ lift = 0 }: { lift?: number }) {
  const t = useSnapshot(toastState);
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!t.visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24 + insets.bottom + lift,
        alignItems: 'center',
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: c.ink,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}
      >
        <Txt style={{ color: c.bg, fontSize: rem(0.875), textAlign: 'center' }}>{t.text}</Txt>
      </View>
    </View>
  );
}
