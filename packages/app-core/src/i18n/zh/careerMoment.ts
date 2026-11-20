import type { Translation } from '@offside/contracts/i18n';
import type { careerMomentText } from '../ko/careerMoment';
export const careerMoment: Translation<typeof careerMomentText> = {
  visitIntro: (p: { club: string; seasons: number; apps: number }) =>
    `你曾效力${p.club} ${p.seasons} 個賽季，出賽 ${p.apps} 場。`,
  visitQuestion: (p: { rd: number }) => `第 ${p.rd} 輪賽前，記者問：「今天如果進球，你會慶祝嗎？」`,
  respect: '「我不會慶祝。」',
  fans: '「我想和遠道而來的球迷一起慶祝。」',
  later: '「比賽結束再問我吧。」',
  visitRecall: (p: { rd: number; reply: string }) => `第 ${p.rd} 輪賽前，你的回答是：${p.reply}`,
  visitGoal: (p: { club: string }) => `你作客${p.club}時攻入一球，客隊看台正高喊你的名字。`,
  hands: '靜靜舉起雙手',
  run: '奔向客隊看台',
  visitAssist: (p: { club: string }) => `作客${p.club}時助攻隊友破門。`,
  visitPlayed: (p: { club: string }) => `作客${p.club}賽後，向熟悉的看台鼓掌致意。`,
  visitBench: (p: { club: string }) => `作客${p.club}時沒有上場，賽後和老隊友敘舊。`,
  rank: (p: { rank: number }) => `預估聯賽第 ${p.rank} 名`,
  competition: (p: { competition: string }) => `下賽季 ${p.competition}`,
  noCompetition: '下賽季無洲際賽事',
  estimateNote: '依球隊戰力預估，與目前排名不同。',
  trophies: '賽季冠軍',
};
