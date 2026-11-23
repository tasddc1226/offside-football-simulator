import type { Translation } from '../core';
import type { VoiceMsgs } from '../ko/voice';

export const voice: Translation<VoiceMsgs> = {
  entry: 'ご意見を送る',
  homeTitle: 'ご意見を送る',
  title: 'ご意見を送る',
  homeSub: '不便な点やご要望を運営に直接送れます。',
  lead: '不便な点やご要望を短く書いてください。運営が直接読みます。',
  kindLabel: '種類（選ばなくてもかまいません）',
  kindBug: '不具合・不便',
  kindIdea: '要望',
  kindOther: 'その他',
  bodyLabel: 'ご意見の内容',
  placeholder: '伝えたいことを書いてください。',
  placeholderBug: 'どの画面で何をしたときに起きるかを書いてください。',
  placeholderIdea: 'ほしい機能や変えてほしい点を書いてください。',
  count: (p) => `${p.n}/${p.max}文字`,
  noteReply:
    '運営だけが読み、ここからは返信できません。返信が必要な場合は contact@offside-lab.com までメールでお送りください。',
  noteContext:
    'アプリのバージョン、端末の種類（Web・iOS・Android と OS のバージョン）、表示言語が一緒に送られます。メールアドレスや電話番号は書かないでください。',
  privacy: 'プライバシーポリシー',
  submit: '送信',
  busy: '送信中…',
  close: '閉じる',
  empty: '内容を書いてください。',
  short: '2文字以上で書いてください。',
  fail: '送信できませんでした。書いた内容はそのまま残っています。少し待ってからもう一度押してください。',
  doneTitle: '受け取りました',
  doneBody:
    '送ってくださりありがとうございます。運営が読み、アップデートを決めるときの参考にします。',
};
