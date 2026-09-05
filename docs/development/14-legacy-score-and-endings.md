# 14. Legacy Score와 엔딩

## 목적

2026-09-05 구현 연결: [Legacy 1.0.0 런타임 통합 명세](19-phase5-runtime-integration.md)에
실제 정규화 상한표, 원본 증거, 과거 기록의 coverage, 한국 모듈과 은퇴 저장 계약을 명시했다.
이 문서의 모집단/밴드 밸런스 조건은 유지하며 작은 테스트 통과로 완료 처리하지 않는다.

은퇴한 커리어를 하나의 완결된 축구 인생으로 회수한다. Legacy Score는 능력치가 아니라 결과의 집계이며, 어떤 커리어도 빈 엔딩이나 굴욕적인 순위 표현을 받지 않는다. RULE-LEG-001(엔딩은 세계 정상 하나가 아닌 복수 가치 인정)을 계산 규칙과 표현 규칙으로 구체화한다.

## 원칙

- Legacy는 Archive를 읽어 계산하는 파생 값이다. Base OVR, 능력치, 관계 상태를 변경하지 않는다.
- 같은 Archive와 같은 `legacyVersion`은 같은 결과를 낸다. 실시간 사용자 집계는 입력이 아니다.
- 총점은 보조 정보다. 주 표현은 엔딩 타이틀과 기여 요인이다.
- 우승이 없어도, 1부 리그를 밟지 못했어도 밴드·엔딩·최고의 순간은 반드시 부여한다.

## RULE-LEG-002 총점 계산

```text
Legacy Score = round(
    Achievement   × 0.30
  + Contribution  × 0.25
  + Longevity     × 0.15
  + Relationship  × 0.15
  + Narrative     × 0.15
)
```

- 각 요소는 0~100 정수로 정규화한 뒤 가중합한다. 총점은 0~100 정수다.
- 가중치와 정규화 상한표는 ruleset manifest에 `legacyVersion`으로 버전 관리한다.
- 요소 정규화는 참조 분포가 아니라 ruleset의 절대 상한표를 사용한다. 참조 분포는 백분위와 밸런스 검증에만 쓴다.

## 구성 요소 입력과 정규화

| 요소 | 입력 정본 | 정규화 규칙 |
|---|---|---|
| 성취 (30) | 팀 트로피, 승격, 개인상, 대표팀 출전·대회, 핵심 경기 챕터 성공 결과 | 트로피 점수 = 기본값 × `competitionLevel` × `leagueStrength`, 출전 비율 40% 미만 트로피는 절반 가중. 대표팀은 출전 수와 대회 단계로 가산. 상한 100 |
| 기여 (25) | 시즌별 출전 시간 비율, 스쿼드 역할, 팀 내 중요도, 핵심 경기 영향, 계약 약속 이행률 | 포지션별 기대 출전·기록 테이블 대비 비율로 계산해 포지션 편향을 제거. 주전 시즌 수와 역할 가중 평균. 상한 100 |
| 장기성 (15) | 프로 시즌 수, 총 출전, 부상 결장 비율, 복귀 횟수, 나이 대비 활동 | 시즌 수 로그 스케일, 결장 비율 감점, 중대 부상 후 복귀 가점. 상한 100 |
| 관계 (15) | 감독 신뢰 궤적, 동료 관계 평균, 팬 기억 태그, 주장·부주장 경험, 멘토링 결과 | 시즌 가중 평균과 최종 값의 혼합. 부정 태그는 감점하되 요소 하한 0. 상한 100 |
| 서사 (15) | 보유 태그 수와 희귀도, 엔딩 희귀도, 극적 반전 이벤트 수 | 태그 희귀도 점수 합(COMMON 5, RARE 12, EPIC 25)과 반전 이벤트 가산. 상한 100 |

## RULE-LEG-003 중복 가산 금지

- 하나의 `sourceId`(트로피, 경기, 이벤트, 계약)는 한 요소에서만 점수를 만든다.
- 같은 사건이 태그 조건에도 쓰이면 서사 요소에서는 태그 희귀도로만 반영하고 원본 점수를 다시 더하지 않는다.
- 팀 트로피는 대회당 시즌당 1회만 인정한다. 리그 우승과 리그 MVP는 서로 다른 `sourceId`이므로 각각 인정한다.
- 임대 기간 기록은 임대 구단 기여로 집계하고 원소속 구단 기여에 중복 산입하지 않는다.

## RULE-LEG-004 참조 모집단

- 백분위와 밴드 밸런스는 ruleset에 동봉된 합성 참조 분포 `legacyReferencePopulationId`를 사용한다.
- 참조 분포는 같은 ruleset으로 포지션군별 최소 10,000 커리어를 시뮬레이션해 만든 불변 아티팩트다.
- 익명 MVP에는 서버 집계 백분위가 없으므로 실시간 사용자 데이터는 참조 분포에 섞지 않는다.
- 참조 분포를 교체하면 새 `legacyVersion`을 만든다. 기존 Archive의 총점은 바뀌지 않는다.

## 밴드 라벨

| 밴드 ID | 총점 | 표시 문구 | 의미 |
|---|---:|---|---|
| BAND-LEGEND | 90~100 | 전설 | 참조 분포 최상위. 시대를 대표한 커리어 |
| BAND-ICON | 75~89 | 레전드 | 구단과 팬이 이름으로 기억하는 커리어 |
| BAND-REMEMBERED | 50~74 | 기억되는 커리어 | 특정 시즌·구단·순간으로 회자되는 커리어 |
| BAND-SOLID | 25~49 | 견실한 커리어 | 오래 뛰었거나 팀에 필요했던 커리어 |
| BAND-COMPLETE | 0~24 | 짧았지만 완결된 커리어 | 길지 않았지만 하나의 이야기로 끝난 커리어 |

밸런스 목표는 참조 분포에서 BAND-LEGEND 약 2%, BAND-ICON 약 8%, BAND-REMEMBERED 약 30%다. 목표와의 편차는 밸런스 리포트로 확인하고 계산식이 아니라 상한표를 조정한다.

## RULE-LEG-005 표현 규칙

- 주 카드(SCR-026) MUST: 엔딩 타이틀, 총점, 밴드 문구, 상위 기여 요인 3개, 아쉬운 기회 1개만 표시한다.
- 백분위는 상세 보기에서만 표시한다. `percentileHidden`이 true이면 상세에서도 숨긴다.
- 하위 백분위 표현 MUST NOT: "상위 94%", "하위 6%" 같은 문구를 금지한다. 상세에서는 "참조 집단의 N%보다 앞섰다" 형식과 밴드 문구만 허용한다.
- 모든 커리어는 엔딩 하나와 최고의 순간 하나를 반드시 가진다. 최고의 순간은 핵심 경기, 트로피, 데뷔, 복귀, 계약 중 서사 가중치가 가장 높은 `sourceId`다.
- 아쉬운 기회는 감점 원인이 아니라 "선택하지 않은 경로" 문구로 표현한다. 예: "두 번째 임대 제안을 거절했다".
- 기여 요인 문구는 원인 태그를 포함한다. 예: "기여 88: 7시즌 연속 출전 시간 80% 이상".

## 커리어 태그 카탈로그

태그는 시즌 결산과 은퇴 시점에 평가하며 이벤트 조건, 엔딩 조건, 서사 점수에 재사용한다.

| ID | 태그 | 부여 조건 요약 | 희귀도 | 재사용 |
|---|---|---|---|---|
| TAG-ONE-CLUB | 원클럽맨 | 프로 8시즌 이상 한 구단 소속, 임대 제외 | RARE | 재계약 이벤트, END-ONE-CLUB-LEGEND |
| TAG-JOURNEYMAN | 저니맨 | 완전 이적 5회 이상 또는 6개 구단 | COMMON | 적응 이벤트, END-JOURNEYMAN |
| TAG-LOAN-LEGEND | 임대 신화 | 임대 중 출전 비율 70% 이상과 평점 상위, 복귀 후 주전 | RARE | 임대 제안 이벤트, END-LOAN-LEGEND |
| TAG-BIG-GAME | 빅게임 플레이어 | 핵심 경기 챕터 성공 5회 이상, 결승·더비 득점 관여 포함 | RARE | 핵심 경기 outcome 가중치 |
| TAG-GLASS-GENIUS | 유리몸 천재 | 잠재력 상위 밴드와 중대 부상 3회 이상 | RARE | 부상 이벤트 문구, 언론 이벤트 |
| TAG-MANAGER-FAVOURITE | 감독의 애제자 | 같은 감독 아래 신뢰 80 이상 3시즌 | COMMON | 감독 교체 이벤트 |
| TAG-LOCKER-LEADER | 라커룸 리더 | 주장·부주장 3시즌 이상, 동료 관계 75 이상 | RARE | 라커룸 중재 이벤트, END-PROMOTION-CAPTAIN |
| TAG-PROMOTION-EXPERT | 승격 전문가 | 승격 2회 이상, 해당 시즌 주전 | RARE | END-PROMOTION-CAPTAIN |
| TAG-DERBY-HERO | 더비의 영웅 | 더비 챕터 결정적 기여 3회 이상 | RARE | 팬 관계 이벤트, END-DERBY-HERO |
| TAG-TRAITOR | 배신자 | 라이벌 구단 직행 이적 또는 약속 위반 이적 후 팬 관계 급락 | COMMON | 친정팀 원정 챕터, END-CONTROVERSIAL-STAR |
| TAG-LATE-BLOOMER | 대기만성 | 26세 이후 최고 OVR을 6 이상 갱신하거나 첫 1부 주전 | RARE | END-LATE-BLOOMER |
| TAG-IRONMAN | 철인 | 10시즌 이상 시즌당 출전 비율 80% 이상, 부상 결장 최소 | EPIC | 장기성 가점, END-IRONMAN |
| TAG-COMEBACK | 컴백 | 중대 부상 또는 장기 결장 후 주전 복귀 | RARE | 재활 이벤트 문구, END-COMEBACK-PLAYER |
| TAG-MENTOR | 멘토 | 유망주 멘토링 이벤트 성공 3회 이상 | COMMON | 은퇴 직전 선택, END-MENTOR |
| TAG-CONTROVERSIAL | 논란의 인물 | 미디어·윤리 이벤트 부정 결과 3회 이상 | COMMON | 스폰서·언론 이벤트, END-CONTROVERSIAL-STAR |
| TAG-UNCROWNED | 무관 | 10시즌 이상 팀 트로피 0, 개인 기록 포지션 상위 | RARE | END-UNCROWNED-KING |

부정 태그(TAG-TRAITOR, TAG-CONTROVERSIAL)는 관계 요소를 감점할 수 있으나 서사 요소에서는 희귀도만큼 가산한다. 부정 태그가 서사를 만드는 것 자체는 유효한 커리어다.

## 엔딩 카탈로그

우선순위는 숫자가 작을수록 높다.

| ID | 엔딩 | 조건 요약 | 요구 태그 | 우선순위 | 대표 문장 |
|---|---|---|---|---:|---|
| END-ONE-CLUB-LEGEND | 원클럽 레전드 | 한 구단 10시즌 이상, 팬 관계 80 이상 | TAG-ONE-CLUB | 10 | 한 구단의 유니폼만 입고 라인을 지켰다 |
| END-NATIONAL-HERO | 대표팀 영웅 | 대표팀 출전 30회 이상 또는 국제대회 토너먼트 챕터 결정적 기여 | 없음 | 15 | 국가의 라인 위에서 가장 빛났다 |
| END-UNCROWNED-KING | 무관의 제왕 | 팀 트로피 0, 성취 60 이상, 기여 80 이상 | TAG-UNCROWNED | 20 | 트로피는 없었지만 누구도 그를 빼고 팀을 말하지 않았다 |
| END-DERBY-HERO | 더비의 영웅 | 더비 챕터 결정적 기여 3회 이상 | TAG-DERBY-HERO | 25 | 그 도시의 절반은 아직도 그 골을 이야기한다 |
| END-PROMOTION-CAPTAIN | 승격 주장 | 승격 2회 이상, 주장 경험 | TAG-PROMOTION-EXPERT | 30 | 올라가는 팀에는 늘 그가 완장을 차고 있었다 |
| END-LOAN-LEGEND | 임대 신화 | 임대 신화 태그와 복귀 후 주전 3시즌 | TAG-LOAN-LEGEND | 35 | 빌려 간 팀이 돌려주기 싫어한 선수 |
| END-COMEBACK-PLAYER | 부상 복귀 선수 | 컴백 태그와 복귀 후 3시즌 이상 활동 | TAG-COMEBACK | 40 | 의사가 말한 날짜보다 늦게, 그러나 확실하게 돌아왔다 |
| END-IRONMAN | 철인 | 철인 태그 | TAG-IRONMAN | 42 | 라인업에서 그의 이름을 지운 감독은 없었다 |
| END-PLAYER-COACH | 선수 겸 코치 | 은퇴 직전 마지막 선택에서 코치 전환 | 없음 | 45 | 마지막 시즌은 벤치 옆에서 시작됐다 |
| END-MENTOR | 유망주 멘토 | 멘토 태그와 30세 이후 3시즌 활동 | TAG-MENTOR | 50 | 그가 키운 선수들이 그의 기록을 넘었다 |
| END-LATE-BLOOMER | 대기만성 | 대기만성 태그와 최고 Base OVR 70 이상(OVR/Legacy 밴드 혼용 정정) | TAG-LATE-BLOOMER | 55 | 남들보다 늦게 라인을 넘었지만 가장 멀리 갔다 |
| END-JOURNEYMAN | 저니맨 | 저니맨 태그와 8시즌 이상 | TAG-JOURNEYMAN | 60 | 여섯 개의 도시가 그를 기억한다 |
| END-CONTROVERSIAL-STAR | 논쟁적 스타 | 배신자 또는 논란의 인물 태그와 성취 60 이상 | TAG-TRAITOR 또는 TAG-CONTROVERSIAL | 65 | 사랑받지는 못했지만 잊히지도 않았다 |
| END-COMPLETE-SHORT | 짧았지만 완결된 커리어 | 폴백. 다른 조건이 없을 때 항상 충족 | 없음 | 999 | 라인을 넘지 못한 날도 그의 축구였다 |

조건 DSL 예시:

```json
{
  "id": "END-ONE-CLUB-LEGEND",
  "priority": 10,
  "when": {
    "all": [
      { "hasTag": ["career.tags", "TAG-ONE-CLUB"] },
      { "gte": ["career.seasonsAtLongestClub", 10] },
      { "gte": ["relationships.fanMemory", 80] }
    ]
  }
}
```

```json
{
  "id": "END-UNCROWNED-KING",
  "priority": 20,
  "when": {
    "all": [
      { "eq": ["career.teamTrophyCount", 0] },
      { "gte": ["legacy.components.achievement", 60] },
      { "gte": ["legacy.components.contribution", 80] }
    ]
  }
}
```

## RULE-LEG-006 엔딩 해소

- 조건을 충족한 엔딩 중 우선순위가 가장 높은 것이 `endingId`가 된다.
- 나머지 충족 엔딩 중 우선순위 상위 2개를 `endingCandidates`에 저장한다. 순서는 우선순위, 같으면 ID 문자열 순으로 고정한다.
- END-COMPLETE-SHORT는 항상 충족하므로 다른 엔딩이 있으면 후보에도 넣지 않는다.
- 클라이언트 MAY: 사용자가 `endingId`와 `endingCandidates` 중 대표 엔딩 하나를 골라 최종 프로필(SCR-028)에 표시한다. 선택은 `displayEndingId`로 별도 저장하고 계산된 `endingId`는 바꾸지 않는다.
- 엔딩 정의가 바뀌면 새 `legacyVersion`이다. 기존 Archive의 `endingId`는 유지한다.

## KICKOFF 도전 보정

Phase 6의 "우승 없이 Legacy 80 달성"은 다음 경로로 도달 가능해야 한다.

| 요소 | 무관 커리어 도달 가능 상한 | 가중 기여 |
|---|---:|---:|
| 성취 | 70 (개인상, 대표팀, 핵심 경기 챕터) | 21.0 |
| 기여 | 95 | 23.8 |
| 장기성 | 90 | 13.5 |
| 관계 | 85 | 12.8 |
| 서사 | 75 | 11.3 |
| 합계 | | 82.4 |

- 참조 분포에서 총점 80 이상은 약 상위 10%, 무관 커리어 중 80 이상은 약 상위 3%를 밸런스 목표로 둔다.
- 도전 판정은 Archive의 `totalScore`와 `teamTrophyCount`만 읽는다. 표시용 밴드나 사용자 선택 엔딩은 입력이 아니다.
- 상한표 조정으로 이 경로가 막히면 TEST-LEG-006이 실패해야 한다.

## DATA-LEG-001 LegacyResult

```ts
type LegacyResult = {
  legacyVersion: string;
  rulesetVersion: string;
  referencePopulationId: string;
  componentScores: {
    achievement: number;
    contribution: number;
    longevity: number;
    relationship: number;
    narrative: number;
  };
  totalScore: number;
  bandId: 'BAND-LEGEND' | 'BAND-ICON' | 'BAND-REMEMBERED' | 'BAND-SOLID' | 'BAND-COMPLETE';
  endingId: string;
  endingCandidates: string[];
  displayEndingId?: string;
  topFactors: [LegacyFactor, LegacyFactor, LegacyFactor];
  missedOpportunity: LegacyFactor;
  bestMomentRef: string;
  percentileByPosition?: number;
  percentileHidden: boolean;
  computedAt: string;
};

type LegacyFactor = {
  component: 'achievement' | 'contribution' | 'longevity' | 'relationship' | 'narrative';
  sourceIds: string[];
  reasonTag: string;
  value: number;
};
```

- Archive에 불변으로 저장한다. 재계산은 새 `legacyVersion`으로 새 LegacyResult를 추가하고 이전 결과를 삭제하지 않는다.
- `percentileHidden` 기본값은 false다. 참조 분포 표본이 부족한 포지션·리그 조합에서만 true로 계산한다. false여도 백분위는 상세 보기에만 노출한다.
- `bestMomentRef`는 항상 존재해야 한다. 후보가 없으면 데뷔 또는 첫 계약 `sourceId`를 사용한다.

## 테스트

| ID | 검증 |
|---|---|
| TEST-LEG-001 | 같은 Archive와 `legacyVersion`으로 100회 계산한 결과 hash가 동일하다 |
| TEST-LEG-002 | GK·DF·MF·FW 동일 품질 fixture의 총점 차이가 ±5 이내다 |
| TEST-LEG-003 | 결승 결승골 fixture에서 같은 `sourceId`가 두 요소에 가산되지 않는다 |
| TEST-LEG-004 | 1시즌 무출전 은퇴 fixture도 `endingId`, `bandId`, `bestMomentRef`를 가진다 |
| TEST-LEG-005 | 참조 분포만 교체했을 때 백분위는 바뀌고 `totalScore`와 `endingId`는 불변이다 |
| TEST-LEG-006 | 무관 fixture가 총점 80 이상에 도달하고 참조 분포 상위 비율이 목표 범위 안이다 |
| TEST-LEG-007 | 주 카드 렌더 결과에 백분위 문자열이 없고 하위 표현 문구가 콘텐츠 검사에서 차단된다 |
| TEST-LEG-008 | 복수 엔딩 충족 fixture에서 우선순위 최솟값이 선택되고 후보 순서가 안정적이다 |
| TEST-LEG-009 | `displayEndingId` 변경이 `endingId`와 `totalScore`를 바꾸지 않는다 |

## 브랜드 어휘와 화면

- 은퇴 화면(SCR-025) 표제는 `FULL TIME`이다. 화면 마지막 줄에 선언문 "커리어에는 VAR이 없다"를 한 번만 표시한다.
- 확정 결과 다시 보기는 "리플레이"다. VAR CHECK는 사용하지 않는다.
- SCR-026은 RULE-LEG-005의 주 카드 규칙을 따른다. SCR-027 연대기는 `topFactors`와 `bestMomentRef`의 `sourceId`로 점프할 수 있어야 한다.
- SCR-028 최종 프로필은 `displayEndingId`가 있으면 그것을, 없으면 `endingId`를 표시한다.
- SCR-SVC-003 개인 시즌 결산의 "최고의 선수"는 `totalScore`가 아니라 밴드와 엔딩 희귀도를 함께 사용한다.

## 관련 문서

- 규칙 정본: [Phase 5](../phases/phase-05-retirement-and-legacy.md), [요구사항 추적표](10-requirements-traceability.md).
- 태그 조건과 이벤트 연결: [이벤트 엔진](04-event-engine.md).
- 리그 정규화 입력: [시뮬레이션](03-game-simulation-engine.md)의 `leagueStrength`, `competitionLevel`.
- 도전 판정: [Phase 6](../phases/phase-06-service-season-kickoff.md).
