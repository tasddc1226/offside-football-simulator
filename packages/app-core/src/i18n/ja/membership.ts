import type { Translation } from '../core';
import type { MembershipMsgs } from '../ko/membership';

export const membership: Translation<MembershipMsgs> = {
  title: 'クラブメンバーシップ',
  lead: '月額の購読で、毎日もらえる特典が増えます。',
  perkAttend: '出席報酬2倍',
  perkAttendSub: '毎日の出席でもらえるアイテムが2倍になります。',
  perkBoost: '毎日潜在能力強化券1枚',
  perkBoostSub: '出席するたびに潜在能力強化券を1枚追加でもらえます。',
  perkAds: '広告なし',
  perkAdsSub: '購読中は広告を見ずに報酬を受け取れます。',
  perkBadge: 'サポーターバッジ',
  perkBadgeSub:
    'クラブ・ランキング・フレンド・コメントで、名前の横にサポーターバッジが付きます。3・6・9か月連続でバッジが変わります。',
  perkTenure: '連続加入ギフト',
  perkTenureSub:
    '2か月目から、出席すると毎月ギフトを受け取れます。潜在能力強化券が毎月1枚ずつ増えて最大6枚、3か月ごとにプレミアムスカウト券も1枚もらえます。',
  streak: (p) => `${p.months}か月連続で加入中です`,
  nextGift: (p) => `${p.months}か月目のギフト · ${p.reward}`,
  join: (p) => `月額${p.price}で加入する`,
  joinIntro: (p) =>
    p.months === 1 ? `初月${p.price}で加入する` : `最初の${p.months}か月は月額${p.price}で加入する`,
  introNote: (p) =>
    `${p.months === 1 ? '初月' : `最初の${p.months}か月`}が過ぎると月額${p.price}で自動更新されます。初めて加入するときに1回だけの価格です。`,
  joinBusy: '決済中…',
  joined: 'メンバーシップに加入しました。',
  active: 'メンバーシップを利用中です',
  renews: (p) => `${p.date}に翌月分が決済されます。`,
  ends: (p) => `自動更新をオフにしました。${p.date}まで特典を受けられます。`,
  until: (p) => `${p.date}まで特典を受けられます。`,
  expired: 'メンバーシップが終了しました。再加入するとすぐに特典を受けられます。',
  renewNote: '毎月自動で更新されます。解約しても残りの期間は特典が続きます。',
  manage: 'サブスクリプション管理',
  manageHint: '解約や支払い方法の変更は、ストアのサブスクリプション管理で行います。',
  restore: '購入を復元',
  restoreBusy: '確認中…',
  restoreNone: '復元できるメンバーシップがありません。',
  adOwned: '広告削除をすでに購入している場合、メンバーシップが終わってもそのまま残ります。',
  webBuy: (p: { price: string; days: number }) =>
    `ウェブで${p.days}日間利用券を買う · ${p.price}ウォン`,
  webOnce:
    'ウェブで買った利用券は自動で再決済されません。期間が残っているうちに買い直すと、終了日から続けて延びます。',
  notOnSale: '現在、メンバーシップの加入を受け付けていません。',
  webJoin: '加入はアプリでできます。アプリで加入したメンバーシップの特典はウェブでも受けられます。',
  login: 'ログインしたオーナーだけがクラブメンバーシップを使えます。',
  loadFail: 'メンバーシップを読み込めませんでした。',
  retry: '再読み込み',
  entry: 'クラブメンバーシップ',
  entrySub: '出席2倍 · 毎日潜在能力強化券 · 広告なし · 連続加入ギフト',
  entryActive: '利用中',
  back: 'オーナー画面へ',
  adHint: 'メンバーシップなら広告なしで受け取れます',
  adHintGo: 'メンバーシップを見る',
};
