import type { Translation } from '../core';
import type { PlayerNudgeMsgs } from '../ko/playerNudge';

export const playerNudge: Translation<PlayerNudgeMsgs> = {
  readyTitle: '可以嘗試潛力強化了',
  scoutTitle: '本賽季的球探評價出爐了',
  readyText: (p) => `${p.cost} · 成功機率${p.chance}%。失敗的話資金不會退還。`,
  scoutText: '可以在球員分頁查看本賽季的評價。真正的潛力會在退役時公開。',
  aria: '球員分頁說明',
  open: '查看球員分頁',
  closeAria: '關閉球員分頁說明',
  close: '關閉',
  tabHint: '潛力說明',
};
