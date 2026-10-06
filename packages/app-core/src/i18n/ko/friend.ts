// 친구 · 친선전(app-core friendText · 웹 TeamFriends.svelte · 앱 TeamFriends.tsx · 팀 프로필의 친구 신청 버튼).
import { ns } from '../core';

const ko = {
  // 알림 · 공유 문구
  invite: (p: { code: string; url: string }) =>
    `OFFSIDE에서 같이 팀 대결해요. 내 친구 코드: ${p.code}\n${p.url}`,
  accepted: (p: { name: string }) => `${p.name} 님과 친구가 됐어요`,
  requestSent: '친구 신청을 보냈어요',
  // 팀 프로필의 친구 신청 버튼
  reqNone: '친구 신청',
  reqSent: '신청 보냄',
  reqReceived: '친구 수락',
  reqAccepted: '친구',
  // 화면
  title: '친구',
  info: (p: { left: number; per: number }) =>
    `친선전은 레이팅과 전적에 들어가지 않아요. 오늘 남은 친선전 ${p.left}/${p.per}`,
  needTeam: '이번 시즌 팀을 만들면 친구와 친선전을 할 수 있어요.',
  loadFailWeb: '친구 목록을 불러오지 못했어요.',
  loadFailApp: '친구를 불러오지 못했어요.',
  inviteBefore: '초대 링크로 들어왔어요. 코드 ',
  inviteAfter: ' 구단주에게 친구 신청할까요?',
  send: '신청',
  close: '닫기',
  myCode: '내 친구 코드',
  shareLink: '초대 링크 공유',
  copyCode: '코드 복사',
  addByCode: '친구 코드로 신청',
  codeAria: '친구 코드',
  receivedTitle: (p: { n: number }) => `받은 신청 ${p.n}`,
  accept: '수락',
  reject: '거절',
  friendsTitle: (p: { n: number; max: number }) => `친구 ${p.n}/${p.max}`,
  noTeamLine: '이번 시즌 팀이 없어요',
  h2hLine: (p: { record: string }) => `상대 전적 ${p.record}`,
  play: '친선전',
  remove: '끊기',
  noFriends: '아직 친구가 없어요. 신청을 수락하면 여기에 보여요.',
  sentTitle: '보낸 신청',
  cancel: '취소',
  recentTitle: '최근 친선전',
  // 확인 · 토스트
  removeConfirm: (p: { name: string }) => `${p.name} 님과 친구를 끊을까요? 상대 전적도 사라져요.`,
  removeTitleApp: '친구 끊기',
  codeInvalid: '친구 코드 8자리를 확인해 주세요.',
  shareFail: '공유하지 못했어요',
  linkCopied: '초대 링크를 복사했어요',
  codeCopied: '코드를 복사했어요',
  codeCopyFail: '코드를 복사하지 못했어요',
  // 앱 접근성 이름
  acceptAria: (p: { name: string }) => `${p.name} 신청 수락`,
  rejectAria: (p: { name: string }) => `${p.name} 신청 거절`,
  playAria: (p: { name: string }) => `${p.name} 님과 친선전`,
  removeAria: (p: { name: string }) => `${p.name} 님과 친구 끊기`,
  cancelAria: (p: { name: string }) => `${p.name} 신청 취소`,
  founder: '창단 멤버',
  preseasonLine: (p: { name: string; ovr: number }) => `프리시즌 ${p.name} · OVR ${p.ovr}`,
  preseasonHint: '프리시즌 팀을 꾸리면 프리시즌에 키운 선수로 친구와 친선전을 할 수 있어요.',
  makePreseason: '프리시즌 팀 꾸리기',
  playPreseason: '프리시즌 친선전',
  playPreseasonAria: (p: { name: string }) => `${p.name} 님과 프리시즌 친선전`,
};

export type FriendMsgs = typeof ko;
export const friendText = ns('friend', ko);
