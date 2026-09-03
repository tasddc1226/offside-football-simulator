// 06 "브랜드 언어"·12 브랜드 가이드: 화면 문구는 한국어, 브랜드 어휘는 폐쇄 목록 안에서만.
// Record<T, string>로 선언해 ATTRIBUTE 전수(도메인 유니온 전체)를 타입으로 강제한다.
import type {
  AttributeKey,
  CareerStage,
  CareerStatus,
  DecisionSlot,
  MatchAppearance,
  OutReason,
  PlayerGender,
  Position,
  PositionGroup,
  PreferredFoot,
  SeasonPhase,
  SelectionCandidate,
  SquadRole,
  TimelineEntry,
} from '@offside/domain';
import type { PlayerHeaderField, ResultKind, RiskLevel } from '@offside/ui';

/** SCR-002 성별 RadioGroup·SCR-004 확인 요약. RULE-PLY-001: 능력·성장에 영향을 주지 않는다. */
export const GENDER_LABELS: Record<PlayerGender, string> = {
  FEMALE: '여성',
  MALE: '남성',
  UNSPECIFIED: '선택하지 않음',
};

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

/**
 * 완료 조건 표 #5, RULE-PLY-001: 확정 뒤 화면(대시보드 SCR-029, 이벤트 화면)의 PlayerHeader 포지션
 * 칸. 포지션 전환 전(주포지션 == 최초 선호 포지션)에는 "같음"을, 전환 뒤에는 선호 포지션을 보조
 * 문구로 구분해 보여준다 — 06 "선수 생성 입력": 포지션 전환 서사만 두 값의 차이를 읽을 수 있다.
 */
export function positionHeaderField(primaryPosition: Position, preferredPosition: Position): PlayerHeaderField {
  return {
    label: '포지션',
    value: POSITION_LABELS[primaryPosition],
    caption: preferredPosition === primaryPosition ? '선호 포지션과 같음' : `선호 ${POSITION_LABELS[preferredPosition]}`,
  };
}

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
  SEASON_STARTED: '시즌 시작',
  STEP_PASSED: '진행',
  SEASON_SETTLED: '시즌 정산',
  // T-2-002 D-34: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  ROLE_RESOLVED: '역할 결정',
  // T-2-004 D-38: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CHAPTER_RESOLVED: '챕터 판단',
};

/**
 * SCR-014 결과 카드·SCR-029 전술실의 효과 대상 한국어 라벨. 능력치 20종은 `ATTRIBUTE_LABELS`를
 * 그대로 재사용하고(중복 정의 금지), 나머지(state·context·relationships) 대상만 여기서 더한다.
 */
export const EFFECT_TARGET_LABEL_KO: Record<
  AttributeKey | 'form' | 'fitness' | 'morale' | 'tacticalFit' | 'squadStatus' | 'positionProficiency' | 'managerTrust' | 'captain' | 'rival' | 'fans' | 'agent',
  string
> = {
  ...ATTRIBUTE_LABELS,
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

/** 충돌 대화상자 비교 카드의 "단계" 행. */
export const CAREER_STAGE_LABELS: Record<CareerStage, string> = {
  YOUTH: '유스',
  PRO: '프로',
};

/** T-2-007 SCR-029 SeasonTimeline·일정표: 결정 슬롯 종류 라벨. */
export const DECISION_SLOT_KIND_LABEL_KO: Record<DecisionSlot['kind'], string> = {
  EVENT: '이벤트',
  CHAPTER: '핵심 경기',
  CONTRACT: '계약',
  ROLE: '역할',
  INJURY: '부상',
  NATIONAL_TEAM: '대표팀',
  SETTLEMENT: '결산',
};

/** T-2-007 SCR-029 일정표: 경기 출전 상태 라벨. START·SUB는 outReason이 항상 null이라 appearance만 본다. */
export const MATCH_APPEARANCE_LABEL_KO: Record<MatchAppearance, string> = {
  START: '선발',
  SUB: '교체',
  OUT: '결장',
};

/** T-2-007 SCR-029 일정표: OUT일 때의 사유 라벨. */
export const OUT_REASON_LABEL_KO: Record<NonNullable<OutReason>, string> = {
  NOT_SELECTED: '미선발',
  UNUSED_SUB: '벤치 대기',
  INJURY: '부상',
  SUSPENSION: '정지',
};

/** T-2-007 SCR-029 전술실: 선발 제외 사유 라벨. */
export const SELECTION_EXCLUDED_LABEL_KO: Record<NonNullable<SelectionCandidate['excluded']>, string> = {
  INJURY: '부상',
  SUSPENSION: '정지',
  NATIONAL_TEAM: '대표팀 차출',
};

/** T-2-007 SCR-029 일정표: 컵 라운드 라벨. */
export const CUP_ROUND_LABEL_KO: Record<'R1' | 'R2' | 'SEMI' | 'FINAL', string> = {
  R1: '1라운드',
  R2: '2라운드',
  SEMI: '준결승',
  FINAL: '결승',
};

/** 충돌 대화상자 비교 카드의 "마지막 기록" 행. */
export const TIMELINE_KIND_LABELS: Record<TimelineEntry['kind'], string> = {
  CAREER_CONFIRMED: '커리어 확정',
  EVENT_RESOLVED: '이벤트 해결',
  CONTRACT_SIGNED: '계약 체결',
  SEASON_STARTED: '시즌 시작',
  STEP_PASSED: '진행',
  SEASON_SETTLED: '시즌 결산',
  // T-2-002 D-34: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  ROLE_RESOLVED: '역할 결정',
  // T-2-004 D-38: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CHAPTER_RESOLVED: '챕터 판단',
};
