# OFFSIDE — 풀타임: 휘슬이 울릴 때까지

> 축구 선수의 유소년 시절부터 은퇴까지를 확률과 선택으로 경험하는 브라우저
> 기반 커리어 게임.

2026-09-24 Phase 9에서 원작 OFFSIDE(결정론적 Web Worker 시뮬레이터)를 더 단순한
확률/이벤트 기반 커리어 시뮬레이터 **풀타임**으로 전면 교체했다. 브랜드는
**OFFSIDE**를 유지하고, 부제 "풀타임: 휘슬이 울릴 때까지"를 붙였다
([offside-lab.com](https://offside-lab.com)). 배경과 대체된 설계 결정은
[`docs/adr/ADR-013-fulltime-replacement.md`](docs/adr/ADR-013-fulltime-replacement.md)를,
원작 문서 전체는 [`docs/archive/offside/`](docs/archive/offside/README.md)를 본다.

## 게임 개요

- 선수를 만들고 유소년부터 은퇴까지 시즌 단위로 진행한다. 훈련·이벤트 선택·
  이적 시장·국가대표·병역이 커리어에 영향을 준다.
- 선수는 FIFA식 34개 세부 능력치를 가지며, 육각형 레이더와 포지션별 OVR로
  요약해서 보여준다.
- 이벤트는 선택지가 있는 텍스트 이벤트로, 결과가 능력치·관계·평판에 반영된다.
- 시드 기반 RNG를 세이브 상태 자체에 저장해, 저장/재개 후에도 같은 흐름을
  이어갈 수 있다.
- 세이브는 브라우저 `localStorage`에만 저장된다(서버 동기화 없음). 로그인은
  기기 간 프로필 복구 수단일 뿐 플레이 조건이 아니다.
- 가상 구단 별칭 체계(풀타임 원작에서 가져온 이름)를 그대로 쓴다.
- 은퇴 후 결과는 기기 로컬 명예의 전당에 쌓인다.
- 공개 정적 페이지: `/guide/`(가이드), `/faq/`, `/legal/terms/`, `/legal/privacy/`.

## 기술 스택

- **`apps/web`**: Vite + TypeScript vanilla 앱(React 없음). 게임 로직은
  `apps/web/src/game/*` 모듈(계정·속성·엔진·이벤트·군 복무·국가대표·포지션·
  시즌 등, 진입점은 `src/game/index.ts` 배럴)에 있다.
- **`apps/api`**: Hono on Cloudflare Workers + D1(Drizzle ORM). health, profile
  (익명 프로필·설정·복구 코드·복구·삭제), Google 로그인(시작·콜백·연결 해제·
  로그아웃)만 다룬다. 계정 병합 플로우는 없다.
- **`packages/contracts`**: API 요청·응답 Zod 스키마. auth·profile·health·
  errors·envelope·headers·primitives로 축소돼 있다.
- **`tooling/fulltime-sim`**: 헤드리스 밸런스 시뮬레이터. `apps/web/src/game/*`를
  그대로 import해 대량 커리어를 시뮬레이션하고 분포를 분석한다. 원작 풀타임
  v4와의 패리티를 2만 커리어로 검증했다(peak p50 74, corr 0.85,
  Europe 74.7%, capped 68.0%).
- **`tooling/scripts`**: 저장소 전반의 유틸리티 스크립트(의존 방향 검사 등).

## 워크스페이스 레이아웃

```text
apps/
  web/                Vite + TypeScript vanilla SPA. 게임 로직은 src/game/*
  api/                Hono on Cloudflare Workers, D1(Drizzle), health·profile·Google 로그인만
packages/
  contracts/          API Zod 스키마(auth·profile·health·errors·envelope·headers·primitives)
tooling/
  scripts/            저장소 유틸리티(예: 의존 방향 검사)
  fulltime-sim/       헤드리스 밸런스 시뮬레이터(원작 풀타임 v4 패리티 검증)
  eslint-config/, tsconfig/
docs/
  adr/                아키텍처 결정 기록. ADR-013이 풀타임 전환을 기록
  tracking/           진행 보드, 결정 로그
  operations/         런북(배포, 도메인, 컷오버 등)
  archive/offside/    원작 OFFSIDE 기획·화면·콘텐츠·QA·디자인·트래킹 문서(참고용)
```

pnpm workspaces + Turborepo 모노레포. Node ≥22.13, TypeScript strict.

## 자주 쓰는 명령

```bash
pnpm dev                  # turbo run dev — web(vite) + api(wrangler dev) 동시 실행
pnpm build                # 전체 빌드
pnpm test                 # 전체 Vitest (turbo)
pnpm lint                 # ESLint 전체
pnpm lint:deps            # 패키지 의존 방향 검사 (tooling/scripts/check-deps.mjs)
pnpm typecheck            # tsc --noEmit 전체
pnpm format               # prettier --write .
pnpm db:migrate           # apps/api 로컬 D1 마이그레이션

# apps/api 전용
pnpm --filter @offside/api db:migrate:staging      # staging D1 마이그레이션
pnpm --filter @offside/api db:migrate:production    # production D1 마이그레이션
pnpm --filter @offside/api db:check                 # drizzle-kit generate 산출물과 커밋된 migrations 일치 확인

# 밸런스 시뮬레이션
pnpm --filter @offside/fulltime-sim sim              # 헤드리스 커리어 시뮬레이션 실행
pnpm --filter @offside/fulltime-sim analyze          # 시뮬레이션 결과 집계
```

머지 전 검증 체인: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build`.

## 개발·운영 규칙 요약

자세한 규칙은 루트 [`CLAUDE.md`](CLAUDE.md)와 [`AGENTS.md`](AGENTS.md)에 있다.

- 저장은 `localStorage`뿐이다. 저장 포맷을 바꾸면 `apps/web/src/game`의
  마이그레이션 코드가 이전 버전 세이브를 계속 읽을 수 있어야 한다.
- 밸런스에 영향을 주는 변경은 `tooling/fulltime-sim`을 돌려 확인한다.
- 구현은 Claude Sonnet 5 서브에이전트에게 위임하고, 오케스트레이션과 검증은
  Claude 메인 세션이 맡는다.
- 문서 정본 우선순위: [`docs/adr/`](docs/adr/README.md) >
  [`docs/tracking/`](docs/tracking/README.md) > [`docs/operations/`](docs/operations)다.
  `docs/archive/offside/`는 참고용이며 정본이 아니다.

## 원작 OFFSIDE 아카이브

원작 OFFSIDE(React 19 + TanStack SPA, Web Worker 결정론 시뮬레이터, 버전 고정
콘텐츠 팩, 서버 체크포인트 동기화, 라커룸·경쟁·발행물·서버 연간 커리어)의
전체 기획·화면·콘텐츠·QA·디자인·트래킹 문서는
[`docs/archive/offside/README.md`](docs/archive/offside/README.md)에 보존돼 있다.
마지막 main 커밋은 `68865f9`이며, 이 커밋에 `offside-final` 태그를 붙이는 것을
권장한다(아직 만들지 않았다).
