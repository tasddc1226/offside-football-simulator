// 국내 컵·대륙 대회 진행 줄과 시상식 줄(comps.ts). 대회·단계 이름은 저장값이라 호출하는 쪽이 tn()으로 옮겨 넘긴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  /** 컵·슈퍼컵·대륙 대회의 한 줄. stage는 저장된 한국어 단계('우승'·'준우승'·'16강 통과'·'8강 탈락' 등). */
  compLine: (p: { name: string; stage: string }) =>
    `${p.name} ${p.stage === '우승' ? '우승!' : p.stage}`,
  contKoPass: (p: { name: string }) => `${p.name} 1라운드 통과, 16강 진출`,
  leagueDirect: (p: { name: string; pts: number }) =>
    `${p.name} 리그 페이즈 통과, 16강 직행 (승점 ${p.pts})`,
  leaguePlayoff: (p: { name: string; pts: number }) =>
    `${p.name} 녹아웃 플레이오프 진출 (승점 ${p.pts})`,
  leagueOut: (p: { name: string; pts: number }) => `${p.name} 리그 페이즈 탈락 (승점 ${p.pts})`,
  galaWin: '발롱도르 수상!',
  galaRank: (p: { rank: number }) => `발롱도르 ${p.rank}위 (30인 후보)`,
};
export type GCompsMsgs = typeof ko;
export const gCompsText = ns('gComps', ko);
