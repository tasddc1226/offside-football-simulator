import type { Translation } from '../core';
import type { GameMsgs } from '../ko/game';

export const game: Translation<GameMsgs> = {
  menuLabel: '遊戲選單',
  tabSeason: '賽季',
  tabPlayer: '球員',
  tabCareer: '生涯',
  tabTrophy: '獎盃',
  tabHome: '首頁',
  age: (p) => `${p.n}歲`,
  salary: (p) => `年薪 ${p.v}`,
  amateur: '業餘',
  value: (p) => `身價 ${p.v}`,
  focus: (p) => `主力 ${p.names}`,
  injury: (p) => `受傷 ${p.n}場`,
  titleOpen: (p) => `代表稱號 ${p.name}，開啟稱號圖鑑`,
  storageFull: '儲存空間不足，無法儲存進度。請到設定中備份。',
  actEvent: '⚡ 查看事件',
  actMarket: '選擇轉會去向',
  actSeasonEnd: '查看賽季總結',
  actPreseason: '進行季前賽訓練',
  actPlay: (p) => `訓練後進行${p.n}場比賽`,
  prep: (p) => `訓練 ${p.train} · 投資 ${p.invest} · 狀態 ${p.cond}`,
  investNone: '無',
};
