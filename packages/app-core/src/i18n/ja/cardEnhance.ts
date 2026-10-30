import type { Translation } from '../core';
import type { CardEnhanceMsgs } from '../ko/cardEnhance';

export const cardEnhance: Translation<CardEnhanceMsgs> = {
  title: 'カード強化',
  open: '強化',
  openAria: (p) => `${p.name}のカードを強化`,
  now: '現在',
  next: '成功すると',
  rate: '成功確率',
  cost: '費用',
  balance: 'クラブ資金',
  tries: '挑戦権',
  triesN: (p) => `${p.n}枚`,
  nextTry: (p) => `あと${p.n}試合スタメンで出場すると挑戦権が1枚増えます。`,
  triesHow: (p) =>
    `オーナーチームのスタメンでランク戦に${p.n}試合出場するごとに、そのカードの挑戦権が1枚増えます。`,
  ovr: (p) => `強化OVR +${p.now} → +${p.next}`,
  effectNote:
    '強化OVRはオーナーチームのポジション実力・チームOVR・給料に加わります。選手キャリアの最高OVRと記録は変わりません。',
  failStay: '失敗しても段階は下がりません。',
  ceiling: (p) => `この段階であと${p.n}回失敗すると、次の挑戦は必ず成功します。`,
  sure: '今回の挑戦は必ず成功します。',
  go: '強化する',
  going: '強化中…',
  close: '閉じる',
  success: (p) => `+${p.lv}への強化に成功しました。`,
  failKeep: (p) => `強化に失敗しました。+${p.lv}のままです。`,
  max: '最高段階です。',
  short: 'クラブ資金が足りません。',
  noTry: '挑戦権がありません。',
  closed: '現在カード強化はお休み中です。',
  listed: '出品中の選手は強化できません。',
  stale: '強化の状態が変わりました。最新の状態を読み込みました。',
  loadFail: '強化情報を読み込めませんでした。',
  retry: 'もう一度',
  tryFail: '強化できませんでした。しばらくしてからもう一度お試しください。',
  sellNote: (p) => `+${p.lv}の強化価値${p.value}が販売価格の範囲に加わります。`,
};
