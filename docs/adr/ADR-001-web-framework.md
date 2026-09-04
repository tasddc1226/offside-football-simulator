# ADR-001. 웹 프레임워크와 렌더링

- 상태: 확정 (2026-09-02)
- 관련: [ADR-003](ADR-003-simulation-location.md), [ADR-005](ADR-005-monorepo-boundaries.md), [시각 디자인 시스템](../development/13-visual-design-system.md)

## 맥락

게임은 로그인 없이 바로 시작하고, 거의 모든 상호작용이 클라이언트에서 일어난다. 검색 노출이 필요한 페이지는 랜딩 한 장뿐이다. 구현은 Sonnet 5 에이전트가 맡으므로 문서와 사례가 많은 표준 조합이 유리하다.

## 결정

| 항목 | 선택 |
|---|---|
| 앱 형태 | Vite 6 + React 19 + TypeScript SPA. SSR 없음 |
| 라우팅 | TanStack Router (타입 안전 경로, 화면 ID를 라우트 이름에 매핑) |
| 스타일 | Tailwind CSS v4. `@theme`에 `--os-*` 토큰을 그대로 등록한다. 임의 색상 클래스 금지 |
| 서버 상태 | TanStack Query (동기화·보관함·시즌 조회) |
| 클라이언트 상태 | Zustand (화면 상태, DRAFT). 게임 정본 상태는 엔진 소유 |
| 게임 엔진 실행 | Web Worker + Comlink. `packages/domain`을 워커 안에서 실행 |
| 로컬 저장 | Dexie (IndexedDB). 스냅샷·명령 로그·설정 |
| 폼·검증 | Zod (contracts 패키지와 공유) |
| 접근성 | Radix Primitives 일부(Dialog, RadioGroup, Tabs)만 사용 |
| 테스트 | Vitest, Testing Library, Playwright, axe-core |
| 랜딩 | `apps/web`의 정적 사전 렌더링 페이지 1장 (vite-plugin 또는 빌드 스크립트) |
| 배포 채널 | 같은 SPA를 두 채널로 빌드한다. `web`(Workers Static Assets)과 `toss`(앱인토스 WebView 미니앱). 채널별 차이는 `packages/platform` 어댑터 뒤에 둔다. [ADR-009](ADR-009-apps-in-toss-channel.md) |
| 앱인토스 SDK | `@apps-in-toss/web-framework` 3.x(설정 `apps-in-toss.config.ts`), `@apps-in-toss/devtools` Vite 플러그인(로컬 브라우저 모킹). TDS(`@toss/tds-mobile`)는 쓰지 않고 자체 디자인 시스템을 유지 |

## 이유

- SSR 프레임워크는 이 게임에 필요한 것보다 크다. 클라이언트 엔진과 IndexedDB가 중심이므로 SPA가 가장 단순하다.
- Tailwind v4는 CSS 변수를 그대로 토큰으로 쓰므로 13 문서의 `--os-*`와 충돌하지 않는다. 에이전트 출력의 일관성이 높다.
- Web Worker로 엔진을 분리하면 시즌 결산 계산이 UI를 막지 않고, 같은 코드를 서버 리플레이 검증에 재사용할 수 있다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| Next.js App Router | RSC와 서버 컴포넌트가 불필요. Vercel Hobby는 상용 불가, Pro는 고정비 |
| SvelteKit | 에이전트 구현 사례가 React보다 적음 |
| CSS Modules 단독 | 가능하지만 에이전트 산출물의 클래스 명명 일관성이 떨어짐 |

## 결과

- 화면 명세의 SCR ID가 라우트 이름이 된다. 예: `/career/$careerId/dashboard` = SCR-029.
- 06 문서의 상태 계약(LOADING·DRAFT·COMMITTING·RESOLVED·EMPTY·ERROR)은 화면 컴포넌트의 공통 훅으로 구현한다.
- 성능 예산(01 문서)의 LCP 2.5초는 랜딩과 허브 기준이다. 엔진 워커 로딩은 허브 진입 후 백그라운드다.
- `apps/web`의 빌드 스크립트는 `build`(Workers Static Assets용)와 `build:toss`(`vite build --mode toss && ait build`, 산출물 `.ait`)로 나뉜다. 화면 컴포넌트는 채널을 직접 분기하지 않고 `platform` 어댑터만 호출한다.
