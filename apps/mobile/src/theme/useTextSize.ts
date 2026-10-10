import { useSyncExternalStore } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { getTextSize, onTextSize, TEXT_SIZE_SCALE } from '@offside/app-core/textSize';

export function useTextSize() {
  return useSyncExternalStore(onTextSize, getTextSize, getTextSize);
}

/** Scale the resolved font and line height together; keep device accessibility scaling enabled. */
export function useTextStyle() {
  const scale = TEXT_SIZE_SCALE[useTextSize()];
  return (style: StyleProp<TextStyle>): StyleProp<TextStyle> => {
    const flat = StyleSheet.flatten(style);
    return [
      style,
      {
        ...(flat?.fontSize != null ? { fontSize: flat.fontSize * scale } : {}),
        ...(flat?.lineHeight != null ? { lineHeight: flat.lineHeight * scale } : {}),
        ...(flat?.letterSpacing != null ? { letterSpacing: flat.letterSpacing * scale } : {}),
      },
    ];
  };
}
