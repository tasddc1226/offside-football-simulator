// 06 "브랜드 언어"·12 브랜드 가이드: 화면 문구는 한국어, 브랜드 어휘는 폐쇄 목록 안에서만.
// Record<T, string>로 선언해 ATTRIBUTE 전수(도메인 유니온 전체)를 타입으로 강제한다.
import type { CareerStatus, Position, PreferredFoot, SquadRole } from '@offside/domain';

export const POSITION_LABELS: Record<Position, string> = {
  GK: '골키퍼',
  CB: '센터백',
  FB: '풀백',
  DM: '수비형 미드필더',
  CM: '중앙 미드필더',
  AM: '공격형 미드필더',
  W: '윙어',
  ST: '스트라이커',
};

export const PREFERRED_FOOT_LABELS: Record<PreferredFoot, string> = {
  LEFT: '왼발',
  RIGHT: '오른발',
  BOTH: '양발',
};

/** 허브 카드 상태 pill: DRAFT "만드는 중", ACTIVE "진행 중"(브리프). RETIRED·ARCHIVED는 이후 Phase. */
export const CAREER_STATUS_LABELS: Record<CareerStatus, string> = {
  DRAFT: '만드는 중',
  ACTIVE: '진행 중',
  RETIRED: '은퇴',
  ARCHIVED: '보관됨',
};

export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  STARTER: '주전',
  ROTATION: '로테이션',
  BENCH: '벤치',
  RESERVE: '리저브',
};
