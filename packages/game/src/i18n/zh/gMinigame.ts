import type { Translation } from '@offside/contracts/i18n';
import type { GMinigameMsgs } from '../ko/gMinigame';

export const gMinigame: Translation<GMinigameMsgs> = {
  tapShot: '射門！',
  tapChip: '挑射！',
  tapDribble: '過人！',
  tapSave: '撲救！',
  zoneWide: '寬',
  zoneMedium: '普通',
  zoneNarrow: '窄',
  timeout: (p) => `時間到。沒有在${p.sec}秒內按下`,
  perfect: '完美時機！',
  good: '時機成功',
  close: '時機差了一點點',
  miss: '錯過了時機',
};
