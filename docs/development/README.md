# OFFSIDE 개발 명세 인덱스

이 디렉터리는 제품 기획서를 구현 가능한 계약으로 변환한 개발 정본이다. 제품 의도는 상위의 `offside-football-simulator-design.*`, 구현 판단은 이 디렉터리와 `phases/`, 화면 동작은 `screens/`를 따른다.

## 읽는 순서

1. [개발 로드맵](00-development-roadmap.md)
2. [시스템 아키텍처](01-system-architecture.md)
3. [도메인·데이터 모델](02-domain-and-data-model.md)
4. [경기·시즌 시뮬레이션](03-game-simulation-engine.md)
5. [이벤트 엔진](04-event-engine.md)
6. [저장·버전·서비스 시즌](05-save-and-versioning.md)
7. [UI·UX 공통 계약](06-ui-ux-specification.md)
8. [API 계약](07-api-contract.md)
9. [테스트 전략](08-testing-strategy.md)
10. [배포·운영](09-deployment-and-operations.md)
11. [요구사항 추적표](10-requirements-traceability.md)
12. [시간 모델과 페이싱](11-time-model-and-pacing.md)
13. [브랜드 가이드](12-brand-guidelines.md)
14. [시각 디자인 시스템](13-visual-design-system.md)
15. [Legacy Score·엔딩](14-legacy-score-and-endings.md)
16. [WORLD STAGE 세계관 확장](15-world-stage-expansion.md)

콘텐츠 저작 형식과 종이 프로토타입은 [`../content/README.md`](../content/README.md)에 있다. 기술 스택·인프라·앱인토스 채널 확정 결정은 [`../adr/README.md`](../adr/README.md), 진행 보드와 워커 위임 규칙은 [`../tracking/README.md`](../tracking/README.md)에 있다.

2026-09-02 ADR 확정으로 이 디렉터리의 실행 위치 관련 서술이 바뀌었다. 시뮬레이션은 브라우저 엔진이 실행하고 서버는 동기화·보관·검증만 한다. 01, 05, 07 문서가 갱신됐으며 다른 문서에서 "서버가 실행한다"는 표현이 남아 있으면 ADR-002·003이 우선한다.

## 정본 우선순위

문서가 충돌하면 다음 순서로 읽는다.

1. `docs/development/` 공통 명세
2. `docs/phases/` 단계 명세
3. `docs/screens/` 화면 명세
4. `docs/content/` 콘텐츠와 프로토타입
5. `docs/offside-football-simulator-design.*` 제품 설계서

제품 설계서는 제품 의도와 원작 분석의 정본이다. 다음 절은 이 디렉터리로 대체됐으므로 구현 근거로 쓰지 않는다.

| 설계서 절 | 대체 문서 | 이유 |
|---|---|---|
| 2장 화면 상태 모델(CREATE/AMATEUR/OFFSEASON 등 8종) | 02 Career.status, FootballSeason.phase, 11 step | 상태 모델 이원화 |
| 3.1 화면별 명세의 필드명(idempotencyKey, PlayerSeed, SeasonRecord, contentPackId) | 02, 05, 07 | commandId, Player, SeasonResult, contentPackVersion으로 통일 |
| 3.1 Screen 23 | screens/05 SCR-023 두 변형 | 경기 판단과 성장 이슈 분리 |
| 5장 능력치 구조의 "관계" 묶음 | 02 능력과 상태의 분리 | 관계는 능력치가 아니라 별도 상태 |
| 6.4 시장가치 지수의 Potential 항 | 03 리그와 시장가치 | 숨긴 정본 대신 정찰 범위 중간값 |
| 11장 "월별 진행", 11.2 "공간형 UI" | 11 시간 모델, screens/05 SCR-029 | 구현 계약으로 구체화 |
| 12장 브랜드 어휘(VAR CHECK, FULL TIME 시즌 결산, "적용됩니다") | 12 브랜드 가이드 | 어휘 정리 |
| 13장 "2차 확장: 감독 전술 적합도" | Phase 2 | 전술 적합도는 1차 핵심 |
| Screen 26 백분위 | 14 Legacy·엔딩 | 고정 참조 분포, 백분위는 보조 |

## 구현 단계

| 단계 | 목표 | 명세 |
|---|---|---|
| 종이 프로토타입 | Phase 0 전 재미 검증 | [`../content/prototype/season-01-inside-forward.md`](../content/prototype/season-01-inside-forward.md) |
| Phase 0 | 기술 기반과 데이터 계약 | [`phase-00-foundation.md`](../phases/phase-00-foundation.md) |
| Phase 1 | 선수 생성부터 첫 계약까지 | [`phase-01-career-vertical-slice.md`](../phases/phase-01-career-vertical-slice.md) |
| Phase 2 | 한 시즌 시뮬레이션, 이후 `LINE TEST` 공개 | [`phase-02-full-season.md`](../phases/phase-02-full-season.md) |
| Phase 3 | 계약·임대·이적 | [`phase-03-contract-and-transfer.md`](../phases/phase-03-contract-and-transfer.md) |
| Phase 4 | 부상·관계·평판 | [`phase-04-injury-and-relationships.md`](../phases/phase-04-injury-and-relationships.md) |
| Phase 5 | 장기 성장·은퇴·Legacy | [`phase-05-retirement-and-legacy.md`](../phases/phase-05-retirement-and-legacy.md) |
| Phase 6 | SEASON 1: KICKOFF | [`phase-06-service-season-kickoff.md`](../phases/phase-06-service-season-kickoff.md) |
| Phase 7 | 운영·밸런스·확장 | [`phase-07-live-operations.md`](../phases/phase-07-live-operations.md) |
| Phase 8 | WORLD STAGE 해외 리그·국제 무대 확장 | [`phase-08-world-stage.md`](../phases/phase-08-world-stage.md) |

## 규범 키워드

- **MUST**: 출시 조건. 구현과 테스트가 반드시 필요하다.
- **SHOULD**: 특별한 사유가 없으면 구현한다.
- **MAY**: 일정과 검증 결과에 따라 선택한다.
- `FR-*`: 기능 요구사항, `RULE-*`: 게임 규칙, `SCR-*`: 화면, `API-*`: API, `DATA-*`: 데이터, `EVT-*`: 도메인 이벤트, `TEST-*`: 검증 항목, `OPS-*`: 운영 요구사항.

## 변경 규칙

- 게임 결과에 영향을 주는 변경은 `rulesetVersion`을 올린다.
- 이벤트 데이터만 바뀌어도 결과 확률·효과가 달라지면 `contentPackVersion`을 올린다.
- 기존 커리어의 결과를 새 규칙으로 소급 재계산하지 않는다.
- 명세 변경 PR에는 관련 요구사항 ID와 테스트 ID를 함께 적는다.
