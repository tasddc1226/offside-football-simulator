import type { Translation } from '../core';
import type { ShellMoreMsgs } from '../ko/shellMore';

export const shellMore: Translation<ShellMoreMsgs> = {
  navIntroGame: 'ゲームメニューです。中央のホームボタンで戻ります。',
  navIntroTeam: 'マイチームメニューです。中央のオーナーボタンで戻ります。',
  back: '← 戻る',
  close: '閉じる',
  retry: '再試行',
  adLabel: '広告',
  adPreview: (p) => `広告枠 · ${p.place}`,
  updateBodyApp: '新しいバージョンが出ました。再起動するとすぐに反映されます。',
  updateBtnApp: '再起動',
  storeUpdateAlert: 'アプリのアップデートのお知らせ',
  storeUpdateTitle: '新しいバージョンがストアに出ました',
  storeUpdateBody: 'アップデートしないと、今後の修正がこのアプリに反映されません。',
  storeUpdateBtn: 'アップデート',
  keepLoginTitle: 'ログインして記録を守る',
  keepLoginBody:
    'ログインすると、引退記録をほかの端末でも見られます。共有リンクはログインなしで作れます。',
  keepLoginGoogle: 'Googleでログイン',
  storeUnavailable: 'この端末ではストアを開けません。',
};
