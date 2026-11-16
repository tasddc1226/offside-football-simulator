import type { Dict } from '../core';

export const gameCenter: Dict = {
  playTitle: 'Google Play Games',
  playBody: 'このオーナーの引退記録を、この端末のGoogle Play Gamesアカウントに送信します。',
  playConnect: 'Google Play Gamesに接続',
  playBusy: 'Google Play Gamesで処理中…',
  playDisconnectHint: '接続を解除しても、送信済みの記録はGoogle Play Gamesに残ります。',
  playSynced: '引退記録をGoogle Play Gamesに反映しました。',
  playSignIn:
    'Google Play Gamesにサインインできませんでした。Play Gamesのアカウント設定を確認してください。',
  weekly: '今週のランキング',
  title: 'Game Center',
  body: 'このオーナーの引退記録を、この端末のGame Centerアカウントに送信します。',
  connect: 'Game Centerに接続',
  busy: 'Game Centerで処理中…',
  leaderboard: 'ランキング',
  achievements: '達成項目',
  disconnect: '接続を解除',
  disconnectHint: '接続を解除しても、送信済みの記録はGame Centerに残ります。',
  retry: '再接続',
  synced: '引退記録をGame Centerに反映しました。',
  empty: '反映できる引退記録はまだありません。',
  signIn: 'Game Centerにサインインできませんでした。端末の設定でサインイン状態を確認してください。',
  sync: '記録を送信できませんでした。接続を確認して、もう一度お試しください。',
  changed: 'アカウントが変わったため、送信を停止しました。使用するアカウントで再接続してください。',
  connected: (p: { name: string }) => `${p.name}に接続しています。`,
};
