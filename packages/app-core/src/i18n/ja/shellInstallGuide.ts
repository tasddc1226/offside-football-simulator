import type { Translation } from '../core';
import type { ShellInstallGuideMsgs } from '../ko/shellInstallGuide';

export const shellInstallGuide: Translation<ShellInstallGuideMsgs> = {
  installTitle: 'ホーム画面に追加してアプリのように開く',
  installInapp: '外部ブラウザ（Safari/Chrome）で開くと、ホーム画面に追加できます。',
  installBody:
    'ホーム画面のOFFSIDEアイコンからすぐに開けます。この案内は設定 > ヘルプでもう一度見られます。',
  optOut: '今後表示しない',
  stepIosChrome1: 'アドレスバー右の共有ボタンをタップします。',
  stepIosChrome2: '下の列のいちばん右にある「その他」をタップします。',
  stepIosChrome3: 'リストから「ホーム画面に追加」を選びます。',
  stepIosChrome4: '右上の「追加」をタップしたら完了です。',
  stepIosSafari1: '画面下（またはアドレスバーの横）の共有ボタンをタップします。',
  stepIosSafari2: 'リストから「ホーム画面に追加」を選びます。',
  stepIosSafari3: '右上の「追加」をタップしたら完了です。',
  stepAndroid1: '右上の ⋮ メニューをタップします。',
  stepAndroid2: '「ホーム画面に追加」を選びます。',
  stepAndroid3: '「追加」をタップしたら完了です。',
  stepOther1: 'スマホのブラウザでoffside-lab.comを開きます。',
  stepOther2: '共有ボタン（または ⋮ メニュー）から「ホーム画面に追加」を選びます。',
  stepOther3: '「追加」をタップしたら完了です。',
};
