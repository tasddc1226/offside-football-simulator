# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

OFFSIDE — 축구 선수 커리어 시뮬레이션 웹 게임. Vite + React SPA가 브라우저 Web Worker에서 결정론적 시뮬레이션을 실행하고 IndexedDB에 로컬 우선 저장한다. Cloudflare Workers(Hono) + D1 서버는 프로필·Google 로그인·checkpoint 동기화·보관·서비스 시즌만 담당한다. 같은 SPA 번들을 앱인토스 미니앱(toss 채널)으로도 배포할 수 있는 구조다.

pnpm workspaces + Turborepo 모노레포. Node 22, TypeScript strict.

## 자주 쓰는 명령

```bash
pnpm dev                  # web(vite, :5173) + api(wrangler dev, :8787) 동시 실행
pnpm test                 # 전체 Vitest (turbo)
pnpm lint                 # ESLint 전체
pnpm lint:deps            # ADR-005 패키지 의존 방향 검사 (tooling/scripts/check-deps.mjs)
pnpm typecheck            # tsc --noEmit 전체
pnpm build                # 전체 빌드
pnpm content:validate     # 콘텐츠 팩·ruleset Zod 검증
pnpm format               # prettier --write .

# 단일 패키지 테스트
pnpm --filter @offside/domain test
# 단일 테스트 파일
pnpm --filter @offside/domain exec vitest run src/growth.test.ts

# e2e (apps/web, Playwright, 뷰포트 360x780 고정)
pnpm --filter @offside/web e2e                      # 스텁 API, 포트 5174
pnpm --filter @offside/web e2e:api                  # 실제 api 포함, 포트 5173/8787
pnpm --filter @offside/web exec playwright test e2e/season.spec.ts   # 단일 spec
# 병행 세션 포트 충돌 시 E2E_PORT/E2E_API_URL 오버라이드 가능

pnpm --filter @offside/web check:bundle             # 초기 청크 예산 검사
pnpm --filter @offside/api db:migrate               # 로컬 D1 마이그레이션
pnpm --filter @offside/api db:check                 # drizzle-kit generate 후 migrations diff 없음 확인
```

머지 전 전체 검증 체인: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @offside/web check:bundle` + e2e.

## 아키텍처와 패키지 경계 (ADR-005, lint로 강제됨)

의존 방향은 아래로만 허용. `tooling/scripts/check-deps.mjs`의 `ALLOWED_DEPENDENCIES`가 정본이고 `pnpm lint:deps`가 검사한다.

```
apps/web        → platform, engine-client, ui, contracts, domain, content
apps/api        → domain, contracts, content        (Hono on Cloudflare Workers + D1 + Drizzle)
platform        → engine-client(LocalStore 포트 타입만), contracts
engine-client   → domain, contracts, content
ui              → contracts(타입만)
content         → domain(타입만)
contracts       → domain(타입만)
domain          → (없음 — 완전 순수)
fixtures        → domain, content                   (테스트 전용: devDependencies로만 허용)
```

핵심 규칙 (ESLint `no-restricted-*`로 강제, `tooling/eslint-config/index.mjs`):

- **`packages/domain`은 순수 TypeScript.** 외부 import, Node·브라우저 API, `Date.now()`, `Math.random()`, `new Date()` 전부 금지. 시간·난수는 입력으로만 받는다. 시뮬레이션은 `seed + rulesetVersion + contentPackVersion + command`로 완전 결정론적이어야 한다 — 서버가 명령 로그를 리플레이해 state hash를 검증한다(ADR-003). 부동소수점 대신 정수/고정 소수점, 정렬은 안정 키.
- **채널 분기 금지.** 화면·엔진·ui는 `channel`을 비교하거나 `@offside/platform/web`·`/toss`를 직접 import하지 않는다. 채널 조립은 `apps/web/src/platform/index.ts` 한 곳. `@apps-in-toss/*`는 `packages/platform/src/toss/`에서만 import 가능.
- **`ui`는 게임 규칙을 계산하지 않는다.** 표시 값은 props로만.
- `apps/*`끼리 서로 import 금지.

## 주요 구성 요소

- **`packages/engine-client`**: 명령 실행기·멱등성·복구, `LocalStore` 포트 정의(구현은 platform), Web Worker 시뮬레이터 프로토콜(`./worker`), 동기화 클라이언트. 로컬 IndexedDB가 플레이 중 정본이고 checkpoint마다 `PUT /careers/{id}`(If-Match revision, 409면 충돌 해소)로 서버 동기화(ADR-002).
- **`packages/content`**: 콘텐츠 팩(`packs/<version>/`)과 ruleset(`rulesets/<version>/`) JSON 원본 + Zod 스키마(정본) + validate CLI. 조건은 JSON 연산자 트리 DSL — 스크립트 실행 없음. `rulesetVersion`·`contentPackVersion`은 Career 생성 시 고정되며 과거 커리어는 과거 버전으로 재현된다. 콘텐츠 확장은 기존 팩 수정이 아니라 **새 팩 버전**으로 만든다(병행 중인 fixture·golden 보호).
- **`packages/fixtures`**: golden fixture·결정론 벡터. 어느 패키지든 devDependencies로만.
- **`apps/web`**: TanStack Router 파일 기반 라우트(`src/routes/career.$careerId.*.tsx`), TanStack Query, Zustand. 빌드 모드 3종: 기본(web), `--mode expanded`, `--mode toss`.
- **`apps/api`**: 세션 미들웨어는 `Authorization` Bearer(toss) 먼저, 없으면 쿠키(web). 비로그인 익명 프로필이 1급이고 Google 로그인은 복구·동기화 수단. 마이그레이션은 drizzle-kit generate 산출물을 커밋(`db:check`로 검증).

## 문서 정본 우선순위

문서 충돌 시: `docs/development/` > `docs/phases/` > `docs/screens/` > `docs/content/` > 통합 설계서. 기술 스택·인프라 확정 결정은 `docs/adr/`(ADR-001~010)이 개발 명세의 "권장"보다 우선한다. 진행 상태·역할·워커 위임 규칙은 `docs/tracking/`(보드는 `board.md`, 결정은 `decision-log.md`)이 정본이다.

## 개발·운영 규칙 (docs/tracking/README.md)

- 작업 ID는 `T-<Phase>-<번호>`. 브랜치는 작업 ID로 시작(`T-0-003-domain-skeleton`), PR 제목은 `T-0-003: 설명` 형식. 머지는 squash.
- 모든 작업은 요구사항 ID(FR·RULE·SCR·API·DATA·TEST)를 참조한다.
- PR 직전 `git fetch origin && git merge origin/main`. `pnpm-lock.yaml` 충돌은 손으로 고치지 말고 `git checkout origin/main -- pnpm-lock.yaml && pnpm install --no-frozen-lockfile`로 재생성 후 전체 체인 재실행.
- 리뷰 체크리스트 요점: domain 순수성, 결정론 테스트(같은 입력 → 같은 hash), 정상·빈 상태·오류·재시도·중복 요청 테스트, 화면은 360px·키보드·모션 감소·시각 토큰만 사용, UI 문자열에 폐기 어휘(`VAR CHECK` 등) 금지, 로그에 쿠키·복구 코드·선수명 원문 금지.
- CI는 self-hosted macOS runner(`self-hosted, macOS, ARM64, offside`). main push가 staging 자동 배포까지 수행한다. 문서만 바뀐 커밋은 코드 검사·배포를 건너뛴다(`.github/scripts/ci-scope.mjs`).

## 앱인토스(toss 채널) 제약 (ADR-009)

SDK가 필요 없는 검토 규칙은 web 채널에서도 지킨다: 초기 청크 300KB 이하·콘텐츠 팩 지연 로드, 진입 직후 모달 금지, Safe Area 침범 금지, `eval`·외부 코드 실행 금지, 약관·개인정보는 SPA 내부 라우트, 런타임 생성형 AI 텍스트 노출 금지(서사는 저작된 콘텐츠 팩만).
