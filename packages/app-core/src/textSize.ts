import { loadKey, saveKey } from '@offside/game/storage';

export const TEXT_SIZES = ['small', 'standard', 'large', 'extraLarge'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 0.9,
  standard: 1,
  large: 1.1,
  extraLarge: 1.2,
};
const KEY = 'ft_text_size';
let current: TextSize | undefined;
const listeners = new Set<() => void>();
export const normalizeTextSize = (value: unknown): TextSize =>
  TEXT_SIZES.includes(value as TextSize) ? (value as TextSize) : 'standard';
// Read after the platform has installed its storage adapter.
export const getTextSize = (): TextSize => (current ??= normalizeTextSize(loadKey(KEY)));
export function setTextSize(value: TextSize) {
  current = normalizeTextSize(value);
  saveKey(KEY, current);
  for (const listener of listeners) listener();
}
export function onTextSize(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
