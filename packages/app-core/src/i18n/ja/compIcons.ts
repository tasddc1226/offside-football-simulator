import type { Translation } from '../core';
import type { CompIconsMsgs } from '../ko/compIcons';

export const compIcons: Translation<CompIconsMsgs> = {
  sheetTitle: (p) => `${p.name}のロゴ`,
  intro:
    'ロゴを自分で選んだ画像に変えられます。この端末にだけ保存され、シェア画像やほかの人の画面には標準のロゴが表示されます。',
  where: '設定 → 大会・タイトル名とロゴの変更で、リーグ・大会のロゴをまとめて見られます。',
  pick: '画像を選ぶ',
  reset: '標準のロゴに戻す',
  close: '閉じる',
  logoLabel: (p) => `${p.name}のロゴを変更`,
  hint: 'リーグ・大会にロゴがつきました。ロゴをタップすると自分の画像に変えられます。',
  hintClose: 'わかりました',
  custom: '自分の画像',
  saved: 'ロゴを変更しました',
  restored: '標準のロゴに戻しました',
  big: '画像を縮小できませんでした。もっとシンプルな画像を選んでください',
  tooLarge: '10MBより小さい画像を選んでください',
  readFail: '画像を読み込めませんでした',
  full: 'ロゴ画像を保存する空きがありません。使わないロゴを標準に戻してください',
  noSpace: '保存容量が足りず保存できませんでした',
  changed: (p) => `変更したロゴ ${p.n}個`,
  imported: (p) => `ロゴを${p.n}個読み込みました`,
};
