import type { Translation } from '../core';
import type { AccountMsgs } from '../ko/account';

export const account: Translation<AccountMsgs> = {
  title: 'アカウント',
  checking: '確認中…',
  errorTitle: '接続できません',
  errorBody:
    'サーバーに接続できず、ログイン状態を確認できません。ゲームは続けられ、進行状況はこの端末に保存されます。',
  retry: '再試行',
  guestTitle: 'ログインしていません',
  guestBody:
    'ゲームの進行はこの端末にだけ保存されます。ログインすると、選手の記録とクラブ名をほかの端末でも見られます。',
  logout: 'ログアウト',
  cancel: 'キャンセル',
  logoutTitle: 'ログアウトしますか？',
  logoutBodyWeb:
    'この端末に保存されたゲームの進行はそのまま残ります。同じGoogleアカウントで再ログインすると、アカウントに保存された記録をまた見られます。',
  logoutBodyApp:
    'この端末に保存されたゲームの進行はそのまま残ります。同じアカウントで再ログインすると、保存された記録を見られます。',
  nickname: 'コメント用ニックネーム',
  nicknamePrompt: 'コメント用ニックネームを決めると、お知らせ掲示板にコメントできます',
  nicknameFixed: (p) => `${p.nickname} · 運営アカウントは変更できません`,
  unlinkGoogle: 'Google連携を解除',
  deleteAccount: 'アカウント削除',
  deleteBody:
    'アカウントと、サーバーに保存された選手の記録・チーム・コメント・チャットを削除しますか？元に戻せません。この端末のゲームの進行は残ります。',
  deleteConfirm: '削除',
  googleTitle: 'Googleアカウント',
  googleVia: 'Googleアカウントでログインしています。',
  appleTitle: 'Appleアカウント',
  appleVia: 'Appleアカウントでログインしています。',
  loginGoogle: 'Googleでログイン',
  loginApple: 'Appleでサインイン',
  googleFinishFail: 'Googleログインを完了できませんでした。もう一度お試しください。',
  appleStartFail: 'Appleログインを開始できませんでした。',
  appleFinishFail: 'Appleログインを完了できませんでした。もう一度お試しください。',
  viaGoogle: 'Google',
  viaApple: 'Apple',
};
