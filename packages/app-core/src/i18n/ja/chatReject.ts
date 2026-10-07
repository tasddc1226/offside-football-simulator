import type { Translation } from '../core';
import type { ChatRejectMsgs } from '../ko/chatReject';

export const chatReject: Translation<ChatRejectMsgs> = {
  rejectReadonly: 'ログインしてニックネームを決めると書き込めます。',
  rejectMuted: '運営ポリシーによりチャットが停止されています。',
  rejectLong: (p) => `一度に${p.max}文字まで送れます。`,
  rejectFilter: 'リンクや暴言は送れません。',
  rejectRate: '少しゆっくり送ってください。',
  mutedNotice: '運営ポリシーによりチャットが停止されています。閲覧は引き続きできます。',
  mutedUntil: (p) =>
    `運営ポリシーにより${p.until}までチャットが停止されています。閲覧は引き続きできます。`,
};
