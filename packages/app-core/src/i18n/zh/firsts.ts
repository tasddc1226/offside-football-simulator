import type { Translation } from '../core';
import type { FirstsMsgs } from '../ko/firsts';

export const firsts: Translation<FirstsMsgs> = {
  title: '伺服器首次成就',
  introRecords: (p) =>
    `${p.records ? '這是所有玩家中最高的紀錄。出現更高的紀錄時，紀錄保持者就會換人。' : '在所有玩家中，只會留下第一個創下的紀錄。'}只有在名人堂公開名字的球員才會顯示名字。`,
  seasonLabel: '賽季',
  tabsLabel: '紀錄分類',
  loadFailed: '無法載入伺服器首次紀錄，請稍後再試。',
  loading: '載入中…',
  empty: '還沒有伺服器首次紀錄。',
  noRecord: '尚無紀錄',
  locked: '未達成',
  mine: '我的球員',
  steps: (p) => `${p.done}/${p.total}階段`,
  next: (p) => `下一個目標：${p.label}`,
  allDone: '已達成最後階段',
  showSteps: '查看所有階段',
  hideSteps: '收起階段',
  burst: (p) => `${p.n}階段`,
  topTitle: '創下最多紀錄的球員',
  topCount: (p) => `${p.n}個`,
};
