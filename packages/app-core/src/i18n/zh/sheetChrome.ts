import type { Translation } from '../core';
import type { SheetChromeMsgs } from '../ko/sheetChrome';

export const sheetChrome: Translation<SheetChromeMsgs> = {
  doc: '第四季工作整理_v3',
  tabTitle: (p) => `${p.doc} - 試算表`,
  menus: '檔案|編輯|查看|插入|格式|資料|工具|擴充功能|說明',
  share: '共用',
  me: '我',
  font: '預設...',
  currency: 'NT$',
  sheet: '工作表1',
};
