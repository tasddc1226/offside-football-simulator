// 구단주 화면의 '내 선수'(웹 MyPlayers.svelte · 앱 screens/owner/MyPlayers.tsx).
import { ns } from '../core';

const ko = {
  entryLead: '시즌별 선수 기록을 보고, 보유 선수를 관리해요.',
  openPlayers: '내 선수 보기',
  menu: '선수 관리 메뉴',
  records: '선수 기록',
  manage: '보유 선수 관리',
  viewRecord: '기록 보기',
  noOwned: '이 시즌에 보유한 선수가 없어요. 육성 기록은 선수 기록에서 볼 수 있어요.',
  retry: '다시 시도',
  pickLimit: '전체 선택 (최대 50명)',
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
