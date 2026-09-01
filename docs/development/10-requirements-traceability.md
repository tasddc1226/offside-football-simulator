# 10. 요구사항 추적표

## 핵심 기능 요구사항

| ID | 요구사항 | Phase | 화면/API | 주요 테스트 |
|---|---|---:|---|---|
| FR-CAR-001 | 비로그인 사용자가 커리어를 생성·재개한다 | 0~1 | SCR-001, API-CAR-001~003 | TEST-E2E-001, 007 |
| FR-PLY-001 | 포지션·주발·아키타입·배경으로 선수를 만든다 | 1 | SCR-002~004 | TEST-E2E-001 |
| FR-OVR-001 | 역할별 가중치로 Base OVR을 계산한다 | 1 | SCR-003~004 | OVR golden |
| FR-SIM-001 | 전술·폼·체력·관계로 시즌을 계산한다 | 2 | SCR-005~006, 015 | TEST-E2E-002 |
| FR-EVT-001 | 조건형 선택 이벤트를 재현 가능하게 해결한다 | 1~4 | SCR-013~014 | 결정론/property |
| FR-CON-001 | 계약·임대·이적 제안을 비교·확정한다 | 1, 3 | SCR-009~010, 017, 019~020 | TEST-E2E-003 |
| FR-REL-001 | 감독·동료·경쟁자·팬 관계를 누적한다 | 4 | SCR-018, 024 | TEST-E2E-004 |
| FR-INJ-001 | 부상·재활·재발·영구 후유증을 분리한다 | 4 | SCR-022 | TEST-E2E-004 |
| FR-LEG-001 | 은퇴·Legacy·연대기·최종 프로필을 보관한다 | 5 | SCR-025~028 | TEST-E2E-005 |
| FR-SVC-001 | 서비스 시즌과 축구 시즌을 분리한다 | 6 | 허브·시즌 결산 | TEST-E2E-006 |
| FR-SAV-001 | 명령을 원자·멱등 저장하고 복구한다 | 전 Phase | 모든 명령 API | TEST-E2E-007 |
| FR-A11Y-001 | P0 여정을 키보드·스크린리더로 완료한다 | 전 Phase | 모든 P0 화면 | 접근성 suite |

## 규칙 요구사항

| ID | 규칙 | 정본 문서 |
|---|---|---|
| RULE-OVR-001 | Base OVR은 영구 능력과 역할 가중치만 사용 | [시뮬레이션](03-game-simulation-engine.md) |
| RULE-PERF-001 | 경기 예상치는 현재 맥락을 별도 합산 | [시뮬레이션](03-game-simulation-engine.md) |
| RULE-RNG-001 | seed·버전·명령이 같으면 결과 동일 | [저장·버전](05-save-and-versioning.md) |
| RULE-EVT-001 | 확정 이벤트 재추첨 금지 | [이벤트](04-event-engine.md) |
| RULE-SVC-001 | 시즌 종료가 기존 Career 삭제/강제 은퇴를 유발하지 않음 | [저장·버전](05-save-and-versioning.md) |
| RULE-LEG-001 | 엔딩은 세계 정상 하나가 아닌 복수 가치 인정 | [Phase 5](../phases/phase-05-retirement-and-legacy.md) |

## 화면→Phase 매핑

| Phase | 화면 |
|---:|---|
| 1 | SCR-001~004, SCR-007, SCR-009~010, SCR-014 |
| 2 | SCR-005~006, SCR-011~015 |
| 3 | SCR-017, SCR-019~020 |
| 4 | SCR-016, SCR-018, SCR-021~024 |
| 5 | SCR-025~028 |
| 6 | SCR-001 허브 확장, SCR-006/015 결산 확장, 시즌 전환·앨범 |

상세 진입 조건과 상태는 [화면 인덱스](../screens/README.md)에 있다.

## 변경 영향 확인

- OVR 변경: RULE-OVR-001, DATA-PLY-001, 시즌 결과 UI, golden fixture, rulesetVersion.
- 이벤트 Effect 변경: RULE-EVT-001, DATA-EVT-001, contentPackVersion, 결정론 fixture.
- 시즌 상태 변경: DATA-SVC-001, API-SVC, 전환 런북, 기존 Career 호환 테스트.
- 저장 필드 변경: schemaVersion, migration, Snapshot hash, 구 fixture 재생.

