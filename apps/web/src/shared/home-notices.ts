export interface HomeNotice {
  id: string;
  date: string;
  title: string;
  body: readonly string[];
}

export const SUPPORT_EMAIL = 'tasddc1569@gmail.com';

export const HOME_NOTICES: readonly HomeNotice[] = [
  {
    id: 'app-experience-2026-09-06',
    date: '2026.09.06',
    title: '화면과 이동 경험을 개선했습니다',
    body: [
      '선택지에 더 빨리 도달할 수 있도록 화면 구조와 정보 밀도를 다듬었습니다.',
      '직접 서명과 상단 고정 메뉴를 적용하고, 밝은 화면과 어두운 화면의 가독성을 함께 개선했습니다.',
    ],
  },
  {
    id: 'domain-and-save',
    date: '2026.09.06',
    title: '새 주소와 게임 기록 저장 안내',
    body: [
      'OFFSIDE의 현재 주소는 offside-lab.com입니다.',
      '다른 기기에서 기록을 이어가려면 기존 기기에서 동기화를 확인한 뒤 Google 계정을 연결하거나 복구 코드를 발급해 주세요. 동기화되지 않은 기기 데이터는 자동으로 옮겨지지 않습니다.',
    ],
  },
] as const;
