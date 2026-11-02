import type { Translation } from '../core';
import type { ShareMetaMsgs } from '../ko/shareMeta';

export const shareMeta: Translation<ShareMetaMsgs> = {
  title: (p) => `${p.who} · ${p.band}（傳奇 ${p.score} 分）`,
  description: (p) =>
    `${p.age} 歲退役 · ${p.apps} 場 ${p.goals} 球 ${p.assists} 助攻 · 獎盃 ${p.trophies} 座`,
  club: (p) => ` · 最後效力 ${p.club}`,
  inviteTitle: '朋友邀請你參加 OFFSIDE 球隊對決',
  inviteDescription: (p) => `好友碼 ${p.code} ・開啟連結後會前往好友申請畫面`,
};
