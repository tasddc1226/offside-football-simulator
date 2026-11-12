# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

OFFSIDE — 부제 "풀타임: 휘슬이 울릴 때까지". 확률/이벤트 기반 축구 선수 커리어
시뮬레이션 게임. 웹(`apps/web`, Svelte 5 SPA · Vite, offside-lab.com)과 앱(`apps/mobile`,
Expo · React Native, 안드로이드 · iOS)이 같은 게임 로직 `packages/game/src/*`(순수 TS)과
화면 규칙 · 문구 `packages/app-core`를 함께 쓴다. 커리어 진행은 전부 기기에서 돌고 세이브는
웹 `localStorage` · 앱 기기 저장소에 있다. `apps/api`(Hono on Cloudflare Workers + D1)는
게임을 시뮬레이션하지 않고 익명 프로필 · Google/Apple 로그인 · 복구 코드, 커리어 · 시즌 요약
적재, 명예의 전당 · 기록실, 구단주 팀 · 이적시장 · 감독, 컵 대회 · 승부 예측, 라운지 채팅 ·
친구, 공지 · 업데이트 게시판, 출석 · 선물, 앱 결제(IAP) · 푸시, 구단명 커스텀, 서버 밸런스
설정, 운영 도구를 다룬다. `apps/agents`는 운영을 돕는 디스코드 에이전트 Worker다(ADR-015).
계정 병합 플로우는 없다.

pnpm workspaces + Turborepo 모노레포. Node ≥22.13, TypeScript strict. 게임 엔진은 웹·앱이 함께 쓰는 `packages/game`(ADR-014)이다.

2026-09-24 Phase 9에서 원작 OFFSIDE(React 19 + TanStack, Web Worker 결정론
시뮬레이터, 버전 고정 콘텐츠 팩, 서버 체크포인트 동기화·리그 원장·서버 연간
커리어)를 이 구조로 전면 교체했다. 배경은
[`docs/adr/ADR-013-fulltime-replacement.md`](docs/adr/ADR-013-fulltime-replacement.md),
원작 문서는 [`docs/archive/offside/`](docs/archive/offside/README.md)를 본다.

## 자주 쓰는 명령

```bash
# 루트 스크립트(lint:deps · lint:i18n · format 등)는 package.json을 본다.

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

# 밸런스 시뮬레이션 (packages/game/src/*을 그대로 import)
pnpm --filter @offside/fulltime-sim sim
pnpm --filter @offside/fulltime-sim analyze
```

머지 전 검증 범위는 [CI 테스트 정책](docs/operations/ci-test-policy.md)을 따른다. 검토된 운영 지표 변경은 관련 웹 E2E만 실행하고, 공통·미분류·CI 변경은 전체 E2E를 실행한다. 전체 검증이 필요한 경우의 체인: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:deps && pnpm lint:i18n && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @offside/web check:bundle` + e2e.

## 주요 구성 요소

- **`packages/game/src`**: 게임 로직 배럴(`index.ts`). data → rng → attributes →
  engine → events-data → events → stories → military → realevents →
  positional → national → comps → season 순서로 로드된다. 시드 RNG
  (`RngSaveState`)는 세이브 상태 안에 저장돼 저장/재개 후에도 이어진다.
- **`apps/web/src/api`**: `apps/api`와 통신하는 클라이언트. GET은 `cachedGet`으로 부른다.
  시즌·은퇴 요약 업로드 큐는 `apps/web/src/sync/outbox.ts`.
- **`apps/api`**: 세션 지연 조회(`middleware/session.ts`의 `resolveSession`), 익명 프로필 1급 +
  Google 로그인은 복구·기기 이동 수단(`profile/`, `auth/`). D1 스키마는
  `db/schema.ts`, 마이그레이션은 `migrations/`(`0015`가 원작 게임 테이블을 드롭한 뒤
  `0016`~ 에서 커리어·명예의 전당·게시판·구단명·밸런스 테이블을 다시 쌓았다. 운영 배포가
  기대하는 테이블 목록은 `tooling/scripts/production-release.mjs`의 `EXPECTED_TABLES`).
  마이그레이션은 drizzle-kit generate 산출물을 커밋한다(`db:check`로 검증).
- **`apps/mobile`**: Expo · React Native 앱. 화면은 `src/screens`, 상태는 valtio(`src/store`).
  JS만 바뀐 변경은 운영 배포 때 EAS OTA로 나가고, 네이티브 변경은 스토어 빌드가 필요하다.
- **`packages/app-core`**: 웹 · 앱 공통 화면 로직과 다국어 사전(`src/i18n/{ko,en,ja,zh}`).
- **`packages/contracts`**: API 요청·응답 Zod 스키마와 밸런스 스펙
  (`@offside/contracts/balance`, zod 없는 서브패스).
- **`tooling/fulltime-sim`**: 헤드리스 밸런스 시뮬레이터. `packages/game/src/*`
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

- **세이브 호환성**: 세이브 포맷을 바꾸는 변경은 `packages/game/src/save.ts`의
  `migrateSave`가 이전 버전 `localStorage` 세이브를 계속 읽을 수 있게
  해야 하고, `save.test.ts`에 이전 형식 사례를 더한다. 마이그레이션 없이
  기존 세이브를 깨뜨리는 배포는 하지 않는다.
- **결정성 골든 (T-10-044)**: `packages/game/src/golden.test.ts`가 고정 시드
  커리어의 최종 상태 해시를 스냅샷으로 고정한다. 동작을 보존하는 리팩터링은
  이 스냅샷을 바꾸면 안 된다. 의도한 밸런스 변경일 때만 `vitest -u`로 갱신하고,
  구조 변경과 결과 변경은 커밋을 나눈다.
- **밸런스 검증**: 확률·성장·이벤트 가중치처럼 밸런스에 영향을 주는 변경은
  `pnpm --filter @offside/fulltime-sim sim`(대량 커리어 시뮬레이션)과
  `analyze`(분포 집계)를 돌려 확인한다. 이 시뮬레이터는 원작 풀타임 v4와의
  패리티 기준선(`tooling/fulltime-sim/reference/random.json`, 2만 커리어 ×
  시드 5개 평균)을 참고 기준으로 유지한다. 수치는 문서에 옮겨 적지 않는다.
- **서버 밸런스 설정 (T-10-016)**: 운영 중 조정할 수치는 코드 배포 대신
  운영 도구(설정 → 운영 도구 → 밸런스)에서 버전으로 바꾼다. 스펙(키·기본값·
  범위)은 `packages/contracts/src/balance-spec.ts`, 운영 도구의 이름·설명은 같은 키로 `balance-text.ts`에 두고, 게임 코드는
  `BAL.<키>`(`packages/game/src/balance.ts`)를 읽는다. 새 버전은 진행 중인
  커리어에 **다음 시즌 시작부터**(`newSeason`), 새 커리어에는 바로 적용되며
  커리어마다 `GameState.bal`에 버전이 저장된다. 수치를 새로 열 때는 스펙에
  키를 더하고 기본값을 지금 하드코딩 값과 같게 둔 뒤, `SEED=<n>`로 시뮬레이터를
  변경 전후 돌려 결과가 똑같은지 확인한다. 적용 전 초안은
  `BALANCE=<values json> pnpm --filter @offside/fulltime-sim sim`으로 미리 돌려 본다.
- **RNG는 입력이 아니라 상태다.** 원작 domain 패키지의 "시간·난수는 입력으로만
  받는다"는 순수성 규칙은 더 이상 적용되지 않는다 — `packages/game/src`은
  일반 TypeScript 모듈이며, RNG 시드는 게임 상태의 일부로 저장·복원된다.

## 운영 DB 마이그레이션 규칙 (2026-11-08, T-11-663 장애)

D1은 마이그레이션이 도는 동안 운영 DB가 다른 요청을 받지 못한다. 2026-11-08 01:16 KST에 `careers` 인덱스
14개를 한 마이그레이션에서 다시 만들다가 30초 만에 DB가 리셋됐고(7429), 5분 동안 오류 390건 · 평균 응답 44초가 났다.
마이그레이션은 실제로 적용됐는데 배포는 실패로 멈춰, 옛 코드가 새 인덱스를 만나 명예의 전당이 503을 냈다.
세부 절차는 [운영 배포 런북](docs/operations/production-release.md)의 "운영 DB 마이그레이션"을 본다.

- **큰 테이블 인덱스는 한 번에 조금씩.** 수십만 행 이상인 표(`careers` · `career_seasons` · `cards` · `team_matches` 등)에
  인덱스를 만들거나 다시 만드는 마이그레이션은 한 배포에 2개까지만 넣는다. 더 필요하면 배포를 나눈다.
- **시간대를 고른다.** 큰 테이블 인덱스 · 데이터 이전 마이그레이션은 KST 19시부터 24시까지 배포하지 않고, 접속이 적은 새벽(KST
  3시부터 7시)에 낸다. PR 본문에 대상 표의 운영 행 수와 인덱스 수를 적는다.
- **확장 → 전환 → 정리.** 한 배포에서 옛 코드와 새 스키마, 새 코드와 옛 스키마가 모두 돌아야 한다. 인덱스의 열 · 조건(부분
  인덱스)을 바꿀 때는 같은 이름을 DROP 후 CREATE하지 않는다. 새 이름으로 추가 → 새 이름을 쓰는 코드 배포 → 다음 배포에서
  옛 인덱스 삭제 순서로 나눈다. `INDEXED BY`로 이름을 박아 둔 인덱스는 반드시 이렇게 한다.
- **마이그레이션 실패는 실제 상태부터 본다.** 배포의 마이그레이션 단계가 실패하면 운영 D1의 `d1_migrations`와
  `sqlite_master`로 적용 여부를 바로 확인한다. 적용됐으면 같은 SHA로 배포를 다시 돌려 코드까지 올리고(적용된 마이그레이션은
  건너뛴다), 적용되지 않았으면 원인을 고치기 전에 재시도하지 않는다. 다른 세션의 배포가 실패했으면 진행 중인 run이 있는지
  먼저 보고 겹쳐 실행하지 않는다.
- **CI가 막는다(T-11-667).** PR 검사의 `Migration weight guard`(`.github/scripts/migration-guard.mjs`)가 새 마이그레이션에서
  큰 표(스크립트의 `BIG_TABLES`) 인덱스 · 표 재생성 · 대량 UPDATE가 3개 이상이거나 같은 이름 인덱스를 DROP 후 CREATE하면
  실패한다. 새벽 배포처럼 계획한 예외만 마이그레이션 파일에 `-- migration-guard: allow <이유>`를 적는다. 표가 커지면
  `BIG_TABLES`에 더한다.

## 화면 문구 규칙 (2026-10-02, T-11-043)

문구를 쓰거나 고치거나 리뷰할 때는 [`docs/tracking/copy-style.md`](docs/tracking/copy-style.md)(정본)를 먼저 연다.
핵심만: UI는 해요체, 문장을 `—`로 잇지 않기, 미사여구·번역투 금지, 빈 화면에 "~해 보세요" 꼬리 금지,
이벤트 결과는 장면으로 끝내기, 웹·앱 문구는 같이 고치기.
엔딩 라벨(`stories.ts` endStory ↔ `titles.ts` STORY_ENDINGS)은 칭호 키이자 세이브 저장값이라 문구만 바꾸면 안 된다.

## 다국어 규칙 (2026-10-05, T-11-102·T-11-106)

화면·게임·서버 문구는 한국어·영어·일본어·번체 중국어 네 벌이다(일본어는 T-11-140, 번체 중국어는 T-11-553). 정본은 [`docs/operations/i18n.md`](docs/operations/i18n.md). 문구를 새로 쓰거나 고치면:

- 코드에 한국어를 박지 않고 `i18n/ko/<ns>.ts`에 넣은 뒤 같은 PR에서 `i18n/en/<ns>.ts`·`i18n/ja/<ns>.ts`·`i18n/zh/<ns>.ts`도 쓴다(화면은 `packages/app-core/src/i18n`,
  게임 엔진은 `packages/game/src/i18n`). 한국어 문구를 고치면 영어·일본어·번체 중국어도 같이 고친다.
- **게이트:** `pnpm lint:i18n`이 사전 밖 소스의 한글 덩어리 수를 기준선(`tooling/i18n-baseline.json`)과 비교해 늘면 실패한다.
  줄었으면 `pnpm lint:i18n --update`로 기준선을 낮춰 같이 커밋한다. 저장값·식별자처럼 일부러 한국어로 두는 줄만 `i18n-ignore` 주석을 단다.
  기준선을 올리는 커밋은 리뷰에서 이유를 적는다.
- 사전 키·종류가 네 언어에서 같은지, 번역 사전에 한글이 없는지는 `i18n.test.ts`(app-core·game)가 본다. 새 네임스페이스 뒤에는
  `node tooling/scripts/i18n-index.mjs`로 en·ja·zh 묶음을 다시 만든다.
- 세이브·서버에 남는 이름(트로피·수상·구단·리그·대회·엔딩 등)은 한국어로 저장하고 그릴 때 `tn()`으로 옮긴다. 새 이름을 만들면
  `packages/game/src/i18n/en/_names.ts`·`ja/_names.ts`·`zh/_names.ts`에 영어·일본어·번체 중국어를 더한다. 언어가 게임 결과를 바꾸면 안 된다(같은 시드 ko·en·ja·zh 비교 테스트).
- 서버가 만드는 문장은 요청의 `lang=en`·`lang=ja`·`lang=zh`로 영어·일본어·번체 중국어를 돌려준다(`apps/api/src/lang.ts`). 운영 도구는 한국어로 둔다.

## 웹·앱 병행 규칙 (2026-10-04, T-11-084)

- 앱(안드로이드·iOS)이 출시돼도 웹(offside-lab.com)을 내리지 않는다. 웹을 줄이는 일은 사용자가 데이터를 보고 정한다.
- 새 게임 기능은 규칙·문구를 `packages/game`·`packages/app-core`에 두고 웹·앱에 함께 낸다.
- 게임 규칙·수치가 바뀌면 공개 가이드 · FAQ(`packages/app-core/src/i18n/{ko,en,ja,zh}/publicGuidePage.mjs`, 웹 `/guide/`·`/en/guide/` 등 · 앱 설정의 게임 가이드)도 같은 PR에서 네 언어를 함께 고친다(T-11-112, T-11-588).
- 결제(IAP)·푸시·보상형 광고만 앱 전용이다. 배경과 축소 검토 기준은 [결정 로그](docs/tracking/decision-log.md)(2026-10-04)를 본다.

## 문서 정본 우선순위

문서 충돌 시: [`docs/adr/`](docs/adr/README.md)(ADR-001~015) >
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
- **구현은 메인 에이전트 세션(Codex 또는 Claude Code)이 직접 한다(2026-09-24 변경).** 서브에이전트는 서로 독립적이라
  병렬로 돌릴 수 있는 작업(문구 작성, 테스트 보강, 무관한 기능)에만 쓰고, 재위임 없이 직접
  구현하게 한다. 이 규칙이 `AGENTS.md`의 작업 방식을 정의한다.
- 리뷰 체크리스트 요점: 새 문구의 ko·en·ja·zh 사전·`lint:i18n` 통과, 세이브 마이그레이션 보존, 밸런스 변경 시
  `tooling/fulltime-sim` 실행, 정상·빈 상태·오류 테스트, UI 문자열에 폐기
  어휘 없음, 로그에 쿠키·복구 코드·선수명 원문 금지, 불필요한 API 호출·세션 조회·
  캐시 무효화 누락 없음(위 "백엔드 보호 · 요청 최소화 규칙").
- CI는 GitHub 호스트 러너(`ubuntu-latest`)를 쓴다.
  문서만 바뀐 커밋은 코드 검사·배포를 건너뛴다(`.github/scripts/ci-scope.mjs`).
- PR 검사(T-11-176): `PR plan`이 바뀐 패키지를 고르고(`ci-affected.mjs`, 패키지 밖 변경이면 전부),
  필요한 잡만 나란히 돈다: `PR quick checks`(서식·린트·타입·단위 테스트·마이그레이션 검사·밸런스 스모크),
  `PR API tests (1~3)`, `PR build and e2e (1~3)`(빌드·번들·e2e). 웹을 바꿨으면 push 전에 로컬에서
  `pnpm --filter @offside/web build && pnpm --filter @offside/web check:bundle`로 번들 예산을 먼저 본다. main push의 CI는 staging용 빌드만 하므로 기다리지
  않는다(T-10-061). 대신 머지 전에 PR 브랜치가 최신 main을 포함하는지 확인한다(아니면 main을 합치고
  PR 검사를 다시 받는다) — 그래야 검사한 트리와 머지된 트리가 같다.
- 운영 배포는 `deploy-production.yml`. 머지 직후 main SHA로 바로 `mode=deploy`를 실행한다 — deploy 모드도
  운영 DB에 쓰기 전에 preflight와 같은 점검을 먼저 한다. 마이그레이션이 있는 배포만 preflight를 먼저 돌린다. 배포가 성공하면
  `release-tag` 잡이 릴리즈 태그 `vYYYY.MM.DD.N`(KST 날짜 + 그날 순번)과 GitHub 릴리즈를
  만든다(`.github/scripts/release-tag.mjs`). 태그를 손으로 만들지 않는다.
- **공개 저장소다(All Rights Reserved, `LICENSE`).** 개인 메일·실명·로컬 경로(`/Users/…`, 에이전트 임시
  폴더)·운영 사용자 ID·비밀값·DB 덤프·다른 서비스 화면 캡처를 커밋하지 않는다. CI의
  `public-hygiene` 단계(`.github/scripts/public-hygiene.mjs`)가 메일·경로를 잡는다. 운영자 공개
  연락처는 도메인 메일 `contact@offside-lab.com`(Cloudflare Email Routing으로 전달)만 쓴다.
