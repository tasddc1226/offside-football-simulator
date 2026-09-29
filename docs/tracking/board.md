# 진행 보드

## 확장 기획 검토

| 작업 | 범위 | 상태 |
|---|---|---|
| T-10-078 | [서비스 시즌·커리어 카드·구단·유저 이적시장 기획](season-card-market-plan.md) | B 시즌 명예의 전당 반영(T-10-090) · D 구단 편성은 은퇴 선수 구단주 팀으로 일부 반영(T-10-092) · C 카드·E 교환·F 시장 미구현 |
| T-10-082 | [구단주 도전 과제·칭호 기획](owner-quests-and-titles-plan.md) | 기획 작성 · 세부 조건 검토 대기 · 기능 미구현(관련: 구단 시즌 업적 T-10-092 반영) |

## 분석 기획 검토

- T-10-083: [GA4 최소 행동 측정 기획](ga4-measurement-plan.md) — 문서 작성, 구현·운영 설정 미적용.

## 다음 서비스 시즌 준비

| 작업 | 범위 | 상태 |
|---|---|---|
| T-10-088 | [칭호·LS·선수 성장 개선 기획](season2-balance-plan.md) — 운영 집계, 개선 순서, 검증·호환성·출시 기준 | 기획 검토 중 · A 일부 반영(T-10-086 대표 칭호 자동 선택) · C 일부 반영(T-10-090 서비스 시즌) · B·D·E·F 미구현 |

## Phase 9: 풀타임 전환 (2026-09-24)

**이 절이 아래 모든 과거 이력(Phase 0~8, T-0~T-7)보다 우선한다.** 오너 결정
(2026-09-23/24 KST)에 따라 원작 OFFSIDE(결정론적 Web Worker 시뮬레이터)를
새 게임 **풀타임**(확률/이벤트 기반, vanilla Vite + TypeScript)으로 전면
교체한다. 상세 배경과 대체·수정된 ADR 목록은
[ADR-013](../adr/ADR-013-fulltime-replacement.md)을 참고한다. 원작 기획·화면·
콘텐츠·QA·디자인·트래킹 문서는 [`docs/archive/offside/`](../archive/offside/README.md)에
보존돼 있다.

### T-9-001: 풀타임 전환

| 서브트랙 | 범위 | 상태 |
|---|---|---|
| T-9-001a | `apps/api` — health·profile·Google 로그인만 남기고 계정 병합·게임 라우트 제거, D1 마이그레이션 0015 | done |
| T-9-001b | `apps/web` — vanilla Vite + TypeScript로 전환, `src/game/*` 게임 모듈, 34개 세부 능력치·육각형 레이더·포지션 OVR, 이벤트·국가대표·병역·이적 시장·로컬 명예의 전당, 공개 정적 페이지 | done |
| T-9-001c | CI/운영 — 파이프라인·배포 설정을 새 구조에 맞게 정리 | done (통합 브랜치 병합) |
| T-9-001d | 문서 — 아카이브, ADR-013, 트래킹 갱신, 루트 문서 재작성 | done (통합 브랜치 병합) |

### 오너 수동 컷오버 절차

운영 배포·D1 마이그레이션 적용·도메인 전환 같은 수동 컷오버 단계는
[`docs/operations/fulltime-cutover.md`](../operations/fulltime-cutover.md)를 따른다.
오너가 직접 실행하며, 0015 적용(게임 테이블 삭제)은 되돌릴 수 없다.

### 취소·중단된 과거 작업

- **T-7 잔여 항목**(T-7-022, T-7-034, T-7-035, T-7-040)은 **취소·무효**다. 원작
  엔진과 함께 폐기됐다. 관련 브리프·평가는 [`docs/archive/offside/tracking/briefs/`](../archive/offside/tracking/briefs/)에
  보존만 돼 있다.
- **Phase 8 WORLD STAGE**(해외 리그·대륙대회 확장, T-8-*)는 **취소·무효**다.
  풀타임에는 해당 확장이 없다. 원작 계획은
  [`docs/archive/offside/phases/phase-08-world-stage.md`](../archive/offside/phases/phase-08-world-stage.md)에
  보존돼 있다.

### 과거 이력 (Phase 0~7, T-0~T-7)

원작 OFFSIDE의 전체 진행 보드(Phase 0 모노레포 골격부터 Phase 7 라이브 운영·
밸런스까지, 운영 출시 SEASON 1: KICKOFF 포함)는
[`docs/archive/offside/tracking/board-pre-phase9.md`](../archive/offside/tracking/board-pre-phase9.md)에
그대로 보존했다. 워커 브리프(118건), 시뮬레이션 증거, phase별 계획·완료 감사,
레거시 위임 스크립트도 같은 아카이브의 `tracking/` 아래 있다.
