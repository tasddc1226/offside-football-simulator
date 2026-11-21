import type { Translation } from '../core';
import type { VoiceMsgs } from '../ko/voice';

export const voice: Translation<VoiceMsgs> = {
  entry: '意見回饋',
  homeTitle: '意見回饋',
  title: '意見回饋',
  homeSub: '把不方便的地方和希望改進的事直接告訴營運團隊。',
  lead: '請簡短寫下不方便的地方或希望的改進。營運團隊會親自閱讀。',
  kindLabel: '類型（可不選）',
  kindBug: '錯誤・不便',
  kindIdea: '建議',
  kindOther: '其他',
  bodyLabel: '意見內容',
  placeholder: '請寫下想說的話。',
  placeholderBug: '請寫下在哪個畫面、做了什麼時發生。',
  placeholderIdea: '請寫下希望新增的功能或想改變的地方。',
  count: (p) => `${p.n}/${p.max} 字`,
  noteReply: '只有營運團隊會閱讀，這裡無法回覆。需要回覆時，請寄信到 contact@offside-lab.com。',
  noteContext:
    '會一併送出 App 版本、裝置類型（網頁・iOS・Android 與系統版本）和顯示語言。請不要寫電子郵件地址或電話號碼。',
  privacy: '隱私權政策',
  submit: '送出',
  busy: '送出中…',
  close: '關閉',
  empty: '請先寫下內容。',
  short: '請至少寫 2 個字。',
  fail: '無法送出。寫好的內容還在，請稍後再按一次。',
  doneTitle: '已收到',
  doneBody: '謝謝你的意見。營運團隊會閱讀，並在規劃更新時參考。',
};
