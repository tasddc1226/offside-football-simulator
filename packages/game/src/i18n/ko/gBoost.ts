// 잠재력 강화 로그(boost.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  success: (p: { lv: number; cost: string }) =>
    `잠재력 강화 성공. ${p.lv}단계가 되었습니다. ${p.cost}원을 썼습니다.`,
  fail: (p: { cost: string }) => `잠재력 강화 실패. ${p.cost}원을 썼고, 다음 시도 확률이 오릅니다.`,
  // T-11-116 자금이 모자라 보상형 광고로 시도했다.
  successAd: (p: { lv: number }) => `광고로 잠재력 강화 성공. ${p.lv}단계가 되었습니다.`,
  failAd: '광고로 잠재력 강화 실패. 다음 시도 확률이 오릅니다.',
  successClub: (p: { lv: number }) => `구단 자금으로 잠재력 강화 성공. ${p.lv}단계가 되었습니다.`,
  failClub: '구단 자금으로 잠재력 강화 실패. 다음 시도 확률이 오릅니다.',
  // T-11-174 잠재력 강화권으로 시도했다.
  successTicket: (p: { lv: number }) => `강화권으로 잠재력 강화 성공. ${p.lv}단계가 되었습니다.`,
  failTicket: '강화권으로 잠재력 강화 실패. 다음 시도 확률이 오릅니다.',
  // T-11-513 구단 자금 확정 강화.
  successSure: (p: { lv: number }) =>
    `구단 자금으로 확정 강화를 했습니다. 잠재력이 ${p.lv}단계가 되었습니다.`,
};
export type GBoostMsgs = typeof ko;
export const gBoostText = ns('gBoost', ko);
