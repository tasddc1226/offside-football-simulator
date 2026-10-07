import type { Translation } from '../core';
import type { ShellLoginMsgs } from '../ko/shellLogin';

export const shellLogin: Translation<ShellLoginMsgs> = {
  failSession: 'ログインの準備ができていません。もう一度タップしてください。',
  failRateLimited: 'ログインの試行回数が多すぎます。少し時間をおいてもう一度お試しください。',
  failUnavailable: '現在Googleログインを利用できません。少し時間をおいてもう一度お試しください。',
  failCancelled: 'ログインをキャンセルしました。',
  offline: 'サーバーに接続できませんでした。少し時間をおいてもう一度ログインしてください。',
  failGeneric: (p) => `Googleログインに失敗しました${p.reason ? `（${p.reason}）` : ''}。`,
  providerGoogle: 'Google',
  linked: (p) => `${p.via}アカウントを連携しました。`,
  switched: (p) => `別の${p.via}アカウントに切り替えました。`,
};
