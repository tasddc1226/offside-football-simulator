# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

OFFSIDE — 부제 "풀타임: 휘슬이 울릴 때까지". 확률/이벤트 기반 축구 선수 커리어
시뮬레이션 웹 게임. `apps/web`은 Vite + TypeScript vanilla 앱(React 없음)이고
게임 로직은 `apps/web/src/game/*`에 있다. 세이브는 브라우저 `localStorage`에만
저장한다(서버 동기화 없음). `apps/api`(Hono on Cloudflare Workers + D1)는
health·profile(익명 프로필·설정·복구 코드·복구·삭제)·Google 로그인(시작·콜백·
연결 해제·로그아웃)만 다룬다. 계정 병합 플로우는 없다.

pnpm workspaces + Turborepo 모노레포. Node ≥22.13, TypeScript strict.

2026-09-24 Phase 9에서 원작 OFFSIDE(React 19 + TanStack, Web Worker 결정론
시뮬레이터, 버전 고정 콘텐츠 팩, 서버 체크포인트 동기화·리그 원장·서버 연간
커리어)를 이 구조로 전면 교체했다. 배경은
[`docs/adr/ADR-013-fulltime-replacement.md`](docs/adr/ADR-013-fulltime-replacement.md),
원작 문서는 [`docs/archive/offside/`](docs/archive/offside/README.md)를 본다.

## 자주 쓰는 명령

```bash
pnpm dev                  # web(vite) + api(wrangler dev) 동시 실행
pnpm test                 # 전체 Vitest (turbo)
pnpm lint                 # ESLint 전체
pnpm lint:deps            # 패키지 의존 방향 검사 (tooling/scripts/check-deps.mjs)
pnpm typecheck            # tsc --noEmit 전체
pnpm build                # 전체 빌드
pnpm format               # prettier --write .

# 단일 패키지 테스트
pnpm --filter @offside/web test
pnpm --filter @offside/api test
pnpm --filter @offside/contracts test

# e2e (apps/web, Playwright)
pnpm --filter @offside/web e2e
pnpm --filter @offside/web exec playwright test e2e/career.spec.ts   # 단일 spec

pnpm --filter @offside/web check:bundle             # 초기 청크 예산 검사
pnpm --filter @offside/api db:migrate               # 로컬 D1 마이그레이션
pnpm --filter @offside/api db:check                 # drizzle-kit generate 후 migrations diff 없음 확인

# 밸런스 시뮬레이션 (apps/web/src/game/*을 그대로 import)
pnpm --filter @offside/fulltime-sim sim
pnpm --filter @offside/fulltime-sim analyze
```

머지 전 전체 검증 체인: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @offside/web check:bundle` + e2e.

## 주요 구성 요소

- **`apps/web/src/game`**: 게임 로직 배럴(`index.ts`). data → rng → attributes →
  engine → events-data → events → stories → military → realevents →
  positional → national → comps → season 순서로 로드된다. 시드 RNG
  (`RngSaveState`)는 세이브 상태 안에 저장돼 저장/재개 후에도 이어진다.
- **`apps/web/src/api`**: `apps/api`와 통신하는 클라이언트(로그인·프로필만).
- **`apps/api`**: 세션 미들웨어(`middleware/session.ts`), 익명 프로필 1급 +
  Google 로그인은 복구·기기 이동 수단(`profile/`, `auth/`). D1 스키마는
  `db/schema.ts`, 마이그레이션은 `migrations/`(최신 `0015`가 게임 테이블을
  전부 드롭하고 `profiles`·`sessions`·`auth_attempts`·`audit_log`·
  `idempotency`만 남긴다). 마이그레이션은 drizzle-kit generate 산출물을
  커밋한다(`db:check`로 검증).
- **`packages/contracts`**: API 요청·응답 Zod 스키마. `auth`·`profile`·
  `health`·`errors`·`envelope`·`headers`·`primitives`로 축소돼 있다.
- **`tooling/fulltime-sim`**: 헤드리스 밸런스 시뮬레이터. `apps/web/src/game/*`
  ES 모듈을 DOM 없이 그대로 import해 대량 커리어를 시뮬레이션한다.

## 저장·밸런스 규칙

원작의 "콘텐츠 팩·ruleset 불변 버전 고정", "리플레이 결정론 검증" 규칙은
서버 시뮬레이션·서버 저장 구조와 함께 폐기됐다(ADR-013). 대신:

- **세이브 호환성**: 세이브 포맷을 바꾸는 변경은 `apps/web/src/game`의
  마이그레이션 코드가 이전 버전 `localStorage` 세이브를 계속 읽을 수 있게
  해야 한다. 마이그레이션 없이 기존 세이브를 깨뜨리는 배포는 하지 않는다.
- **밸런스 검증**: 확률·성장·이벤트 가중치처럼 밸런스에 영향을 주는 변경은
  `pnpm --filter @offside/fulltime-sim sim`(대량 커리어 시뮬레이션)과
  `analyze`(분포 집계)를 돌려 확인한다. 이 시뮬레이터는 원작 풀타임 v4와의
  패리티 기준선(2만 커리어, peak p50 74, corr 0.85, Europe 74.7%,
  capped 68.0%)을 참고 기준으로 유지한다.
- **RNG는 입력이 아니라 상태다.** 원작 domain 패키지의 "시간·난수는 입력으로만
  받는다"는 순수성 규칙은 더 이상 적용되지 않는다 — `apps/web/src/game`은
  일반 TypeScript 모듈이며, RNG 시드는 게임 상태의 일부로 저장·복원된다.

## 문서 정본 우선순위

문서 충돌 시: [`docs/adr/`](docs/adr/README.md)(ADR-001~013) >
[`docs/tracking/`](docs/tracking/README.md)(보드는 `board.md`, 결정은
`decision-log.md`) > [`docs/operations/`](docs/operations)(런북) 순이다.

`docs/archive/offside/`(원작 개발 명세·phases·screens·content)는 **아카이브이며
정본이 아니다.** 참고용으로만 연다 — 코드나 규칙 판단의 근거로 쓰지 않는다.

## 개발·운영 규칙 (docs/tracking/README.md)

- 작업 ID는 `T-<Phase>-<번호>`(서브트랙이 있으면 글자 접미사, 예: `T-9-001d`).
  브랜치는 작업 ID로 시작, PR 제목·커밋 메시지는 `T-9-001d: 설명` 형식(한국어).
  머지는 squash.
- PR 직전 `git fetch origin && git merge origin/main`. `pnpm-lock.yaml` 충돌은
  손으로 고치지 말고 `git checkout origin/main -- pnpm-lock.yaml && pnpm install --no-frozen-lockfile`로
  재생성 후 전체 체인 재실행.
- **구현은 Claude Sonnet 5 서브에이전트에게 위임하고, 오케스트레이션·리뷰·검증은
  Claude 메인 세션(코디네이터)이 맡는다.** 서브에이전트는 격리 worktree에서
  브리프 범위만 구현하고, 명세를 스스로 바꾸지 않는다. 이 규칙이
  `AGENTS.md`의 위임 대상을 정의한다(2026-09-24, ADR-013).
- 리뷰 체크리스트 요점: 세이브 마이그레이션 보존, 밸런스 변경 시
  `tooling/fulltime-sim` 실행, 정상·빈 상태·오류 테스트, UI 문자열에 폐기
  어휘 없음, 로그에 쿠키·복구 코드·선수명 원문 금지.
- CI는 self-hosted macOS runner(`self-hosted, macOS, ARM64, offside`)를 쓴다.
  문서만 바뀐 커밋은 코드 검사·배포를 건너뛴다(`.github/scripts/ci-scope.mjs`).
