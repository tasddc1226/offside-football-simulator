import type { Translation } from '../core';
import type { SheetChromeMsgs } from '../ko/sheetChrome';

export const sheetChrome: Translation<SheetChromeMsgs> = {
  doc: '第4四半期 業務まとめ_v3',
  tabTitle: (p) => `${p.doc} - スプレッドシート`,
  menus: 'ファイル|編集|表示|挿入|表示形式|データ|ツール|拡張機能|ヘルプ',
  share: '共有',
  me: '自分',
  font: 'デフォルト...',
  currency: '¥',
  sheet: 'シート1',
};
