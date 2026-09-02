// 06 "브랜드 언어"·12 브랜드 가이드: 화면 문구는 한국어, 브랜드 어휘는 폐쇄 목록 안에서만.
// Record<T, string>로 선언해 ATTRIBUTE 전수(도메인 유니온 전체)를 타입으로 강제한다.
import type { AttributeKey, CareerStatus, Position, PreferredFoot, SeasonPhase, SquadRole, TimelineEntry } from '@offside/domain';
import type { ResultKind, RiskLevel } from '@offside/ui';

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

/** SCR-010 "출전 약속" 문장. 역할 약속을 한 문장으로 풀어 쓴다. */
export const ROLE_PROMISE_SENTENCE: Record<SquadRole, string> = {
  STARTER: '주전으로 뛸 것으로 예상됩니다.',
  ROTATION: '로테이션 멤버로 기용될 예정입니다.',
  BENCH: '벤치에서 기회를 노립니다.',
  RESERVE: '리저브팀에서 경기 감각을 쌓습니다.',
};

/** 13-visual-design-system.md DSN-CMP-002·003: 위험 라벨·결과 등급의 한국어 표기. */
export const RISK_LABEL_KO: Record<RiskLevel, string> = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' };
export const OUTCOME_KIND_LABEL_KO: Record<ResultKind, string> = { SUCCESS: '성공', NEUTRAL: '보통', FAIL: '실패', FIXED: '확정' };

/** SCR-009 제안 비교: 리그 등급 라벨. */
export const LEAGUE_TIER_LABEL_KO: Record<'YOUTH' | 1 | 2 | 3, string> = { YOUTH: '유스', 1: '1부', 2: '2부', 3: '3부' };

/** SCR-029 대시보드 "현재 단계" 문구. */
export const SEASON_PHASE_LABEL_KO: Record<SeasonPhase, string> = {
  PRESEASON: '프리시즌',
  LEAGUE: '리그',
  CUP: '컵대회',
  TRANSFER_WINDOW: '이적시장',
  SETTLEMENT: '시즌 정산',
};

/** SCR-029 다이어리(CareerTimeline) 항목의 구분 라벨. */
export const TIMELINE_KIND_LABEL_KO: Record<TimelineEntry['kind'], string> = {
  CAREER_CONFIRMED: '데뷔',
  EVENT_RESOLVED: '이벤트',
  CONTRACT_SIGNED: '계약',
  SEASON_SETTLED: '시즌 정산',
};

/**
 * SCR-014 결과 카드·SCR-029 전술실의 효과 대상 한국어 라벨. `Record<AttributeKey, …>`로 능력치
 * 20종 전수를 타입으로 강제하고, 나머지(state·context·relationships) 대상을 유니온으로 더한다.
 */
export const EFFECT_TARGET_LABEL_KO: Record<
  AttributeKey | 'form' | 'fitness' | 'morale' | 'tacticalFit' | 'squadStatus' | 'positionProficiency' | 'managerTrust' | 'captain' | 'rival' | 'fans' | 'agent',
  string
> = {
  shooting: '슈팅',
  passing: '패스',
  dribbling: '드리블',
  tackling: '태클',
  firstTouch: '퍼스트터치',
  crossing: '크로스',
  goalkeeping: '골키핑',
  pace: '스피드',
  acceleration: '가속력',
  agility: '민첩성',
  jumping: '점프력',
  stamina: '스태미나',
  strength: '피지컬',
  durability: '내구성',
  decisions: '판단력',
  concentration: '집중력',
  composure: '침착성',
  positioning: '포지셔닝',
  leadership: '리더십',
  consistency: '꾸준함',
  form: '폼',
  fitness: '체력',
  morale: '사기',
  tacticalFit: '전술 적합도',
  squadStatus: '스쿼드 상태',
  positionProficiency: '포지션 숙련도',
  managerTrust: '감독 신뢰',
  captain: '주장 관계',
  rival: '라이벌 관계',
  fans: '팬 관계',
  agent: '에이전트 관계',
};
