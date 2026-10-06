import type { Translation } from '../core';
import type { ChatRejectMsgs } from '../ko/chatReject';

export const chatReject: Translation<ChatRejectMsgs> = {
  rejectReadonly: 'Log in and pick a nickname to chat.',
  rejectMuted: 'Chat is suspended under our policies.',
  rejectLong: (p) => `You can send up to ${p.max} characters at a time.`,
  rejectFilter: "Links and profanity can't be sent.",
  rejectRate: 'Slow down a bit.',
  mutedNotice: 'Chat is suspended under our policies. You can still read.',
  mutedUntil: (p) => `Chat is suspended until ${p.until} under our policies. You can still read.`,
};
