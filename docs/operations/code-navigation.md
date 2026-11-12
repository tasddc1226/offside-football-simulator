# 코드 탐색과 동작 보존 리팩터링

짧은 진입점 지도다. 정책의 정본은 루트 AGENTS/CLAUDE, 저장·RNG 규칙과 CI 범위는 기존 문서를 따른다. 이 문서는 새 계층이나 별도 검증 정책을 만들지 않는다.

## 시작

1. `git status --short`로 기존 작업을 확인하고 보존한다. 변경은 작업 ID 브랜치/별도 worktree에서 진행한다.
2. `node --version`을 확인한다. CI 버전은 `.node-version`이며 `.nvmrc`는 이를 가리킨다. Node 16으로 Corepack을 실행하면 설치 전에 실패할 수 있다. 전역 설정을 바꾸지 말고 해당 셸에서 프로젝트 Node 버전을 선택한다.
3. 저장소 루트에 `.codegraph/`가 있으면 CodeGraph MCP 또는 `codegraph explore "심볼 또는 파일"`로 먼저 탐색한다. 없으면 `rg --files`, `rg`와 소스를 사용한다. 인덱스 생성 여부는 사용자가 결정한다.
4. 증상에서 아래 진입점으로 좁힌다. 먼저 호출자와 저장/DB/네트워크 효과를 확인한 뒤 소유 모듈 하나를 바꾼다.

## 책임 지도

| 변경 목적               | 먼저 볼 진입점                                                                                 | 경계                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 선수 한 구간 진행       | `packages/game/src/turn.ts` playPhase                                                          | 명시적 RNG 순서. UI가 규칙을 재구현하지 않음                                |
| 진행·미완료 선택·시트   | `packages/app-core/src/game-actions.ts` createGameActions                                      | 진행→저장→연출 순서, pending 복구                                           |
| 후보·킵·공개·프리미엄   | `packages/app-core/src/scouting-actions.ts` createScoutingActions                              | 시드·킵·선택 당시 입력의 저장 계약                                          |
| 시상                    | `packages/game/src/comps.ts` seasonAwards                                                      | 국내→세계→포지션/연맹 단계, 조건부 RNG                                      |
| 감독 시즌 리뷰          | `packages/game/src/manager3/season.ts` finishSeason                                            | 평가→선수단→감독→승강→제의 순서                                             |
| 감독 공통 데이터        | `packages/game/src/manager-content.ts`                                                         | v3가 legacy 실행 모듈을 값 import하지 않음                                  |
| 은퇴 엔트리·로컬 보관   | `packages/game/src/season.ts` retirementEntry, `packages/game/src/hof-store.ts` appendLocalHof | 앱 액션이 저장 후 표시·업로드. retire는 기존 호출용 wrapper                 |
| 팀 편성 파생값          | `packages/app-core/src/teamDraftView.ts` projectTeamDraft                                      | 수치 규칙은 contracts/teamOwner 재사용. 프리셋 선택·화면 상태는 caller 소유 |
| 계정 freshness·세대     | `packages/app-core/src/accountCache.ts` createAccountCache                                     | 5분 TTL·singleflight·상태. 쿠키/토큰·반응성은 플랫폼 어댑터                 |
| 모바일 계정 로딩        | `apps/mobile/src/game/account.ts`                                                              | 토큰 갱신. analytics는 전체 host 대신 이 모듈에 의존                        |
| HTTP·클라이언트 캐시    | `packages/app-core/src/api/transport.ts` apiFetch/cachedGet                                    | 실행 경로 하나. client는 기존 import 호환 facade                            |
| 계정·공개 endpoint      | `packages/app-core/src/api/profile.ts`, `public.ts`                                            | 새 기능은 도메인 API 모듈에 두고 전송을 복제하지 않음                       |
| 성공한 쓰기의 캐시 범위 | `packages/app-core/src/api/mutationPolicy.ts`                                                  | 기본 전체 무효화, 좁은 예외만 명시                                          |
| 내구성 업로드           | `packages/app-core/src/outbox.ts`                                                              | 일반 fetch와 다른 리비전·keepalive·격리·순서 보장                           |
| 팀·카드·컵 수정 정책    | `apps/api/src/team/competitionLineup.ts`                                                       | 라우터를 import해 정책을 재사용하지 않음                                    |
| 시즌·경기 충전 정책     | `apps/api/src/team/matchPolicy.ts`, `apps/api/src/time.ts`                                     | 명단 저장·랭크·친구 경로가 공통 소비                                        |
| 랭크 경기 시작          | `apps/api/src/team/startRankedMatch.ts`                                                        | 최초 batch·guard·커밋 순서. HTTP가 background/cache 어댑터 제공             |
| 즉시·라이브 결과 표시   | `apps/api/src/team/rankedMatchProgress.ts`                                                     | 전적/점수/디비전 계산만 공유. 라이브 확정 트랜잭션은 별도                   |
| 리그 읽기·순위          | `apps/api/src/team/leagueRead.ts`                                                              | cron lifecycle·뉴스 생성에 의존하지 않음                                    |
| 리그 알림 계획          | `apps/api/src/team/leagueNotifications.ts`                                                     | 순수 계획. 커서와 알림 쓰기는 league의 단일 batch                           |
| 컵/리그 진행·시즌 마감  | `apps/api/src/team/cup.ts`, `league.ts`, `seasonClose.ts`                                      | 작업 상한·영속 커서·멱등성·재개 순서                                        |

리그 뉴스는 `team/leagueNews.ts`가 조회, `leagueNewsSelection.ts`가 순수 후보 계획, `leagueNewsProjection.ts`가 표시 조립을 담당한다. 선택 전 전체 경기 상세를 읽지 않는다.

Team의 `teamRecords.svelte.ts` / `useTeamRecords.ts`는 기록·통계·업적, `teamMatches.svelte.ts` / `useTeamMatches.ts`는 랭크/친선 결과 상태를 소유한다. `Team.svelte` / `Team.tsx`는 초안·저장·탭 진입과 새로고침 시점을 소유한다. 앱의 `TeamFormationToolbar` / `TeamCoachCard`는 표시 전용이며 편집·펼침 상태를 소유하지 않는다.

Create의 입력 정책은 `app-core/create-controls.ts`, 재시도 키/시드 계획은 `scoutAttempts.ts`, 아이템 기본값/안내는 `scoutItemsView.ts`가 소유한다. 플랫폼 도구 상태는 `createScoutItems.svelte.ts` / `useScoutItems.ts`, 공개 연출은 `createCandidateReveal.svelte.ts` / `useCandidateReveal.ts`에 있다. 후보 생성·킵·저장은 기존 `scouting-actions.ts`에 남는다.

순환을 피하는 표시/SQL leaf는 웹 `CompIconView.svelte`, 앱 `screens/game/TrophyRow.tsx`, API `db/repos/firstsMutations.ts`다. 표시를 재사용하려고 편집 시트/전체 탭을 import하거나, SQL 문장을 쓰려고 판정 실행 모듈을 import하지 않는다. 남겨 둔 지연 의존과 agents 경계는 [순환 후보 검토](../tracking/code-quality-refactor.md#t-11-710-남은-순환-후보-검토)에 근거를 기록했다.

## 빠른 검증 경로

루트에서 실행한다. 아래는 해당 변경의 개발 중 확인 명령이며 필수 CI나 플랫폼 검증을 대체하지 않는다. 파일 분리 뒤에는 먼저 타입·린트를 통과시키고 테스트를 돌린다. UI 편집 중/푸시 전/PR의 범위는 [CI 테스트 정책](ci-test-policy.md)을 따른다.

```sh
# 소유 패키지 타입·린트 (예: app-core)
pnpm --filter @offside/app-core typecheck
pnpm --filter @offside/app-core lint
pnpm lint:deps
pnpm lint:i18n

# 엔진: 결과와 옛 저장을 보존하는 기준선
pnpm --filter @offside/game exec vitest run src/golden.test.ts src/save.test.ts src/manager3.test.ts --maxWorkers=4

# 팀 파생값·초안
pnpm --filter @offside/app-core exec vitest run src/teamDraftView.test.ts src/teamDraft.test.ts src/teamOwnerLineup.test.ts src/cupLineupBar.test.ts --maxWorkers=4

# 계정·전송·내구성
pnpm --filter @offside/app-core exec vitest run src/accountCache.test.ts src/api/client.test.ts src/outbox.test.ts src/outboxReliability.test.ts --maxWorkers=4
pnpm --filter @offside/web exec vitest run src/ui/account-state.test.ts
pnpm test:mobile-unit

# API 쿼리 수·랭크·리그 (로컬 D1을 만드는 테스트라 더 느림)
pnpm --filter @offside/api exec vitest run src/routes/queryEfficiency.test.ts src/routes/ownerTeam.test.ts src/team/league.test.ts src/team/leagueAlert.test.ts src/team/leagueNews.test.ts --maxWorkers=2

# 웹 변경을 푸시하기 전
pnpm --filter @offside/web build
pnpm --filter @offside/web check:bundle
```

모바일의 `pnpm test:mobile-unit`은 기존 CI의 `vitest.push.config.mjs` 목록을 그대로 실행한다. 이름과 달리 광고·결제·계측·내비게이션도 포함하므로 새 모바일 테스트는 이 기존 명시 목록을 확인한다. 실제 iOS/Android 상호작용은 별도 테스트 환경에서 확인하고 미확인 상태를 기록한다.

리팩터링 중 골든 스냅샷·검증 시간 제한·확률을 바꾸어 실패를 통과시키지 않는다. 로컬 CPU가 몰려 시뮬레이션 테스트의 시간 제한에 걸리면 동시 검증을 줄이고 제한된 worker로 원인을 구분한다.

## 새 코드의 위치를 고르는 기준

- 동일 수치·정책은 한 소유 모듈에 둔다. Svelte·React Native 반응성은 각 어댑터에 남긴다.
- 라우터는 인증·본문·HTTP·요청 수명을, 사용 사례는 처리 순서를, repos는 SQL을 소유한다. 기존 명확한 경계부터 이용한다.
- 데이터 정의를 얻기 위해 진행 엔진을 import하지 않는다. 타입 의존과 런타임 값 의존을 구분한다.
- 파일 길이만 줄이는 분할보다 책임·역방향 의존·중복 정책을 줄인다. 새 framework/registry/generic store가 필요한지 먼저 확인한다.
- 세이브 키·엔딩 라벨·기존 오류/응답·조건부 RNG는 호환 계약이다. 행동 변경이 필요하면 구조 변경과 분리한다.

진행 및 실제 검증 결과는 [T-11-705](../tracking/code-quality-refactor.md)에 기록한다.

개발 중 새 파일을 분리한 뒤 Vite가 이미 해결한 모듈 오류나 SSR 오류를 계속 보이면 먼저 실제 경로·타입·빌드를 확인한다. 그 뒤 개발 서버를 재시작하고 필요하면 Vite `--force`로 이 worktree의 의존성 최적화를 다시 만든다. 없는 import나 실패한 빌드를 캐시 탓으로 넘기지 않는다.
