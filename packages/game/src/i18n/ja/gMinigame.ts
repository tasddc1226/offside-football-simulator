import type { Translation } from '@offside/contracts/i18n';
import type { GMinigameMsgs } from '../ko/gMinigame';

export const gMinigame: Translation<GMinigameMsgs> = {
  tapShot: 'シュート！',
  tapChip: 'チップ！',
  tapDribble: '抜く！',
  tapSave: 'ダイブ！',
  zoneWide: '広い',
  zoneMedium: '普通',
  zoneNarrow: '狭い',
  timeout: (p) => `時間切れ。${p.sec}秒以内にタップしませんでした`,
  perfect: '完璧なタイミング！',
  good: 'タイミング成功',
  close: '惜しくもタイミングがずれた',
  miss: 'タイミングを逃しました',
};
