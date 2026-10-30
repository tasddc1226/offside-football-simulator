import type { Translation } from '../core';
import type { ShareMetaMsgs } from '../ko/shareMeta';

export const shareMeta: Translation<ShareMetaMsgs> = {
  title: (p) => `${p.who} · ${p.band}(レジェンド${p.score}点)`,
  description: (p) =>
    `${p.age}歳で引退 · ${p.apps}試合${p.goals}ゴール${p.assists}アシスト · トロフィー${p.trophies}個`,
  club: (p) => ` · 最後の所属 ${p.club}`,
};
