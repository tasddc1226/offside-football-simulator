// 앱 개인 알림함(T-11-099) — 앱 screens/notifications/Inbox.tsx · components/InboxButton.tsx · platform/inbox.ts ·
// app-core notification-inbox.ts.
import { ns } from '../core';

const ko = {
  kindNews: '새 소식',
  kindTest: '알림 테스트',
  kindReturn: '다시 킥오프',
  kindTeam: '내 팀',
  kindMarket: '이적시장',
  kindSocial: '친구',
  title: '알림함',
  titleUnread: (p: { n: number }) => `알림함, 읽지 않은 알림 ${p.n}개`,
  back: '이전으로',
  keepNote: '받은 알림을 90일간 보관해요.',
  viewRelated: '관련 내용 보기',
  markRead: '읽음으로 표시',
  notFound: '이 알림을 찾을 수 없어요.',
  all: '전체',
  unreadN: (p: { n: number }) => `읽지 않음 ${p.n}`,
  refresh: '새로고침',
  readAll: '모두 읽음',
  unread: '읽지 않음',
  unreadAria: '읽지 않음, ',
  emptyUnread: '읽지 않은 알림이 없어요.',
  empty: '아직 받은 알림이 없어요.',
  more: '이전 알림 더 보기',
  checking: '알림 확인 중…',
  retry: '다시 시도',
  loadFailed: '알림을 불러오지 못했어요. 다시 시도해 주세요.',
  connectFailed: '알림함에 연결하지 못했어요. 다시 시도해 주세요.',
};

export type InboxMsgs = typeof ko;
export const inboxText = ns('inbox', ko);
