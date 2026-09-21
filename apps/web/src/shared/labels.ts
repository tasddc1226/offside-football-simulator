// 06 "브랜드 언어"·12 브랜드 가이드: 화면 문구는 한국어, 브랜드 어휘는 폐쇄 목록 안에서만.
// Record<T, string>로 선언해 ATTRIBUTE 전수(도메인 유니온 전체)를 타입으로 강제한다.
import type {
  AppearancePromiseOutlook,
  AppearancePromiseOutlookStatus,
  AttributeKey,
  CareerStage,
  CareerStatus,
  ChapterTrigger,
  DecisionSlot,
  EffectExpiresAt,
  InjuryBodyPart,
  InjuryEpisode,
  InjurySeverity,
  MatchAppearance,
  NationalTeamCallUp,
  OutReason,
  PlayerGender,
  Position,
  PositionGroup,
  PreferredFoot,
  RehabPlan,
  RelationTarget,
  RelationshipLogEntry,
  RoleProposal,
  SeasonPhase,
  SelectionCandidate,
  SelectionReasonComponent,
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
  RESERVE: '예비 선수',
};

/** SCR-010 "출전 약속" 문장. 역할 약속을 한 문장으로 풀어 쓴다. */
export const ROLE_PROMISE_SENTENCE: Record<SquadRole, string> = {
  STARTER: '주전으로 뛸 것으로 예상됩니다.',
  ROTATION: '로테이션 멤버로 기용될 예정입니다.',
  BENCH: '벤치에서 기회를 노립니다.',
  RESERVE: '출전 명단 진입을 위해 경쟁합니다.',
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
  SERVICE_STARTED: '복무 시작', SERVICE_COMPLETED: '복무 완료', INTERNATIONAL_TOURNAMENT: 'U23 국제대회', MENTORED: '후배 멘토링',
  RETIRED: '은퇴',
  CAREER_CONFIRMED: '데뷔',
  EVENT_RESOLVED: '이벤트',
  CONTRACT_SIGNED: '계약',
  SEASON_STARTED: '시즌 시작',
  DEVELOPMENT_COMPLETED: '훈련과 대화',
  STEP_PASSED: '진행',
  SEASON_SETTLED: '시즌 정산',
  // T-2-002 D-34: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  ROLE_RESOLVED: '역할 결정',
  // T-2-004 D-38: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CHAPTER_RESOLVED: '챕터 판단',
  // T-2-014 D-42: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CAREER_TAG_GRANTED: '커리어 태그 획득',
  // T-3-001: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CONTRACT_RENEWED: '계약 갱신',
  TRANSFERRED: '완전 이적',
  LOANED: '임대 이적',
  LOAN_RETURNED: '임대 복귀',
  OFFER_REJECTED: '제안 거절',
  OFFER_EXPIRED: '제안 만료',
  NEGOTIATED: '조건 협상',
  INJURED: '부상',
  REHAB_CHOSEN: '재활 선택',
  RECOVERED: '부상 회복',
  INJURY_RECURRED: '부상 재발',
  MANAGER_CHANGED: '감독 교체',
  NATIONAL_TEAM_CALLED: '국가대표 소집',
  NATIONAL_TEAM_DECLINED: '국가대표 소집 거절',
  CAPTAIN_APPOINTED: '주장 임명',
  CLUB_MEETING_RESOLVED: '구단 면담',
  CLUB_MEETING_GOAL_EVALUATED: '면담 목표 평가',
};

/**
 * SCR-014 결과 카드·SCR-029 전술실의 효과 대상 한국어 라벨. 능력치 20종은 `ATTRIBUTE_LABELS`를
 * 그대로 재사용하고(중복 정의 금지), 나머지(state·context·relationships) 대상만 여기서 더한다.
 */
export const EFFECT_TARGET_LABEL_KO: Record<
  AttributeKey | 'form' | 'fitness' | 'morale' | 'tacticalFit' | 'squadStatus' | 'positionProficiency' | 'managerTrust' | 'captain' | 'rival' | 'fans' | 'agent' | 'popularity' | 'media' | 'matchesRemaining' | 'recurrenceRiskBp',
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
  popularity: '인기',
  media: '미디어 평판',
  matchesRemaining: '결장 잔여 경기',
  recurrenceRiskBp: '재발 위험(bp)',
};

/**
 * 챕터·이벤트 결과 카드의 "원인 태그" 칩에서만 쓰는 한국어 라벨(RES-BUG-001). `career.tags`·
 * `outcome.addTags`에 저장되는 값은 콘텐츠 팩이 정의하는 자유 형식 snake_case 문자열이라 화면에
 * 그대로 내보내면 "프로_데뷔" 같은 내부 식별자가 노출된다. 저장값은 건드리지 않고 화면 표시만
 * 이 표를 거친다 — 모든 팩 버전(0.1.0~0.5.0)의 addTags 값을 전수 조사해 채웠다. 카탈로그에 없는
 * 태그는 `resultTagLabel`이 null을 돌려주고 호출부가 걸러내(숨긴다) 원문을 절대 노출하지 않는다.
 */
export const RESULT_TAG_LABEL_KO: Record<string, string> = {
  고집: '고집',
  규율: '규율',
  늦은_출발: '늦은 출발',
  단기_계약_선호: '단기 계약 선호',
  대화_회피: '대화 회피',
  더비의_영웅: '더비의 영웅',
  데뷔전_강렬: '강렬한 데뷔전',
  도발_예고: '도발 예고',
  돌파_성공: '돌파 성공',
  라커룸_배려: '라커룸 배려',
  멘토의_제자: '멘토의 제자',
  밑바닥부터: '밑바닥부터',
  반시즌_임대: '반시즌 임대',
  부모의_걱정: '부모의 걱정',
  빌드업_모험: '빌드업 모험',
  빌드업_안정: '빌드업 안정',
  수비_영웅: '수비의 영웅',
  승격_기여: '승격권 기여',
  언론_충돌: '언론과 충돌',
  언론_플레이: '언론 플레이',
  언론_회피: '언론 회피',
  에이전트_계약: '에이전트 계약',
  에이전트_교체: '에이전트 교체',
  역할_기존장점_증명: '기존 장점 증명 중',
  역할_시험_협의: '역할 시험 협의 중',
  역할_협의_완료: '역할 협의 완료',
  원클럽_싹: '원클럽맨의 싹',
  유연한_선수: '유연한 선수',
  이적_희망: '이적 희망',
  입단테스트_완료: '입단 테스트 완료',
  잔류_선언: '잔류 선언',
  장기_계약_선호: '장기 계약 선호',
  재발_위험_관리: '재발 위험 관리',
  재발_위험_방치: '재발 위험 방치',
  주목받는_유망주: '주목받는 유망주',
  증명: '증명',
  지시를_따름: '지시를 따름',
  직접_협상: '직접 협상',
  진로_아카데미: '아카데미 경로',
  진로_아카데미_이동탐색: '아카데미 이동 탐색 경로',
  진로_아카데미_평가: '아카데미 평가 경로',
  진로_입단테스트: '입단 테스트 경로',
  진로_지역_이동훈련: '지역 리그 이동 훈련 경로',
  진로_지역_준비: '지역 리그 준비 경로',
  진로_하부리그: '하부 리그 경로',
  진로_학교_상위테스트: '학교·상위 테스트 경로',
  진로_학교_성인훈련: '학교·성인 훈련 경로',
  테스트_보통: '테스트 보통',
  테스트_성공: '테스트 성공',
  테스트_실패: '테스트 실패',
  팀_우선: '팀 우선',
  편을_듦: '편을 듦',
  프로_데뷔: '프로 데뷔',
  학업_병행: '학업 병행',
  함께_싸움: '함께 싸움',
  협상: '협상',
};

/** 태그 id 하나를 결과 카드용 한국어 라벨로 바꾼다. 카탈로그에 없으면 null(호출부가 걸러내
 * 화면에서 숨긴다 — 내부 식별자를 원문 그대로 보여주지 않는다). */
export function resultTagLabel(tagId: string): string | null {
  return RESULT_TAG_LABEL_KO[tagId] ?? null;
}

/** 태그 id 목록을 라벨로 바꾸고 매핑이 없는 항목은 제거한다. 결과 카드 태그 칩 렌더링에 쓴다. */
export function resultTagLabels(tagIds: readonly string[]): string[] {
  return tagIds.reduce<string[]>((labels, tagId) => {
    const label = resultTagLabel(tagId);
    if (label !== null) labels.push(label);
    return labels;
  }, []);
}

/** T-7-010 이슈 144·D-68: `CAREER_TAGS`(도메인 데이터)의 라벨 중 화면에서 "리그가 바뀐다"는
 * 오독을 남기는 것만 웹 표시용으로 덮어쓴다. 저장값(도메인 태그 id·설명)은 건드리지 않는다. */
const CAREER_TAG_LABEL_OVERRIDE_KO: Partial<Record<string, string>> = {
  'TAG-PROMOTION-EXPERT': '승격권 전문가',
};

/** 커리어 태그 id를 화면 표시용 라벨로 바꾼다. 덮어쓸 라벨이 없으면 도메인 정의 라벨을 그대로 쓴다. */
export function careerTagLabel(tagId: string, domainLabel: string): string {
  return CAREER_TAG_LABEL_OVERRIDE_KO[tagId] ?? domainLabel;
}

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

/** T-2-007 SCR-029 일정표: 경기 출전 상태 라벨. SUB + UNUSED_SUB는 벤치 대기로 별도 표시한다. */
export const MATCH_APPEARANCE_LABEL_KO: Record<MatchAppearance, string> = {
  START: '선발',
  SUB: '교체',
  OUT: '결장',
};

/** T-2-007 SCR-029 일정표: 결장·미사용 교체 사유 라벨. */
export const OUT_REASON_LABEL_KO: Record<NonNullable<OutReason>, string> = {
  SERVICE: '복무로 휴식',
  NOT_SELECTED: '미선발',
  UNUSED_SUB: '벤치 대기',
  INJURY: '부상',
  SUSPENSION: '정지',
};

/** T-2-007 SCR-029 전술실: 선발 제외 사유 라벨. */
export const SELECTION_EXCLUDED_LABEL_KO: Record<NonNullable<SelectionCandidate['excluded']>, string> = {
  SERVICE: '복무로 휴식',
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

/** T-2-009 SCR-015 역할 변화 목록: 감독 제안 유형·수락/거절 라벨. */
export const ROLE_PROPOSAL_TYPE_LABEL_KO: Record<RoleProposal['type'], string> = {
  KEEP: '유지',
  POSITION_CHANGE: '포지션 변경',
  ROLE_CHANGE: '역할 변경',
};

export const ROLE_DECISION_LABEL_KO: Record<'ACCEPT' | 'DECLINE', string> = {
  ACCEPT: '수락',
  DECLINE: '거절',
};

/**
 * T-2-009 SCR-015 포지션 카드: `PositionStatsTotals`(FW·MF·DF·GK 판별 유니온) 필드의 한국어 라벨.
 * 같은 필드명(assists·cleanSheet)은 그룹이 달라도 의미가 같아 하나의 평면 맵으로 둔다.
 */
export const POSITION_STAT_LABEL_KO = {
  goals: '득점',
  assists: '도움',
  xgCenti: 'xG',
  shots: '슈팅',
  offsides: '오프사이드',
  chancesCreated: '기회 창출',
  progressivePasses: '전진 패스',
  passesAttempted: '패스 시도',
  passesCompleted: '패스 성공',
  passSuccessRate: '패스 성공률',
  ballRecoveries: '볼 회수',
  tackles: '태클',
  interceptions: '인터셉트',
  aerialsWon: '공중볼',
  goalsConcededInvolved: '실점 관여',
  cleanSheet: '클린시트',
  saves: '세이브',
  psxgMinusGoalsCenti: 'PSxG−실점',
  crossesClaimed: '크로스 처리',
  buildUpPasses: '빌드업 패스',
} as const;

/** T-7-005 #105: TAG 챕터가 같은 트리거 타입을 재사용할 때 붙는 제목. 진짜 데뷔전(DEBUT kind)과는
 * 다른 화면이라 여기서만 쓰는 별도 문구를 둔다. 이 표에 없는 tag는 chapterTriggerLabel이
 * resultTagLabel로 한 번 더 시도한다. */
const CHAPTER_TAG_TITLE_KO: Record<string, string> = {
  프로_데뷔: '데뷔 이후의 무대',
};

/** T-2-008 SCR-031: 챕터 트리거를 "왜 이 경기인가" 문구로 바꾼다. TAG는 Phase 3+ 전용이라 고정
 * 사전이 없었다(D-38) — T-7-005 #105부터 CHAPTER_TAG_TITLE_KO·RESULT_TAG_LABEL_KO를 순서대로
 * 거쳐 원시 tag 문자열(예: "프로_데뷔")이 제목으로 그대로 새는 경로를 막는다. */
export function chapterTriggerLabel(trigger: ChapterTrigger): string {
  switch (trigger.kind) {
    case 'DEBUT':
      return '프로 데뷔전';
    case 'DERBY':
      return '라이벌 더비';
    case 'CUP_FINAL':
      return '컵 결승';
    case 'DECIDER':
      return '결정전';
    case 'INJURY_RETURN':
      return '부상 복귀전';
    case 'NATIONAL_DEBUT':
      return '대표팀 데뷔전';
    case 'TAG':
      return CHAPTER_TAG_TITLE_KO[trigger.tag] ?? resultTagLabel(trigger.tag) ?? '핵심 경기';
  }
}

/** T-2-008 SCR-031: `season.selection.playerReason.component`(선발 판정에서 선수·경계 후보 사이
 * 가중 차이가 가장 큰 구성 요소) 라벨. */
export const SELECTION_REASON_LABEL_KO: Record<SelectionReasonComponent, string> = {
  TACTICAL_FIT: '전술 적합도',
  MANAGER_TRUST: '감독 신뢰',
  EXPECTED_PERFORMANCE: '경기 예상치',
  SQUAD_STATUS: '스쿼드 상태',
  EARLY_OPPORTUNITY: '신인 제한 기회',
};

/** 이슈 145 SCR-031 경기 결과: 출전 약속 이행 전망(`computeAppearancePromiseOutlook.status`) 문구. */
export const PROMISE_OUTLOOK_STATUS_LABEL_KO: Record<AppearancePromiseOutlookStatus, string> = {
  SECURED: '이행 확정',
  ON_TRACK: '기준 이상 · 남은 경기에 따라 달라집니다',
  RECOVERABLE: '남은 경기로 회복 가능',
  UNRECOVERABLE: '이번 시즌 이행 불가 확정',
};

/** 이슈 145: "출전 약속 벤치 15% · 현재 12% · 남은 6경기로 회복 가능" 한 줄. 약속 기준이 0%(예비
 * 선수)면 비율 비교 대신 기준 없음을 알린다. 도메인이 계산한 값을 문구로만 바꾼다. */
export function appearancePromiseOutlookLine(outlook: AppearancePromiseOutlook): string {
  const role = SQUAD_ROLE_LABELS[outlook.promisedRole];
  if (outlook.promisedShareBp === 0) return `출전 약속 ${role} · 최소 출전 기준 없음`;
  const promised = Math.round(outlook.promisedShareBp / 100);
  const current = Math.round(outlook.currentShareBp / 100);
  const tail =
    outlook.status === 'RECOVERABLE'
      ? `남은 ${outlook.remainingMatches}경기로 회복 가능`
      : PROMISE_OUTLOOK_STATUS_LABEL_KO[outlook.status];
  return `출전 약속 ${role} ${promised}% · 현재 ${current}% · ${tail}`;
}

/** T-2-012 D-54: `GET /v1/service-seasons/current`의 `notice` 키 → 실제 문구. 서버는 문장을
 * 보내지 않는다(D-12 관례) — SCR-001 허브 배너가 이 문구를 그대로 쓴다. */
export const SERVICE_SEASON_NOTICE_KO: Record<'LINE_TEST', string> = {
  LINE_TEST: '테스트 시즌입니다. 이 커리어는 테스트 보관함에 남고 정식 시즌 도전에는 집계되지 않습니다.',
};

/** 충돌 대화상자 비교 카드의 "마지막 기록" 행. */
export const TIMELINE_KIND_LABELS: Record<TimelineEntry['kind'], string> = {
  SERVICE_STARTED: '복무 시작', SERVICE_COMPLETED: '복무 완료', INTERNATIONAL_TOURNAMENT: 'U23 국제대회', MENTORED: '후배 멘토링',
  RETIRED: '은퇴 확정',
  CAREER_CONFIRMED: '커리어 확정',
  EVENT_RESOLVED: '이벤트 해결',
  CONTRACT_SIGNED: '계약 체결',
  SEASON_STARTED: '시즌 시작',
  DEVELOPMENT_COMPLETED: '훈련과 대화',
  STEP_PASSED: '진행',
  SEASON_SETTLED: '시즌 결산',
  // T-2-002 D-34: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  ROLE_RESOLVED: '역할 결정',
  // T-2-004 D-38: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CHAPTER_RESOLVED: '챕터 판단',
  // T-2-014 D-42: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CAREER_TAG_GRANTED: '커리어 태그 획득',
  // T-3-001: exhaustive Record가 typecheck에서 깨져 최소 수정(PR 본문 참고).
  CONTRACT_RENEWED: '계약 갱신',
  TRANSFERRED: '완전 이적',
  LOANED: '임대 이적',
  LOAN_RETURNED: '임대 복귀',
  OFFER_REJECTED: '제안 거절',
  OFFER_EXPIRED: '제안 만료',
  NEGOTIATED: '조건 협상',
  INJURED: '부상',
  REHAB_CHOSEN: '재활 선택',
  RECOVERED: '부상 회복',
  INJURY_RECURRED: '부상 재발',
  MANAGER_CHANGED: '감독 교체',
  NATIONAL_TEAM_CALLED: '국가대표 소집',
  NATIONAL_TEAM_DECLINED: '국가대표 소집 거절',
  CAPTAIN_APPOINTED: '주장 임명',
  CLUB_MEETING_RESOLVED: '구단 면담',
  CLUB_MEETING_GOAL_EVALUATED: '면담 목표 평가',
};

// ---------------------------------------------------------------------------
// T-4-009 D-57: Phase 4 화면(SCR-018 라커룸·SCR-022 부상·SCR-032 대표팀 차출 등)이 쓸 라벨. 화면이
// 아직 없어(T-4-005 선행 작업) 여기서는 순수 함수·상수만 두고 렌더링은 하지 않는다. 룰셋에 이
// 경계·문구를 위한 새 상수를 추가하지 않는다(브리프 제약) — 전부 이 파일 안의 상수다.
// ---------------------------------------------------------------------------

/** 0~100(관계 5축) 5단계 공용 라벨. 인기·미디어(0~10000)는 같은 5단계를 스케일만 다르게 나눈다
 * (REPUTATION_TIER_BOUNDARIES). 정확한 문구는 화면 통합 시 디자인 리뷰에서 조정될 수 있다. */
const TIER_LABELS_5 = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'] as const;

function tierIndex(value: number, boundaries: readonly number[]): number {
  let index = 0;
  for (const boundary of boundaries) {
    if (value >= boundary) index += 1;
  }
  return index;
}

/** 관계 5축(managerTrust·captain·rival·fans·agent, `CareerState.relationships`) 0~100 경계.
 * [20, 40, 60, 80] 미만 구간이 각각 매우 낮음~매우 높음의 5단계를 이룬다. */
export const RELATION_TIER_BOUNDARIES = [20, 40, 60, 80] as const;

/** SCR-018 라커룸·SCR-029 전술실: 관계 축 하나의 현재값(0~100)을 5단계 라벨로 바꾼다. */
export function relationTierLabel(value: number): string {
  return TIER_LABELS_5[tierIndex(value, RELATION_TIER_BOUNDARIES)]!;
}

/** SCR-029 전술실 "감독 신뢰" 카드 전용 진입점(브리프 "감독 신뢰 단계"). managerTrust도 관계 5축의
 * 하나라 같은 경계·문구를 그대로 쓴다(관계 라벨과 다른 룰셋 상수를 새로 만들지 않는다). */
export function managerTrustTierLabel(managerTrust: number): string {
  return relationTierLabel(managerTrust);
}

export type RelationDirection = 'UP' | 'FLAT' | 'DOWN';

/** SCR-018·SCR-029 D-57 stage 2: 방향 화살표. */
export const RELATION_DIRECTION_ARROW: Record<RelationDirection, string> = {
  UP: '↑',
  FLAT: '→',
  DOWN: '↓',
};

/**
 * `state.relationshipLog`(D-50: 룰셋 `relationshipRules.logMax` 길이로 이미 "최근"만 남긴 링버퍼)
 * 에서 한 축의 delta 합 부호로 방향을 고른다. 합이 정확히 0이거나 그 축의 기록이 없으면 FLAT.
 */
export function relationshipDirection(log: readonly RelationshipLogEntry[], target: RelationTarget): RelationDirection {
  const sum = log.reduce((total, entry) => (entry.target === target ? total + entry.delta : total), 0);
  if (sum > 0) return 'UP';
  if (sum < 0) return 'DOWN';
  return 'FLAT';
}

/** relationshipDirection의 화살표 문자열 버전(화면이 바로 문자열로 쓸 수 있게). */
export function relationshipDirectionArrow(log: readonly RelationshipLogEntry[], target: RelationTarget): string {
  return RELATION_DIRECTION_ARROW[relationshipDirection(log, target)];
}

/**
 * T-7-005 이슈 #142: `RelationshipLogEntry.reasonTag`·`state.memoryTags[target]` 항목은 도메인이
 * 정의한 자유 문자열이라(매핑 없음) 화면에 그대로 내보내면 `PROMISE_BREACH`·`NATIONAL_TEAM_ACCEPT`
 * 같은 내부 키가 새어나간다. 저장값은 건드리지 않고 화면 표시만 이 표를 거친다(RESULT_TAG_LABEL_KO와
 * 같은 관례). `packages/domain/src/legacy/result.ts`가 채우는 `LEGACY_*` 키는 은퇴 평가 사유라
 * 일괄 문구로 묶는다.
 */
export const RELATIONSHIP_REASON_LABEL_KO: Record<string, string> = {
  PROMISE_BREACH: '출전 약속 미이행',
  NATIONAL_TEAM_ACCEPT: '대표팀 소집 수락',
  NATIONAL_TEAM_DECLINE: '대표팀 소집 거절',
  NATIONAL_TEAM_CONDITIONAL: '대표팀 소집 조건부 수락',
  CAPTAIN_MEDIATION: '주장 중재',
  ETHICS_DISCLOSURE: '윤리 문제 공개',
  ETHICS_FAILURE: '윤리 문제 외면',
  ETHICS_REVIEW: '윤리 검토',
  LOCKER_SILENCE: '라커룸 침묵',
  MEDIA_MISREAD: '언론 오독',
  OPEN_CONVERSATION: '솔직한 대화',
  OVEREXERTION: '무리한 훈련',
  PERSONAL_GOAL: '개인 목표 우선',
  RECOVERY_ROUTINE: '회복 루틴',
  TACTICAL_REVIEW: '전술 복기',
  TEAM_FIRST: '팀 우선',
};

const UPPER_SNAKE_CASE_TAG = /^[A-Z][A-Z0-9_]*$/;

/**
 * 관계 로그·기억 태그 하나를 화면용 한국어로 바꾼다. 우선순위: (1) 위 카탈로그, (2) `LEGACY_` 접두
 * 키는 '은퇴 평가', (3) `resultTagLabel`(한글 스네이크 결과 태그와 값 공간이 겹칠 수 있어 재시도),
 * (4) 그래도 없고 대문자 스네이크 케이스(내부 식별자로 보이면) '최근 변화'로 숨긴다, (5) 그 외(알
 * 수 없는 소문자·혼합 문자열)는 원문 그대로 — 내부 키가 아니라 콘텐츠가 직접 넣은 문구일 수 있어서다.
 * `null`은 '최근 변화'.
 */
export function relationshipReasonLabel(tag: string | null): string {
  if (tag === null) return '최근 변화';
  const known = RELATIONSHIP_REASON_LABEL_KO[tag];
  if (known !== undefined) return known;
  if (tag.startsWith('LEGACY_')) return '은퇴 평가';
  const asResultTag = resultTagLabel(tag);
  if (asResultTag !== null) return asResultTag;
  if (UPPER_SNAKE_CASE_TAG.test(tag)) return '최근 변화';
  return tag;
}

/** `CareerState.reputation`(popularityCenti·mediaCenti, 0~10000) 5단계 경계. RELATION_TIER_BOUNDARIES와
 * 같은 비율(100배)이라 같은 TIER_LABELS_5를 쓴다. */
export const REPUTATION_TIER_BOUNDARIES = [2000, 4000, 6000, 8000] as const;

/** SCR-024 SNS·평판, SCR-029 휴대폰 D-57 stage 2: 인기 단계(계약 전·첫 결산 전에는 숫자 대신 이
 * 라벨만 보여준다 — 실제 정수는 stage 3부터 `popularityCenti/100`으로 공개). */
export function popularityTierLabel(popularityCenti: number): string {
  return TIER_LABELS_5[tierIndex(popularityCenti, REPUTATION_TIER_BOUNDARIES)]!;
}

/** SCR-024 미디어 반응 단계. popularityTierLabel과 같은 경계를 쓴다(별도 미디어 전용 경계 없음). */
export function mediaTierLabel(mediaCenti: number): string {
  return TIER_LABELS_5[tierIndex(mediaCenti, REPUTATION_TIER_BOUNDARIES)]!;
}

/** T-4-002 D-49 SCR-022 부상 진단: 부위. */
export const INJURY_BODY_PART_LABELS: Record<InjuryBodyPart, string> = {
  KNEE: '무릎',
  ANKLE: '발목',
  HAMSTRING: '햄스트링',
  SHOULDER: '어깨',
  HEAD: '머리',
};

/** SCR-022 부상 진단: 심각도. */
export const INJURY_SEVERITY_LABELS: Record<InjurySeverity, string> = {
  MINOR: '경미',
  MODERATE: '보통',
  MAJOR: '중상',
};

/** SCR-022 재활 계획 선택지(choice.rehabPlan). */
export const REHAB_PLAN_LABELS: Record<RehabPlan, string> = {
  EARLY: '조기 복귀',
  STANDARD: '표준 재활',
  CONSERVATIVE: '보수적 재활',
};

/** SCR-022·SCR-029 부상 카드: `InjuryEpisode.status`(회복 상태). */
export const INJURY_EPISODE_STATUS_LABELS: Record<InjuryEpisode['status'], string> = {
  ACTIVE: '치료 중',
  REHAB: '재활 중',
  RECOVERED: '회복 완료',
  RECURRED: '재발',
};

/** SCR-032 대표팀 차출: RESOLVE_EVENT choice.callUp 결정. */
export const NATIONAL_TEAM_CALL_UP_LABELS: Record<NationalTeamCallUp, string> = {
  ACCEPT: '소집 수락',
  DECLINE: '소집 거절',
  CONDITIONAL: '조건부 참가',
};

/**
 * SCR-029 전술실·다이어리: 저장된(=이미 STEPS_AFTER/SEASONS_AFTER가 AT_STEP/AT_SEASON_INDEX로
 * 치환된, D-40 규칙 3) Effect의 만료 시점을 "지금부터 몇 스텝/시즌 뒤"로 바꾼다. content가 직접
 * 쓰는 원본 형태(STEPS_AFTER·SEASONS_AFTER)도 방어적으로 처리하되(exhaustive switch), 실제
 * state.activeEffects·deferredEffects에는 나타나지 않는다(SCR-014 결과 카드는 outcome 정의 자체를
 * `shared/effect-summary.ts`의 formatEffectSummary로 이미 이 두 형태로 보여준다 — 중복 함수 아님,
 * 입력이 다르다: 여긴 "저장된 state의 지금 시점 기준" 상대 문구다).
 */
export function effectExpiresAtLabel(
  expiresAt: EffectExpiresAt,
  context: { currentStep: number; seasonIndex: number },
): string {
  if (expiresAt === null) return '만료 없음';
  switch (expiresAt.kind) {
    case 'STEPS_AFTER':
      return `${expiresAt.steps}스텝 뒤 만료`;
    case 'AT_STEP': {
      const remaining = expiresAt.step - context.currentStep;
      return remaining <= 0 ? '이번 스텝에 만료' : `${remaining}스텝 뒤 만료`;
    }
    case 'AT_SEASON_END':
      return '이번 시즌 결산 때 만료';
    case 'SEASONS_AFTER':
      return `${expiresAt.seasons}시즌 뒤 만료`;
    case 'AT_SEASON_INDEX': {
      const remaining = expiresAt.index - context.seasonIndex;
      return remaining <= 0 ? '다음 시즌 시작 전 만료' : `${remaining}시즌 뒤 만료`;
    }
  }
}
