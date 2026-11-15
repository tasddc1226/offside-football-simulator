import type { Translation } from '../core';
import type { EditFileMsgs } from '../ko/editFile';

export const editFile: Translation<EditFileMsgs> = {
  empty: '沒有貼上任何內容。',
  link: '請貼上檔案裡的內容，而不是連結。打開檔案後複製全部內容。',
  cut: '檔案內容中途被截斷了。請從第一個 { 複製到最後一個 }。',
  notFile: '這不是從遊戲匯出的編輯檔內容。請打開匯出的檔案並複製全部內容。',
  wrongNames: '這是賽事・獎項・聯賽名稱檔。請到設定的「更改賽事・獎項名稱與標誌」匯入。',
  wrongClubs: '這是俱樂部名稱・隊徽檔。請到設定的「更改俱樂部名稱・隊徽」匯入。',
  pasteHint: '打開匯出的編輯檔，複製全部內容後貼上。用檔名或連結無法匯入。',
};
