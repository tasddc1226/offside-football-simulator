import type { Dict } from '../core';

export const gameCenter: Dict = {
  title: 'Game Center',
  body: '將這位經營者的退役紀錄傳送至此裝置的Game Center帳號。',
  connect: '連接Game Center',
  busy: 'Game Center處理中…',
  leaderboard: '排行榜',
  achievements: '成就',
  disconnect: '中斷連接',
  disconnectHint: '中斷連接後，已傳送的紀錄仍會保留在Game Center。',
  retry: '重新連接',
  synced: '退役紀錄已同步至Game Center。',
  empty: '目前沒有可同步的退役紀錄。',
  signIn: '無法登入Game Center。請在裝置設定中確認登入狀態。',
  sync: '無法傳送紀錄。請確認連線後再試一次。',
  changed: '帳號已變更，因此已停止傳送。請使用要連接的帳號重新連接。',
  connected: (p: { name: string }) => `已連接至${p.name}。`,
};
