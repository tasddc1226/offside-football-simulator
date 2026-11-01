import type { Translation } from '../core';
import type { SheetChromeMsgs } from '../ko/sheetChrome';

export const sheetChrome: Translation<SheetChromeMsgs> = {
  doc: 'Q4 work summary_v3',
  tabTitle: (p) => `${p.doc} - Spreadsheet`,
  menus: 'File|Edit|View|Insert|Format|Data|Tools|Extensions|Help',
  share: 'Share',
  me: 'Me',
  font: 'Default...',
  currency: '$',
  sheet: 'Sheet1',
};
