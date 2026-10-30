import type { Translation } from '../core';
import type { SheetPlayMsgs } from '../ko/sheetPlay';

export const sheetPlay: Translation<SheetPlayMsgs> = {
  storyTag: (p) => `故事 · ${p.name}`,
  eventResult: (p) => `結果 · ${p.label}`,
  dexNew: '📖 圖鑑新項目',
  dexNote: '可在首頁的機率圖鑑中查看',
  storyEnd: (p) => `故事完結 · ${p.name}`,
  storyStarted: '新故事開始：',
  storyNext: '故事將在下一個階段延續。',
  marketTitle: '下賽季要在哪裡踢球？',
  salary: '年薪',
  marketHint: '點擊卡片即可前往合約。關閉視窗後，邀約仍會保留。',
  offerA11y: (p) =>
    `${p.name}，${p.lg}${p.salary !== null ? `，年薪 ${p.salary}` : ''}${p.sub ? `，${p.sub}` : ''}${p.reason ? `，${p.reason}` : ''}`,
  noHonors: '本賽季沒有獲得獎項。',
  promoTitle: '確定升級 K1聯賽',
  promoBodyWeb: (p) => `本賽季以第 1 名確定${p.club}升級。下賽季將在 K1聯賽出賽。`,
  promoBodyApp: (p) => `本賽季以第 1 名確定${p.club}升級。下賽季將在 K1聯賽出賽。`,
  promoDownWeb: (p) => `讓出席位的${p.club} · 降級 K2聯賽`,
  promoDownApp: (p) => `${p.club} · 降級 K2聯賽`,
  comps: '各賽事成績',
  tours: '國家隊 · 國際賽事',
  gala: '金球獎頒獎典禮',
  miles: '生涯里程碑',
  scoutHint: '球探一句話',
  fans: '球迷反應',
  ageWeb: (p) => `${p.age} 歲了。開始準備下個賽季吧。`,
  ageApp: (p) => `${p.age} 歲了。準備迎接下個賽季。`,
};
