import type { RetentionStory } from '../ko/retentionPush.js';

export const retentionPushText: Record<RetentionStory, { title: string; body: string }> = {
  career: {
    title: '続きの選手が待っています',
    body: 'ホームの「続きから」で中断したところから再開できます。',
  },
  matches: {
    title: '休んでいる間にランク戦を{n}試合しました',
    body: '{w}勝{d}分{l}敗です。マイチームの最近の試合で結果を確認できます。',
  },
  sold: {
    title: '休んでいる間に選手が{n}人売れました',
    body: '移籍市場の取引履歴で販売内容とクラブ資金を確認できます。',
  },
  season: {
    title: '新しいシーズンが始まりました',
    body: 'シーズン{season}のランキングがゼロから始まります。',
  },
  news: {
    title: '休んでいる間に変わったことがあります',
    body: 'アップデート情報に新機能をまとめました。',
  },
  farewell: {
    title: 'キャリアはそのまま残っています',
    body: 'いつでもホームから続きをプレイできます。このお知らせのあとは送りません。',
  },
  create: {
    title: '最初の選手を作りましょう',
    body: '選手を作るとすぐにデビューシーズンが始まります。',
  },
  retire: {
    title: 'デビューした選手が待っています',
    body: '引退までプレイすると選手カードが手に入り、自分のクラブを作れます。',
  },
  login: {
    title: '引退した選手でクラブを作れます',
    body: 'GoogleかAppleでログインするとクラブを作れて、機種変更後も記録を引き継げます。',
  },
  club: {
    title: '引退選手のカードでクラブを作りましょう',
    body: 'クラブを作ると、ほかのオーナーとランク戦ができます。',
  },
  rank: {
    title: '最初のランク戦の番です',
    body: 'マイチームで対戦相手を選んで試合を始めましょう。',
  },
};
