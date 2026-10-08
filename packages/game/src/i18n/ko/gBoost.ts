// 잠재력 강화 로그(boost.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  success: (p: { lv: number; cost: string }) =>
    `잠재력 강화 성공. ${p.lv}단계가 되었습니다(${p.cost}원).`,
  fail: (p: { cost: string }) => `잠재력 강화 실패(${p.cost}원). 다음 시도 확률이 오릅니다.`,
  // T-11-116 자금이 모자라 보상형 광고로 시도했다.
  successAd: (p: { lv: number }) => `잠재력 강화 성공. ${p.lv}단계가 되었습니다(광고).`,
  failAd: '잠재력 강화 실패(광고). 다음 시도 확률이 오릅니다.',
  successClub: (p: { lv: number }) => `잠재력 강화 성공. ${p.lv}단계가 되었습니다(구단 자금).`,
  failClub: '잠재력 강화 실패(구단 자금). 다음 시도 확률이 오릅니다.',
};
export type GBoostMsgs = typeof ko;
export const gBoostText = ns('gBoost', ko);
