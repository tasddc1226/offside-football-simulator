import { loadKey, saveKey } from '@offside/game/storage';
const KEY = 'ft_app_conversion_dismissed_until';
export const conversionNotice = $state({ until: 0 });
export function restoreConversionNotice() {
  const value = loadKey<number>(KEY);
  conversionNotice.until = typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
export function dismissConversionNotice() {
  conversionNotice.until = Date.now() + 7 * 24 * 60 * 60 * 1000;
  saveKey(KEY, conversionNotice.until);
}

const SEEN_KEY = 'ft_app_conversion_last_seen';
let seenThisSession = false;
export function homePromptDue() {
  const last = loadKey<number>(SEEN_KEY);
  return (
    !seenThisSession &&
    (typeof last !== 'number' || !Number.isFinite(last) || Date.now() - last >= 24 * 60 * 60 * 1000)
  );
}
export function recordHomePrompt() {
  seenThisSession = true;
  saveKey(SEEN_KEY, Date.now());
}
