import { ns } from '@offside/contracts/i18n';
const ko = {
  visitIntro: (p: { club: string; seasons: number; apps: number }) =>
    `${p.club}에서 ${p.seasons}시즌, ${p.apps}경기를 뛰었습니다.`,
  visitQuestion: (p: { rd: number }) =>
    `${p.rd}라운드를 앞두고 기자가 묻습니다. “오늘 골을 넣으면 세리머니를 할 건가요?”`,
  respect: '“세리머니는 하지 않겠습니다.”',
  fans: '“원정 온 우리 팬들과 기뻐할 겁니다.”',
  later: '“경기가 끝나고 말씀드릴게요.”',
  visitRecall: (p: { rd: number; reply: string }) =>
    `${p.rd}라운드 경기 전, 당신의 대답은 ${p.reply}`,
  visitGoal: (p: { club: string }) =>
    `${p.club} 원정에서 골을 넣었습니다. 원정석에서 당신의 이름을 부릅니다.`,
  hands: '두 손을 든다',
  run: '원정석으로 달려간다',
  visitAssist: (p: { club: string }) => `${p.club} 원정에서 동료의 골을 도왔습니다.`,
  visitPlayed: (p: { club: string }) =>
    `${p.club} 원정 경기가 끝나고 익숙한 관중석을 향해 박수를 보냈습니다.`,
  visitUnused: (p: { club: string }) =>
    `${p.club} 원정에서 교체를 기다렸지만 출전 기회는 오지 않았습니다.`,
  visitInjured: (p: { club: string }) => `부상으로 ${p.club} 원정에 출전하지 못했습니다.`,
  visitBench: (p: { club: string }) =>
    `${p.club} 원정에서 출전 기회는 없었습니다. 경기 뒤 옛 동료들과 인사를 나눴습니다.`,
  rank: (p: { rank: number }) => `예상 리그 ${p.rank}위`,
  competition: (p: { competition: string }) => `다음 시즌 ${p.competition}`,
  noCompetition: '다음 시즌 대륙 대회 없음',
  estimateNote: '구단 전력 기준 예상이에요. 현재 순위와는 달라요.',
  trophies: '시즌 우승',
};
export const careerMomentText = ns('careerMoment', ko);
