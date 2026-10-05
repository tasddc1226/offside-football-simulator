// 확률 도감(game/eventDex.ts)이 만드는 영향 요인 이름과 대체 문구.
import { ns } from '@offside/contracts/i18n';

const ko = {
  factorClub: '소속팀 전력',
  factorLeague: '리그 수준',
  factorTrust: '감독 신뢰',
  factorMorale: '사기',
  factorFame: '명성',
  factorCond: '컨디션',
  factorAge: '나이',
  factorInjury: '부상 정도',
  factorContract: '남은 계약 기간',
  factorOvr: '종합 능력치(OVR)',
  factorTrait: (p: { name: string }) => `특성 '${p.name}'`,
  labelVaries: '(상황에 따라 달라지는 선택지)',
};
export type GDexMsgs = typeof ko;
export const gDexText = ns('gDex', ko);
