import type { Translation } from '@offside/contracts/i18n';
import type { careerMomentText } from '../ko/careerMoment';
export const careerMoment: Translation<typeof careerMomentText> = {
  visitIntro: (p: { club: string; seasons: number; apps: number }) =>
    `${p.club}で過ごした${p.seasons}シーズン。出場は${p.apps}試合でした。`,
  visitQuestion: (p: { rd: number }) =>
    `第${p.rd}節を前に記者が尋ねます。「今日はゴールを決めたら喜びますか？」`,
  respect: '「喜びは控えます」',
  fans: '「遠征してきたサポーターと喜びます」',
  later: '「試合後に聞いてください」',
  visitRecall: (p: { rd: number; reply: string }) =>
    `第${p.rd}節の試合前、あなたはこう答えました。${p.reply}`,
  visitGoal: (p: { club: string }) =>
    `${p.club}とのアウェー戦でゴール。アウェー席からあなたの名前が響きます。`,
  hands: '静かに両手を上げる',
  run: 'アウェー席へ駆け寄る',
  visitAssist: (p: { club: string }) => `${p.club}とのアウェー戦で味方のゴールをアシストしました。`,
  visitPlayed: (p: { club: string }) =>
    `${p.club}とのアウェー戦を終え、見慣れたスタンドに拍手を送りました。`,
  visitBench: (p: { club: string }) =>
    `${p.club}とのアウェー戦は出番なし。試合後にかつての仲間と挨拶を交わしました。`,
  rank: (p: { rank: number }) => `予想リーグ順位 ${p.rank}位`,
  competition: (p: { competition: string }) => `来季 ${p.competition}`,
  noCompetition: '来季の大陸大会出場なし',
  estimateNote: 'クラブ戦力に基づく予想です。現在の順位とは異なります。',
  trophies: 'シーズンの優勝',
};
