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

## 구현 단계

| 단계 | 목표 | 명세 |
|---|---|---|
| Phase 0 | 기술 기반과 데이터 계약 | [`phase-00-foundation.md`](../phases/phase-00-foundation.md) |
| Phase 1 | 선수 생성부터 첫 계약까지 | [`phase-01-career-vertical-slice.md`](../phases/phase-01-career-vertical-slice.md) |
| Phase 2 | 한 시즌 시뮬레이션 | [`phase-02-full-season.md`](../phases/phase-02-full-season.md) |
| Phase 3 | 계약·임대·이적 | [`phase-03-contract-and-transfer.md`](../phases/phase-03-contract-and-transfer.md) |
| Phase 4 | 부상·관계·평판 | [`phase-04-injury-and-relationships.md`](../phases/phase-04-injury-and-relationships.md) |
| Phase 5 | 장기 성장·은퇴·Legacy | [`phase-05-retirement-and-legacy.md`](../phases/phase-05-retirement-and-legacy.md) |
| Phase 6 | SEASON 1: KICKOFF | [`phase-06-service-season-kickoff.md`](../phases/phase-06-service-season-kickoff.md) |
| Phase 7 | 운영·밸런스·확장 | [`phase-07-live-operations.md`](../phases/phase-07-live-operations.md) |

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

