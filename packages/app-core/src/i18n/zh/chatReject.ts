import type { Translation } from '../core';
import type { ChatRejectMsgs } from '../ko/chatReject';

export const chatReject: Translation<ChatRejectMsgs> = {
  rejectReadonly: '登入並設定暱稱後就能發言。',
  rejectMuted: '依營運政策，你的聊天功能已被停用。',
  rejectLong: (p) => `一次最多可傳送 ${p.max} 個字。`,
  rejectFilter: '無法傳送連結或不雅用語。',
  rejectRate: '請放慢一點再傳送。',
  mutedNotice: '依營運政策，你的聊天功能已被停用。仍可繼續閱讀。',
  mutedUntil: (p) => `依營運政策，聊天功能停用至 ${p.until}。仍可繼續閱讀。`,
};
