import type { Translation } from '../core';
import type { ShellMoreMsgs } from '../ko/shellMore';

export const shellMore: Translation<ShellMoreMsgs> = {
  navIntroGame: '這是遊戲選單。點中間的首頁按鈕即可返回。',
  navIntroTeam: '這是我的球隊選單。點中間的老闆按鈕即可返回。',
  back: '← 返回',
  close: '關閉',
  retry: '重試',
  adLabel: '廣告',
  adPreview: (p) => `廣告位 · ${p.place}`,
  updateBodyApp: '新版本已推出。重新啟動即可立即套用。',
  updateBtnApp: '重新啟動',
  storeUpdateTitle: '商店已推出新版本',
  storeUpdateBody: '更新後就能立即獲得新功能與修正。',
  storeUpdateForceBody: '此版本已停止支援。請至商店更新後再繼續。',
  storeUpdateLater: '稍後',
  storeUpdateBtn: '更新',
  keepLoginTitle: '登入保護你的紀錄',
  keepLoginBody: '登入後，在其他裝置上也能查看退役紀錄。分享連結不需登入也能建立。',
  keepLoginGoogle: '使用 Google 登入',
  storeUnavailable: '此裝置無法開啟商店。',
};
