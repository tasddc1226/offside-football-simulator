// 국가대표·국제대회 문구(national.ts). 대회·단계·나라 이름은 저장값이라 여기서 옮기지 않는다(tn).
import { ns } from '@offside/contracts/i18n';

const ko = {
  /** 라이벌전 이름(nation.ts RIVAL.label)을 지금 언어로. */
  rivalLabel: (p: { ko: string }) => p.ko,
  rivalWin: (p: { label: string; g: number }) =>
    `${p.label} 승리!${p.g ? ` ${p.g}골을 터뜨리며` : ''} 국민 영웅이 됐습니다.`,
  debut: (p: { name: string }) => `생애 첫 A대표팀 발탁! (${p.name})`,
  windowName: (p: { m: number }) => `${p.m}월 A매치`,
  friendly: '친선 A매치',
  wcQual: (p: { year: number; region: string; conf: string }) =>
    `${p.year} 월드컵 ${p.region} 예선`,
  score: (p: { team: string; kg: number; og: number; opp: string; pso: string | null }) =>
    `${p.team} ${p.kg}-${p.og} ${p.opp}${p.pso ? ` (승부차기 ${p.pso})` : ''}`,
  matchLog: (p: { comp: string; score: string; mins: number; g: number; a: number }) =>
    `[${p.comp}] ${p.score}${p.mins ? ` · ${p.mins}분${p.g ? ` ${p.g}골` : ''}${p.a ? ` ${p.a}도움` : ''}` : ' · 벤치'}`,
  captain: '국가대표팀 주장으로 선임됐습니다.',
  whyInjury: '부상으로 최종 명단 제외',
  whyCut: '최종 명단 탈락',
  whyRefused: '소속팀이 차출을 거부',
  whyWildcard: '와일드카드 발탁',
};
export type GNationalMsgs = typeof ko;
export const gNationalText = ns('gNational', ko);
