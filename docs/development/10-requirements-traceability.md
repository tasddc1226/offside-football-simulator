# 10. 요구사항 추적표

## 핵심 기능 요구사항

| ID | 요구사항 | Phase | 화면/API | 주요 테스트 |
|---|---|---:|---|---|
| FR-CAR-001 | 비로그인 사용자가 커리어를 생성·재개한다 | 0~1 | SCR-001, API-CAR-001~003 | TEST-E2E-001, 007 |
| FR-PLY-001 | 이름·성별·선호 포지션·주발·아키타입·배경으로 선수를 만든다 | 1 | SCR-002~004 | TEST-E2E-001, 성별 불변식 fixture |
| FR-OVR-001 | 역할별 가중치로 Base OVR을 계산한다 | 1 | SCR-003~004 | OVR golden |
| FR-SIM-001 | 전술·폼·체력·관계로 시즌을 계산한다 | 2 | SCR-005~006, 015 | TEST-E2E-002 |
| FR-EVT-001 | 조건형 선택 이벤트를 재현 가능하게 해결한다 | 1~4 | SCR-013~014 | 결정론/property |
| FR-CON-001 | 계약·임대·이적 제안을 비교·확정한다 | 1, 3 | SCR-009~010, 017, 019~020 | TEST-E2E-003 |
| FR-REL-001 | 감독·동료·경쟁자·팬 관계를 누적한다 | 4 | SCR-018, 024 | TEST-E2E-004 |
| FR-INJ-001 | 부상·재활·재발·영구 후유증을 분리한다 | 4 | SCR-022 | TEST-E2E-004 |
| FR-LEG-001 | 은퇴·Legacy·연대기·최종 프로필을 보관한다 | 5 | SCR-025~028 | TEST-E2E-005 |
| FR-SVC-001 | 서비스 시즌과 축구 시즌을 분리한다 | 6 | 허브·시즌 결산 | TEST-E2E-006 |
| FR-NOTICE-001 | 홈에서 운영이 배포 없이 올리는 공지를 본다(D1 `notices`, HOME_NOTICES 상수 대체) | 6 | 허브, API-NOTICE-001 | notices 라우트 테스트, hub.spec.ts |
| FR-SAV-001 | 명령을 원자·멱등 저장하고 복구한다 | 전 Phase | 모든 명령 API | TEST-E2E-007 |
| FR-A11Y-001 | P0 여정을 키보드·스크린리더로 완료한다 | 전 Phase | 모든 P0 화면 | 접근성 suite |
| FR-REC-001 | 복구 코드로 다른 브라우저에서 프로필을 복원한다 | 1 | SCR-004, SCR-030, API-PRO-003~004 | TEST-E2E-008 |
| FR-HUB-001 | 커리어 대시보드에서 상태를 보고 결정 화면으로 들어간다 | 1 | SCR-029 | TEST-E2E-001 |
| FR-ONB-001 | 온보딩과 점진 공개로 수치를 단계적으로 연다 | 1 | SCR-034, StatusStrip | TEST-E2E-009 |
| FR-CHP-001 | 핵심 경기 챕터에서 위험이 보이는 판단을 한다 | 2 | SCR-031, SCR-023 | TEST-E2E-010 |
| FR-TIME-001 | 시즌을 12 step과 두 모드로 진행한다 | 2 | CMD-SIM-001~002 | 시간 모델 테스트 |
| FR-NAT-001 | 대표팀 차출과 국적 규칙 모듈을 처리한다 | 4~5 | SCR-032 | TEST-E2E-004 확장 |
| FR-DSN-001 | 모든 화면이 시각 디자인 토큰과 브랜드 어휘 폐쇄 목록을 지킨다 | 전 Phase | 13, 12 문서 | 시각 회귀·문자열 lint |
| FR-WLD-001 | 국내 Career가 해외 리그·대륙대회까지 확장된다 | 8 | SCR-035~040 | TEST-E2E-011, 013 |
| FR-WLD-002 | 해외 제안의 등록·통화·적응·출전 조건을 비교하고 원자 확정한다 | 8 | SCR-036~038, CMD-CON-001~004 | TEST-E2E-011~012 |
| FR-WLD-003 | 리그·컵·대륙대회·대표팀 일정을 중복 없이 집계한다 | 8 | SCR-039~040 | TEST-E2E-013 |
| FR-WLD-004 | 구 ruleset Career와 Archive를 결과 변경 없이 재개한다 | 8 | 호환 어댑터·Snapshot | migration suite |

## 규칙 요구사항

| ID | 규칙 | 정본 문서 |
|---|---|---|
| RULE-OVR-001 | Base OVR은 영구 능력과 역할 가중치만 사용 | [시뮬레이션](03-game-simulation-engine.md) |
| RULE-PERF-001 | 경기 예상치는 현재 맥락을 별도 합산 | [시뮬레이션](03-game-simulation-engine.md) |
| RULE-RNG-001 | seed·버전·명령이 같으면 결과 동일 | [저장·버전](05-save-and-versioning.md) |
| RULE-EVT-001 | 확정 이벤트 재추첨 금지 | [이벤트](04-event-engine.md) |
| RULE-SVC-001 | 시즌 종료가 기존 Career 삭제/강제 은퇴를 유발하지 않음 | [저장·버전](05-save-and-versioning.md) |
| RULE-SEL-001 | 선발은 전술 적합도·감독 신뢰·예상치·스쿼드 지위로 판정 | [시뮬레이션](03-game-simulation-engine.md) |
| RULE-PLY-001 | 성별은 프로필 정보로만 저장하고 선호 포지션과 현재 주포지션을 분리 | [도메인·데이터 모델](02-domain-and-data-model.md) |
| RULE-TIME-001~004 | 12 step 시즌, advance 규칙, FAST/CHAPTER 모드, 결정 예산 | [시간 모델](11-time-model-and-pacing.md) |
| RULE-LEG-001 | 엔딩은 세계 정상 하나가 아닌 복수 가치 인정 | [Legacy·엔딩](14-legacy-score-and-endings.md) |
| RULE-LEG-002~006 | Legacy 가중치, 중복 가산 금지, 참조 분포, 표현, 엔딩 해소 | [Legacy·엔딩](14-legacy-score-and-endings.md) |
| RULE-WLD-001~006 | OVR 불변, 리그 정규화, 적응 분리, 등록 재검증, 일정 우선순위, 경로 가치 | [WORLD STAGE](15-world-stage-expansion.md) |

## 화면→Phase 매핑

| Phase | 화면 |
|---:|---|
| 1 | SCR-001~004, SCR-007, SCR-009~010, SCR-014, SCR-029, SCR-030, SCR-034 |
| 2 | SCR-005~006, SCR-011~015, SCR-031, SCR-033 |
| 3 | SCR-017, SCR-019~020 |
| 4 | SCR-016, SCR-018, SCR-021~024(경기 판단 변형), SCR-032 |
| 5 | SCR-023(성장 이슈 변형), SCR-025~028 |
| 6 | SCR-001 허브 확장, SCR-006/015 결산 확장, 시즌 전환·앨범 |
| 8 | SCR-035~040, SCR-017~020/029/032 확장 |

상세 진입 조건과 상태는 [화면 인덱스](../screens/README.md)에 있다.

## 변경 영향 확인

- OVR 변경: RULE-OVR-001, DATA-PLY-001, 시즌 결과 UI, golden fixture, rulesetVersion.
- 이벤트 Effect 변경: RULE-EVT-001, DATA-EVT-001, contentPackVersion, 결정론 fixture.
- 시즌 상태 변경: DATA-SVC-001, API-SVC, 전환 런북, 기존 Career 호환 테스트.
- 저장 필드 변경: schemaVersion, migration, Snapshot hash, 구 fixture 재생.
- 선발 규칙 변경: RULE-SEL-001, 선수 A·B fixture, 결과 화면 이유 문구, rulesetVersion.
- 선수 정체성 필드 변경: RULE-PLY-001, DATA-PLY-001, DRAFT·Snapshot schema, 공개 선수 카드, golden fixture와 구 Snapshot migration.
- 시간 모델 변경: RULE-TIME-*, leagueCalendar, 결정 예산, 세션 길이 테스트, 콘텐츠 pack 배치.
- Legacy 변경: RULE-LEG-002~006, legacyVersion, 참조 분포 아티팩트, KICKOFF 도전 보정, 과거 Archive 불변 테스트.
- 브랜드 어휘·시각 토큰 변경: 12·13 문서, 문자열 lint, 스크린샷 회귀.
- 세계 데이터 변경: DATA-WLD-001~007, RULE-WLD-001~006, ruleset/contentPackVersion, 구 Team 어댑터, TEST-E2E-011~013.
