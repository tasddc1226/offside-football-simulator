// T-11-133 웹 잠재력 평가 구매 로그(peek.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  paid: (p: { cost: string }) => `스카우트에게 ${p.cost}원을 내고 이번 시즌 잠재력 평가를 받았다.`,
};
export type GPeekMsgs = typeof ko;
export const gPeekText = ns('gPeek', ko);
