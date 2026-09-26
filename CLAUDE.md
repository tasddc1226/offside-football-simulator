# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

OFFSIDE — 부제 "풀타임: 휘슬이 울릴 때까지". 확률/이벤트 기반 축구 선수 커리어
시뮬레이션 웹 게임. `apps/web`은 Svelte 5 SPA(Vite)이고 게임 로직은
`apps/web/src/game/*`(순수 TS), 화면은 `apps/web/src/ui/*`에 있다. 게임은 전부
브라우저에서 돌고 세이브는 `localStorage`에 있다. `apps/api`(Hono on Cloudflare
Workers + D1)는 게임을 시뮬레이션하지 않고 익명 프로필·Google 로그인·복구 코드,
커리어·시즌 요약 적재, 명예의 전당, 공지·업데이트 게시판, 구단명 커스텀, 서버
밸런스 설정, 운영 도구를 다룬다. 계정 병합 플로우는 없다.

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
- **`apps/web/src/api`**: `apps/api`와 통신하는 클라이언트. GET은 `cachedGet`으로 부른다.
  시즌·은퇴 요약 업로드 큐는 `src/game/outbox.ts`.
- **`apps/api`**: 세션 지연 조회(`middleware/session.ts`의 `resolveSession`), 익명 프로필 1급 +
  Google 로그인은 복구·기기 이동 수단(`profile/`, `auth/`). D1 스키마는
  `db/schema.ts`, 마이그레이션은 `migrations/`(`0015`가 원작 게임 테이블을 드롭한 뒤
  `0016`~ 에서 커리어·명예의 전당·게시판·구단명·밸런스 테이블을 다시 쌓았다. 운영 배포가
  기대하는 테이블 목록은 `tooling/scripts/production-release.mjs`의 `EXPECTED_TABLES`).
  마이그레이션은 drizzle-kit generate 산출물을 커밋한다(`db:check`로 검증).
- **`packages/contracts`**: API 요청·응답 Zod 스키마와 밸런스 스펙
  (`@offside/contracts/balance`, zod 없는 서브패스).
- **`tooling/fulltime-sim`**: 헤드리스 밸런스 시뮬레이터. `apps/web/src/game/*`
  ES 모듈을 DOM 없이 그대로 import해 대량 커리어를 시뮬레이션한다.

## 백엔드 보호 · 요청 최소화 규칙 (2026-09-25, T-10-015)

서버(Workers·D1) 자원과 네트워크는 **데이터가 정말 필요할 때만** 쓴다. 새 화면·API를
만들거나 고칠 때 아래를 기본값으로 지킨다. 어길 이유가 있으면 PR 본문에 적는다.

- **필요할 때만 요청한다.** 화면·탭·섹션이 실제로 열릴 때 불러온다. 보이지 않는 데이터를
  미리 부르거나, 화면에 들어올 때마다 같은 데이터를 다시 부르지 않는다. 목록 응답으로
  충분하면 항목마다 상세를 따로 부르지 않는다(N+1 금지). 폴링·주기적 재검증은 되도록
  두지 않고, 꼭 필요하면 분 단위로 둔다(계정 재검증 5분).
- **웹 읽기는 메모를 거친다.** `apps/web/src/api`의 GET은 `cachedGet(path, ttlMs)`로
  부른다(같은 요청 동시 호출은 하나로 합치고, 실패는 기억하지 않는다). 데이터를 바꾸는
  요청은 `apiFetch`가 성공 시 메모를 비운다. `apiFetch` 밖(outbox 등)에서 서버 상태를
  바꾸면 `clearApiCache()`를 직접 부른다.
- **공개 조회는 세션·DB를 건드리지 않는다.** 세션은 필요한 핸들러에서만
  `await resolveSession(c)`로 조회한다(요청당 1회 메모). 모든 요청에 DB를 조회하는 전역
  미들웨어를 새로 만들지 않는다.
- **모두에게 같은 공개 GET은 엣지 캐시한다.** `apps/api/src/edgeCache.ts`의
  `edgeCached(c, path, ttlSec, load)`로 감싸고, 캐시 키는 쿼리를 정규화한 경로로 만든다.
  사용자마다 다른 응답·404는 캐시하지 않는다. 그 데이터를 바꾸는 쓰기 경로는
  `purgeEdge(c, paths)`로 해당 키를 지운다. 캐시 키가 무한히 늘지 않게 캐시 대상을
  기본 페이지 크기·첫 페이지처럼 좁힌다.
- **DB는 적게, 인덱스와 함께.** 요청당 쿼리는 필요한 만큼만(순차 조회보다 join·batch),
  목록에는 `limit` 상한을 둔다. 새 정렬·필터 쿼리는 그 쿼리를 받치는 인덱스
  마이그레이션을 함께 낸다(예: `0021_hof_sort_indexes.sql`).
- **테스트로 고정한다.** 새 화면은 e2e에서 반복 이동 시 같은 API를 다시 부르지 않는지
  요청 횟수로 확인한다(`apps/web/e2e/hof.spec.ts`). 새 공개 API는 쿠키가 있어도
  `sessions`·`profiles`를 조회하지 않는지 확인한다(`apps/api/src/routes/hof.test.ts`).

## 저장·밸런스 규칙

원작의 "콘텐츠 팩·ruleset 불변 버전 고정", "리플레이 결정론 검증" 규칙은
서버 시뮬레이션·서버 저장 구조와 함께 폐기됐다(ADR-013). 대신:

- **세이브 호환성**: 세이브 포맷을 바꾸는 변경은 `apps/web/src/game`의
  마이그레이션 코드가 이전 버전 `localStorage` 세이브를 계속 읽을 수 있게
  해야 한다. 마이그레이션 없이 기존 세이브를 깨뜨리는 배포는 하지 않는다.
- **결정성 골든 (T-10-044)**: `apps/web/src/game/golden.test.ts`가 고정 시드
  커리어의 최종 상태 해시를 스냅샷으로 고정한다. 동작을 보존하는 리팩터링은
  이 스냅샷을 바꾸면 안 된다. 의도한 밸런스 변경일 때만 `vitest -u`로 갱신하고,
  구조 변경과 결과 변경은 커밋을 나눈다.
- **밸런스 검증**: 확률·성장·이벤트 가중치처럼 밸런스에 영향을 주는 변경은
  `pnpm --filter @offside/fulltime-sim sim`(대량 커리어 시뮬레이션)과
  `analyze`(분포 집계)를 돌려 확인한다. 이 시뮬레이터는 원작 풀타임 v4와의
  패리티 기준선(2만 커리어, peak p50 74, corr 0.85, Europe 74.7%,
  capped 68.0%)을 참고 기준으로 유지한다.
- **서버 밸런스 설정 (T-10-016)**: 운영 중 조정할 수치는 코드 배포 대신
  운영 도구(설정 → 운영 도구 → 밸런스)에서 버전으로 바꾼다. 스펙(키·기본값·
  범위)은 `packages/contracts/src/balance-spec.ts` 한 곳이고, 게임 코드는
  `BAL.<키>`(`apps/web/src/game/balance.ts`)를 읽는다. 새 버전은 진행 중인
  커리어에 **다음 시즌 시작부터**(`newSeason`), 새 커리어에는 바로 적용되며
  커리어마다 `GameState.bal`에 버전이 저장된다. 수치를 새로 열 때는 스펙에
  키를 더하고 기본값을 지금 하드코딩 값과 같게 둔 뒤, `SEED=<n>`로 시뮬레이터를
  변경 전후 돌려 결과가 똑같은지 확인한다. 적용 전 초안은
  `BALANCE=<values json> pnpm --filter @offside/fulltime-sim sim`으로 미리 돌려 본다.
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
- **구현은 Claude 메인 세션이 직접 한다(2026-09-24 변경).** 서브에이전트는 서로 독립적이라
  병렬로 돌릴 수 있는 작업(문구 작성, 테스트 보강, 무관한 기능)에만 쓰고, 재위임 없이 직접
  구현하게 한다. 이 규칙이 `AGENTS.md`의 작업 방식을 정의한다.
- 리뷰 체크리스트 요점: 세이브 마이그레이션 보존, 밸런스 변경 시
  `tooling/fulltime-sim` 실행, 정상·빈 상태·오류 테스트, UI 문자열에 폐기
  어휘 없음, 로그에 쿠키·복구 코드·선수명 원문 금지, 불필요한 API 호출·세션 조회·
  캐시 무효화 누락 없음(위 "백엔드 보호 · 요청 최소화 규칙").
- CI는 self-hosted macOS runner(`self-hosted, macOS, ARM64, offside`)를 쓴다.
  문서만 바뀐 커밋은 코드 검사·배포를 건너뛴다(`.github/scripts/ci-scope.mjs`).
- 운영 배포는 `deploy-production.yml`(preflight → 같은 SHA로 deploy). 배포가 성공하면
  `release-tag` 잡이 릴리즈 태그 `vYYYY.MM.DD.N`(KST 날짜 + 그날 순번)과 GitHub 릴리즈를
  만든다(`.github/scripts/release-tag.mjs`). 태그를 손으로 만들지 않는다.
- **공개 저장소다(All Rights Reserved, `LICENSE`).** 개인 메일·실명·로컬 경로(`/Users/…`, 에이전트 임시
  폴더)·운영 사용자 ID·비밀값·DB 덤프·다른 서비스 화면 캡처를 커밋하지 않는다. CI의
  `public-hygiene` 단계(`.github/scripts/public-hygiene.mjs`)가 메일·경로를 잡는다. 운영자 공개
  연락처는 도메인 메일 `contact@offside-lab.com`(Cloudflare Email Routing으로 전달)만 쓴다.
