// 누를 수 있는 모든 것의 바탕(웹 T-10-121: 누르는 동안 살짝 들어가고 어두워진다). 동작 줄이기면 들어가지 않는다.
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

export interface PressProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
  /** 누를 때 줄어드는 비율(큰 카드·목록 행은 0.985). */
  scale?: number;
}

export function Press({ style, scale = 0.97, disabled, ...rest }: PressProps) {
  const { motionOK } = useSnapshot(prefs);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        typeof style === 'function' ? style(pressed) : style,
        pressed && !disabled && { opacity: 0.88, ...(motionOK ? { transform: [{ scale }] } : {}) },
      ]}
    />
  );
}
