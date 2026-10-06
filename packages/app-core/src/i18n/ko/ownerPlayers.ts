// 구단주 화면의 '내 선수'(웹 MyPlayers.svelte · 앱 screens/owner/MyPlayers.tsx).
import { ns } from '../core';

const ko = {
  title: '내 선수',
  loading: '불러오는 중…',
  sourceAccount: '계정에 기록된 선수예요. 다른 기기에서도 똑같이 보여요.',
  sourceOffline: '서버에 연결하지 못해 이 기기에 저장된 선수를 보여 줘요.',
  sourceDeviceWeb: '이 기기에 저장된 선수예요. 구글 계정을 연결하면 계정에 모아 볼 수 있어요.',
  sourceDeviceApp: '이 기기에 저장된 선수예요. 로그인하면 계정에 모아 볼 수 있어요.',
  seasonGroup: '시즌',
  tagPublic: '공개',
  openRecord: (p: { name: string }) => `${p.name} 선수 기록 열기`,
  showAll: (p: { n: number }) => `모두 보기 (${p.n}명)`,
};

export type OwnerPlayersMsgs = typeof ko;
export const ownerPlayersText = ns('ownerPlayers', ko);
