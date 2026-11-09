import type { Translation } from '../core';
import type { CompIconsMsgs } from '../ko/compIcons';

export const compIcons: Translation<CompIconsMsgs> = {
  sheetTitle: (p) => `${p.name} 標誌`,
  intro: '可以把標誌換成自己選的圖片。只儲存在這台裝置，分享圖片與其他人的畫面仍顯示預設標誌。',
  where: '在設定 → 更改賽事・獎項名稱與標誌，可以一次看到所有聯賽與賽事標誌。',
  pick: '選擇圖片',
  reset: '改回預設標誌',
  close: '關閉',
  logoLabel: (p) => `更換 ${p.name} 標誌`,
  hint: '聯賽與賽事有標誌了。點一下標誌就能換成自己的圖片。',
  hintClose: '知道了',
  custom: '我的圖片',
  saved: '已更換標誌',
  restored: '已改回預設標誌',
  big: '無法縮小這張圖片，請選擇較簡單的圖片',
  tooLarge: '請選擇小於 10MB 的圖片',
  readFail: '無法讀取圖片',
  full: '沒有空間再儲存標誌圖片。請把不用的標誌改回預設',
  noSpace: '儲存空間不足，無法儲存',
  changed: (p) => `已更換 ${p.n} 個標誌`,
  imported: (p) => `已載入 ${p.n} 個標誌`,
};
