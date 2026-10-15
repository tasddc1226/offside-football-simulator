# ADR-013. 풀타임으로 전면 교체 (Phase 9)

- 상태: 확정 (2026-09-23/24 KST, 오너 결정)
- 관련: [ADR-001](ADR-001-web-framework.md), [ADR-002](ADR-002-persistence-and-identity.md), [ADR-003](ADR-003-simulation-location.md), [ADR-004](ADR-004-content-format.md), [ADR-005](ADR-005-monorepo-boundaries.md), [ADR-006](ADR-006-service-name-and-domain.md), [ADR-007](ADR-007-hosting-and-infra.md), [ADR-008](ADR-008-auth-and-account-merge.md), [ADR-009](ADR-009-apps-in-toss-channel.md), [ADR-010](ADR-010-shared-contracts.md), [ADR-011](ADR-011-league-ledger-and-career-feedback.md), [ADR-012](ADR-012-server-annual-careers.md), [아카이브](../archive/offside/README.md)

## 맥락

T-7(라이브 운영·밸런스)의 잔여 작업(T-7-022·034·035·040)이 진행되고 T-8 WORLD STAGE
확장이 계획되던 중, 오너가 원작 OFFSIDE — React 19 + TanStack SPA, 도메인/콘텐츠/
engine-client/fixtures/ui/platform 패키지를 가진 Web Worker 결정론 엔진, 버전 고정
JSON 콘텐츠 팩·ruleset, Dexie(IndexedDB) 저장, 서버 체크포인트 동기화·라커룸·경쟁·
발행물·서버 연간 커리어 — 를 훨씬 단순한 확률/이벤트 기반 커리어 시뮬레이터
**풀타임**으로 완전히 교체하기로 결정했다. 실사용자 데이터가 운영에 없었으므로
보존 제약이 이 결정을 막지 않았다. 이 브랜치에서 코드 마이그레이션은 이미 끝났다
(T-9-001a API, T-9-001b 웹 완료; T-9-001c CI/운영 진행 중; 이 문서가 속한
T-9-001d 문서 작업).

## 결정

1. **전면 교체.** 원작 OFFSIDE의 기획·화면·엔진·콘텐츠 체계를 유지하지 않는다.
   풀타임이 흡수해야 할 것만 남긴다.
2. **브랜드는 OFFSIDE 유지.** 부제에 "풀타임"을 포함한다 — 부제 `풀타임: 휘슬이
   울릴 때까지`, 페이지 타이틀 `오프사이드 — 풀타임 축구 커리어`. offside-lab.com
   도메인도 그대로 쓴다.
3. **서버는 로그인·프로필만.** `apps/api`는 health, profile(익명 프로필·설정·복구
   코드·복구·삭제), Google 로그인(시작·콜백·연결 해제·로그아웃)만 남긴다. 계정
   병합 플로우와 `/v1/auth/merge`는 제거한다. D1 마이그레이션 0015가 게임 관련
   테이블을 전부 드롭하고 `profiles`·`sessions`·`auth_attempts`·`audit_log`·
   `idempotency`만 남긴다.
4. **구현은 Claude Sonnet 5 서브에이전트에게 위임**하고, 오케스트레이션과 리뷰·검증은
   Claude 메인 세션이 맡는다. 이 규칙이 `AGENTS.md`의 기존 "Luna에게 위임" 규칙을
   대체한다.
5. **가상 구단 별칭은 유지**한다 — 풀타임의 가상 구단 이름은 그대로 쓴다.

새 게임의 구조:

| 항목 | 풀타임 |
|---|---|
| 클라이언트 | Vite + TypeScript vanilla 앱(`apps/web`). React·TanStack 없음 |
| 게임 로직 | `apps/web/src/game/*` 모듈(계정·속성·엔진·이벤트·군 복무·국가대표·포지션·시즌 등), 배럴 `index.ts` |
| 난수 | 시드 RNG가 세이브 상태 안에 저장된다(엔진 실행 위치와 결정론 검증 인프라는 더 이상 필요 없다) |
| 저장 | `localStorage`만. 서버 동기화·체크포인트·Dexie 없음 |
| 선수 모델 | FIFA식 34개 세부 능력치, 육각형 레이더, 포지션별 OVR |
| 콘텐츠 | 선택지가 있는 이벤트, 국가대표, 병역, 이적 시장, 로컬 명예의 전당 |
| 공개 페이지 | `/guide/`, `/faq/`, `/legal/terms/`, `/legal/privacy/` 정적 페이지 |
| 서버 | `apps/api` — health·profile·Google 로그인만(Hono, Cloudflare Workers + D1) |
| 공유 계약 | `packages/contracts` — auth·profile·health·errors·envelope·headers·primitives로 축소 |
| 밸런스 검증 | `tooling/fulltime-sim` — 원작 풀타임 v4와의 패리티를 2만 커리어로 검증(peak p50 74, corr 0.85, Europe 74.7%, capped 68.0%) |

## 대체하는 ADR (Supersedes)

이 ADR이 아래 결정을 완전히 대체한다. 각 문서의 상태 줄은 `Superseded by ADR-013`으로
갱신했고 본문은 원작 기록으로 그대로 남겼다.

- **ADR-001**(웹 프레임워크: React 19 + TanStack Router) → 바닐라 Vite + TypeScript로 대체
- **ADR-003**(Web Worker 시뮬레이션과 서버 리플레이 검증) → 클라이언트 단일 실행, 서버 검증 없음(시드 RNG가 세이브에 저장)
- **ADR-004**(JSON 콘텐츠 팩·ruleset, 불변 버전 고정) → `apps/web/src/game`의 코드 내장 이벤트/데이터, 버전 고정 콘텐츠 팩 체계 없음
- **ADR-011**(리그 원장·결정론·커리어 피드백) → 제안 단계였고 새 게임 구조와 무관해짐
- **ADR-012**(서버 권위 연간 커리어) → 서버 권위 시뮬레이션 자체가 없어짐

## 부분 수정하는 ADR (Amends)

- **ADR-002**(영속 저장소와 비로그인 식별) — 게임 상태 저장은 `localStorage`로
  단순화됐다(Dexie·서버 체크포인트 동기화 없음). 비로그인 익명 프로필과 Google
  로그인을 통한 프로필 복구·기기 이동은 그대로 유지되며 D1에 남는다. 상태 줄:
  `Amended by ADR-013 (게임 저장은 localStorage, 서버는 프로필만)`.
- **ADR-005**(모노레포 패키지 경계) — 패키지 목록이 `apps/web`(vanilla), `apps/api`,
  `packages/contracts`, `tooling/scripts`, `tooling/fulltime-sim`으로 축소됐다.
  `packages/domain`·`content`·`engine-client`·`platform`·`ui`·`fixtures`는 더 이상
  존재하지 않는다(코드는 T-9-001a/b에서 이미 삭제됐다). 상태 줄:
  `Amended by ADR-013 (패키지 목록 축소)`.
- **ADR-007**(호스팅·인프라) — Cloudflare Workers·D1 호스팅 구조 자체는 바뀌지
  않았지만, D1에 게임 데이터가 더 이상 없다(마이그레이션 0015). 상태 줄:
  `Amended by ADR-013 (D1에 게임 데이터 없음)`.
- **ADR-008**(인증과 계정 연결·병합) — Google 로그인 자체는 유지하되 계정 병합
  플로우(A/B 병합, `/v1/auth/merge`)를 제거했다. 상태 줄:
  `Amended by ADR-013 (계정 병합 제거)`.
- **ADR-009**(앱인토스 미니앱 대응) — 미니앱 출시는 보류 상태 그대로이며,
  `packages/platform`(채널 어댑터)이 코드에서 제거됐다. 필요해지면 git 이력에서
  되살린다. 상태 줄: `Amended by ADR-013 (보류 유지, platform 패키지 삭제됨)`.

## 재확인 (Reaffirmed)

- **ADR-006**(서비스명 표기와 도메인) — `OFFSIDE` 워드마크와 offside-lab.com
  도메인을 그대로 쓴다. 이번 전환에서 바뀌지 않았음을 재확인한다.

## 이유

- 오너가 원작의 결정론·서버 동기화·복잡한 콘텐츠 파이프라인보다 단순한 확률/이벤트
  루프를 우선하기로 판단했다. 실사용자 데이터가 없어 보존 비용 없이 교체할 수
  있었다.
- 브랜드(OFFSIDE)와 서버 최소 기능(로그인·프로필)은 유지해 도메인·사용자 인지도와
  운영 표면을 재사용한다.
- 구현 위임 주체를 Sonnet 5 서브에이전트로 명시해 `AGENTS.md`의 오래된 "Luna"
  규칙을 정리한다.

## 결과

- `docs/archive/offside/`에 원작 기획·화면·콘텐츠·QA·디자인·트래킹 문서를
  보존했다(이 작업, T-9-001d).
- `docs/adr/README.md`의 표를 갱신해 각 ADR의 새 상태를 반영한다.
- `docs/tracking/board.md`에 Phase 9 절을 추가해 T-9-001의 서브트랙 상태와
  T-7/T-8 잔여 작업의 취소를 기록한다.
- 루트 `README.md`·`CLAUDE.md`·`AGENTS.md`를 새 게임 구조와 위임 규칙에 맞게
  다시 쓴다.
