// T-11-818 서포터 뱃지(클럽 멤버십 연속 구독 단계). 구단주 · 팀 프로필 · 랭킹 · 친구 · 상대 팀 · 댓글 이름 옆에 붙는다.
import { ns } from '../core';

const ko = {
  pill: (p: { tier: number }) => (p.tier > 1 ? `서포터 ${p.tier}개월` : '서포터'),
  label: (p: { tier: number }) =>
    p.tier > 1 ? `클럽 멤버십 ${p.tier}개월 연속 서포터` : '클럽 멤버십 서포터',
};

export type SupporterMsgs = typeof ko;
export const supporterText = ns('supporter', ko);
