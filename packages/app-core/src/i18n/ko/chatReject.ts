// chat 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  rejectReadonly: '로그인하고 닉네임을 정하면 쓸 수 있어요.',
  rejectMuted: '운영 정책에 따라 채팅이 정지됐어요.',
  rejectLong: (p: { max: number }) => `한 번에 ${p.max}자까지 보낼 수 있어요.`,
  rejectFilter: '링크나 욕설은 보낼 수 없어요.',
  rejectRate: '조금 천천히 보내 주세요.',
  mutedNotice: '운영 정책에 따라 채팅이 정지됐어요. 읽기는 계속할 수 있어요.',
  mutedUntil: (p: { until: string }) =>
    `운영 정책에 따라 ${p.until}까지 채팅이 정지됐어요. 읽기는 계속할 수 있어요.`,
};

export type ChatRejectMsgs = typeof ko;
export const chatRejectText = ns('chatReject', ko);
