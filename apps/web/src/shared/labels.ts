// 06 "브랜드 언어"·12 브랜드 가이드: 화면 문구는 한국어, 브랜드 어휘는 폐쇄 목록 안에서만.
// Record<T, string>로 선언해 ATTRIBUTE 전수(도메인 유니온 전체)를 타입으로 강제한다.
import type {
  AttributeKey,
  CareerStage,
  CareerStatus,
  Position,
  PositionGroup,
  PreferredFoot,
  SquadRole,
  TimelineEntry,
} from '@offside/domain';

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

/** SCR-002 포지션 탭. 룰셋 `positions`에는 그룹 라벨이 없어 화면 문구로 둔다. */
export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  GK: '골키퍼',
  DEF: '수비수',
  MID: '미드필더',
  FWD: '공격수',
};

/** SCR-002 "포지션 설명" 문구. 룰셋 `positions`는 코드 목록뿐이라 화면이 한 줄 설명을 둔다. */
export const POSITION_DESCRIPTIONS: Record<Position, string> = {
  GK: '골문을 지키고 수비 라인을 조율한다.',
  CB: '중앙에서 상대 공격을 막고 볼을 안전하게 걷어낸다.',
  FB: '측면을 오르내리며 수비와 공격을 함께 돕는다.',
  DM: '수비 라인 앞에서 상대 공격을 끊고 공격을 시작한다.',
  CM: '중원에서 공수를 연결하고 경기 흐름을 조율한다.',
  AM: '최전방 바로 뒤에서 결정적인 패스와 슈팅을 노린다.',
  W: '측면에서 스피드와 드리블로 상대를 무너뜨린다.',
  ST: '최전방에서 득점 기회를 마무리한다.',
};

/** SCR-003 CompareCards의 "핵심 능력"·"약점" 행 라벨. 룰셋에는 능력 이름이 없어 화면이 둔다. */
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  shooting: '슈팅',
  passing: '패스',
  dribbling: '드리블',
  tackling: '태클',
  firstTouch: '퍼스트 터치',
  crossing: '크로스',
  goalkeeping: '골키핑',
  pace: '스피드',
  acceleration: '가속력',
  agility: '민첩성',
  jumping: '점프력',
  stamina: '스태미나',
  strength: '몸싸움',
  durability: '내구성',
  decisions: '판단력',
  concentration: '집중력',
  composure: '침착성',
  positioning: '위치 선정',
  leadership: '리더십',
  consistency: '꾸준함',
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

/** 충돌 대화상자 비교 카드의 "단계" 행. */
export const CAREER_STAGE_LABELS: Record<CareerStage, string> = {
  YOUTH: '유스',
  PRO: '프로',
};

/** 충돌 대화상자 비교 카드의 "마지막 기록" 행. */
export const TIMELINE_KIND_LABELS: Record<TimelineEntry['kind'], string> = {
  CAREER_CONFIRMED: '커리어 확정',
  EVENT_RESOLVED: '이벤트 해결',
  CONTRACT_SIGNED: '계약 체결',
  SEASON_SETTLED: '시즌 결산',
};
