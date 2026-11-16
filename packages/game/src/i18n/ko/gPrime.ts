// T-11-733 전성기 연장 로그(prime.ts). peak는 능력치가 처음 떨어지기 시작하는 시즌 끝 나이다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  success: (p: { peak: number; cost: string; ad: boolean }) =>
    `전성기 연장에 성공했습니다. 이제 ${p.peak}세 시즌이 끝날 때부터 능력치가 떨어집니다${p.ad ? '(광고)' : `(${p.cost}원)`}.`,
  great: (p: { peak: number; cost: string; ad: boolean }) =>
    `전성기 연장 대성공! 두 해가 한꺼번에 늘어 ${p.peak}세 시즌이 끝날 때부터 능력치가 떨어집니다${p.ad ? '(광고)' : `(${p.cost}원)`}.`,
  fail: (p: { cost: string; ad: boolean }) =>
    `전성기 연장에 실패했습니다${p.ad ? '(광고)' : `(${p.cost}원)`}. 다음 시도 확률이 오릅니다.`,
};
export type GPrimeMsgs = typeof ko;
export const gPrimeText = ns('gPrime', ko);
