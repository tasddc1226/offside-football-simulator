# ADR-005. 모노레포와 패키지 경계

- 상태: 확정 (2026-09-02)
- 관련: [시스템 아키텍처](../development/01-system-architecture.md), [ADR-001](ADR-001-web-framework.md), [ADR-007](ADR-007-hosting-and-infra.md)

## 결정

pnpm workspaces + Turborepo. Node 22 LTS, TypeScript strict, ESLint + Prettier, Changesets 없음(앱 하나이므로 태그로 버전).

```text
apps/
  web/            Vite React SPA, Cloudflare Pages
  api/            Hono on Cloudflare Workers, D1, R2
packages/
  domain/         순수 규칙. simulate, OVR, 선발, 이벤트 해결, Legacy
  content/        팩·ruleset 원본, Zod 스키마, validate·simulate CLI
  contracts/      API 요청·응답 Zod 스키마, 오류 코드, Snapshot 직렬화 타입
  engine-client/  Web Worker 래퍼, Dexie 저장소, 동기화 클라이언트
  ui/             디자인 토큰, 공통 컴포넌트(PlayerHeader, ChoiceCard 등)
  fixtures/       golden fixture와 결정론 벡터
tooling/
  eslint-config/, tsconfig/
```

의존 방향(위에서 아래로만 허용):

```text
apps/web  → engine-client, ui, contracts, domain(타입만), content(타입만)
apps/api  → domain, contracts, content(스키마만)
engine-client → domain, contracts, content(스키마만)
ui → contracts(타입만)
domain → (없음)
content → domain(타입만)
contracts → domain(타입만)
fixtures → domain, content
```

금지:

- `domain`은 다른 패키지, Node API, 브라우저 API를 import하지 않는다. ESLint `no-restricted-imports`로 강제한다.
- `apps/*`는 서로 import하지 않는다.
- `ui`는 게임 규칙을 계산하지 않는다. 표시할 값은 props로만 받는다.

## 개발 명령

| 명령 | 내용 |
|---|---|
| `pnpm dev` | web + api 로컬 동시 실행 (wrangler dev, D1 로컬) |
| `pnpm test` | Vitest 전체. `domain` 결정론 테스트 포함 |
| `pnpm e2e` | Playwright, preview 빌드 대상 |
| `pnpm content:validate` | 팩·ruleset 검증 |
| `pnpm db:migrate` | Drizzle migration 생성·적용 |
| `pnpm deploy:<env>` | wrangler로 preview/staging/production 배포 |

## 이유

- 01 문서의 패키지 경계(web, application, domain, persistence, content, observability)를 실제 실행 위치에 맞게 재배치했다. `application`과 `persistence`는 클라이언트 엔진(`engine-client`)과 API(`apps/api`)로 갈라진다.
- Turborepo는 캐시와 파이프라인만 담당하고 빌드 도구는 각 앱이 가진다. 에이전트가 이해하기 쉬운 구조다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| 단일 패키지 | domain 순수성을 강제할 수 없음 |
| Nx | 기능은 많지만 이 규모에 과함 |

## 결과

- Phase 0 첫 작업은 이 구조의 골격과 의존 방향 lint다.
- 에이전트 작업 브리프는 항상 "어느 패키지를 만지는가"를 먼저 적는다.
