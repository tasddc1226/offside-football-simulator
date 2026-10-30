// T-11-513 몸 관리 로그(care.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  bought: (p: { cut: number; cost: string }) =>
    `몸 관리 프로그램을 시작했습니다. 이번 시즌 끝 능력치 하락이 ${p.cut}% 줄어듭니다(${p.cost}원).`,
};
export type GCareMsgs = typeof ko;
export const gCareText = ns('gCare', ko);
