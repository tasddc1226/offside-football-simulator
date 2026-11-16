import { ns } from '../core';

const ko = {
  playTitle: 'Google Play Games',
  playBody: '현재 기기의 Google Play Games 계정에 이 구단주의 은퇴 기록을 보내요.',
  playConnect: 'Google Play Games 연결',
  playBusy: 'Google Play Games 처리 중…',
  playDisconnectHint: '연결을 끊어도 이미 보낸 기록은 Google Play Games에 남아요.',
  playSynced: '은퇴 기록을 Google Play Games에 반영했어요.',
  playSignIn: 'Google Play Games에 로그인하지 못했어요. Play Games 계정 설정을 확인해 주세요.',
  offerHomeTitle: '은퇴 기록으로 순위를 겨뤄요',
  offerRetireTitle: '이 기록으로 순위에 도전해요',
  offerBody: (p: { service: string }) =>
    `${p.service} 계정에 이 구단주의 은퇴 기록을 보내 순위표와 목표 달성에 참여해요.`,
  connectLeaderboard: '연결하고 순위표 보기',
  connectAchievements: '연결하고 목표 보기',
  dismissOffer: '게임 서비스 연결 안내 닫기',
  opening: '여는 중…',
  weekly: '이번 주 순위',
  title: 'Game Center',
  body: '현재 기기의 Game Center 계정에 이 구단주의 은퇴 기록을 보내요.',
  connect: 'Game Center 연결',
  busy: 'Game Center 처리 중…',
  leaderboard: '순위표',
  achievements: '목표 달성',
  disconnect: '연결 끊기',
  disconnectHint: '연결을 끊어도 이미 보낸 기록은 Game Center에 남아요.',
  retry: '다시 연결',
  synced: '은퇴 기록을 Game Center에 반영했어요.',
  empty: '아직 반영할 은퇴 기록이 없어요.',
  signIn: 'Game Center에 로그인하지 못했어요. 기기 설정에서 로그인 상태를 확인해 주세요.',
  sync: '기록을 보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
  changed: '계정이 바뀌어 기록 전송을 멈췄어요. 사용할 계정으로 다시 연결해 주세요.',
  connected: (p: { name: string }) => `${p.name} 계정과 연결돼 있어요.`,
};

export const gameCenterText = ns('gameCenter', ko);
