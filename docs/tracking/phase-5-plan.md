# Phase 5 실행 계획 — 장기 커리어·은퇴·Legacy

착수: 2026-09-05, 사용자 요청에 따라 Phase 3·4와 겹치지 않는 별도 작업으로 진행한다.
착수 기준 main: `a468837` · 초기 브랜치: `T-5-001-career-foundation`

정본: [Phase 5 범위](../phases/phase-05-retirement-and-legacy.md), [Legacy·엔딩](../development/14-legacy-score-and-endings.md), [고도화 실행 계획](../development/16-advancement-execution-plan.md).

## 1. 충돌 회피 계약

현재 다른 작업이 소유한 `simulate.ts`, `types.ts`, `ruleset.ts`, `packages/domain/src/index.ts`, 기존 fixture/golden, `packages/contracts`, `packages/content`, 웹 라우트·공통 UI·E2E, CI와 추적 보드는 수정하지 않는다.

이번 첫 작업의 쓰기 범위는 다음으로 제한한다.

- `packages/domain/src/legacy/`: 신규 순수 함수와 그 테스트, 로컬 barrel.
- `docs/development/16-advancement-execution-plan.md`: 기존 고도화 계획을 저장소에 포함.
- 이 문서와 `docs/tracking/briefs/T-5-001.md`.

기존 `SeasonSummary`·`SeasonResult`를 읽기 전용으로 소비한다. 패키지 공통 export도 아직 연결하지 않아 기존 엔진·웹 런타임 경로를 바꾸지 않는다. Phase 3·4의 수정 완료를 기다려야 하는 통합은 후속 작업으로 분리한다. 보드의 Phase 3·4 상태나 다른 세션의 소유권을 이 문서에서 변경하지 않는다.

## 2. 구현 순서와 상태

아래 번호는 이 계획의 작업 제안이다. 외부 작업 시스템에 자동 배정한 것이 아니며, 이번에 착수한 것은 T-5-001 하나다.

| 작업    | 범위                                                                              | 선행 조건                               | 상태                             |
| ------- | --------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------- |
| T-5-001 | 통산 기록 projection, 정규화된 Legacy 가중합·밴드, 이미 충족된 엔딩 우선순위 해소 | 현재 SeasonResult                       | 로컬 구현·검증 완료, main 미통합 |
| T-5-002 | 통산·업적 정본, 불변 Archive, Legacy 버전·저장 계약                               | T-5-001, 공유 타입 변경 소유권 합의     | 예정                             |
| T-5-003 | 다년 성장·노쇠, 은퇴 압력, 마지막 선택과 명령                                     | T-5-002, Phase 3·4 엔진 통합 완료       | 예정                             |
| T-5-004 | 기록→Legacy 절대 상한표 정규화, sourceId 중복 가산 방지                           | T-5-002, 실제 업적 입력과 상한표 확정   | 예정                             |
| T-5-005 | 14종 엔딩 eligibility, 최고 순간·기여 이유·선택하지 않은 기회                     | T-5-003·004, 모호한 조건 정정           | 예정                             |
| T-5-006 | SCR-025~028 은퇴·Legacy·연대기·프로필과 새 커리어                                 | T-5-002~005, Phase 4 화면·UI 통합 완료  | 예정                             |
| T-5-007 | 20년 실제 엔진 완주, Archive 불변·복구, 포지션 참조 분포·접근성·E2E               | T-5-003~006                             | 예정                             |
| T-5-008 | 한국 국적 규칙 모듈 및 연대기 검증                                                | 포함 범위·규칙 버전·생성 기록 계약 확정 | 범위 결정 대기                   |

T-5-001의 하위 계산기가 통과해도 FR-LEG-001, TEST-LEG-001~009 전체 또는 Phase 5를 완료 처리하지 않는다. Phase 6 버전 실행 보존과 맞물리는 지점은 T-5-002에서 정한다.

## 3. T-5-001 데이터 경계

### 통산 기록

`aggregateCareerRecords(history)`는 한 커리어의 **확정된** `seasonHistory`만 받는다.

- 정본은 각 `SeasonSummary.result`다. 바깥 summary의 index/team/mode/competitions가 다르거나 결과 hash가 다르면 오류로 거부한다. hash는 정합성 검증이지 서버 인증·부정행위 방지 수단이 아니다.
- `appearances.total`은 선수의 출전 수가 아니라 결장을 포함한 기록 경기 수이므로 `scheduledMatches`에 담는다. `playedMatches = total - zeroMinute`다. `starts`, `substitutions`, `outMatches`는 기존 카운터의 의미를 보존한다.
- 평점은 `ratingSumTenths / ratedMatches`로 계산해 마지막에 한 번 반올림한다. 평점 없는 커리어는 0점이 아닌 `null`이다.
- 임대 시즌은 `result.teamId` 하나에만 귀속한다. 원소속 계약과 clubHistory를 별도 가산하지 않는다.
- GK/DF/MF/FW 통계는 별도 묶음으로 보존한다. GK의 음수 `psxgMinusGoalsCenti`도 유지한다. 현재 수집되지 않는 포지션별 득점을 임의로 0으로 채운 통합 득점은 만들지 않는다.
- 동일 시즌의 동일 증거는 1번만 집계한다. 다른 결과나 settlement revision을 가진 중복은 오류다. 시즌·구단·포지션 출력 순서는 결정론적으로 고정한다.
- `sources`에 시즌 index·구단·확정 revision·결과 hash를 보존한다. 입력 참조를 결과에 공유하지 않는다.
- 데이터가 비거나 시즌 index가 띄엄띄엄이어도 존재하는 기록만 집계한다. 이것은 완전한 은퇴 Archive의 증명이 아니다. 누락 시즌·커리어 종료·버전 검증은 T-5-002·003의 책임이다.
- 대표팀 소집을 A매치 출전으로, 연봉 계약액을 실제 수입으로, 부상 교체 횟수를 중대 부상 에피소드 수로 취급하지 않는다. 우승·승격·개인상·수입·대표팀 통산은 이번 projection에 없다.

### Legacy 점수

`calculateLegacyScore`는 **이미 정규화된 0~100 정수 5개**에 기존 가중치 30/25/15/15/15를 적용한다. 원시 통산 기록을 점수로 정규화하지 않는다. NaN·Infinity·소수·범위 밖 값은 clamp하지 않고 거부한다.

규칙 버전, 참조 모집단, percentile, topFactors, bestMomentRef, computedAt은 이번 결과에 없으므로 `LegacyScoreSummary`라고 부른다. 저장 정본 `LegacyResult`를 대신하지 않는다. 정규화 상한표·버전 manifest·40,000개 이상의 참조 커리어 검증은 후속 작업이다.

### 엔딩

`resolveLegacyEndings`는 이미 충족된 ID만 받아 정본의 우선순위를 적용한다. 14종 ID가 등록되어 있다는 것은 14종 엔딩이 게임에서 달성 가능하다는 뜻이 아니다.

- 최우선 엔딩 1개 + 추가 후보 최대 2개.
- 의미 있는 엔딩이 있으면 폴백은 후보에서도 제외.
- 중복 ID는 제거하고 알려지지 않은 ID는 거부.
- 표시 엔딩 선택은 원래 계산된 엔딩을 바꾸지 않는 별도 값.
- 대기만성 조건의 OVR/Legacy 밴드 혼용, 대표팀 출전·승격 기록 등 미확정 eligibility를 임의 구현하지 않는다.

## 4. 검증과 해석

T-5-001 검증 기록은 브리프에 남긴다. 기존 실제 SETTLE_SEASON fixture와 임대/복귀 fixture는 읽기 전용으로 재생한다. 신규 집계 테스트는 입력 상태/hash를 바꾸지 않는지 확인한다.

20개 시즌을 합성한 자료의 집계·100회 hash 일치 테스트와 **20년 실제 엔진 완주**는 구분한다. 이번 작업은 전자만 구현하며, 실제 엔진 다년 플레이·은퇴 후 명령 거부·불변 저장·화면은 T-5-007에서 검증한다. 마찬가지로 동일 점수 입력의 재현성은 포지션별 실제 성과 정규화의 공정성을 증명하지 않는다.

현재 브랜치에서 전체 기존 도메인 회귀를 실행해 기존 golden을 갱신하지 않고 통과해야 한다. 외부 UI 동작을 바꾸지 않으므로 이 작업에서 새 브라우저 플레이나 운영 배포를 하지 않는다.

## 5. 통합 전에 확정할 것

1. Archive의 identity·버전·sourceId·결산 기록 보존 및 서버/로컬 저장 계약.
2. 원시 기록의 Legacy 절대 상한표와 입력별 소유권. 없는 데이터를 0점으로 임의 처리하지 않기.
3. 엔딩 조건의 단위와 실제 업적 생성 경로, 한국 국적 모듈의 필수 범위.
4. 은퇴 압력 계수·경계·마지막 선택의 재진입 및 멱등성 계약.
5. 공유 파일 변경 가능 시점. 해당 시점에 최신 main을 통합하고 Phase 3·4 회귀를 다시 수행.

이번 착수는 코드·문서 준비이며 PR 병합·출시·다른 작업 재배정 권한을 확대하지 않는다.
