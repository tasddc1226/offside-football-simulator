# Phase 5 인수 감사 — 은퇴·Legacy·Archive

후속 구현은 [현재 실행 상태](phase-5-plan.md)와 [런타임 통합 명세](../development/19-phase5-runtime-integration.md)를
참조한다. 아래 미구현 표는 `99d1121` 시점 감사 원본으로 보존한다. 현재의 실제 RETIRE·서버 보관·
결과 화면·한국 모듈 구현을 이 과거 표만 보고 미구현이라고 판단하지 않는다. 반대로 현재 필수 gate의
최종 모집단·활성화·실제 QA 증거를 확인하기 전에는 Phase 5 전체를 완료 처리하지 않는다. 14개 엔딩은
저장 근거를 갖춘 `RAW_EVIDENCE` fixture 검증이며 14개 모두의 자연 플레이를 뜻하지 않는다.

## 2026-09-06 후속 인수 결정

이 감사의 과거 미구현 판정과 분포 결과는 당시 증거로 보존한다. 사용자는 합성 모집단의 밴드 비율을
관찰 목표로 승인했으며, 목표 범위 이탈만으로 병합을 중단하지 않는다. 대신 다음 네 조건은 계속
필수다: (1) 기존 Archive·Legacy 결과와 null reference binding의 byte/hash 호환성, (2) 동일 품질
GK/DF/MF/FW의 점수 공정성, (3) 저장된 경기 근거를 사용하는 고득점 경로의 실제 도달 가능성,
(4) 참조집단 provenance·표본 수·seed 무결성.
새 후보의 런타임 생성·보관·재로드·복구 증거가 준비되기 전에는 전체 완료로 표시하지 않는다.

현재 통합에서 RETIRE 명령·서버 원자 보관·Legacy 계산/근거·네 엔딩 화면·한국 모듈은 구현됐다.
남은 필수 gate는 (a) ruleset 1.1/content 0.3 신규 은퇴가 Legacy 1.1과 발행 참조집단을 실제로
선택하는 활성화, (b) 최종 40k 산출물의 provenance/count/seed와 동일 품질 포지션 공정성·80점 이상
도달성 확인, (c) 그 구성으로 신규 생성→플레이→은퇴→보관→새로고침→복구를 거치는 실제 QA,
(d) 최종 head CI와 병합이다. 이 항목들의 결과는 아직 이 문서에 기록하지 않는다.

기준 문서: `phase-05-retirement-and-legacy.md`, `14-legacy-score-and-endings.md`,
`17-phase5-archive-contract.md`, `18-retirement-pressure-and-last-choice.md`.
기준 커밋: `99d1121` (`T-5-003` 독립 은퇴 압력·마지막 선택 코어).

후속 구현: 아래 표는 **통합 전 감사**다. 이후 실제 RETIRE 명령·원자 Archive 저장, LegacyResult,
화면과 4포지션 20시즌 회귀가 추가됐다. 아래의 `없음`·`미구현` 표현은 현재 코드 상태가 아니라
`99d1121`에서 무엇이 부족했는지를 보존한다. 최신 충족/미충족 구분은 위 현재 gate와
[통합 브리프](briefs/T-5-003-local-integration.md)를 참조한다.

## 판정 요약 — `99d1121` 당시 감사

현재는 Phase 5 전체 인수 불가다. `packages/domain/src/legacy/`에 통산 기록,
점수 요약, 엔딩 우선순위, Archive 코어/버전 binding, 은퇴 압력·선택 **계획**이
있다. `pnpm --filter @offside/domain exec vitest run src/legacy`는 6개 파일·172개
테스트가 통과하지만, 이 결과는 독립 순수 함수의 증거일 뿐 실제 은퇴 명령, 저장,
LegacyResult, 다년 엔진, 화면, 한국 국적 모듈의 인수 증거가 아니다.

## Phase 5 완료 조건별 감사 — 역사 기록

| 완료 조건                                     | 현재 근거                                                                              | 정확한 미충족 사항                                                                                                                      | 필요한 인수 증거/경계 테스트                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 20년 범위 fixture를 제한 시간 안에 완주       | 20시즌 합성 집계 입력을 다루는 T-5-001 계열 테스트만 있음                              | 실제 `simulate`로 20년을 진행하고 시즌 결산·성장·부상·계약·이벤트를 연결한 fixture와 시간 예산이 없음                                   | 고정 seed 20년 E2E 1건, 제한 시간 측정, 결과 hash/메모리 상한 기록; 실패 시 원인별 단계 로그              |
| 포지션별 성장·노쇠 경계가 golden curve와 일치 | `growth.ts` 기존 성장식과 기존 growth 테스트가 있음                                    | Phase 5용 GK/DF/MF/FW golden curve, 20년 노쇠 경계, 장기 회귀 비교가 없음. T-5-003은 성장식을 의도적으로 연결하지 않음                  | 포지션×연령 경계 fixture, golden JSON, 기존 시즌 회귀 및 centi 이월 검증; 노쇠 중복 적용 여부 확인        |
| 은퇴 후 일반 진행 명령이 거부                 | Archive 코어는 `RETIRED` checkpoint만 수용하고, retirement 함수는 상태를 변경하지 않음 | `RETIRE` command, Career 상태 전환, ARCHIVED 이후 `START/ADVANCE/SETTLE` 거부 및 API 오류 계약이 없음                                   | 저장소를 포함한 RETIRE 성공/재시도/후속 명령 테스트; 명령별 오류 코드와 revision 불변 검증                |
| 통산 합계가 FootballSeason 기록 합과 일치     | `aggregateCareerRecords`가 확정 `SeasonSummary.result` 정합성을 검사                   | 실제 은퇴 경계에서 모든 시즌을 모아 Archive에 기록하고, 승격·트로피·대표팀·수입 등 Legacy 입력의 정본을 연결하지 않음                   | 다년 CareerState→Archive 합계 비교, 누락·중복·임대 귀속 fixture, sourceId와 결과 hash 검증                |
| 같은 Career의 Legacy 결과 재현                | 점수 요약은 동일 입력 가중합, Archive hash/legacy binding은 결정론적                   | 완전한 `LegacyResult`(절대 상한표, topFactors, missedOpportunity, bestMomentRef, percentile)와 `legacyVersion` manifest/registry가 없음 | 같은 Archive/version 100회 hash 동일, 정의 checksum drift 거부, 참조분포 교체 시 total/ending 불변 테스트 |
| 의미 있는 엔딩 최소 12종과 폴백 제공          | 14개 ID와 우선순위 해소 함수, 폴백 ID가 등록됨                                         | ID 등록은 달성 가능성을 증명하지 않음. 실제 태그·업적 생성/eligibility evaluator와 14개 달성 fixture가 없음                             | 각 14종 최소 1 fixture, 복수 충족 후보 정렬, 폴백·1시즌 무출전, 미확인 ID 거부 테스트                     |
| Archive 생성 후 변경 불가                     | 깊은 freeze, canonical hash, INSERT/REUSE/conflict 순수 정책 테스트                    | DB 원자 insert-if-absent, 소유권/CAS, 응답 유실·동시성·ARCHIVED 상태 원자 저장이 없음                                                   | 동일 요청 100회 경쟁, 다른 내용 conflict, 중간 write 실패 복구, 다른 소유자 접근/PUT 거부 테스트          |
| 동일 품질 GK/DF/MF/FW 점수 차이 ±5 이내       | 현재 `calculateLegacyScore`는 이미 정규화된 5개 점수만 받음                            | 포지션별 기대 출전·기록 상한표와 4포지션 동일 품질 실제 기록 fixture, 참조분포가 없음                                                   | 포지션별 최소 fixture와 합성 분포 진단; ±5 공정성 초과 시 출시 중단. 밴드 비율 편차만으로는 중단하지 않음 |
| 한국 국적 병역 경로가 연대기·통산에 반영      | 현재 기본 `nationalityRuleState`만 생성되며 관련 규칙 모듈 없음                        | 한국 모듈 인터페이스, 병역/U23·아시안게임·올림픽 특례, 복무 경로 이벤트와 Archive 반영이 전부 미구현                                    | 한국 fixture의 각 경로/거절/예외, timeline·season summary·Archive sourceId 일치 및 기본 국적 회귀         |

## 계약별 미충족 구현·데이터

### 은퇴 압력과 마지막 선택

`retirement.ts`는 정책과 facts를 받아 `CONTINUE/WATCH/REVIEW`를 계산하고,
검증된 offer ID를 포함한 `CONTRACT_CONFIRMATION` 또는
`RETIREMENT_CONFIRMATION` 계획만 반환한다. 운영 정책 기본값과 CareerState facts
어댑터가 없고, `resolveRetirementDecision`의 INSERT/REUSE도 메모리 계획이다.

다음이 연결되기 전에는 은퇴 완료로 표시하면 안 된다.

- 결산 revision에서 facts를 한 번만 만드는 신뢰 어댑터와 불변 정책 registry.
- `RETIRE` 명령의 expectedRevision CAS, 멱등 command log, 계약 성공 시점의
  `lastChanceConsumed` 원자 저장.
- 제안 만료·두 기기 경합·응답 유실·자발적 은퇴 취소·마지막 계약 기간 상한의
  제품 계약.
- 중도 은퇴의 부분 시즌 결산 정책. 현재 코어의 활성 시즌 거부는 영구 제품
  금지로 해석할 수 없다.

### Archive·Legacy

`createCareerArchiveCore`는 RETIRED snapshot과 연속 확정 season history를
검증하는 독립 코어다. `ArchiveLegacyBinding`은 향후 평가 행의 주소/버전만
보존하며 완전한 `LegacyResult`가 아니다. 실제 저장 어댑터, API, ARCHIVED 상태
전환, 서버 replay/소유권 검증은 없다. 관계 전체 궤적, 실제 수입, 승격·개인상,
대표팀 출전, 부상 결장 분모와 sourceId 정본도 부족하다.

`14-legacy-score-and-endings.md`의 0~100 5축 정규화, 중복 가산 방지, 참조분포,
topFactors/missedOpportunity/bestMoment 표현 규칙은 구현되지 않았다. 현재 점수
함수에 원시 기록을 넣거나 기존 단순 점수 테스트를 `LegacyResult` 인수 증거로
확대 해석하면 안 된다.

### 화면·반복 루프

SCR-025~028, `FULL TIME`/선언문, Timeline sourceId jump, 표시 엔딩 선택,
선수 보관함과 새 커리어 시작의 통합 인수 증거가 없다. 화면 문구에 백분위 또는
하위 순위 표현이 섞이지 않는 콘텐츠 검사가 필요하다.

## 제품 결정이 필요한 모호성

1. 운영 retirement policy의 age band·가중치·WATCH/REVIEW 경계와 ruleset 버전.
2. 마지막 계약의 최대 기간, 계약 기회 소비 후 재평가 시점, 제안 만료/거절 및
   자발적 은퇴 취소의 허용 시점.
3. 활성 시즌 중 은퇴 허용 여부와 허용 시 부분 시즌을 통산·Legacy에 넣는 규칙.
4. 엔딩 조건의 측정 단위. 특히 `TAG-LATE-BLOOMER`의 “OVR 6 갱신”과
   `BAND-REMEMBERED 이상` 결합, 대표팀 “출전”과 소집의 구분.
5. 팀 트로피·승격·개인상·대표팀·수입·부상·관계·태그의 생성 주체와 sourceId
   중복 방지 계약.
6. 포지션별 정규화 절대 상한표와 참조분포 artifact/최소 표본, percentileHidden
   조건.
7. 한국 국적 모듈의 필수 범위, 복무 경로가 경기 가능 기간·관계·수입·Timeline에
   미치는 효과와 버전 호환 정책.
8. Archive 요청/본문 크기 상한을 초과할 때의 분할·원본 보관 방식. 코어를
   잘라 저장하는 것은 허용되지 않는다.

## 다음 작업의 bounded test tasks

- **A1 — 20년 성장 회귀:** 고정 seed 4포지션으로 실제 엔진 20년 진행, golden curve와 시간 예산을 검증한다. 공유 API/화면은 건드리지 않는다.
- **A2 — RETIRE 수직 슬라이스:** facts adapter→RETIRE→RETIRED snapshot→Archive/LegacyResult→ARCHIVED를 한 저장소 fixture에 연결하고 일반 명령 거부를 검증한다.
- **A3 — 저장 경쟁성:** 동일 요청 100회, 다른 revision/본문 경합, 응답 유실·중간 실패를 대상으로 unique/CAS/원자성 테스트를 만든다.
- **A4 — Legacy 입력 정본:** 4포지션 동일 품질 및 무관 80점 fixture, 절대 상한표와 sourceId 중복 검사를 추가하고 10,000개/포지션 분포 리포트를 생성한다.
- **A5 — 엔딩 eligibility:** 14종 엔딩 각각 달성 가능한 최소 fixture와 폴백·후보·표시 엔딩 불변 테스트를 만든다.
- **A6 — UI 계약:** SCR-025~028 렌더/E2E에서 주 카드 필드, 백분위 숨김, `FULL TIME`, Timeline jump, Archive 불변을 검증한다.
- **A7 — 한국 모듈:** 결정된 규칙 버전으로 병역 경로별 timeline·season·Archive fixture와 기본 모듈 회귀를 추가한다.

위 작업 중 하나의 독립 순수 함수 테스트 통과만으로 Phase 5 완료를 선언하지 않는다.
