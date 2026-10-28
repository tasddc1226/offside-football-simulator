import type { Translation } from '../core';
import type { AccountMsgs } from '../ko/account';

export const account: Translation<AccountMsgs> = {
  title: '帳號',
  checking: '確認中…',
  errorTitle: '無法連線',
  errorBody: '無法連線到伺服器，無法確認登入狀態。遊戲可以繼續，進度會儲存在這台裝置。',
  retry: '重試',
  guestTitle: '尚未登入',
  guestBody: '遊戲進度只會儲存在這台裝置。登入後，就能在其他裝置查看球員紀錄與俱樂部名稱。',
  logout: '登出',
  cancel: '取消',
  logoutTitle: '要登出嗎？',
  logoutBodyWeb:
    '這台裝置儲存的遊戲進度會保留。用同一個 Google 帳號重新登入，就能再次查看帳號中儲存的紀錄。',
  logoutBodyApp: '這台裝置儲存的遊戲進度會保留。用同一個帳號重新登入，就能查看儲存的紀錄。',
  nickname: '留言暱稱',
  nicknamePrompt: '設定留言暱稱後，就能在消息留言板留言',
  nicknameFixed: (p) => `${p.nickname} · 營運帳號無法更改`,
  unlinkGoogle: '解除 Google 連結',
  unlinkTitle: '要解除 Google 連結嗎？',
  unlinkBodyOnly:
    '這個帳號將沒有登入方式，會變成未登入狀態。即使在其他裝置用同一個 Google 帳號登入，也無法載入此帳號的球員紀錄與球隊。在這台裝置再次用 Google 登入就會重新連結。這台裝置的遊戲進度會保留。',
  unlinkBodyApple:
    '這個帳號仍可用 Apple 登入繼續使用。即使在其他裝置用同一個 Google 帳號登入，也無法載入此帳號的球員紀錄與球隊。這台裝置的遊戲進度會保留。',
  unlinkConfirm: '解除連結',
  unlinkFail: '無法解除 Google 連結，請稍後再試。',
  deleteAccount: '刪除帳號',
  deleteBody:
    '要刪除帳號以及伺服器上儲存的球員紀錄・球隊・留言・聊天嗎？此操作無法復原。這台裝置的遊戲進度會保留。',
  deleteConfirm: '刪除',
  deleteDone: '已刪除帳號。這台裝置的遊戲進度會保留。',
  deleteFail: '無法刪除帳號，請稍後再試。',
  googleTitle: 'Google 帳號',
  googleVia: '已使用 Google 帳號登入。',
  appleTitle: 'Apple 帳號',
  appleVia: '已使用 Apple 帳號登入。',
  loginGoogle: '使用 Google 登入',
  loginApple: '使用 Apple 登入',
  googleFinishFail: '無法完成 Google 登入，請再試一次。',
  appleStartFail: '無法開始 Apple 登入。',
  appleFinishFail: '無法完成 Apple 登入，請再試一次。',
  viaGoogle: 'Google',
  viaApple: 'Apple',
};
