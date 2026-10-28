import type { Translation } from '../core';
import type { OwnerPlayersMsgs } from '../ko/ownerPlayers';

export const ownerPlayers: Translation<OwnerPlayersMsgs> = {
  entryLead: '管理持有球員，並查看各賽季的培養紀錄。',
  openPlayers: '開啟球員管理',
  menu: '球員管理選單',
  records: '球員紀錄',
  manage: '持有球員',
  viewRecord: '查看紀錄',
  noOwned: '這個賽季沒有持有的球員。培養紀錄可以在球員紀錄中查看。',
  retry: '重試',
  pickLimit: '全選（最多50名）',
  title: '球員管理',
  loading: '載入中…',
  sourceAccount: '這些是記錄在帳號中的球員，在其他裝置上也會顯示一樣的內容。',
  sourceOffline: '無法連線到伺服器，目前顯示的是儲存在此裝置上的球員。',
  sourceDeviceWeb: '這些是儲存在此裝置上的球員。連結 Google 帳號後，就能集中在帳號中查看。',
  sourceDeviceApp: '這些是儲存在此裝置上的球員。登入後，就能集中在帳號中查看。',
  seasonGroup: '賽季',
  tagPublic: '公開',
  openRecord: (p) => `開啟${p.name}的球員紀錄`,
  showAll: (p) => `查看全部（${p.n}名）`,
};
