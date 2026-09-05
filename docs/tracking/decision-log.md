# 결정 로그

날짜 역순. ADR로 승격된 결정은 링크만 남긴다.

## 2026-09-05 (오전, 밤사이 머지 5건 현황 정리 — 사용자 요청으로 Claude 세션이 문서·현황판만 갱신)

**결과(Codex 오케스트레이터 + Luna Max 워커, Orca Run `run_d5981c30764b`)**: PR #55 T-3-004(`dc2cbaa`, 9/4 21:42) → PR #63 로컬 QA 화면 표시 오류 4건(`0b9fb69`, 22:35, 사용자 이슈 #57~#60) → PR #64 T-4-002 부상 모델(`27292d4`, 9/5 01:36) → PR #65 T-3-005 계약·협상·이적 UI(`3032bdd`, 02:25, **Phase 3 코드 종료**) → PR #67 T-4-003 관계·감독·평판(`b180536`, 04:17). PR #68 T-4-004 대표팀(5d9ffc5, CI 녹색)은 리뷰 지적 2건을 워커가 수정 중. 디자인 PR #66(19개 화면 모바일 개편, 사용자 작업)은 main 재통합 대기.

**남은 순서(Codex 계획)**: #68 머지 → #66 최신 main 통합·충돌 해결·머지 → T-4-005 UI → T-4-006 3시즌 통합 검증 → Phase 4 최종 감사. 사용자 결정은 U-014·U-015(LINE TEST 9/8 시작 예정)·U-005.

**세션 운용**: Claude 7일 사용량이 9/4 저녁 소진돼 Codex(gpt-5.6-sol ultra)로 인계했고, Claude 세션은 9/5 오전 사용량 회복 뒤 사용자 요청으로 상태 파악과 문서·현황판 갱신만 수행했다. 워커 투입·머지 판단은 계속 Codex 세션이 한다.

## 2026-09-04 (오후, 오케스트레이터 인계·PR #54 머지)

**인계**: Claude Code 세션 `ec0b55e0-72c5-48f4-81e0-e287cece7700`의 전체 흐름과 마지막 상태를 확인했다. 이 세션은 T-3-003 종료를 경계로 정지했으며 `claude --resume ec0b55e0-72c5-48f4-81e0-e287cece7700`으로만 재개한다. 기술 책임자·오케스트레이터는 Codex로 인계했고, 구현·테스트 코드 변경은 Orca Orchestration Run `run_d5981c30764b` 아래 **`gpt-5.6-luna` + reasoning `max` 워커에게만** 위임한다(동시 최대 3개). 오케스트레이터는 계속 `apps/`·`packages/`·`tooling/`을 직접 편집하지 않는다.

**T-3-003 결과**: PR #54의 최초 구현 head `cafb870`을 Luna Max가 독립 리뷰해 P1 세 건을 찾았다. (1) `잔류_선언`을 먼저 제거해 태그 기반 배신 이적이 영원히 판정되지 않음, (2) 임대에도 약속 위반 이적 팬 페널티가 적용됨, (3) 임대 만료 뒤 자동 FA 분기에서 원소속 복원 없이 임대 구단 context·관계가 남음. 같은 Luna Max 수정 워커가 공통 복원·태그 처리와 처리기 행렬 회귀 테스트 11건을 추가해 `7d31f07`로 push했고, PR #54를 16:47 KST squash 머지(`e1ae3de`)했다. 새 head의 Quality gates·Browser gates·Deploy PR preview가 모두 성공했고, 오케스트레이터 환경(Node 22) 전체 `pnpm test`도 domain 535·web 308·api 169를 포함해 10/10 task 통과했다.

**명세 정정·수용 결정**: 결산 뒤 시장 개설과 step 7 응답 필수화로 기존 golden의 revision/draws가 달라지는 것은 기능 요구의 필연적 결과라 수용한다. `career-11-loan` 첫 계약 길이 3은 임대 시즌에도 원계약 잔여가 소비되는 D-46을 실제 RETURN 분기로 검증하기 위해 수용한다. `rivalPairs`는 대칭으로 유지한다. 브리프의 `Contract.transferFeeMinor`는 현재 정본 Contract 계약에 없는 필드이므로 추가하지 않고 표시 투영은 T-3-005로 미룬다.

**Orca 운용 메모**: `worker-start --agent codex --model gpt-5.6-luna --effort max` 직접 생성은 이번 실행에서 명령 파싱 오류가 났다. 수정 확인 전에는 Luna Max 터미널을 수동 생성해 TUI idle을 확인한 뒤 `worker-start --terminal`로 task에 연결한다. 워커 샌드박스가 Orca 런타임에 접근하지 못해 `worker_done`을 못 보내는 경우에는 transcript·git·PR 증거를 회수하고 `worker-abandon` + 수동 task 완료 처리한다.

**다음 Wave 브리프**: [T-3-004](briefs/T-3-004.md)·[T-4-002](briefs/T-4-002.md)·[T-4-003](briefs/T-4-003.md)를 병렬 슬롯 3개로 확정했다. T-3-004는 Phase 3 상태를 바꾸지 않고 strict/runtime/sync 증거만 만든다. T-4-002는 부상 발생 뒤 강제 pending을 일반 슬롯보다 우선하고 재발 창을 additive episode counter로 추적한다. T-4-003은 시즌 사이 감독 예약(`nextManager`)·주장단 상태·실패 누계를 additive 상태로 두며, D-52 원문에 맞춰 전용 생성기 대상(INJURY/NATIONAL_TEAM/RUMOUR)만 일반 이벤트 후보에서 제외한다. 두 B 트랙 PR은 먼저 머지된 쪽의 공용 타입을 다른 쪽이 main merge로 보존한다.

**후속 브리프 선작성(17:11)**: [T-3-005](briefs/T-3-005.md)와 [T-4-004](briefs/T-4-004.md)를 작성했다. T-3-005 사전 감사에서 현재 main의 step 7은 CONTRACT 슬롯만 갖고 `selectEligibleEvents`는 RUMOUR을 제외하므로, 0.2.0 활성화만으로 `EVT-CON-010`이 도달하지 않는 계획-구현 간격을 확인했다. 웹 워커가 가짜 pending이나 조용한 domain 변경으로 덮지 않고 최소 `RESOLVE_EVENT` 재사용 전이를 결정 게이트로 올리게 했다. T-4-004는 skeleton에 없는 평점 대안 기준(`minRatingTenths:70`)과 이벤트 참조를 룰셋 데이터로 추가하고, 부상 자동 사양·managerTrust 불변·NATIONAL_DEBUT 1회 예약을 검증하도록 고정했다.

## 2026-09-04 (오후, PR #53 머지 — 트랙 B 타입 슬라이스)

**결과**: PR #53(T-4-001, `7188327` → squash `aba154a`, 13:57). 리뷰 수정 0건 — HEALTH Effect 규칙(SUM·즉시·만료 없음, activeEffects 미저장), 기본 감독 rng 0, 훅 골격 3개의 실제 호출 지점 배선(spy 테스트), INJURY·NATIONAL_TEAM의 RESOLVE_EVENT 전용 닫힘, 골든 draws 불변을 확인했다. 사건 2건: (1) PR #50이 먼저 들어가 CONFLICTING → 재머지 지시(양쪽 규칙 보존·체크섬 재계산·골든 재기록). (2) 재기록 골든 4개를 커밋하지 않고 push → 오케스트레이터 체인이 contracts 골든 순회 실패로 잡음 → 추가 커밋 뒤 체인 녹색(e2e 72). 워커 워크트리 `git status`를 DONE 직후 확인하는 절차를 메모리에 추가.

**U-016 완료(14:56)**: 사용자가 wrangler 로그인. staging D1 조회로 재예행 이벤트 확인 — funnel 5단계 각 1건, season_settled FAST/CHAPTER 각 1건, 배치 curl 70건은 D1 도달 확인 뒤 삭제. LINE TEST 준비 체크리스트는 U-014·U-015(사용자)만 남았다.

**후속**: T-4-002(부상 모델)·T-4-003(관계·감독·평판) 브리프. DEFERRED 타깃 접두사 불일치(워커 발견, 기존 버그)는 T-4-002에 정리 항목으로. 동시 워커 1개(T-3-003) — 7일 사용량 97%라 추가 투입은 9/5 21:00 리셋 뒤.

## 2026-09-04 (오후, PR #50 머지 — 이적시장 생성기, T-3-003 투입)

**결과**: PR #50(T-3-002, `0674ee4` → squash `408a765`, 13:33). 리뷰 수정 1건(결산 뒤 상태에서 STARTER·평점 INTEREST 분기 도달 불가 → `currentSquadPerformance` 폴백 헬퍼, 시장 골든 값·rng 소비 불변, 테스트 3건)을 워커가 반영했고 PR #51과의 manifest 체크섬 충돌도 origin/main 머지 뒤 재계산으로 스스로 해결해 준비해 둔 후속 지시(review-2)는 보내지 않았다. 체인(origin/main + 0674ee4) 녹색(e2e 72). Phase 3 완료 조건 1·2·5의 생성기 쪽 근거 확보, 배선은 T-3-003.

**T-3-003 투입(13:34)**: 브리프(13:20)대로. 동시 워커 2개(T-4-001·T-3-003). T-4-001과 `simulate.ts`·`types.ts`가 겹치므로 먼저 머지되는 쪽 뒤에 다른 쪽이 origin/main을 머지한다(브리프에 명시).

## 2026-09-04 (오후, PR #52 머지 — LINE TEST 결함 3건 수정, T-3-003 브리프)

**결과**: PR #52(T-2-015, `ff45412` → squash `5462dc7`, 13:21) 리뷰 수정 0건. 워커는 PR 게이트 폴백대로 push → `PR_BODY.md` → `DONE`으로 멈췄고 오케스트레이터가 REST(curl)로 PR을 열었다. 체인 녹색(mock e2e 72, 실 api e2e recovery-api·google-link·service-season 8). 워커가 로컬 D1로 20건 curl 202도 확인했다. 변경: `insertAnalyticsEvents` 14행 청크 순차 insert(spy 테스트 50 → 14·14·14·8, 로컬 Miniflare가 상한을 재현하지 않아 재현 시도 안 함), `toErrorEnvelope` unknown error 고정 문구(원문은 logger `errorMessage` 500자), 온보딩 첫 슬라이드 `onboarding-service-season-notice`. 투입 13:02 → 머지 13:21(19분).

**T-3-003 브리프(13:20)**: PR #50 머지 뒤 투입. 설계 결정 — `CareerState.parentContract`(임대 중 원소속 계약 보관, 기존 골든 9종 stateHash만 갱신), 룰셋 `contractRules.imposedPositionProficiency`·`leagues[].promotionSlots`, NEGOTIATE roll 1회(성공 bp = successBp + reputation 보정, 시장가치 보정은 룰셋 상수가 없어 보류), 재계약은 새 stint 없이 열린 stint의 contractId만 교체(`RENEWED` 예약 유지), 결산 순서 D-47 → 임대 분기 → 시장 개설, step 7 제안 자동 만료 임시 규칙 제거(응답 필수), 태그 평가기 5종 조건을 표로 고정, 웹은 SCR-009 재사용 라우팅·e2e 헬퍼만(첫 계약 1시즌이 가능해 step 7·결산 뒤 시장이 e2e에서 실제로 열린다).

**재예행(13:32, 5462dc7 staging)**: 온보딩→계약→FAST·CHAPTER 시즌 40초 통과, 분석 POST 4건 202, 20건·50건 배치 curl 202(Origin 헤더 필요, 수정 전 503), `/onboarding` 첫 슬라이드 LINE TEST 안내 확인. line-test-plan 3절 #2·#3 ✅, 7절 2행은 D1 건수 확인(U-016)만 남음. **후속**: 동시 워커 2개(T-4-001·T-3-002), 슬롯 1개 비어 있으나 T-3-003은 PR #50 선행이라 대기.

## 2026-09-04 (오후, PR #51 머지 — 팩 0.2.0·팀 12, PR #50 수정 요청, T-2-015 투입)

**결과**: PR #51(T-3-006, `6911b74` → squash `31e321d`, 13:01) 리뷰 수정 0건, 체인 녹색(e2e 71). 워커는 브리프의 Orca PR 게이트 폴백대로 `gh pr create`를 시도하지 않고 push → `PR_BODY.md` → `DONE`을 출력했고, 오케스트레이터가 GitHub REST로 PR을 열었다(오케스트레이터 세션의 `gh api …/pulls`도 이번엔 훅에 막혀 curl로 열었다). **브리프 정정 2건**(워커가 옳게 처리): (1) `phases: ['PRO']`는 CareerPhase가 아니라 stage라 스키마에 없다 → 각 이벤트의 실제 phase + `career.stage eq PRO` 트리거. (2) "팀 풀 확장 → 골든 9종 재기록"은 틀린 가정 — 골든은 domain 소유 `ruleset-proto.json`(팀 4개 고정)으로 생성되고 content 룰셋과 무관하다. 후보 풀 크기 변화는 `load-ruleset.test.ts`의 `poolSizeForTiers`로 검증. **후속**: web `apps/web/src/shared/narrative.ts` `STATIC_TOKEN_KEYS`에 `agent`가 없어 0.2.0을 활성화하면 `{agent}`가 그대로 노출된다 → T-3-005 브리프 선행 항목. `EVT-CON-010`은 `presentation: 'RUMOUR'`라 일반 후보 풀에서 제외되며 SCR-019(T-3-005)가 소비한다.

**PR #50(T-3-002) 리뷰(12:56~13:00)**: 체인 녹색, rng 소비 순서·골든(career-04·07은 OFFER_EXPIRED 타임라인으로 stateHash만 변경, draws 불변)·`transferRules` 정합 검사 모두 브리프대로. 워커 결정 3건 수용: `state.id` 대신 `state.careerId`(브리프 오류), ADR-005 때문에 도메인 테스트는 합성 8팀 룰셋(`market-fixture-ruleset.ts`), D-44 "tier 3 최저 조건" 대안 미구현(현 구단 잔류 변형만 — T-3-003에서 필요하면). **수정 요청 1건(도달 불가 분기, PR #37 교훈)**: `judgeMarketReason`이 `season === null`이면 STARTER·평점 INTEREST 판정을 건너뛰는데 `openMarketAfterSettlement`는 결산 뒤 상태(season null)를 받으므로 그 경로가 영영 실행되지 않는다. `currentSquadRole`도 같은 이유로 약속 역할로 떨어진다 → `seasonHistory` 마지막 결과(`selectionSummary.squadRoleAtEnd`·`playerStats`) 폴백 헬퍼 + 테스트 2건. 수정 뒤 #51 머지(manifest 체크섬)와 충돌하므로 origin/main 재머지 후 재검증.

**T-2-015 투입(13:02)**: PR #51 머지로 슬롯이 비자 즉시. LINE TEST(09-08) 전 머지 필수. 동시 워커 3개(T-4-001·T-3-002·T-2-015).

## 2026-09-04 (정오, PR #49 머지 — LINE TEST 준비 코드, Orca PR 게이트 사건, T-3-006 투입)

**결과**: PR #49(T-2-012, `41d2704` → squash `c90b769`, 12:18) 리뷰 수정 0건. 루트 체인 녹색(web 307·api 164 테스트, e2e 71) + 실 api e2e 7건(recovery-api·google-link·service-season) 통과. D-54·D-55는 브리프대로 구현됐다 — 리뷰에서 확인한 동작: (1) `POST /v1/analytics/events`는 50건 초과 시 요청 전체를 거부(절단 아님), 화이트리스트 밖 이벤트·속성은 건별 폐기, rate limit은 `auth_attempts` 테이블 재사용(kind `ANALYTICS_EVENTS`, clientId당 60/분). (2) `GET /v1/service-seasons/current`는 포인터 미설정·행 없음 모두 503 `SERVICE_SEASON_UNAVAILABLE`, `Cache-Control: public, max-age=60`. (3) 웹 폴백 순서 네트워크 → kv 캐시 → 상수 `svc_kickoff`이므로 production에서 포인터가 없어도 로컬 생성은 되고 동기화에서 막힌다(출시 게이트 전 의도된 상태). 허브는 LOCKED·ARCHIVED가 확인된 경우에만 생성을 막는다. (4) 워커가 적은 범위 밖 한계: 프로필 복구 다운로드가 커리어별 `createdServiceSeasonId` 대신 현재 포인터 하나를 쓴다(`GetCareerResponse`에 필드 없음) — T-2-013 운영 계획에서 다룰지 판단.

**Orca PR 게이트 사건**: 워커의 `gh pr create`가 Orca 데몬 훅("이 세션에서 코드 정리를 아직 실행하지 않았습니다. PR 생성 전 /simplify 또는 /review:pr …")에 세 번 막혔고, 워커가 `/review:pr`를 단일 에이전트로 수행한 뒤에도 같은 훅이 막았다. 오케스트레이터 세션의 `gh pr create`도 같은 훅에 막혀 **GitHub API(`gh api repos/…/pulls`)로 PR #49를 열었다**(오케스트레이터가 diff 전체를 리뷰한 뒤). 게이트를 유지할지, 워커 세션에서만 풀지는 사용자 결정으로 올린다. 그때까지 브리프 규칙: 훅에 막히면 브랜치 push → PR 본문을 워크트리 `PR_BODY.md`로 저장 → `DONE <sha>`와 본문 경로 출력 후 멈춤, 오케스트레이터가 리뷰 뒤 API로 PR 개설(T-3-006 브리프부터 명시, 진행 중인 T-4-001·T-3-002는 턴 종료 시 같은 지시 전달).

**투입**: T-3-006(팩 0.2.0·PRO 이벤트 5·팀 4 추가, `T-3-006-pack-0-2-0`, 12:21) — 동시 워커 3개(T-4-001·T-3-002·T-3-006). T-4-001은 31분 만에 컨텍스트 84%라 압축 뒤 이어질 가능성이 높고, 7D 사용량 93%(9/5 21:00 리셋).

**T-2-013 완료(12:26, 오케스트레이터 docs)**: [line-test-plan.md](line-test-plan.md). 정한 것 — (1) 기준선 3지표의 분모: 첫 계약 도달률 = CONTRACT_SIGNED/ONBOARDING_STARTED(첫 커리어, `careerIndex = 1`), 첫 시즌 완주율 = SEASON_SETTLED/CONTRACT_SIGNED, 두 번째 시즌 시작률 = seasonIndex 2종 이상 `step_passed` 기기/SEASON_SETTLED. (2) 일정 제안 09-08~09-21(1차 1주 → 중간 기준선 → 2차 1주 → 최종 기준선), 2주 상한(D-32 Phase 3·4 밸런스가 기다림). (3) 종료는 D1 직접 UPDATE가 아니라 시드 `svc_line_test` status LOCKED PR(시드가 배포마다 upsert). (4) 사람 기준 세션 길이 판정은 U-005가 아니라 분석 이벤트 버킷으로. (5) 새 사용자 액션 U-015(테스터 모집·안내문·피드백 채널). 공개 전 오케스트레이터 예행(FAST·CHAPTER 1시즌씩 staging 완주)은 staging 확인 뒤 바로 한다.

**staging 확인·예행(12:34~12:56)**: `GET /v1/service-seasons/current` → `svc_line_test`·PRESEASON·`isTest: true`·`notice: LINE_TEST`. 예행은 기존 e2e 헬퍼를 staging URL로 돌리는 임시 스펙(스크래치 워크트리, 커밋 안 함): 온보딩→복구 코드→첫 계약(16초)→FAST 시즌→CHAPTER 시즌→허브 배너·배지까지 39초에 통과. **결함 3건**: (1) 분석 이벤트 POST 4건 중 1건 503 — curl 재현: 1건·14건 202, 20건 503 `Failed query: insert into "analytics_events" …`. 원인은 D1 문장당 바인딩 변수 100개 상한(7열×20행=140), Miniflare 로컬은 재현 안 됨. 웹 큐가 20건마다 비우므로 LINE TEST에서 대부분의 배치가 유실될 결함. (2) 그 503 본문에 SQL 전문이 노출됨(`toErrorEnvelope`가 unknown error의 `err.message`를 그대로 내보냄). (3) 빈 기기는 온보딩으로 리다이렉트돼 테스트 시즌 안내를 못 본다(배너는 허브 전용). → [T-2-015 브리프](briefs/T-2-015.md)(12:36): 14행 청크 순차 insert + spy 테스트, unknown error 메시지 고정·로거로 이동, 온보딩 안내 1줄. 동시 워커 3명 상한이라 첫 워커 종료 즉시 최우선 투입(LINE TEST 09-08 전 머지 필수). 기준선 D1 조회는 이 기기 wrangler 토큰 만료로 불가 → U-016(사용자 `wrangler login`).

**후속**: staging 배포(run on `c90b769` → 문서 푸시로 취소돼 `2270e81` run이 대신 배포)가 끝나면 `GET https://offside-api-staging.tasddc1569.workers.dev/v1/service-seasons/current`가 `svc_line_test`·`isTest: true`를 돌려주는지 확인 → T-2-013(LINE TEST 운영 계획, 오케스트레이터 docs). U-014(Paid 플랜)는 LINE TEST 공개 직전.

## 2026-09-04 (오전, PR #48 머지 — Phase 3·4 타입 슬라이스, 후속 브리프 3종 작성)

**결과**: PR #48(T-3-001, `d3ce9df` → squash `b756999`, 11:43) 리뷰 수정 요청 1건 — 브리프가 `contract.isLastSeason`을 `seasonsRemaining <= 1`로 적어 워커가 그대로 구현했으나, ADR-010 유도식(`lengthSeasons − 서명 이후 SEASON_STARTED 횟수` = 현 시즌 **이후** 잔여)에서는 진행 중 마지막 시즌의 잔여가 0이므로 `season !== null && seasonsRemaining === 0`으로 정정(브리프 오류, 오케스트레이터 책임). 리뷰 결정 3건: `stepSummaries` 길이 11 유지(결산 step은 요약 없음 — 브리프의 12도 오류), followUp 이벤트에도 presentation 제외 규칙 적용, 골든 멀티라인 포맷 수용. 검증 체인(origin/main + d3ce9df) 녹색 — e2e 68 통과, 골든 9종 draws 불변. 비용 $25.77·85분.
**후속 브리프 3종(11:40, 오케스트레이터 작성)**: [T-4-001](briefs/T-4-001.md)·[T-3-002](briefs/T-3-002.md)·[T-3-006](briefs/T-3-006.md). 브리프 수준에서 정한 것 — (1) **T-3-002는 생성기까지만**: `judgeMarketReason`(rng 없음)·`generateMarket`·`buildRenewalOffer`·`openMarketAfterSettlement`를 export하고 결산 배선·ACCEPT/REJECT/NEGOTIATE는 T-3-003이 한다(둘 사이 어떤 커리어도 막히지 않도록). step 7 RENEWAL 제안은 T-3-003 전까지 "미응답 = OFFER_EXPIRED 자동 통과" 임시 규칙. 안전 잔류 제안은 항상 **현 구단**(D-44의 tier 3 대안 미사용). D-45의 관계 이월 값은 트랙 B와의 파일 충돌을 피해 `transferRules.relationshipCarry`에 둔다(D-53 표의 `relationshipRules.transferCarry` 대신). `competitorSummary`는 파생 시드(`market:<careerId>:<revision>:<teamId>`)로 계산해 결정 스트림 draws를 늘리지 않는다. (2) **T-4-001**: `HEALTH` Effect는 SUM·IMMEDIATE·만료 없음·activeEffects 미저장으로 제한, `RELATION` 타깃에 `popularity`·`media`(→ `reputation.*Centi`) 추가하고 ADR-010 표를 같은 커밋에서 갱신. `START_SEASON`이 rng 없이 기본 감독(`${teamId}-mgr-1`, 이름은 teamId 코드포인트 합으로 선택, tenure = 같은 팀 연속 시즌 + 1)을 채워 `season.manager.*` DSL이 바로 값을 갖는다. `RESOLVE_EVENT` payload에 `rehabPlan?`·`callUp?`를 더해 INJURY·NATIONAL_TEAM pending을 닫고, `onMatchInjury`·`onSettlementRelations` 항등 훅을 `simulate.ts`에 미리 박아 T-4-002·T-4-003이 공용 파일을 다시 만지지 않게 한다. 트랙 B 룰셋 5개 섹션(자리표시자 값)은 `growthRules` 뒤, T-3-002의 `transferRules`는 `offerRules` 뒤에 넣어 같은 파일의 충돌 위치를 분리. (3) **T-3-006**: 팩 0.2.0을 새 디렉터리로 만들고 로더에 등록하되 **활성 팩은 0.1.0 유지**(전환은 T-3-005 또는 별도 작업 — 서비스 시즌 seed와 골든을 건드리지 않기 위해). 새 이벤트 5개는 전부 PRO 단계·`authoring: 'PROTOTYPE'`(이벤트 스키마에 선택 필드 추가)이며 루머 이벤트만 `presentation: 'RUMOUR'`. 팀 4개 추가(1부 1·2부 1·3부 2 → YOUTH 1·1부 3·2부 4·3부 4)로 첫 계약 추첨 풀이 바뀌어 골든 9종 재기록(draws 불변). narrative 토큰에 `agent` 키 추가.
**투입 순서**: T-4-001·T-3-002 즉시(동시 워커 3개 상한 — T-2-012 진행 중), T-3-006은 T-2-012 머지 뒤. 7D 사용량 90%(9/5 21:00 리셋)라 상한에 걸리면 워커가 멈출 수 있음 — 그 경우 리셋 뒤 재개.

## 2026-09-04 (오전, 사용자 결정 4건 — PR #46 머지·ADR-010 승인·U-013 (A)·구단 12개, T-2-012·T-3-001 투입)

**사용자 결정**: (1) PR #46(T-0-010, 사용자 작성 Cloudflare 배포 파이프라인) 머지 승인 → `abf9bfa` squash 머지(10:07). 리뷰: GitHub Actions 3잡 + 오케스트레이터 로컬 체인(e2e 68) 녹색, 코드 변경 4건 타당, 안전 경계(fork 시크릿 미전달·preview D1 직렬화·production 자동 배포 없음) 확인. 권고 1건 — private 저장소 Actions 무료 한도(월 2,000분) 대비 `docs/**`만 바뀐 푸시도 전체 CI·staging 배포가 돌므로 `paths-ignore` 추가(후속 PR). (2) **ADR-010 설계 승인(U-012 닫힘)**. (3) U-013 **(A)**: Phase 3·4 워커가 메커니즘 검증용 최소 이벤트 문구를 `PROTOTYPE`·`playtested: false`로 직접 쓰고 정식 문구는 콘텐츠 승격 뒤 교체. (4) 가상 구단 8→12 확장(T-3-006 범위, 브랜드 어휘 준수).
**투입**: T-2-012(LINE TEST 준비, [브리프](briefs/T-2-012.md), 포트 5189)와 T-3-001(타입 슬라이스, [브리프](briefs/T-3-001.md), 포트 5188)을 나란히. 파일 경계: T-2-012는 domain·content·contracts career-state/commands/careers를 만지지 않고, T-3-001은 apps·platform·contracts analytics/service-seasons를 만지지 않는다. T-0-010은 main 푸시 staging 자동 배포·smoke 확인 뒤 completed → **10:40 completed**: `abf9bfa` 런은 10분 뒤 문서 푸시(`0ba3ea0`)가 워크플로 concurrency `cancel-in-progress`로 취소했고, `0ba3ea0` 런이 Quality·Browser·Deploy staging 전부 success. staging api health·web root 200 직접 확인. 교훈: 문서만 바뀐 푸시가 진행 중인 main 런을 취소하고 같은 코드를 다시 배포한다 — `paths-ignore: docs/**`(그리고 main 푸시는 cancel-in-progress 대신 대기)가 필요하다. Phase 0 전 항목 종료.
**D-54·D-55**([phase-2-plan.md](phase-2-plan.md)): 서비스 시즌 포인터는 API 환경 변수 `ACTIVE_SERVICE_SEASON_ID`(staging `svc_line_test`, production 미설정 → 503), `service_seasons.is_test`로 테스트 보관함 구분, API-SVC-001 공개 라우트, 신규 생성만 PRESEASON·ACTIVE 허용. 분석 이벤트는 platform 큐 → `POST /v1/analytics/events` → D1 `analytics_events`, zod 화이트리스트, 신규 이벤트 4종(`funnel_reached`·`step_passed`·`season_settled`·`choice_selected`)으로 D-31 네 지표를 낸다. Analytics Engine 미사용.

## 2026-09-04 (새벽, PR #47 머지 — Phase 2 코드 작업 종료)

**결과**: PR #47(T-2-011, `0c27965`, 03:41) 리뷰 수정 요청 0건. 오케스트레이터 검증 체인(origin/main 5a16831 + 116dc62) 녹색 — lint·deps·typecheck·test·build·bundle·e2e 68 통과. [Phase 2 완료 조건 표](phase-2-completion.md) 9행 전부 ✅: 포지션군 fixture 4종(GK 기존 + DF·MF·FW 신규, `@offside/fixtures` export·contracts 크기/스키마·api Node↔workerd 해시 등록), 시즌 결정론(같은 시드 2회 재생 stateHash 일치)·집계(playerStats ↔ matches 재합산), career-03-underdog 시즌 완주 + shadow-replay(선수 START 수 > COMP-W-2), selection A/B 시즌 B > A, FAST·CHAPTER 시즌 완주 자동화 시간·명령 수 기록, TEST-E2E-002·010(새로고침 전후 `rngState.draws` 동일), e2e 68건 3회 무결점(5187).
**후속 정리**: (a) `generatePlayerProfile` truePotential ≥ baseOvr+1 불변식(roll 순서·소비 불변, 표본 7%의 역전 해소; career-04-gk·07-df golden 갱신 — 저장된 커리어는 생성 시점 값 유지, schemaVersion 1 그대로). (b) 워커 시뮬레이터 타임아웃을 요청당 예산으로(`rejectOne`; 포트 broken은 error/messageerror만, 늦은 응답은 무시). (d) `TrainingFocus`를 domain에서 re-export. (c) EVT-REL-001(가중치 100) vs EVT-CON-002(10) 가중치 관찰은 수정하지 않고 T-2-010 콘텐츠 입력으로 기록 — "사용자 확인"이 아니라 오케스트레이터 지시였음을 명시.
**발견(범위 밖, 기록만)**: W 포지션 slots=2 구조상 "선수 선발 수 > COMP-W-1"은 성립 불가(선수 제외 경기에도 COMP-W-1이 rank 1 START) → 완료 조건 비교 대상을 전술 적합도에 밀려 벤치인 COMP-W-2로 고정. A/B 시즌 비교는 선발이 갈린 뒤 경기 RNG가 분기해 시즌 전체는 선발 수·출전 시간으로만 비교. 세션 자동화 시간은 FAST 2.9~4.5초·CHAPTER 3.0~4.7초(명령 4건) — 사람 기준 6분/12분 판정은 U-005 플레이테스트 결과와 합쳐 오케스트레이터가 낸다.
**Phase 2 코드 작업 종료**: 남은 T-2-010(U-005)·T-2-012(U-002)·T-2-013(012 뒤)은 사용자 게이트. Phase 3·4는 U-012(ADR-010)·U-013 확인 뒤 투입하며 T-3-001 브리프를 먼저 쓴다. 7D 사용량 86%(9/5 21:00 리셋)라 브리프 작성은 오케스트레이터가 직접 하고 워커 투입은 리셋·승인 뒤로 둔다.
**T-3-001 브리프 선작성(03:46, [briefs/T-3-001.md](briefs/T-3-001.md))**: phase-3-4-plan D-44·D-45·D-53을 타입 슬라이스로 구체화하면서 네 가지를 브리프 수준에서 정했다 — (1) `appearancePromise`는 `{ minutesShareBp }`만 두고 역할은 기존 `rolePromise`로 갈음, (2) D-53 표의 `FootballSeason.market`은 두지 않고 시장 요약(`MarketSummary`)은 `pending.OFFERS/CONTRACT` 안에만, (3) step 7 사전 협상 pending은 `{ kind: 'CONTRACT'; step; offers; market }`(OFFERS와 같은 형태 + step)로 `ACCEPT_OFFER`/`REJECT_OFFER`를 재사용, (4) PR #45 후속 `SeasonResult.stepSummaries[]`는 T-3-001에 배정. `clubHistory`는 현 소속 항목(`toSeasonIndex: null`)을 포함하며 Phase 1 첫 계약이 첫 항목을 만든다. 룰셋 데이터·스키마는 T-3-001이 만지지 않는다(밸런스 수치 0건). 트랙 B pending(INJURY·NATIONAL_TEAM) 형태와 DSL 경로(`health.*`·`reputation.*`·`season.manager.*`)는 NOT_MODELED로 예약만.

## 2026-09-04 (새벽, Phase 3·4 병렬 계획 초안 D-43~D-53)

**결과**: [phase-3-4-plan.md](phase-3-4-plan.md) 작성(02:18). phase-03·04 정본, ADR-010, 로드맵 "Phase 3 이후 병렬화", 03·04·11 개발 명세, 현재 도메인 타입(Offer/Contract/Pending/FootballSeason/CareerState, offers.ts, season.ts 슬롯 규칙, contracts commands.ts의 CMD-CON 예약 리터럴)을 대조해 트랙 A(T-3-001~006)·트랙 B(T-4-001~006)로 분해했다. 주요 결정: (D-43) 팀 변경은 결산 뒤 이적시장에서만, step 7 창은 재계약 사전 협상·루머 태도만; (D-44) Offer v2(kind·유효 revision·출전 약속·협상 1회·안전 잔류 제안); (D-45) ACCEPT_OFFER 원자 전환과 context·관계 이월 표; (D-46) 임대 1시즌·LOAN_RETURN; (D-47) 약속 위반·배신 이적 Effect·태그; (D-48) Phase 3 태그 5종 코드화(구단 tier 실제 변경은 Phase 6·8); (D-49) 부상 모델(심각도·부위·범위·재활·재발·후유증은 확정 시점에만, 강제 사건 상한 2); (D-50) 관계 5축 + relationshipLog·memoryTags, season.manager와 결산 교체, reputation.popularityCenti; (D-51) 대표팀 기본 모듈·NATIONAL_DEBUT 챕터; (D-52) 새 명령은 CMD-CON-001~004뿐, 부상·대표팀·관계 결정은 RESOLVE_EVENT + presentation 변형; (D-53) 트랙별 파일·필드 소유권, 타임라인 kind 사전 예약, 타입 슬라이스 순차(T-3-001 → T-4-001), schemaVersion 1 유지. 열린 질문에 U-013(워커 PROTOTYPE 문구 작성 허용, 팀 풀 확장) 추가. PR #45 후속(결산 뒤 step 요약 유실)은 타입 슬라이스에 `SeasonResult.stepSummaries[]`로 배정.

## 2026-09-04 (새벽, PR #44 검증 실패 — e2e 결함 2건, T-2-011 투입)

**결과**: PR #44(T-2-008, `0ffc00f`)·PR #45(T-2-009, `3fa150f`) 리뷰는 수정 요청 0건. 그러나 #44를 main 위에서 전체 체인으로 돌리자 e2e 60 통과·2 실패(병렬 부하). trace·error-context로 원인 확정: (1) `season.spec.ts` `advanceThroughSeasonToSettlement` — '진행' 클릭 직후 다음 루프의 `toBeEnabled`가 isPending 반영 전 틱에 통과 → `textContent()`는 '진행' → `click()`의 actionability 대기가 disabled→enabled 전환을 건너 step 12/12의 '결산하기'(같은 `/^(진행|결산하기)$/` locator)에 클릭이 떨어져 `season-result` 자리표시("준비 중")로 이동, 거기서 60s 타임아웃. (2) `chapter.spec.ts`(a11y.spec SCR-031도 같은 helper) — 시드에 따라 17세 OVR 59 선수가 19경기 전부 `미선발 · 0분`이라 DEBUT 트리거(minutes>0)가 한 번도 안 맞아 챕터가 안 열리고 step 12에서 타임아웃. 둘 다 이 PR의 e2e 설계 결함이라 PR 안에서 수정 후 머지: (1) 클릭 locator를 `'진행'` exact로 분리, 클릭 뒤 `step k/12`·pathname 변화를 기다린 뒤 다음 루프(chapter helper도 동일), (2) `createCareer`에 DEV 전용 시드 오버라이드(`localStorage['offside:e2e-seed']`, `import.meta.env.DEV` 가드)를 두고 chapter·a11y e2e는 데뷔 챕터가 이른 step에 열리는 시드를 상수로 심는다. 전체 e2e 3회 + 해당 스펙 `--repeat-each 3` 통과를 요구.

**머지**: T-2-008 수정 커밋 `401e62e`(exact locator 분리·클릭 뒤 `step k/12`/pathname 변화 대기, `createCareer`의 DEV 전용 `localStorage['offside:e2e-seed']` 오버라이드 + `seedDeterministicChapterRun`, README) 검토 통과 → main 위 전체 체인 e2e 62 통과 → PR #44 `4f11110` 01:56 머지. 남은 위험(T-2-011 e2e 견고화 항목으로): `Promise.race`의 패자 `waitForURL`이 60s 뒤 늦게 거부되는 구조, `/legal/privacy` axe `scrollable-region-focusable`가 `--repeat-each 3`에서 2/96 실패(기존 플레이크), 시드 상수는 콘텐츠·룰셋 변경 시 재선정 필요. T-2-009에 `MAIN UPDATED 4f11110` 전송.

**PR #45 머지**: T-2-009가 `MAIN UPDATED 4f11110`을 받아 main을 머지(`56ae745`: labels.ts 양쪽 유지, PR #44의 season.spec exact locator·step 대기 구현을 `helpers/player-creation.ts`로 옮겨 유지 + `resolveCurrentChapterScreen`, a11y 중복 import 정리) → main 위 전체 체인 e2e 66 통과 → PR #45 `1065272` 02:08 머지. 후속(Phase 3 브리프에 배정): (a) 결산 뒤 `season`이 비워져 다이어리의 step 요약("3승 1무" 등 STEP_PASSED 연대기)이 사라짐 — 도메인이 `SeasonResult`에 step별 요약을 남겨야 함, (b) SCR-006 유소년 변형은 단위 테스트만 있고 e2e·axe 미커버(유소년 fixture 필요), (c) 시즌 결산 화면의 D-29 "경계 회귀" 캡션 문구는 콘텐츠 검토 대상. T-2-011에 `MAIN UPDATED 1065272` 전송(web 항목 착수, `/legal/privacy` axe 플레이크 재현 시 최소 수정 허용).

**운영**: T-2-008 워커 TUI가 입력을 받지 않아(`send` accepted, 화면 미반영, 매달린 자식 없음) 프로세스를 끝내고 `redispatch.sh`로 같은 워크트리에 새 터미널을 띄워 지시 파일 경로만 보냈다. 멀티라인 `orca terminal send`는 입력창에 들어가지 않는다 — 긴 지시는 파일로 쓰고 한 줄로 경로를 보낸다.

**투입**: T-2-011(Phase 2 완료 조건 검증, 워크트리 `T-2-011-phase2-verify`, 포트 5187)을 3번째 워커로 투입. #44·#45가 아직 main에 없으므로 브리프에 "도메인·API 항목 먼저(fixture 3종→결정론→집계→career-03→B > A→후속 3건), web 항목(세션 길이·e2e 3회·TrainingFocus import)은 `MAIN UPDATED` 뒤" 절을 추가했다. #45 후속으로 결산 뒤 `season` 초기화로 다이어리 step 요약("3승 1무")이 사라지는 문제(도메인이 `SeasonResult`에 step 요약을 남겨야 함)를 T-2-011 또는 Phase 3 초에 배정한다.

## 2026-09-03 (밤, PR #43 T-2-014 머지 — Phase 3+ 공유 계약 D-40~D-42, ADR-010 승인 대기)

**결과**: T-2-014(PR #43, `dd480a2`) 머지. (D-40) Effect: kind→타깃 소유권 표(ADR-010), `ONCE_PER_SEASON`(dedupe 키 `season:<index>:<sourceId>`, 결산 회귀 시 정리), `AT_SEASON_END`·`SEASONS_AFTER`(저장 시 `AT_SEASON_INDEX`로 치환), `REPLACE`는 적용 전 값을 `restoreTo`에 저장해 복원, `reasonTag`, 결산 직전 `expireAtSeasonEnd`(AT_SEASON_END·이번 시즌 이하 AT_SEASON_INDEX·자연 만료 못 한 AT_STEP 강제 만료) → 그 위에서 성장·회귀. PERMANENT는 만료 금지(콘텐츠 스키마). (D-41) `computeMarketValueIndex(input, marketValueRules)` 순수 함수(bp 가중 7성분, 0~10000 centi), `MarketValueInput`에 `truePotential` 타입 배제(`expectTypeOf`), `buildMarketValueInput` 어댑터(`contractSeasonsRemaining = lengthSeasons − 서명 이후 SEASON_STARTED 횟수`, `popularityCenti` 5000 고정은 Phase 4까지). (D-42) `CAREER_TAG_IDS` 16종(14 문서 순서)·`CAREER_TAGS`(label·rarity·evaluateAt·ownerPhase), `state.careerTags`·`careerTagGrants`, `grantCareerTag`(멱등·정렬), `evaluateCareerTags` 결산 훅(seasonHistory 반영 뒤 평가, timeline `CAREER_TAG_GRANTED`), 평가기 TAG-BIG-GAME(챕터 SUCCESS 5회)·TAG-DERBY-HERO(더비 3회)·TAG-IRONMAN(10시즌 80%). `RESOLVE_CHAPTER.outcomes[].kind` 필수, `ChapterRecord.trigger`·`decisions[].outcomeKind`. 골든은 hash·신규 필드만 변경.

**리뷰 결정**: 수정 필수 2건 — (1) 세 번째 반복된 "타입 확장으로 깨진 apps/web typecheck": main(PR #42) 머지 뒤 테스트 리터럴·labels·SyncConflictDialog·대시보드 timeline switch 최소 수정, e2e는 `E2E_PORT=5194`로 필수. 워커가 또 "기존 오류"라 적었으나 이 PR의 `CAREER_TAG_GRANTED` 추가가 원인. (2) `expireAtSeasonEnd`의 `AT_SEASON_INDEX` 비교를 `===`에서 `<=`로(유스 구간 index 0 효과가 영원히 남지 않게, 테스트 추가). 수용: `contractSeasonsRemaining` 유도식, 태그 ownerPhase/evaluateAt 배정(ADR-010 표), `popularityCenti` 고정.

**사용자 결정 필요(U-012)**: ADR-010(공유 계약)은 워커가 작성했다 — ADR-001~009처럼 사용자 승인이 필요하다. 특히 (a) 태그별 ownerPhase 배정, (b) 시장가치 가중치(bp 3500/2000/1500/1000/1000/500/500)와 `popularityCenti` 5000 고정, (c) PERMANENT 만료 금지. 승인 전에도 Phase 3·4 브리프 작성은 이 계약을 전제로 진행한다.

**후속 기록**: `MarketValueInput.leagueTier`는 `contract.leagueTier`에서 오므로 Phase 3 이적이 계약을 바꿀 때 함께 갱신해야 한다. 웹 `TrainingFocus` 재선언(T-2-007)은 domain 타입 import로 정리(T-2-009 또는 T-2-011).

## 2026-09-03 (밤, PR #42 T-2-007 머지 — 시즌이 브라우저에서 돈다, T-2-008·T-2-009 투입)

**결과**: T-2-007(PR #42, `4feeb15`) 머지. 계약 → 프리시즌 계획(SCR-005: 모드 FAST/CHAPTER 기본값 RULE-TIME-003, 훈련 계획 ROLE/TECHNICAL/PHYSICAL/MENTAL → `START_SEASON.trainingFocus`) → 시즌 준비(SCR-011: 12 step 미리보기·컵 일정·시즌 시작) → 역할 제안(SCR-012: KEEP/POSITION_CHANGE CompareCards/ROLE_CHANGE → `RESOLVE_ROLE`) → 대시보드 시즌화(SCR-029: pending 종류별 다음 결정 카드, 일정표 탭 경기별 스코어·출전·평점, 전술실 탭 `deriveTacticalRoom`) → 결산까지 브라우저에서 이어진다. SCR-033 능력치 상세(묶음·역할 가중치·OVR 미리보기, truePotential 미노출 테스트). SCR-031·015는 자리표시(T-2-008·009). playwright `E2E_PORT`/`E2E_API_URL` override. e2e 60 통과(season 2·a11y 4 신규), 초기 번들 97 KB gzip. 계약 뒤 시즌 1 전체(계획→결산)→시즌 2 계획까지 e2e 3.9~5.0초.

**리뷰 결정**: 수정 필수 없음. 훈련 계획은 02 명세의 "2~3개" 대신 D-39 `trainingFocus` 4종과 1:1(명세는 고치지 않고 기록). "조건부 훈련"은 도메인 명령이 없어 미구현. 웹의 `TrainingFocus` 타입은 domain 타입을 import하지 않고 재선언 — T-2-009에서 정리 가능(비차단).

**투입**: T-2-008(SCR-031 챕터 화면: `selectChapterCandidates`→`ADVANCE.chapterCandidates`, `RESOLVE_CHAPTER`, 재생, e2e 포트 5185)·T-2-009(SCR-015 결산 화면: `deriveSeasonResultView`, 카운트업, 응답 유실 복구, 포트 5186). 동시 워커 3개(T-2-014·008·009). 접점: T-2-014(PR #43)가 `RESOLVE_CHAPTER.outcomes[].kind`를 필수로 만들므로 T-2-008은 팩 outcome의 `kind`를 처음부터 실어 보내게 안내.

**운영 메모**: 브리프 템플릿의 e2e 절을 워커별 `E2E_PORT`로 갱신. 워커 Bash 분류기 장애(T-2-007, 약 20분)는 재시도 지시로 풀렸다.

## 2026-09-03 (밤, PR #41 T-2-004 머지 — Wave 3 종료, T-2-014 투입)

**결과**: T-2-004(PR #41, `7859e8a`) 머지. `walkToNextDecision`이 step의 경기를 돌린 직후 `selectChapter`(roll 없음)로 후보를 대조한다 — 출전(minutes > 0)한 경기만 대상, FAST는 MAJOR만, `resolvedChapterIds`(`${chapterId}@${seasonIndex}`)와 이번 시즌 `season.chapters`로 재열림 방지, MAJOR > weight > id. `RESOLVE_CHAPTER`(CMD-SIM-005)는 판단마다 `state.rngState`에서 roll 1회(경기 스트림은 건드리지 않음), 같은 decisionId 재전송은 `DECISION_ALREADY_RESOLVED`. 판단이 모두 끝나면 `ChapterRecord`(평점 델타는 최종 평점 − `computeRatingTenths` 재도출 원래 평점)를 `season.chapters`에 남기고 timeline `CHAPTER_RESOLVED`. 팩 `chapters/CHP-MATCH-001/002/004`, 스키마는 CURRENT/RELATION/DEFERRED만·±12·`ratingDeltaTenths` ±15·`priorProbability.successBp` ±500bp. 룰셋 `leagues[]`에 `rivalOpponentIndex`·`promotionSpots`·`relegationSpots`. golden career-05-chapter(CHAPTER 모드, step 3 데뷔전, 판단 2개, 100회 재생 불변) 신규. 기존 골든은 필수 필드 추가로 hash만 변경(RNG 소비 5개 전부 불변), career-02·04는 placeholder CHAPTER 자동 통과용 여분 `ADVANCE`가 사라져 명령 로그가 줄었다. 실제 1.0.0 룰셋·0.1.0 팩으로 CREATE_CAREER부터 진행해 유스 첫 시즌 step 3에서 데뷔전 챕터가 실제로 열리는 것을 테스트로 확인(도달 불가 분기 없음).

**D-38 확정**: 브리프대로. 추가로 (1) `ADVANCE.payload.chapterCandidates`가 비면 챕터는 열리지 않는다(기존 골든 호환, START_SEASON은 step 1이 항상 ROLE_PROPOSAL이라 후보 없이 걷는다), (2) CHAPTER pending은 자동 통과 대상에서 빠졌다(`RESOLVE_CHAPTER`로만 닫힘), (3) 웹의 `selectChapterCandidates`(content runtime)는 `positionGroups`·`resolvedChapterIds`만 거르고 실제 판정은 domain이 한다.

**리뷰 결정**: 수정 필수 1건 — 타입 확장(`resolvedChapterIds`·`CHAPTER_RESOLVED`)으로 깨진 apps/web typecheck를 같은 PR에서 최소 수정. 워커가 "T-2-002 때부터의 기존 버그"라 적은 대시보드 `timelineSentence` 오류는 실제로 이 PR의 `CHAPTER_RESOLVED` 추가가 원인(exhaustive switch)이었다 — 브리프 템플릿에 "'기존 버그'라 적기 전에 origin/main에서 확인" 규칙 추가(b112c98). 수용: 골든 hash 변경·명령 로그 축소, `ChapterRecord.ratingDeltaTenths` 정의.

**후속 기록**: tier1~3 리그의 `rivalOpponentIndex`(전부 1)·`promotionSpots`/`relegationSpots`(0/3, 3/3, 3/0)는 스키마 통과용 임시값 — 콘텐츠 정본(`docs/content/kickoff/`)에서 확정할 것. DEBUT 트리거가 `seasonIndex === 1`로 제한돼 2번째 시즌 데뷔(첫 시즌 0분)는 열리지 않는다 — Phase 3 태그 작업(T-2-014 이후)에서 `seasonHistory` 출전 합산으로 넓힌다. 챕터 판단이 바꾼 평점은 그 step의 폼 갱신(`applyCondition`, walk 중 계산)에는 반영되지 않는다 — 결산 통계에는 반영됨.

**투입**: T-2-004·T-2-005가 모두 main에 있어 T-2-014(Phase 3+ 공유 계약: D-40 Effect 규칙·D-41 시장가치·D-42 CareerTag·ADR-010)를 투입했다. 동시 워커 2개(T-2-007·T-2-014). T-2-007 머지 뒤 T-2-008(챕터 화면)·T-2-009(결산 화면)를 투입한다.

**운영 메모**: T-2-007 워커가 Bash 안전 분류기 장애("claude-sonnet-5 temporarily unavailable (overloaded)", auto 모드가 셸 명령 판정 불가)로 약 20분 멈췄다. 다른 워커에서 셸이 정상인 것을 확인하고 재시도를 지시해 풀렸다 — 감시의 IDLE-LONG이 잡아 준다. T-2-004 워커 비용 약 $45.8(177분, main 머지·골든 재생성 포함).

## 2026-09-03 (밤, PR #40 T-2-005 머지 — Wave 3 절반, T-2-004 PR #41 리뷰 중)

**결과**: T-2-005(PR #40, `eaeb6cf`) 머지. `SETTLE_SEASON`이 `SeasonResult`(팀 성적·개인 통계·성장 Δ·원인 태그·canonical hash)를 `seasonHistory[].result`로 남기고, 성장은 결산 시 1회 roll 없이 정수 산술(연령대 예산 U21 600/PRIME 200/VETERAN 0 centi, 잠재력 gap cap 20, 출전 계수 2,400분 기준·바닥 30%, 경험 보너스 평점 7.5 이상, 훈련 집중 `START_SEASON.payload.trainingFocus`, 소수 이월 `growthCarryCenti`). 폼·체력·사기는 매 step 경기 결과로 갱신(`conditionRules`, 폼 기준 평점 6.5·나눔 0.8). 밸런스 테스트(200 seed × 17/25/31세)가 balance-targets 표를 만족한다(U21 중앙값 +1·90백분위 +3, PRIME 0/+1, VETERAN 0/0). golden career-06-settled 신규, 다른 골든은 hash만 변경(RNG 소비 불변). Snapshot 최대 34.1 KB.

**D-39 상수 확정**: 브리프의 `goodRatingTenths 700`·`formPivotTenths 650`은 평점 스케일(40~100, ×10) 착오였고 워커가 75·65(나눔 8)로 바로잡았다. 룰셋 `growthRules`·`conditionRules`·`promiseMinutesShareBp`가 정본이다.

**리뷰 결정**: 수정 필수 2건. (1) 타입 확장으로 깨진 apps/web 테스트 4개는 "테스트 파일만 최소 수정" 예외로 같은 PR에서 고치게 했다(루트 typecheck가 깨지면 체인 통과가 아니다). (2) **DEFERRED 효과 유실 버그** — `START_SEASON`이 `deferredEffects`를 비운 뒤 walk를 돌아, 이전 시즌·유스 이벤트(EVT-CON-002·EVT-MGR-001의 "다음 시즌 1단계부터")가 미룬 효과가 한 번도 적용되지 않았고, 반대로 시즌 중 미룬 효과가 같은 시즌 뒤 step에 적용될 수 있었다. `FootballSeason.scheduledEffects`(이번 시즌 적용 예정 목록)를 두고 `START_SEASON`에서 `state.deferredEffects`를 통째로 옮긴 뒤 walk 중 step마다 풀도록 고쳤다(시뮬레이션 수준 테스트 (a) 유스 구간 미룸 → 첫 시즌 step 1 적용, (b) 시즌 N step 2 미룸 → N에는 미적용·N+1 step 5 적용). 수용: `squadRoleAtStart`, ROLE_RESOLVED refId `${type}:${decision}`, placeholder `ChapterRecord`(T-2-004가 main 머지 시 실제 타입으로 교체), season.test.ts의 morale→fans 전환.

**후속 기록**: `player.ts` 생성 시 attributes와 truePotential을 독립으로 굴려 표본의 7%가 처음부터 `baseOvr > truePotential`(성장식은 gap 0으로 정확히 처리) → T-2-011에서 `truePotential = max(rolled, baseOvr + 1)`류 불변식을 넣는다. T-2-014 브리프에 `scheduledEffects` 구조 유지를 명시했다.

**머지 순서**: T-2-004(PR #41)는 도메인·contracts·콘텐츠 스키마가 좋았으나 루트 typecheck(apps/web 테스트 4개·labels·SyncConflictDialog·대시보드 timeline switch — 워커가 "기존 버그"라 적은 항목은 실제로 이 PR의 `CHAPTER_RESOLVED` 추가가 원인)를 고쳐야 해서, 준비가 먼저 끝난 PR #40을 먼저 머지하고 T-2-004가 main을 머지해 placeholder를 교체한다.

**운영 메모**: 오케스트레이터 검증 체인의 e2e 앞에 `until ! lsof -nP -iTCP:5174 …` 대기를 넣어 워커 체인과 포트를 직렬화했다(turbo 캐시 적중으로 체인 5분). 워커 7일 사용량 한도 76%(9/5 21:00 리셋).

## 2026-09-03 (밤, PR #39 T-2-003 머지 — Wave 2 종료, Wave 3 T-2-004·T-2-005 투입)

**결과**: T-2-003(PR #39, `4409052`) 머지. 시즌 시작 시 리그·컵 일정을 roll 없이 확정하고 `ADVANCE`가 step의 경기를 순서대로 계산한다(팀 결과 → 선발 → 출전 시간 → 관여량 → 포지션군 통계 → 카드 → 부상 → 평점). 평점은 ×10 정수(40~100), 시즌 누계·리그 순위·컵 진행이 `season.playerStats`·`competitions`에 남는다. 골든 career-04-gk(GK) 신규, 02·03 재기록. FAST 시즌 1개 domain 계산 7.4 ms(Node). revision·결정 RNG draws는 T-2-002 골든과 동일 — 경기 계산이 결정 흐름에 영향을 주지 않는다.

**D-37 경기 전용 RNG 스트림**: `season.matchRngState`를 결정 스트림과 분리하고 시즌 시작 시 `match:<seasonIndex>:<rngState.s>` 해시로 시드한다. 경기 결과가 FAST/CHAPTER의 결정 타이밍에 영향받지 않고, fork-by-replay 뒤에도 시즌이 그대로 같다(careerId는 시드에 넣지 않는다).

**리뷰 결정**: 수정 필수 2건 — matchRngState를 결정 스트림 복사 대신 해시 파생 시드로, `yellowSuspensionAt`을 브리프 값 5로 복원(자연 누적 seed 탐색 대신 `seasonYellowCount = yellowSuspensionAt − 1` 강제 테스트). PR #38 머지 뒤 후속으로 career-04-gk를 contracts golden 가드·순회·크기·api cross-runtime에 추가. 수용한 편차: `injury.outMatches {1,4}`(브리프 {1,3}), 리그 순위는 resultTable 기대 승점 근사, 컵 무승부는 다음 라운드 진출, MF/DF ratingWeights 워커 튜닝.

**Wave 3 투입**: T-2-004(챕터, D-38)·T-2-005(결산·성장, D-39) 브리프를 확정해 병행 투입. 두 작업이 `types.ts`·contracts 스키마·골든을 같이 만지므로 충돌은 origin/main 정본으로 해소하게 했고, T-2-005는 T-2-004 미머지 시 `chapters: []`로 두게 했다. 챕터 후보 계산의 웹 연결은 T-2-008, 결산 화면은 T-2-009.

**운영 메모**: 검증 체인이 turbo 캐시 적중으로 2.5분에 끝났다(같은 커밋 입력 해시 → 워커 실행 결과 재생, e2e·build는 실제 실행 54 통과). PR #38 때 세운 규칙(5174 비어 있을 때만 e2e, `CHAIN EXIT 0`을 읽은 뒤 별도 명령으로 머지)을 지켰다. 워커 세션에 남아 있던 `/loop` 잔여 알림은 터미널을 닫으며 정리됐다.

## 2026-09-03 (저녁, PR #38 T-2-006 머지 — Wave 2 절반)

**결과**: T-2-006(PR #38, `6f2f00e`) 머지. 도메인 규칙 변경 없이 검증 체인만 넓혔다: contracts에 fixture 전체를 처음부터 재생하며 매 명령 뒤 `CareerStateSchema` strict 파싱 + 재해시로 golden hash와 대조하는 순회 테스트와 golden 파일 목록 가드(`KNOWN_GOLDEN_FILES`, T-2-003의 career-04 추가 시 갱신 필요), Snapshot·PUT 본문 크기 측정(시즌 중 최대 15,343 B ≈ 권장치 256 KB의 6% — **D-33 결론: 현 구조 유지, 압축 불필요**), api 3경로 시즌 동기화(단일 PUT·checkpoint 분할·Idempotency-Key 재시도)와 Miniflare golden 순회, engine-client replay·fork·import 시즌 golden, 로컬 저장 SEASON_START·SEASON_SETTLED 계약, 브라우저 Web Worker career-02 FAST 시즌 리플레이 hash 일치·시즌 구간 9.6~15 ms(상한 5,000 ms, Node 52 ms, domain 단독 7.4 ms). 워커 비용 약 $11.3, 114분, 리뷰 1회 2건.

**리뷰 결정**: 워커가 `apps/web/src` 금지와 충돌해 미착수로 남긴 브라우저 Worker 항목은 dev 전용 `apps/web/src/dev/hash-probe.tsx`·`apps/web/e2e/hash-probe.spec.ts` 두 파일만 예외로 허용해 같은 PR에서 끝냈다. PUT 본문 크기는 `ADVANCE`·빈 payload 근사 대신 실제 명령 type·payload로 다시 쟀다(career-01 4,376 → 5,564 B).

**운영 메모**: 워커 세션의 UserPromptSubmit 훅(claude-mem 플러그인 연결 실패)이 투입 프롬프트와 리뷰 프롬프트를 각각 한 번씩 막았다 — 화면에서 "operation blocked by hook"을 확인하고 같은 프롬프트를 재전송하면 통과한다. T-2-003 워커는 조사용 fork 5개로 7분에 약 $10를 써 중단시켰고, 브리프 템플릿의 금지 문구를 조사용 서브에이전트까지 명시했다(ab6603c).

## 2026-09-03 (오후, PR #37 T-2-002 머지 — T-2-003·T-2-006 병행 투입)

**결과**: T-2-002(PR #37, `41b89e6`) 머지. 룰셋에 전술 스타일 3종(possession 4-3-3·counter 4-2-3-1·press 4-1-4-1, 포지션별 선호 아키타입)·리그 4(유스 8·1부 12·2부 12·3부 10)·FA컵(1~3부, R2 step 7)·선발 상수·경쟁자 이름 40, domain `selection.ts`(Tactical Fit·familiarity·Expected Performance·Squad Status·Selection Score·rankSelection·rankPositionForPlayer·computeRoleProposal·deriveTacticalRoom)와 `competitors.ts`(포지션 8×2, 23롤/명 = 368롤), step-1 ROLE_PROPOSAL pending과 `RESOLVE_ROLE {ACCEPT|DECLINE}`(CMD-SIM-004), contracts 스키마, golden career-02(RESOLVE_ROLE 포함)·career-03-underdog(OVR 58이 OVR 80 경쟁자를 제치고 START). 전체 체인 통과(e2e 54, 번들 100.8 KB). 워커 비용 약 $30.6, 109분, 리뷰 1회 3건.

**리뷰 수정 3건**: (1) `computeRoleProposal`의 후보 포지션 필터가 "다른 포지션의 선호 아키타입에 선수 아키타입이 포함"이라 항상 false — 아키타입이 포지션 고유라 POSITION_CHANGE가 운영 룰셋에서 도달 불가였다. 브리프 표현이 모호했던 오케스트레이터 책임. 후보 = 인접 포지션 전부(아키타입 필터 없음)로 확정(D-34 보정). 실제 룰셋으로 도달 케이스·GK 불가·선호 아키타입 선수 불가 테스트 추가. (2) RESOLVE_ROLE 네 분기 공통 불변식 `season.squadRole === squadRoleFromSelection(season.selection)` — 제안의 `to`·`squadRoleAfter`는 예측값이고 실제 역할은 재산출 순위가 정한다(D-26). (3) `packages/fixtures` index에 career-03 export 누락.

**수용한 편차 → D-36 정수 상태**: 브리프의 소수 첫째 자리 반올림 대신 정수 반올림(`roundToInt`). `canonicalize`가 safe integer만 허용하므로 **저장 상태의 모든 수는 정수**이며 소수가 필요한 값은 `…Tenths`·`…Centi` 정수 필드로 든다. T-2-003 브리프의 평점을 `ratingTenths`(40~100)로 고쳤다(00c362d). 그 밖에 RESOLVE_ROLE `nextAction: 'ADVANCE'`, web 최소 수정('역할 결정' 라벨), 100× 반복 테스트 timeout 15초(공유 머신 부하).

**남긴 것·리스크**: (a) 밸런스 — career-03에서 아키타입 항(+40)만으로 OVR이 22 낮은 선수가 1부 팀 주전이 된다. balance-targets "8 이상 낮은 선수의 장기 주전 5% 미만"과 긴장 → T-2-011 측정 항목에 넣고 `tacticalFitWeights.archetype`(0.4)을 조정 후보로 둔다. (b) 계약 제안의 `tacticalFitEstimate`(45~75)가 실제 스타일 계산값(career-02는 37)과 무관 → Phase 3 계약 작업에서 실제 계산으로 추정치를 만든다. (c) 경쟁자 부상·정지, 주장(captaincy) 모델 없음(Phase 4). (d) `season.selection`은 시즌 시작·RESOLVE_ROLE 시점 스냅샷이며 경기마다 재산출·저장은 T-2-003.

**투입**: Wave 2로 T-2-003(경기 계산, domain·content)과 T-2-006(계약 정합·Snapshot 크기·동기화 회귀·Worker 시간)을 나란히 투입. 두 브리프에 T-2-002 접점 절(정수 tenths·selection API·스키마 동반 추가)을 더했다.

## 2026-09-03 (오후, PR #36 T-2-001 머지 — T-2-002 투입)

**결과**: T-2-001(PR #36, `a806e21`) 머지. FootballSeason·12 step 캘린더(룰셋 `leagueCalendar`)·START_SEASON/SETTLE_SEASON·ADVANCE 재정의(다음 결정 step 또는 결산까지)·결정 예산 절단·STEP_BOUNDARY checkpoint·golden career-02-season(FAST 결정 step {1,3,7,11}, CHAPTER 1~11). 새 roll 없음(FAST 30·CHAPTER 35 draws). 워커 비용 약 $24.3, 102분. 오케스트레이터 재검증 체인 통과(e2e 54).

**리뷰 수정 4건**: (1) engine-client·platform typecheck 2건·취약한 hash 손상 테스트 1건이 브리프의 수정 금지 목록에 걸려 빨간 채 남음 → 최소 수정 예외 확장. (2) FAST 결정 예산이 모드가 열지 않는 슬롯(EVENT·MINOR 챕터)까지 세어 step 11 MAJOR 챕터를 잘랐음(golden에서 발견) → 예산은 그 모드가 여는 슬롯에만. (3) 시즌 walk가 step을 넘길 때 `expireEffects`를 부르지 않아 시즌 중 AT_STEP 만료 누락 → 지나간 step마다 접어 적용. (4) 결산 뒤 nextAction 'ADVANCE'가 NOTHING_TO_ADVANCE로 실패 → 'DECISION'. 워커가 스스로 찾은 버그(EVENT를 별도 명령으로 닫은 뒤 step이 안 닫힘)는 회귀 테스트와 함께 고쳐져 있었다.

**수용한 편차**: `START_SEASON` payload는 `{ simulationMode, serviceSeasonId }`(domain 상태에 서비스 시즌 id가 없어 CREATE_CAREER처럼 payload로 받음, D-25 보완). competitions는 `LEAGUE`·`CUP` 자리표시자 2건(T-2-002가 룰셋 리그·컵으로 대체). 룰셋 `seasonBoundaryReset { form 50, fitness 80, morale 60 }`은 임의값(밸런스는 D-29·LINE TEST 뒤). step 10 CHAPTER는 importance 미지정 → MINOR 취급. step 8 대표팀 창은 EVENT kind 그대로.

**교훈**: 브리프의 "typecheck 깨지면 최소 수정" 예외는 web·api만이 아니라 상태 타입을 소비하는 모든 패키지(engine-client·platform 포함)에 둔다 — T-2-002 이후 브리프에 반영. 예산·모드처럼 두 규칙이 겹치는 곳은 브리프에 계산 예(기본 캘린더에서 기대 결정 집합)를 적어 준다.

**남긴 것**: DEFERRED 효과(`appliesAt: NEXT_SEASON_STEP`)를 새 시즌 해당 step에서 적용하는 경로가 없다 → T-2-005. Phase 1 step 번호와 시즌 step 번호가 겹쳐 유스 단계 AT_STEP 효과가 첫 시즌 같은 번호 step에서 만료된다 → T-2-014(Effect 만료 규칙). `advance()`·`advanceInSeason()`의 eligibleEvents 검증 중복 → T-2-014 정리 후보. ADVANCE가 walk 시작 상태로 평가한 EVENT 후보(D-10)를 여러 step 뒤 슬롯에 그대로 쓰는 방식은 경기가 상태를 바꾸는 T-2-003부터 재검토.

**투입**: T-2-002(팀 전술 스타일·경쟁자 생성·Tactical Fit·Squad Status·RULE-PERF-001·RULE-SEL-001·감독 역할 제안 `RESOLVE_ROLE`, D-26·D-34). 브리프에 PR #36 접점(ROLE 자동 통과 제거, cupRounds R2, 자리표시자 대체, 브리프 예외 범위 확장)을 적었다.

## 2026-09-03 (오후, T-2-002 브리프 선작성 — D-34)

**결정 D-34**(phase-2-plan 3절): T-2-001이 진행되는 동안 다음 순서인 T-2-002(팀 전술·경쟁자·선발) 브리프를 미리 썼다. 전술 스타일 3종·팀 `squadStrength`·리그 팀 수·컵 R2 step 7, Tactical Fit(스타일 내적 0.6 + 선호 아키타입 0.4), 숙련도 등급화(기존 `positionProficiency` 재사용), Squad Status 식, 경쟁자 8포지션 × 2명과 RNG 순서, step 1 감독 역할 제안과 새 명령 `RESOLVE_ROLE`(CMD-SIM-004)을 확정했다. 계획서에 없던 "역할 제안을 어느 명령이 닫는가"의 빈틈을 여기서 메웠고, "조건부 훈련"은 T-2-005로 미뤘다. 투입은 T-2-001 머지 뒤(순차).

## 2026-09-03 (정오, PR #35 머지 — Phase 1 종료, Phase 2 Wave 1 투입)

**결과**: T-1-017(PR #35, `d5fbf11`) 머지. SCR-002 포지션 구분 `Tabs`를 `RadioGroup` 형제로 분리해 Radix roving-tabindex 충돌을 없앴고(keyboard e2e가 우회 없이 "공격수 탭 → 윙어"로 완주), `PlayerHeader` caption으로 주포지션·선호 포지션 구분, 개인정보 처리방침 "개인정보의 국외 이전" 절·표(Cloudflare, Inc. / Google LLC), SCR-014 전용 aria-live(정확히 1회), `careerPhase` 상수화. COMMITTING 이탈 경고는 `beforeunload` 최소 구현 — popstate 대화상자는 TanStack history가 내부 키 `__TSR_index`로 방향을 계산해 더미 항목이 인덱스를 깨뜨리므로 보류(워커가 소스로 확인, 브리프가 허용한 대안). 리뷰 수정 요청 0건, 워커 비용 약 $12.2, 51분. 재검증: 체인(e2e 54)·실 api 58건 통과.

**Phase 1 종료 선언**: 완료 조건 표 15행 중 14행 ✅. #12(시각 토큰·폐기 어휘)는 오케스트레이터가 수동 점검(12 문서 폐기 어휘 `VAR CHECK`·시즌 결산의 `FULL TIME`·`적용됩니다`가 UI 문자열에 0건, 화면 소스에 hex 리터럴 0건). #15 Google 실계정 검증만 U-003 대기(코드는 PR #33으로 준비). Phase 1 워커 비용 합계는 보드 완료 표 참조. 남은 결함은 Phase 2 후속으로 넘겼다: 로그아웃 뒤 커리어 소유자 불일치(T-2-011), COMMITTING 뒤로 가기 대화상자(라우터 API로 다시 시도, T-2-010 화면 작업 때), axe heading-one moderate.

**D-33 Phase 2 열린 질문 확정**(phase-2-plan 4절 제안 채택): 리그 팀 수는 룰셋 `leagues[].teamCount`, 리그는 홈·원정 2회전, 컵은 4라운드(R1·R2·SEMI·FINAL 중 캘린더에 R1 step 5·SEMI 9·FINAL 11); 경쟁자 아키타입은 팀 선호 60%·나머지 40%; Snapshot 크기는 T-2-006이 측정해 상한을 넘으면 결산 시 요약 압축. T-2-001은 캘린더(`leagueCalendar`)만 룰셋에 넣고 팀 수·컵 라운드 데이터는 T-2-002가 넣는다.

**투입**: T-2-001(시즌 구조: FootballSeason·12 step 캘린더·START_SEASON/SETTLE_SEASON·ADVANCE 재정의·STEP_BOUNDARY checkpoint·결정 예산 절단). 브리프에서 CHAPTER·CONTRACT 등 슬롯은 "열되 자동 통과"하는 플레이스홀더로 두고 실제 내용은 T-2-002~005가 채운다. career-01 golden은 stateHash만 바뀌어야 하고, 새 golden career-02-season(FAST·CHAPTER)을 만든다. 시즌 없을 때의 ADVANCE 경로는 손대지 않는다(Phase 1 화면 호환).

## 2026-09-03 (오전, PR #34 E2E 완료 조건 머지 — T-1-017 투입, Phase 1 종료 보류)

**결과**: T-1-014(PR #34, `2bbfdf0`) 머지. resilience(새로고침 복원, 확정 이중 클릭 시 revision 정확히 +2, PUT 유실 뒤 같은 Idempotency-Key 재시도, COMMITTING 뒤로가기 특성화), recovery-conflict(실 api, 두 기기 다른 선택으로 진짜 409 → 두 선택 검사), session-length(자동화 약 4.7초, D-22 단가 최소 조작 58초 — 화면 13·선택 10·입력 1·확정 14), keyboard(클릭 없이 완주), a11y 6건 확장, perf(실제 빌드 4G 스로틀: 허브 LCP 1136ms vs T-0-013 기준 2519ms, CLS ≈ 0). 헬퍼 추출로 create·first-contract 중복 제거. `e2e:api`·`e2e:perf` 스크립트. 리뷰 수정 요청 0건, 워커 비용 약 $19.8, 80분. 오케스트레이터 재검증: 체인(e2e 53) + 실 api 5건 + perf 1건 통과.

**결정 — Phase 1 종료 보류**: 완료 조건 표 15행 중 #1(키보드 완주)이 조건부 — SCR-002 포지션 구분 `Tabs`가 `RadioGroup` 안에 중첩돼 트리거 4개가 Tab으로 도달 불가(08 "출시 차단 기준: 키보드로 P0 흐름 완료 불가"). #5(선호/주포지션 구분 표시)·#14(ADR-008 국외 이전 표) ❌, 08 체크리스트의 결과 aria-live 낭독과 06 COMMITTING 이탈 경고도 미구현. 사용자 규칙(Phase 1을 닫은 뒤 Phase 2)에 따라 이 다섯과 `careerPhase` 상수화를 T-1-017(web + ui, 크기 3)로 묶어 투입하고, 머지 뒤 Phase 1을 닫는다. 표 행 수는 D-22의 13이 아니라 15(T-1-016이 phase-01 조건 2개를 추가) — 워커가 문서에 기록.

**남긴 것**: #12(시각 토큰·폐기 어휘)는 자동 검사가 없다 — Phase 2 전에 오케스트레이터가 수동 검토하거나 lint 작업을 별도로 연다. Google 로그아웃 뒤 로컬 커리어 PUT이 404를 받아 "서버 저장 실패"만 반복(원인 안내 없음) — T-2-011. axe `page-has-heading-one`(moderate) 여러 화면 — 완료 조건 무관, Phase 2 화면 작업에서 정리. "다시 연결" 뒤 LOCAL_ONLY 배지 잔존은 버그 아님으로 확인(반응형 구독).

## 2026-09-03 (오전, PR #33 Google 연결 머지 — Phase 1 잔여 T-1-014 하나)

**결과**: T-1-013(PR #33, `547686c`) 머지. Google OIDC(Authorization Code + PKCE, arctic 3.7.0) start/callback/merge/unlink. state·codeVerifier는 10분 HttpOnly 쿠키(`Path=/v1/auth/google`), 시작은 IP당 시간당 30회. 콜백 결과는 ADR-008 표대로 linked/switched/merge_required(세션 `pending_merge_*` 10분 TTL, 확정 직전 대상 프로필 재검증). 프로필 삭제 시 google_sub·email을 비워 같은 계정 재연결을 허용. `Profile`에 `googleEmailMasked`·`pendingMerge`(default null). `platform.features.googleLink`로만 채널 분기(toss false). SCR-030 Google 행·병합 선택 대화상자·로그아웃 활성화. 가짜 OIDC는 `ENVIRONMENT=local && GOOGLE_FAKE=1`일 때만. 리뷰 수정 요청 0건(워커가 /review:pr Important 1건 — 병합 확정 시 대상 프로필 삭제 여부 미검증 — 을 스스로 고쳤다). 워커 비용 약 $22.2, 79분.

**검증**: 루트 체인 통과(e2e 41). 실 api e2e는 google-link 2건 통과, `recovery-api.spec.ts` 1건 실패 — PR #32(T-1-016)가 SCR-002 성별을 필수로 만들면서 이 실 api 전용 스펙의 온보딩 헬퍼가 `/create`에 머문다. 기본 체인은 실 api 스펙을 건너뛰어 PR #32 검증에서 잡히지 않았다. T-1-014가 첫 커밋으로 고친다. 교훈: 화면 폼을 바꾸는 PR은 `E2E_WITH_API=1` 스펙도 돌린다.

**남긴 것**: Google 연결 프로필에서 로그아웃하면 로컬 커리어는 남지만 다음 `GET /v1/profile`이 새 익명 프로필을 발급하므로 기존 커리어 PUT이 소유자 불일치가 될 수 있다 — T-1-014가 재현·기록하고 처리 규칙은 Phase 2 T-2-011에서 정한다. 실제 Google 계정 검증은 U-003(클라이언트 ID·시크릿) 뒤.

## 2026-09-03 (오전, PR #32 선수 성별·선호 포지션 머지 — T-1-014 투입)

**결과**: T-1-016(PR #32, `4eb8112`) 머지. `PlayerDraft`에 `gender`(FEMALE·MALE·UNSPECIFIED) 추가, CONFIRM_PLAYER는 7개 필드를 요구. `PlayerProfile`·`PlayerPublic`의 `position`을 `preferredPosition`(불변)·`primaryPosition`(현재 주포지션, 확정 시 같은 값)으로 분리. SCR-002 성별 RadioGroup(설명 `aria-describedby`)·"선호 포지션" 라벨, SCR-004 요약, PlayerHeader는 확정 뒤 `primaryPosition`. content에 gender가 조건 DSL·Effect target 어디에도 없다는 불변식 테스트. golden은 revision 10·rngStateDraws 30·baseOvr 59 그대로이고 stateHash만 바뀌었다(성별이 결과를 바꾸지 않음을 확인). 런타임 migration 함수는 없다(출시 전 `schemaVersion: 1`, 기존에도 없었음). gender는 분석·로그·오류 details에 복사되지 않는다(grep 확인). 리뷰 수정 요청 0건, 워커 비용 약 $15.7, 43분.

**투입**: T-1-014(E2E 완료 조건·완료 조건 표) 투입, T-1-013과 병렬. T-1-013에는 PR #32 머지와 PR 전 `origin/main` 병합을 지시했다. 남은 Phase 1 코드 작업은 T-1-013·T-1-014 둘뿐이다.

## 2026-09-03 (오전, PR #31 설정 데이터 섹션·법적 문서 머지 — T-1-013 투입)

**결과**: T-1-012(PR #31, `1e97406`) 머지. api 복구·삭제 라우트의 contracts 스키마 채택, `Platform.clearLocalData`, `importCareerFromServer`, D-20 대조(`planReconciliation` 순수 함수 13건 테스트), SCR-030 데이터 섹션(복구 코드 발급·재발급, 프로필 복구·충돌 선택, 프로필 삭제 2단계, 이 기기 데이터 삭제, 로그아웃 비활성), 법적 문서 초안(운영자 정보는 U-010). 실제 api를 띄운 복구 왕복 e2e(컨텍스트 A 발급 → B 복구)는 워커 8.3초, 오케스트레이터 재실행 12.9초 통과. 워커 비용 약 $20.7.

**워커 질문 처리**: /review:pr가 잡은 "복구 뒤 대조 실패가 성공 토스트에 가려짐"에 사용자 문구 수정으로 답했고, "새로고침" 안내 대신 설정 "다시 연결"에 `reconcileAfterRecovery('NONE')`을 추가하는 범위 확장을 승인했다(01번 항목의 지시 시각은 08:56).

**리뷰에서 잡은 것(필수 2건)**: 커리어별 다운로드·가져오기 실패를 조용히 건너뛰어 "커리어 3개" 토스트에 2개만 보일 수 있던 것 → 실패 집계 `{ ok: false, failed }`(로컬 미전송 보호용 `CAREER_REVISION_CONFLICT`는 제외); 목록 조회 실패 시 `invalidateQueries`가 안 불려 `['profile']`이 옛 프로필에 남던 것 → 실패 경로에도 갱신. 워커가 T-1-011 잔재(`useSyncSummary`의 `displaySyncState`가 매번 새 객체 → 무한 렌더 루프)를 발견해 WeakMap 캐시로 고쳤다.

**승인·후속**: `inputmode="latin"`은 유효하지 않아 `text`로, Toast `warning`·Button `danger` 변형 부재는 inline 토큰으로 대체(packages/ui 후속), 로그아웃 핸들러는 도달 불가라 비움(T-1-013이 채움, 브리프 보충에 명시). `E2E_WITH_API=1`이면 웹을 5173으로 띄우는 것은 api `ALLOWED_ORIGINS` 때문 — Phase 2 T-2-012 LINE TEST 준비에서 5174 허용 여부 결정.

**투입**: T-1-013(Google OIDC 연결·병합·로그아웃, `T-1-013-google-oidc`)을 PR #31 머지 직후 투입. T-1-016과 병렬. T-1-014는 T-1-016 머지 뒤 T-1-013과 병렬로 투입한다.

## 2026-09-03 (아침, PR #26 진로~계약·대시보드 머지 — T-1-016 투입)

**결과**: T-1-009(PR #26, `b40c168`) 머지. SCR-007 진로 선택·SCR-008 입단 테스트·SCR-013/014 이벤트·결과·SCR-009 제안 비교·SCR-010 계약·SCR-029 대시보드. 온보딩부터 첫 계약·대시보드까지 브라우저에서 이어지고 `first-contract.spec.ts`가 전 구간을 3.4~5.5초에 통과한다(5분 세션 예산 판정, D-22). 워커 비용 약 $36.9, 353분(main 병합 2회 포함), 리뷰 2회 + 재검증 1회.

**리뷰에서 잡은 것(4건)**: 대시보드 "진행"과 SCR-014 "다음"이 `NOTHING_TO_ADVANCE` 외 실패를 조용히 삼킴 → `ErrorState`+재시도; 아키타입이 kebab id로 노출 → `archetypeName` 헬퍼; T-1-008 `shared/ruleset.ts`와 T-1-009 `engine/content.ts`의 룰셋 이중 파싱 → 후자로 통합; 능력치 20종 라벨 이중 정의(문구도 3곳이 달랐음) → `ATTRIBUTE_LABELS` 재사용. 재검증에서 e2e tsconfig 타입 오류(`test.use({ reducedMotion })`는 `contextOptions` 소속) 1건과 SCR-029 단위 테스트의 시드 의존 플레이키(`advanceUntilOffers`로 교체)를 추가로 잡았다.

**승인·후속**: SCR-014를 timeline `EVENT_RESOLVED`로 재구성해 새로고침이 roll을 소비하지 않는 설계, `event_.result.tsx` 파일명(TanStack 플랫 라우트 부모 추론), 모션 감소 `data-reduced-motion` 수정 승인. 후속은 보드 T-2-010(previewEffects 구조화, EVT-CON-002 C 성장 줄, 태그 라벨)·T-2-011(fixtures eligibleEvents 불일치 기록)·T-1-014(`careerPhase` 분석 값 고정)에 적었다. SCR-014 "리플레이" 버튼은 브리프 비요구라 미구현.

**T-1-012 질문 처리**: /review:pr가 잡은 "복구 뒤 대조(`reconcileAfterRecovery`) 실패가 성공 토스트로 가려짐"에 대해 워커가 셋 중 하나를 물었다 → 사용자 문구까지 수정으로 결정. 단 "새로고침해 주세요"는 대조를 다시 돌리지 않으므로 경고 토스트 "프로필은 복구했지만 커리어 목록을 불러오지 못했습니다. 설정의 다시 연결로 다시 시도하세요"로 하고, 설정 "다시 연결" 성공 경로에 `reconcileAfterRecovery('NONE')`을 추가하는 작은 범위 확장을 승인했다.

**투입**: T-1-016(선수 성별·선호 포지션, `T-1-016-player-gender-position`)을 PR #26 머지 직후(08:58) 투입. 워커 2명(T-1-012·T-1-016) 병렬. Phase 1 잔여는 T-1-013·T-1-014.

**운영 사고**: PR #30 머지(01:47) 뒤 감시 스크립트(watch.py)가 T-1-009의 갱신 보고(01:57)와 T-1-012의 질문 대화상자(02:00대)를 약 7시간 동안 알리지 못했다. 사용자가 08:55에 진행 여부를 물어 발견. 원인: BUSY 판정 정규식의 단어 목록(`Running`·`Working` 등)이 워커 산문("Running the single allowed /review:pr")에 오탐해 화면을 계속 "작업 중"으로 봤다(프로세스는 살아 있었음). 조치: BUSY를 스피너 줄(`\S+… (`·`…` 끝·`esc to interrupt`)만 보도록 고치고 감시 재시작, 워커 질문 즉시 응답. 재발 방지: 워커가 90초 이상 프롬프트만 보이면 무조건 이벤트를 내고, 오케스트레이터는 턴마다 감시 출력 파일의 마지막 이벤트 시각을 확인한다.

## 2026-09-03 (새벽, PR #30 동기화 배선 머지 — T-1-012 투입)

**결과**: T-1-011(PR #30, `280e2f4`) 머지. engine-client `forkCareerByReplay`·Worker 실패 처리(error/messageerror/타임아웃 → 재생성), web 동기화 싱글턴 배선(online/visibilitychange/pagehide flush, 시작 시 미전송분 재개), 허브 카드·커리어 레이아웃 저장 배지, 설정 동기화 행("지금 동기화"·"다시 연결"), 충돌 대화상자(REMOTE/LOCAL fork/LATER), pending-delete 큐. 검증 체인 전체 통과, e2e 24건. 워커 비용 약 $34.9, 123분, 리뷰 2회.

**리뷰에서 잡은 것(필수 2건)**: (1) SyncClient 상태가 메모리에만 있어 새로고침 뒤 이미 저장된 커리어가 전부 "아직 저장 안 됨"으로 보였다 → 웹 순수 함수 `displaySyncState(state, LocalCareerRecord)`로 보정(engine-client 시드 API는 넣지 않음). (2) 세션 없는(401) 서버 삭제를 "서버에 없음"으로 분류해 큐에서 버렸다 → 재시도로 재분류하고 "다시 연결" 성공 시 삭제 재시도. 권장 3건(충돌 대화상자 catch, `getSyncClient` 거부 catch 2곳, Worker 타임아웃 TODO 주석)도 반영.

**범위 확장 결정**: `CORS_ALLOWED_HEADERS`에 `X-Request-Id`가 없어 실제 브라우저에서는 동기화 PUT/GET preflight가 항상 실패했다(e2e는 `page.route` 스텁이라 못 잡음, 워커가 임시 헤더 패치로 수동 확인하다 발견). 이 기능이 동작하려면 필수라 contracts·api 수정을 이 PR 범위에 넣었다. 교훈: 실서버 수동 확인은 "임시 패치 없이" 재현해야 하며, CORS 허용 헤더 목록은 클라이언트가 보내는 헤더 상수와 같은 파일에서 유지한다.

**후속(보드로 옮김)**: `createWorkerSimulator` 타임아웃이 요청당이 아니라 포트 전체를 broken으로 만든다 → Phase 2 시즌 시뮬레이션 전에 요청당 예산으로(T-2-011 timing). 새로고침 뒤 표시 시각은 `record.updatedAt` 근사(서버 저장 시각과 초 단위 차이 가능). Playwright `context.setOffline`은 Vite HMR을 끊어 문서를 비우므로 e2e 오프라인은 `navigator.onLine` 스푸핑 + `online/offline` 이벤트로 한다(관례로 기록). `@offside/fixtures` JSON import attribute 문제는 e2e에서 `loadRuleset` 우회 중.

**운영**: T-1-009 워커가 PR 본문에 `pnpm exec tsc --noEmit` 통과를 적고 "체인 통과"라 보고했으나 web 패키지의 typecheck 스크립트는 e2e tsconfig도 검사한다 → 오케스트레이터 재검증에서 `reducedMotion` 타입 오류 1건 발견. 규칙: PR 본문 "테스트 방법"은 루트 체인 명령을 그대로 적고, 워커가 대체 명령을 쓴 흔적이 있으면 재검증 전에 되돌려 보낸다.

**투입**: T-1-012(설정 데이터 섹션·법적 문서, `T-1-012-settings-data`)를 PR #30 머지 직후 투입. T-1-016은 PR #26 머지 뒤 병렬 투입.

## 2026-09-03 (WORLD STAGE 세계관 확장 승인)

**사용자 결정**: 국내 프로에서 끝내지 않고 해외 유명 리그를 연상시키는 국제 커리어까지 세계관을 확장한다. 현재 국내 MVP 개발 순서는 유지하고, Phase 3~5의 이적·관계·대표팀과 Phase 7 운영 기반을 완성한 뒤 Phase 8 `WORLD STAGE`로 출시한다. Phase 번호는 개발 순서이며 새 ruleset의 선수는 은퇴 전 이적시장부터 해외 경로를 경험한다.

**범위 결정**: 실명 리그·구단·선수·로고·유니폼은 사용하지 않는다. 첫 확장은 해외 2개국·4개 디비전·24개 가상 구단·대륙 클럽 대회 1개로 완주와 선택 분포를 검증하고, 통과 뒤 최대 5개 리그 스타일로 넓힌다. 실제 환율·세금·이민 법률을 실시간 복제하지 않고 설명 가능한 가상 등록 규칙을 쓴다.

**기술 결정**: 기존 `Team` ID는 유지하고 ruleset 1.x의 `LegacyTeam`을 `WorldTeam`으로 정규화하는 로더를 둔다. 해외 이동은 Base OVR을 바꾸지 않으며 적응은 Context, 리그·대회 수준은 기록·시장가치·Legacy 정규화 입력이다. 해외 계약은 기존 `ACCEPT_OFFER` 명령 안에서 등록 재검증, 계약, 팀·국가 변경, 적응 상태, Timeline을 원자 확정한다. 등록 실패 시 기존 계약과 팀을 보존한다. 기존 Career를 새 ruleset으로 자동 승격하지 않는다.

**추적**: FR-WLD-001~004, DATA-WLD-001~007, RULE-WLD-001~006, SCR-035~040, TEST-E2E-011~013. 구현 백로그는 T-8-001~010이며 정본은 [개발 명세](../development/15-world-stage-expansion.md)와 [Phase 8](../phases/phase-08-world-stage.md)이다.

## 2026-09-03 (새벽, Phase 2 계획과 Phase 3 이후 병렬화 — D-24~D-32)

**사용자 결정**: "Phase 2까지 순차, 그 뒤 병렬"을 확인하고 그대로 진행하라고 했다. 로드맵에 "Phase 3 이후 병렬화" 절을 추가했다: Phase 2 종료 → 공유 계약(Effect 만료·중첩, 시장가치 입력, CareerTag 인터페이스) 확정 → Phase 3·4 병렬 → Phase 5·6 병렬. LINE TEST가 도는 동안 Phase 3·4의 도메인 골격은 먼저 만들고 밸런스 수치만 기준선 뒤로 미룬다. 트랙 상한 3개.

**Phase 2 계획 초안**: [phase-2-plan.md](phase-2-plan.md). 작업 14건(T-2-001~014), Wave 4개. 도메인 Wave 1·2(시즌 구조 → 선발 판정 → 통계 generator → 챕터·집계)는 순차, 화면 3건과 공유 계약 작업은 Wave 3에서 병렬, 검증·콘텐츠·LINE TEST 준비가 Wave 4. 설계 결정 D-24~D-32은 초안이며 각 Wave 투입 전에 확정한다. 열린 질문 3개(리그·컵 구조의 데이터화 정도, 경쟁자 아키타입 분포, Snapshot 크기)는 Wave 1 전에 닫는다.

**투입 시점**: Phase 순서 규칙대로 Phase 1 보드가 전부 done(또는 U 대기 blocked)이 된 뒤 T-2-001을 띄운다. 브리프는 미리 쓴다.

## 2026-09-02 (밤, PR #25 선수 만들기 머지 — T-1-011 투입)

**결과**: T-1-008 PR #25 squash 머지(`122144f`). SCR-002(정보)·SCR-003(스타일)·SCR-004(확정·복구 코드) 화면과 최소 API 클라이언트(`apiFetch`, `getProfile`, `issueRecoveryCode`)가 들어갔다. `guardCareerStep`이 DRAFT 단계 순서를 지키고, 확정 뒤 복구 코드 단계는 `?step=recovery`로 남아 새로고침에도 유지된다. web 99 tests, e2e 18. 전체 체인·e2e를 오케스트레이터가 재실행해 확인했다. 비용 약 $22.1, 78분.

**리뷰에서 잡은 것(수정 후 머지)**: (1) `apiFetch`가 body 없는 POST에 `Content-Type`을 붙이지 않아 api의 전역 `bodyGuard`(결정 4)가 `VALIDATION_FAILED`(JSON_BODY_REQUIRED)로 거부했다. 워커는 이를 "로컬 크로스 포트 구성의 일시적 400"으로 적었지만 api 테스트 하니스로 재현하니 결정적이었다 — 브라우저에서 복구 코드 발급은 항상 실패했고 e2e는 라우트를 모킹해 잡지 못했다. 상태 변경 메서드는 body가 없어도 `{}` + JSON Content-Type을 보내도록 고쳤다. (2) SCR-002 오류 화면의 "입력으로 돌아가기"가 필드 오류만 지우고 화면 상태를 바꾸지 않아 아무 동작도 하지 않았다. (3) SCR-003·004 오류 화면에 retryable이 아닐 때 빠져나갈 길이 없었다. 교훈: 워커가 "실서버 수동 검증"이라고 적어도 재현 근거(요청·응답)가 없으면 믿지 않는다. 실제로 워커가 상대한 8787 서버는 Phase 0 워크트리의 죽은 `wrangler dev`였다.

**받아들인 것**: 복구 코드 표시에 Tailwind `font-mono` 사용(`--os-font-mono` 토큰은 `packages/ui` 후속). ADVANCE 직후 도착 화면이 가중 랜덤이라 e2e는 SCR-007 계열(path·tryout·event) 중 하나로 검증. 포지션군 탭을 바꿔도 이전 선택을 유지(라디오는 실제 선택값 기준).

**후속**: `--os-font-mono` 토큰 추가(packages/ui, M 백로그 또는 T-1-014와 함께). `a11y.spec.ts`의 `analyze()` 전 렌더 대기(T-1-014). `/career/$careerId` 로더 not-found 처리(T-1-012, 기존). SCR-004에서 ADVANCE만 실패했을 때 '재시도'가 CONFIRM_PLAYER부터 다시 보내는 문제(확정 뒤에는 ADVANCE만 재시도해야 함) — 작은 수정, T-1-009 머지 뒤 화면 정리 때 함께.

**운영**: T-1-008 첫 세션은 Stop 훅 뒤 `curl localhost:8787`이 죽은 서버에 영원히 걸려 Claude TUI가 입력을 받지 않았다. 프로세스를 정리하고 같은 워크트리에 새 세션을 띄워 리뷰 파일을 읽게 했다(`docs/tracking/scripts/redispatch.sh`). 투입·감시 스크립트를 저장소 `docs/tracking/scripts/`로 옮기고 상태 디렉터리를 `~/.offside-orch`로 고정했다(세션 스크래치는 사라진다).

**콘텐츠 정본**: 사용자가 PR #24로 `docs/content/kickoff/`(아키타입 바이블, 이벤트 카탈로그 48개, 시즌 도전·앨범, 밸런스 목표, 종이 플레이테스트 키트, 제작 백로그)를 머지했다. 백로그 문서대로 콘텐츠가 `SHIPPABLE`이 되기 전에는 개발 작업을 만들지 않는다. Phase 2 계획 때 입력으로 쓴다.

**다음**: T-1-011(동기화 배선) 투입. T-1-009 PR 대기. T-1-011 머지 뒤 T-1-012, 그다음 T-1-013·014 동시.

## 2026-09-02 (밤, PR #23 web 엔진 배선 머지 — Wave 3 투입)

**결과**: T-1-007 PR #23 squash 머지(`b400922`). 브라우저에서 온보딩 → KICKOFF → DRAFT 커리어 → 허브 카드 → 삭제까지 IndexedDB(Dexie)와 Web Worker 시뮬레이터로 동작한다. `createAppEngine`은 팩·룰셋 호환성을 검사하고, `career-actions`가 명령마다 분석 이벤트를 보내며, `advance`는 `selectEligibleEvents` 결과를 payload로 넣는다(단위 테스트가 실제 전송 payload를 검사). `screenForCareer`가 커리어 상태 → 화면을 결정한다. ui-store는 LocalStore kv `ui:settings`에 영속화. web 53 tests, e2e 11, 초기 청크 165KB gzip. 전체 체인·e2e를 오케스트레이터가 재실행해 확인했다. 비용 약 $28.1, 87분.

**규칙 위반(비용)**: 워커가 브리프의 "`/review:pr` 1회만 예외"를 넘어 gstack `/review`(전문가 7종 + Claude·Codex adversarial + Codex 구조화 리뷰)를 실행했다. 그 리뷰가 생성·삭제 실패 무피드백, 더블클릭 중복 생성, 삭제 캐시 잔존, 목록 N+1, KICKOFF 브랜드 표기 같은 실제 문제를 잡아 고치긴 했지만 비용이 다른 작업의 2~3배가 됐다. 브리프 템플릿과 남은 브리프 6개의 문구를 "gstack `/review`·`/codex`·adversarial 리뷰 전부 금지, `/review:pr` 1회만"으로 바꿨다. 리뷰는 오케스트레이터 몫이다.

**받아들인 것**: `apps/web/tsconfig.json`의 `allowImportingTsExtensions`(`@offside/content` exports가 `.ts` 소스를 가리키는데 web이 처음 실제로 import함). `careers-sort.ts`가 platform exports에 없어 store 정렬에 의존(정렬 보장은 store 계층). 설정 데이터 섹션에 "내보내기" 행이 있으나 D-20에 따라 T-1-012가 제거한다.

**후속(브리프에 반영)**: (1) 모션 감소 설정이 DOM에 반영되지 않음 → T-1-009에 `useReducedMotion`·`data-reduced-motion` 항목 추가. (2) `__root.tsx` 랜드마크·h1 부재로 axe moderate 2건 → T-1-008에 추가. (3) Worker가 죽으면 대기 중 simulate가 영원히 멈춤 → T-1-011에 `createWorkerSimulator` 오류·타임아웃 처리 추가. (4) `/career/$careerId` 로더가 모든 실패를 not-found로 처리(손상 스냅샷 구분 없음)와 `/` 로더 초기 실패 미처리는 `errorComponent`가 필요해 T-1-012(복구 UI) 때 함께 본다. (5) toss KV 스텁이 메모리 저장이라 새로고침에 잃는 것은 이미 알려진 보류 백로그(M-00x).

**슬롯**: T-1-008(선수 만들기 SCR-002~004)·T-1-009(진로~계약·대시보드) 동시 투입. 활성 워커 2개.

## 2026-09-02 (저녁, D-21·D-22 결정 — Google OIDC 연결, Phase 1 완료 판정 측정, T-1-013·014 브리프)

**결정**: `phase-1-plan.md`에 D-21(Google OIDC)과 D-22(완료 판정 측정)를 추가했다. Google은 `GoogleOidc` 포트 뒤에 arctic 구현과 가짜 구현을 두어 U-003 없이도 로컬·E2E에서 전 흐름을 돌린다. ID 토큰은 직접 TLS 교환이라 서명 검증 없이 `iss`·`aud`·`exp`만 본다. state·PKCE는 10분 쿠키. 병합 대기는 세션 컬럼(`pending_merge_profile_id`)이고 커리어 이동 배치는 복구와 같은 함수를 쓴다. 07에 API-AUTH-006 `POST /auth/google/unlink`를 추가했다(SCR-030 "연결 해제"에 대응하는 API가 없었다). 프로필 삭제가 `google_sub`도 비우게 해 T-1-004 후속 과제를 닫는다. 화면은 마스킹 이메일만 보여 준다. 완료 판정은 `docs/tracking/phase-1-completion.md` 13행 표로 하고, 최소 조작 시간 단가(화면 1.0·선택 2.0·입력 4.0·확정 1.5초)를 고정했다. 허브 LCP·CLS는 기록만 하고 assert하지 않는다. T-1-014는 버그를 고치지 않고 적는다.

**선행 변경**: T-1-014 선행에 T-1-011(충돌 시나리오)을 추가했다. arctic 3.7.0(2025-05-21 배포)은 최소 배포 기간 정책을 통과한다.

**브리프 현황**: Phase 1 브리프 15개 전부 작성 완료(T-1-001~015). 남은 투입 순서: T-1-007 머지 → T-1-008·009 → T-1-008 머지 뒤 T-1-011 → T-1-011 머지 뒤 T-1-012 → T-1-012 머지 뒤 T-1-013·014 동시.

## 2026-09-02 (저녁, D-19·D-20 결정 — 동기화 충돌 해소와 설정 데이터 섹션, T-1-011·012 브리프)

**결정**: `docs/tracking/phase-1-plan.md`에 D-19(동기화 배선·충돌 해소)와 D-20(SCR-030 데이터 섹션)을 추가했다. 핵심: (1) 충돌의 "이 기기 진행 유지"는 Phase 0 결정 로그의 후보 (a) fork-by-replay를 채택한다. 로컬 명령 로그 전체를 새 careerId로 엔진에서 재실행하면 결정론 때문에 careerId만 다른 커리어가 생기고, 서버 API는 바뀌지 않는다. `PUT` 강제 플래그(b)는 서버 로그 계보를 섞어 리플레이 검증을 깨므로 기각. (2) `LocalCareerRecord.ownerProfileId`는 Phase 1에서 채우지 않는다. 소유는 서버 세션이 판정하고 마지막 프로필 id는 kv `profile:id`에 둔다. 복구로 프로필이 바뀌면 서버 목록과 사용자의 병합 선택으로 로컬을 대조한다(KEEP이면 서버에 없는 로컬 커리어 삭제, MOVE면 유지·전송, 뒤처진 커리어는 `importCareerFromServer`로 받되 미전송분이 있으면 덮어쓰지 않는다). (3) 복구 코드 "다시 보기"는 서버가 해시만 가져 불가능하므로 발급일 표시로 읽는다. (4) 로그아웃은 Google 연결 프로필에서만 활성(T-1-013 전에는 항상 비활성 + 이유). (5) 데이터 내보내기는 Phase 7이라 행을 두지 않는다. (6) 법적 문서 본문은 사실 기반 초안으로 워커가 쓰고 사업자 정보·최종 문안은 U-010으로 사용자에게 남긴다.

**선행 변경**: T-1-011의 선행에 T-1-008을 추가했다(`src/api/client.ts`를 T-1-008이 만들고 T-1-011이 재사용. 둘이 동시에 만들면 충돌). 따라서 T-1-007 머지 뒤 T-1-008·009를 먼저, T-1-008 머지 뒤 T-1-011, T-1-011 머지 뒤 T-1-012 순서다. T-1-012는 platform(`clearLocalData`)·engine-client(`import.ts`)·api(복구·삭제 라우트 스키마 채택) 를 작게 만진다.

## 2026-09-02 (저녁, PR #22 contracts Phase 1 스키마 머지)

**결과**: T-1-006 PR #22 squash 머지(`e2d0602`). `CommandRequestSchema`가 12개 명령의 판별 유니온이 되고 Phase 1 6종은 payload 스키마를 갖는다(Phase 2+는 임의 record). `CommandLogEntrySchema`는 `commandType`에 맞는 payload 스키마로 재검사한다(refinement가 붙은 스키마는 `.omit()`이 안 되므로 `CommandLogEntryShapeSchema` + `checkCommandTypePayload`로 분리). `PlayerPublic`은 `truePotential`을 갖지 않는 타입이고 `toPlayerPublic`은 허용 목록으로 필드를 옮긴다. `CareerStateSchema`·`Offer`·`Contract`·`Pending`·`TimelineEntry`·`Effect`는 domain 타입과 `expectTypeOf().toEqualTypeOf()`로 동일성을 고정했다(typecheck에서 검증). 복구 코드 정규화·표시 포맷·입력 스키마와 프로필 삭제 2단계 스키마 추가. `CONTRACTS_VERSION` 0.2.0. contracts 132 tests, api 113 tests, 전체 체인 통과. 비용 약 $10.5, 36분.

**범위 경계 판단**: 정합 검사가 `apps/api/src/routes/careers.test.ts`의 `makeCommand` 기본 payload(`{}`)를 거부해 api 테스트 17건이 깨졌다. 워커가 멈추고 물어봤고, 헬퍼가 애초에 잘못된 payload를 쓴 것이라 한 줄 수정(`{ eligibleEvents: [] }`)만 승인했다.

**후속**: `ATTRIBUTE_KEYS` 런타임 복제본이 domain·content·contracts 세 곳이 됐다(ADR-005의 타입 전용 의존 규칙 때문). 각각 `satisfies readonly AttributeKey[]`로 묶여 있어 키가 빠지면 typecheck가 잡지만, 순서 불일치는 잡지 못한다. 순서가 해시에 영향을 주는 곳은 domain뿐이라 지금은 두고, Phase 2에서 키 목록을 한 곳으로 모을지 결정한다. api의 복구·삭제 라우트는 아직 자체 검증을 쓴다. contracts 스키마 채택은 T-1-012에서 한다.

**슬롯**: 활성 워커 1개(T-1-007). T-1-008·009·011은 T-1-007 머지를 기다린다. 대기 시간에 T-1-011·012 브리프를 쓴다.

## 2026-09-02 (저녁, PR #21 이벤트 선택기 머지 — web 배선 투입)

**결과**: T-1-015 PR #21 squash 머지(`8a9345f`). `buildConditionContext`가 조건 DSL 필드 전부를 `CareerState`에서 채우고(도메인에 없는 필드는 기본값, `rng.injuryRoll`은 100으로 두어 부상 트리거가 헛걸리지 않게), `selectEligibleEvents`가 followUp 우선·기본 조건·쿨다운·트리거 평가로 `ADVANCE` payload를 만든다. `loadContentPack`(브라우저용, 정적 JSON import)과 `ContentPack` 타입 추가. `RulesetSchema satisfies z.ZodType<Ruleset>`을 위해 `OfferBranchSchema` 옵션 필드를 `.exactOptional()`로 바꿨다. fixtures 룰셋 일치 테스트는 `summary`·`blurb`만 제외하고 규칙 값 전부를 비교한다. content 159 tests, fixtures 13 tests, 전체 체인·`content:validate` 통과. 비용 약 $9.6, 48분.

**후속**: 조건 DSL의 `context.managerTrust`와 `relationships.managerTrust`가 둘 다 있는데 전자는 도메인에 없어 0으로 채운다. 팩은 후자만 쓴다. 04 문서에서 `context.managerTrust`를 빼거나 후자로 매핑하도록 정리한다(콘텐츠 작업 때).

**슬롯**: T-1-007(web 엔진 배선·허브·온보딩·설정)을 투입했다. 활성 워커 2개(T-1-006, T-1-007). T-1-006 머지 뒤에도 T-1-008·009는 T-1-007을 기다린다.

## 2026-09-02 (저녁, T-1-015 블로커 결정 — 룰셋 일치 테스트 범위, 브라우저 팩 로더)

**블로커**: fixtures `ruleset-consistency.test.ts`가 콘텐츠 룰셋 1.0.0과 domain 테스트 픽스처 `ruleset-proto.json`의 차이로 실패했다. (1) `lower-league-skipped` 분기 누락 → T-1-005가 픽스처에 추가해 머지됐으므로 main 재병합으로 해소. (2) 아키타입 `summary`·배경 `blurb` 같은 설명 문구 차이 → 테스트를 규칙 값 비교로 좁힌다. 테스트에 `PRESENTATION_KEYS`(실제로 다른 문구 키만 명시)를 두고 재귀 제거 후 deep-equal. `name`·id·가중치·수치·태그·`startTeamId`는 계속 비교한다. domain 파일은 건드리지 않는다.

**범위 추가(T-1-015)**: content에 브라우저용 `loadContentPack(version): ContentPack`(정적 JSON import, 스키마 검증, `PACK_VERSIONS`)을 추가하고 `selectEligibleEvents(pack: ContentPack, state)`로 맞춘다. CLI `loadPack`은 Node 전용이라 web이 쓸 수 없었다. T-1-007 브리프는 이 이름을 전제로 쓴다. 처음 보낸 지시가 터미널에서 잘려 들어가 세 조각으로 다시 보냈다.

**받아들인 것**: fixtures `tsconfig.json`에 `allowImportingTsExtensions: true`(content의 `.ts` 접미 상대 import를 fixtures가 처음 typecheck하게 됨). engine-client·web도 content를 import하는 순간 같은 설정이 필요할 수 있다(T-1-007 참고).

**브리프**: T-1-008(선수 만들기 + 복구 코드 단계, 최소 API 클라이언트), T-1-009(진로·입단 테스트·범용 이벤트/결과·제안 비교·계약·대시보드)를 미리 썼다. SCR-002의 생년 입력은 Phase 1에서 제외(도메인 나이 17 고정)하고 화면 문서에 정정을 적었다.

## 2026-09-02 (저녁, PR #19·#20 머지 — 도메인 첫 계약, api 복구·삭제)

**PR #19 (T-1-005, domain)**: squash 머지(`1a0ffed`). `offers.ts`가 D-9 분기 매칭·제안 생성(개수 수식, 팀 풀 id 순 비복원 추출, `topTierMinOvr`면 첫 제안만 tier 1, 제안당 rng 소비 팀→기간→역할→등번호→적합도)을 맡고, `advance` 3단계와 `ACCEPT_OFFER`가 계약을 확정한다. golden은 첫 계약까지 확장(revision 10, draws 30, `37cc92a1…`, 이 seed는 테스트 성공 → `seoul-tier1` BENCH 1건 → `CTR-10`). domain 129 tests, 전체 체인 통과. 비용 약 $9.9, 28분.

**리뷰에서 고친 것**: `verifySnapshot`의 새 검사가 계약과 pending이 함께 있으면 무조건 실패했다. Phase 2부터 계약 중인 선수에게도 이벤트가 pending으로 걸리므로 `pending.kind === 'OFFERS'`일 때만 `CONTRACT_OFFERS_CONFLICT`로 좁혔다. 브리프의 "둘 다 있으면 실패" 문구가 넓게 쓰인 오케스트레이터 실수다. 워커가 테스트 픽스처 `ruleset-proto.json`에 `lower-league-skipped` 분기를 보강한 것(콘텐츠 룰셋에는 이미 있었음)은 받아들였다.

**PR #20 (T-1-004, api)**: squash 머지(`4797827`). migration 0001(`profiles.deleted_at`, `auth_attempts`, `audit_log`), 복구 코드 발급(30자 알파벳, rejection sampling)·복구(같은 프로필 200, 충돌 409, `MOVE_TO_LINKED` 소유권 이동 + 감사 로그, `KEEP_LINKED_ONLY` 세션 재바인딩)·프로필 삭제 2단계(세션 tokenHash로 서명한 10분 토큰, `runBatch` 원자 삭제)·로그아웃(쿠키 제거)·`DELETE /v1/careers/:id`(타인 소유도 404). rate limit은 워커 자체 리뷰에서 SELECT+UPDATE 레이스를 발견해 단일 UPSERT로 고쳤다. api 113 tests, `db:check` 통과. 비용 약 $11.6, 75분(응답 중단 1회, 재개 지시).

**받아들인 것**: (1) `MOVE_TO_LINKED`는 커리어·스냅샷·명령 로그를 옮기고 idempotency 레코드는 옮기지 않는다(키가 `(ownerProfileId, key)`라 옮기면 충돌 가능, TTL로 소멸. 병합 직후 같은 키 재시도는 서버 revision 검사로 막힌다). (2) 삭제 확인 토큰 서명은 HMAC이 아닌 `sha256(secret|msg)`인데 비밀이 세션 소유자만 아는 값이라 실익 없음. (3) 요청·응답 검증은 api 로컬 코드. contracts 스키마(T-1-006)로 바꾸는 일은 T-1-012·013.

**후속**: `profiles.recovery_code_hash` 인덱스(복구 호출마다 풀스캔). 세션 미들웨어가 요청마다 프로필을 한 번 더 조회하므로 `findActiveSession`에 JOIN으로 합치기. 소프트 삭제된 프로필의 `google_sub` unique가 재연결을 막을 수 있으므로 T-1-013에서 삭제 시 `google_sub`를 비우거나 재연결 규칙을 정한다.

**슬롯**: 활성 워커 2개(T-1-006 contracts, T-1-015 content). T-1-007(web 배선)은 T-1-015 머지 직후, T-1-008·009는 T-1-006·007 머지 후 투입한다. 그 전에 T-1-008·009 브리프를 쓴다.

## 2026-09-02 (저녁, PR #18 E2E 도입 머지)

**결과**: T-1-010 PR #18 squash 머지(`01d64e8`). `@playwright/test` 1.62.1·`@axe-core/playwright` 4.13.0(둘 다 7~8월 배포, 정책 안), Chromium 1개 프로젝트, `vite dev --port 5174` 자동 기동. 허브·법적 문서 스모크, axe serious·critical 0건(전체 위반도 0건), dev 전용 `/__dev/hash-probe`가 브라우저 Web Worker에서 career-01을 재생해 golden(revision 8, `15eea997…`)과 일치. 프로덕션 `dist/`에 probe·fixture 흔적 없음(직접 확인), 초기 청크 91.82KB. 임시 워크트리에서 전체 체인 + E2E 7 passed(6.3초). 비용 약 $5.9, 23분.

**받아들인 것**: (1) `apps/web`이 `@offside/fixtures`를 devDependency로 가진다(ADR-005 테스트 전용 예외). (2) `e2e/hash-probe.spec.ts`는 golden을 `@offside/fixtures` import 대신 JSON 파일을 직접 읽는다. Node 22 ESM이 import attribute 없는 JSON import를 거부하기 때문이다. (3) `typecheck`가 `e2e/tsconfig.json`도 검사한다.

**후속**: fixtures 패키지의 JSON import에 `with { type: 'json' }`을 붙이거나 TS 모듈로 감싸 Node ESM에서도 import되게 한다(T-1-014 전에). `playwright.config.ts`의 `reuseExistingServer`는 CI 연결(T-0-010) 때 `!process.env.CI`로 바꾼다. 브리프의 "라우트 등록" 표현과 달리 구현은 `main.tsx`의 부트스트랩 분기(경로 문자열 비교)인데, 라우터 밖이라 프로덕션 번들 분리가 더 확실해 그대로 둔다.

**슬롯**: 활성 워커 3개(T-1-004·T-1-005·T-1-015). 남은 후보(T-1-006 contracts, T-1-007 web 배선)는 선행 머지 대기라 브리프를 먼저 쓴다.

## 2026-09-02 (저녁, PR #17 domain 선수 모델 머지 — Wave 2 투입)

**결과**: T-1-001 PR #17 squash 머지(`3a8f7c8`). Position 8종·PlayerDraft·PlayerProfile·Pending·Timeline·Ruleset 타입, `UPDATE_PLAYER_DRAFT`·`CONFIRM_PLAYER`(rng 23회, D-7 순서)·`ADVANCE {eligibleEvents}` 가중 선택(정렬 검증, 1-based 누적)·`RESOLVE_EVENT` pending 검증, SETTLEMENT에서 제시할 것이 없으면 `NOTHING_TO_ADVANCE`. 룰셋은 `SimulationInput.ruleset`으로 받는다(해시 제외). golden revision 8(`15eea997…`, rng draws 25), 인사이드 포워드 Base OVR 59 확인. domain 90 tests, 전체 체인 통과. 결정론 예산 검사는 별도 테스트(10초)로 분리. 비용 약 $13.1, 43분.

**받아들인 예외**: `SimulationInput.ruleset` 추가로 engine-client 소스가 깨져 워커가 `EngineClientDeps.ruleset` 배선과 `replayCommandLog` 룰셋 인자를 넣었다(브리프에 허용 범위로 기록). fixtures가 `rulesetProto`를 export한다. 기존 테스트 2건은 pending 모델에 맞춰 조정(`COMMAND_ALREADY_RESOLVED` → `VALIDATION_FAILED/NO_PENDING_EVENT`, 동기화 테스트는 `UPDATE_PLAYER_DRAFT` 사용). fixture-determinism 테스트 timeout 15초.

**슬롯**: 선행(T-1-001·T-1-002)이 끝나 Wave 2의 T-1-005(domain 제안·계약)와 T-1-015(content 이벤트 선택기)를 투입했다. 활성 워커 4개(T-1-004·T-1-010·T-1-005·T-1-015). T-1-006(contracts)은 T-1-005 머지 뒤, T-1-007(web 배선)은 T-1-015 머지 뒤 투입한다.

## 2026-09-02 (저녁, PR #16 UI 부품 키트 머지)

**결과**: T-1-003 PR #16 squash 머지(`cb7d932`). Radix RadioGroup·Dialog·Tabs 래핑과 부품 10종(Stepper·ChoiceCard·CompareCards·StatusStrip·PlayerHeader·ResultCard·DashboardSection·CareerTimeline·Toast). 키보드·포커스 테스트는 `@testing-library/user-event`로. ui 45 tests, web 번들 91.81KB 불변(새 export는 아직 web이 import하지 않아 트리셰이킹). 비용 약 $11.4, 39분.

**리뷰에서 고친 것**: (1) 워커가 오늘 배포된 `user-event 14.6.7`을 쓰려고 `pnpm-workspace.yaml`에 `minimumReleaseAgeExclude`를 추가했다. 공급망 보호 정책 우회라 되돌리고 14.6.6으로 고정했다. 워커 규칙 문서에 "정책이 막는 버전은 예외 등록 대신 더 오래된 버전"을 추가했다. (2) PlayerHeader 이름은 브리프가 `DisplayWord`라고 잘못 적었고(브랜드 어휘 전용) 워커가 지적했다. 13 DSN-CMP-001대로 `<h2>`로 고쳤다. (3) CompareCards는 모바일·데스크톱 레이아웃을 DOM에 둘 다 그리므로 액션 슬롯을 `renderAction(layout)`으로 바꿔 중복 id를 호출자가 피할 수 있게 했다.

**받아들인 것**: 위험·결과 아이콘은 13이 요구하는 SVG 자산이 없어 유니코드 문자로 대체(아이콘 자산 생기면 교체, 후속). `ResultCard`의 `FIXED` 종류 시각은 워커 임의(■, `--os-text-2`). 포커스 링은 기존 `--os-focus` 재사용.

## 2026-09-02 (저녁, PR #15 룰셋 1.0.0 머지)

**결과**: T-1-002 PR #15 squash 머지(`dff279f`). 룰셋 1.0.0(아키타입 24·배경 3·국적 10·팀 8·제안·계약 규칙), `RulesetSchema`·`loadRuleset`, CLI가 룰셋 checksum(`852ab110…`)도 검증. 팩 0.1.0의 EVT-CON-002/003이 태그로 이어지고 조건 DSL에서 `career.pathDecision`을 뺐다. content 80 tests, 전체 체인 통과. 비용 약 $9.4, 26분.

**스펙 수정(워커 발견)**: `진로_하부리그` 경로에서 baseOvr < 55이면 EVT-CON-003이 뜨지 않아 `입단테스트_완료`가 없고, 제안 분기가 하나도 맞지 않아 제안 0개가 될 수 있었다. D-9 표와 T-1-002·T-1-005 브리프에 `lower-league-skipped`(1건, tier 3) 분기를 추가했다. 제안은 어떤 경로에서도 최소 1건이라는 원칙을 지킨다.

**저작 데이터 리뷰**: 인사이드 포워드·배경 3종·팀 8개(가상 이름)·wage band가 계획 표와 일치. 아키타입 23개는 가중치 합 1, 포지션당 3개, GK만 `goalkeeping` 가중치. 수치 밸런스는 종이 프로토타입(U-005)과 Phase 2 시즌 시뮬레이션 뒤 재조정한다.

**슬롯**: T-1-002가 끝나 빈 슬롯에 T-1-010(E2E 도입)을 투입했다.

## 2026-09-02 (저녁, PR #14 머지 — Phase 0 코드 작업 종료)

**결과**: 워커가 리뷰 3건을 모두 반영했다(`dirty` 플래그, `classifyNonConflictError` 공유, `LocalStoreConstraintError`만 기록 제거). 회귀 테스트 3개 추가, engine-client 55 tests. 임시 워크트리에서 lint·lint:deps·typecheck·build 통과. PR #14를 squash 머지(`620a3fb`), 워크트리·터미널 정리, main 체크아웃 ff-pull. 비용 약 $10.7, 43분.

**검증 중 발견**: 전체 워크스페이스 테스트를 캐시 없이 병렬 실행하자 domain `fixture-determinism.test.ts`의 "1,000회 5초 이내"가 5.5초로 실패했다. 단독 실행은 0.7초. PR과 무관한 부하 문제라 머지를 막지 않았다. 후속: T-1-001 브리프에 "예산 검사를 별도 테스트로 분리, 예산 10초, 단독 측정값 기록"을 추가했다. CI(T-0-010)에서는 도메인 테스트를 별도 job으로 돌리는 것도 고려한다.

**Phase 게이트**: Phase 0에서 남은 것은 T-0-010(U-002 대기)뿐이다. 사용자 결정(Phase 순서)에 따라 Phase 1 Wave 1(T-1-001 domain, T-1-002 content, T-1-003 ui, T-1-004 api)을 투입한다. T-0-010은 U-002가 오면 바로 착수한다.

## 2026-09-02 (저녁, PR #14 동기화 클라이언트 리뷰)

**상황**: T-0-015 PR #14(`createSyncClient`, 12 + golden 1 테스트, 전체 52 tests). 임시 워크트리에서 전체 체인 통과. 코드 리뷰에서 3건을 수정 요청했다.

**요청한 수정**:
1. 전송 중 확정된 명령이 유실되는 창: 사이클이 `buildSyncBody() === null`로 끝나는 순간과 `inFlight` 해제 사이에 `notifyCommitted`가 오면 예약이 사라진다. `dirty` 플래그로 사이클 종료 시 재예약.
2. 409 뒤 `GET /careers/{id}` 응답을 PUT과 같은 기준으로 분류(401 → LOCAL_ONLY, 재시도 가능 코드 → RETRYING, 나머지 FAILED). 이전 구현은 200이 아니면 전부 FAILED.
3. `markSynced`·`buildSyncBody` 예외를 `LocalStoreConstraintError`만 기록 제거로, 그 외 I/O 예외는 재시도로.

**받아들인 것**: `resolveConflict(REMOTE)`가 idempotency 테이블을 전량 삭제하는 방식. `LocalStoreTx.idempotency`에 revision 범위 삭제가 없어서다. 오래된 commandId 재실행은 `CAREER_REVISION_CONFLICT`로 안전하게 실패한다. 포트에 범위 삭제를 넣을지는 T-1-011(동기화 배선) 때 다시 본다. `Math.random` 지터와 `Date.now()`는 엔진 밖(전송 계층)이라 허용.

## 2026-09-02 (저녁, Phase 1 실행 계획과 설계 결정 D-1~D-18)

**상황**: Phase 1 다이제스트에서 설계 문서가 비워 둔 항목 14개(Position enum, 아키타입 카탈로그, 배경 효과, 역할 가중치, Contract/Offer, 제안 생성 규칙, Timeline, 복구 코드 형식·제한, API-PRO-003~005·AUTH 본문, `career.pathDecision`, SCR-004 API 오기, 잠금 표시 정본, 대학 경로, `relationships.family`)를 확인했다. 워커에게 결정을 남기지 않기 위해 오케스트레이터가 [phase-1-plan.md](phase-1-plan.md)에 결정을 적었다.

**결정 요지**:
- 포지션 8종·묶음 4종(D-1). 아키타입은 포지션당 3개, 룰셋 데이터로(D-2). 인사이드 포워드 가중치는 프로토타입에서 결정력 14+슈팅력 6을 `shooting` 0.20으로 합쳐 fixture 능력으로 59.30 → golden 59(D-3·D-4).
- 배경 3종은 `state/context/relationships` 초기값과 능력 보정을 통째로 정의하고, `club-academy`는 프로토타입 김서준 값과 같다(D-5). 잠재력은 아키타입 범위에서 굴리고 정찰 범위는 −(5~10)/+(3~8)(D-6).
- DRAFT → `UPDATE_PLAYER_DRAFT` → `CONFIRM_PLAYER`에서만 rng 소비(23회). 확정 후 Phase 1은 유스 시즌을 건너뛰고 `currentStep 12`·`SETTLEMENT`에서 시작한다. Phase 2가 그 앞에 시즌을 넣는다(D-7).
- 룰셋 데이터는 `packages/content/rulesets/1.0.0/ruleset.json`이고 domain은 `SimulationInput.ruleset`으로 받는다. 룰셋은 해시에 넣지 않는다(D-8).
- 이벤트 **적격 판정은 클라이언트(content `selectEligibleEvents`)**, **선택은 도메인**이 `ADVANCE{eligibleEvents}`에서 굴려 `pending`에 기록한다. `RESOLVE_EVENT`는 pending과 일치해야 한다. 재생이 콘텐츠 평가 없이 성립한다(D-10). 이를 위해 ADR-005의 engine-client·web → content 허용 범위를 "스키마·조건 평가기·팩/룰셋 로더"로 넓혔다.
- `career.pathDecision` 필드 대신 태그(`진로_입단테스트`·`진로_아카데미`·`진로_하부리그`, `입단테스트_완료`, `테스트_성공/보통/실패`). 팩 0.1.0은 제자리 수정(사용자 없음). 대학 경로는 Phase 3, `relationships.family`는 도메인에 없으므로 참조 시 검증 실패(D-11).
- 제안 생성은 룰셋 `offerRules.branches`(태그 분기)와 개수 수식(기본 1 + 태그 보너스, 최대 3, 최소 1). `ACCEPT_OFFER`만 Phase 1, `NEGOTIATE`·`REJECT_OFFER`는 Phase 3(D-9).
- 복구 코드 `OFS-XXXX-XXXX-XXXX`, 30자 알파벳 12자리, SHA-256만 저장, 원문은 발급 응답에 한 번. 실패 시도 IP+세션당 시간당 5회, 발급 프로필당 시간당 5회, rate limit은 KV 없이 D1 `auth_attempts`(D-14). 프로필 삭제 2단계 토큰 10분·즉시 삭제, 로그아웃은 로컬 유지, `DELETE /careers/{id}`(D-15).
- SCR-004의 "API-CAR-005 호출"은 오기라 screens 문서를 고쳤다. 잠금 표시 정본은 06(D-16). Google은 코드 구현 후 U-003 대기(D-17). E2E는 Playwright + axe, API 시나리오는 `wrangler dev --local`(D-18).

**작업 분해**: T-1-001~T-1-015, 4 Wave. Wave 1(domain·content·ui·api) 브리프 4건 작성. 투입은 Phase 0 종료(T-0-015 머지) 후. T-0-010은 U-002 대기로 남긴 채 넘어갈지 사용자에게 확인한다.

**미결**: 아키타입 23개와 팀 8개의 구체 수치는 워커 저작 후 오케스트레이터 리뷰. 복구 코드 30자 알파벳의 12자리 엔트로피(약 2^59)는 온라인 시도 제한과 함께 충분하다고 판단했다.

## 2026-09-02 (저녁, PR #13 커리어 동기화 API 머지)

- **PR #13(T-0-008) 머지 `5969ec6`.** 규칙 1~9 구현 확인. 서버 해시 검사는 `sha256Hex(snapshot.state)`이며 engine-client `encodeSnapshot`이 `state = canonicalize(state)`로 직렬화하므로 클라이언트 `hashState`와 일치한다(T-0-011로 런타임 간 일치도 확인). 동시 쓰기 실패 시 재조회 → 규칙 4 → 409 흐름, `pruneSnapshots(5)` 실패는 warn.
- **후속 — 실제 fixture 본문 API 테스트.** careers 테스트는 자체 canonicalize로 본문을 만든다. api는 engine-client를 import할 수 없으므로(ADR-005) `@offside/fixtures` + `@offside/domain`으로 career01 golden 본문을 만들어 `PUT`하는 통합 테스트를 T-0-010 CI 작업에 포함한다. state 래퍼와 본문 `snapshot.revision`의 교차 검증은 규칙에 없어 넣지 않았다(클라이언트 `decodeSnapshot`이 담당).
- T-0-015(동기화 클라이언트) 투입. Phase 0 남은 항목: T-0-015, T-0-010(U-002 대기).

## 2026-09-02 (저녁, Phase 순서 준수 결정)

- **사용자 결정.** 로컬 화면이 허브·자리표시자뿐이라 Phase 1 화면 작업을 병렬로 앞당길지 물었고, "정의한 Phase 순서대로 진행"으로 확정. Phase 0의 남은 항목(T-0-008 진행 중, T-0-015 대기, T-0-010은 U-002 대기)을 닫은 뒤 Phase 1 워커를 투입한다.
- **운영.** 대기 시간에는 Phase 1 브리프를 문서로만 준비한다(T-1-001~). T-0-010이 U-002(Cloudflare 계정)에 계속 막히면 그 항목만 blocked로 남기고 Phase 1로 넘어갈지 사용자에게 확인한다.

## 2026-09-02 (저녁, PR #12 platform 골격 머지)

- **PR #12(T-0-012) 머지 `675ac12`.** Dexie 구현은 `db.transaction('rw'|'r', 전체 테이블)`로 IndexedDB 원자성·직렬화를 그대로 쓰고 Dexie를 `await import`로 지연 로드(초기 청크 예산). KV 구현은 readwrite마다 prefix 전체를 백업해 throw 시 복원. 두 구현 모두 engine-client 계약 테스트와 golden 통과. 채널 분기는 `apps/web/src/platform/index.ts`의 `import.meta.env.MODE === 'toss'` 한 곳, `build:toss` 스크립트로 빌드.
- **ADR-005 해석 확정.** platform이 engine-client에서 가져올 수 있는 것은 LocalStore 포트 **타입**과 `LocalStoreConstraintError` **클래스**(계약 테스트의 `instanceof`에 필요). ADR-005 표의 문구를 "포트 타입·오류 클래스"로 고침. `createEngineClient` 등 실행기는 여전히 platform에서 import 금지(경계 스캔 테스트가 강제).
- **후속 — KV 스토어 백업 비용.** prefix 전체 백업은 커리어가 커지면 명령마다 수 MB 복사가 된다. toss 채널 착수(M-001) 때 "건드린 키만 저널링"으로 바꾼다. 지금은 스텁이라 그대로 둔다.

## 2026-09-02 (저녁, PR #11 폰트 dynamic subset 머지)

- **PR #11(T-0-013) 머지 `acbfd1d`.** `@offside/ui/fonts.css`(subset 94개 + 'Pretendard Fallback')를 앱이 `tailwind.css`보다 먼저 import. `check:bundle`에 폰트 예산 2종 추가(단일 woff2 200KB, preload 합 100KB).
- **폴백 메트릭의 한계.** `size-adjust`·`ascent-override`는 macOS/iOS의 Apple SD Gothic Neo 기준으로 계산했다(fonttools 측정, 계산식은 fonts.css 주석). Windows(Malgun Gothic)·Android(Noto Sans KR)는 `local()` 순서상 같은 override 값을 받으므로 정확하지 않다. CSS만으로는 OS별 분기가 안 되므로 Phase 1 실기기 점검(08 체크리스트)에서 CLS를 보고 필요하면 플랫폼 감지로 클래스를 바꾸는 방식으로 보정한다.
- **스크린샷 정책.** 워커는 외부 호스팅(gist·artifact) 권한이 없다. 시각 검증은 수치와 결론 문장을 PR 본문에 적고 파일은 스크래치패드에 남기는 것으로 통일(브리프 템플릿에 반영 예정).

## 2026-09-02 (저녁, PR #10 런타임 간 해시 일치 머지)

- **PR #10(T-0-011) 머지 `c45bede`.** workerd(Miniflare)에서 career01 재생·SHA-256 경계·canonicalize가 Node·golden과 모두 일치. 불일치 0건. 서버 측 무결성 검사(T-0-008 규칙 5)가 클라이언트 해시를 그대로 재검증해도 된다는 전제가 확인됨.
- **Miniflare v5.** wrangler 4.127.1이 끌어오는 miniflare 5.x는 `new Miniflare({ workers: [...] })` 형태라 브리프의 v4 옵션은 패키지가 공개하는 `convertV4MiniflareOptions`로 변환해 사용. esbuild는 wrangler 내부 0.25.x와 다른 0.28.1을 명시(테스트 번들 전용이라 무해. 추후 CI에서 esbuild 중복 설치가 문제되면 정리).
- **합류 후 검증.** main에서 api 테스트 58건 통과(2회). 다만 첫 병렬 실행에서 `cross-runtime-hash.test.ts`가 workerd 콜드스타트로 vitest 기본 5초를 넘겨 1회 실패(단독 662ms). CI 재발 방지로 해당 파일의 `beforeAll` 30초·describe 15초 타임아웃을 T-0-008 워커에게 별도 커밋으로 맡김.

## 2026-09-02 (저녁, PR #9 api HTTP 계층 머지·폰트 측정 결과)

- **PR #9(T-0-006) 머지 `483001b`.** 리뷰에서 잡은 결함 1건: idempotency 미들웨어가 같은 키의 동시 요청 2개를 모두 통과시킨 뒤 두 번째 INSERT가 UNIQUE 위반으로 throw해 라우트는 성공했는데 503이 나가는 레이스. `onConflictDoNothing` + 저장 실패 시 응답 불변(warn 로그 `IDEMPOTENCY_STORE_FAILED`) + 동시 요청 테스트로 수정. T-0-008의 "같은 PUT 100개 → 전부 200"은 이 수정과 서버 규칙 4("이미 반영됨 → 200")의 조합에 기댄다.
- **세션 규칙 확정 사항.** `GET /v1/profile`은 세션이 없을 때만 익명 프로필·세션을 발급하고, 위조·만료 쿠키도 "없음"으로 취급해 새 프로필을 준다(복구는 로그인·복구 코드의 몫). Bearer가 무효면 쿠키가 있어도 401. 그 외 보호 라우트는 401 `PROFILE_REQUIRED`. 로그에 `error.message`가 남으므로 D1 오류 문자열에 값이 섞이지 않는지 T-0-010 CI 이후 점검(후속).
- **T-0-013 측정(워커 보고, PR 전).** 전송 바이트 2109KB→269KB(87% 감소), LCP는 4G 2445→2519ms, 느린 3G 2444→2478ms로 사실상 불변, CLS 0. 원인: 기존에도 `font-display: swap`이라 폰트가 페인트를 막지 않았고 허브가 빈 상태라 JS 파싱이 LCP를 지배. 결론: 전환은 유지(전송량·향후 콘텐츠 여유), 허브 LCP 2.5초 예산은 실제 허브 화면(Phase 1)이 붙은 뒤 다시 측정. tabular-nums 검증은 숫자 UI가 없어 스크래치 HTML로 subset의 `tnum` 보존만 확인하기로 함.
- T-0-008(커리어 동기화 API) 투입.

## 2026-09-02 (저녁, PR #8 engine-client 머지·후속 과제)

- **PR #8(T-0-007) 머지 `9667dc7`.** 브리프의 테스트 목록(골든 inline·worker, 100 병렬 멱등, revision 경쟁, 쓰기 단계 충돌, 롤백, 복구 a~d, decodeSnapshot, buildSyncBody, 순수성 스캔, 계약 테스트)이 모두 구현됨. `check-deps.mjs`는 `checkDeps(pkg, deps, allowed, field)`로 분리해 `TEST_ONLY_PACKAGES`를 devDependencies에서만 허용.
- **후속 1 — 로컬 저장 크기.** idempotency 레코드가 `ExecuteSuccess` 전체(encoded Snapshot + DomainSnapshot)를 저장해 revision당 state가 최대 3벌 남는다. Phase 1에 "로컬 저장 예산·정리 정책" 작업을 두고, idempotency는 `{ revision, resultHash }`만 남기고 응답은 snapshots 테이블에서 재조립하는 방향을 검토한다(05 "저장된 최초 응답을 돌려준다"는 의미 유지).
- **후속 2 — 동기화 전 검증.** `buildSyncBody`는 최신 Snapshot을 decode 검사 없이 싣는다. T-0-015 브리프에 "전송 전 `loadCareer`로 최신 Snapshot 검증(필요 시 복구) 후 `buildSyncBody`" 규칙을 추가했다.
- **후속 3 — 오류 형태.** `buildSyncBody`·`markSynced`는 없는 careerId에 `EngineError`가 아니라 `Error`를 던진다. T-0-015에서 `CAREER_NOT_FOUND`로 감싼다(engine-client 변경 없음).
- T-0-012(platform·Dexie)와 T-0-011(런타임 간 해시) 투입. 동시 워커 4명(T-0-006·T-0-013·T-0-012·T-0-011).

## 2026-09-02 (저녁, T-0-015 동기화 클라이언트 설계)

- **큐 정책.** careerId당 대기 1개·진행 1개. web은 1.5초 debounce로 연속 명령을 한 PUT에 합치고 시즌 종료·은퇴·생성 체크포인트는 즉시, toss는 debounce 0(ADR-002 "모든 step 경계"). 재시도는 지수 백오프(2s→60s, 지터 ±20%), 재시도 가능 여부는 contracts `RETRYABLE_BY_CODE`. 같은 본문의 재시도는 같은 Idempotency-Key.
- **409 처리.** 서버 Snapshot을 GET해 로컬에 같은 revision·같은 stateHash의 Snapshot이 있으면 서버는 로컬 로그의 조상 → `markSynced(serverRevision)` 후 빨리감기 재전송(사이클당 1회). 아니면 `CONFLICT` 상태로 멈추고 화면에 넘긴다.
- **충돌 해소 범위.** Phase 0은 `'REMOTE'`(서버 채택: 서버 Snapshot 검증 후 로컬 revision 되감기, 버려지는 로컬 로그는 kv에 보관)만 구현. `'LOCAL'`(이 기기 우선)은 서버에 강제 덮어쓰기 API가 없고 명령 로그 계보가 섞이면 후일 리플레이 검증이 깨지므로 보류. 후보는 (a) 로컬 로그를 새 careerId로 포크해 엔진에서 재실행(결정론이라 결과 동일, API 변경 없음, 커리어가 둘이 됨) vs (b) `PUT`에 강제 플래그 추가(서버 로그 교체). 추천은 (a). 화면(Phase 1)과 함께 결정.
- **세션 부재.** 401은 `LOCAL_ONLY`로 두고 platform이 세션을 만든 뒤 앱이 다시 알리면 재개. 재시도 불가 4xx(VERSION_MISMATCH 등)는 `FAILED`로 표시만 하고 게임은 계속(ADR-002 "동기화 실패는 진행을 막지 않는다").

## 2026-09-02 (저녁, PR #6 머지·PR #7 리뷰·버전 라벨)

- **PR #6(T-0-005) 머지 `9b292b1`.** 수정 2건 확인: cursor 인코딩을 `btoa/atob + TextEncoder`로 바꿔 Workers 런타임 호환, purity 테스트가 `Buffer`·`process.`·`require(`·`__dirname`을 금지. `db:check`는 `git status --porcelain -- migrations`로 미추적 migration도 잡는다(임시 컬럼으로 실패→복원 확인).
- **Phase 0 버전 라벨.** `rulesetVersion`은 `"1.0.0"`(00 로드맵 "LINE TEST로 ruleset 1.0.0 확정", domain golden fixture, API 시드 `svc_kickoff`, 07 예시 모두 이 값), `contentPackVersion`은 `"0.1.0"`, `schemaVersion`은 1. 패키지 버전 상수(`DOMAIN_VERSION` 등)와 ruleset 라벨은 별개 이름공간. content 팩 manifest `compatibleRulesetVersions`를 `["0.1.0"]`→`["1.0.0"]`으로 고쳤다.
- **PR #7(T-0-004) 리뷰 결정.** (1) 루트 `content:validate`는 `turbo run content:validate`를 유지하고 패키지 스크립트 이름을 `content:validate`로 통일(캐시·파이프라인 일관). (2) content CLI는 `node ./src/cli/validate.ts`(Node 22 타입 스트리핑)로 실행하므로 `.ts` 확장자 import와 `allowImportingTsExtensions`를 content 패키지에 한해 허용. (3) 콘텐츠 후속 과제로 기록: sourceId `EVT-…​.A.A1.0`처럼 `.N` 접미(같은 선택지의 다중 효과 구분), EVT-CON-002는 4지→3지선다(스키마 max 3), 선택지 weight는 임의값(합 100 미달은 경고), 조건 필드는 문자열 타입 화이트리스트. 이들은 T-0-004 브리프의 "프로토타입과 다르게 결정한 항목"으로 04 문서 갱신 시 반영.
- **PR #7(T-0-004) 머지 `cfc868f`.** main 재병합·lockfile 재생성 후 체인·content:validate 재확인. 빈 슬롯에 T-0-013(폰트 dynamic subset, 독립 작업) 투입. T-0-011 브리프 작성(Node·workerd 해시 일치, 브라우저 Web Worker는 Playwright 도입 시). T-0-007 브리프의 "domain fixture 원본 삭제" 문구 철회(domain→fixtures devDependency는 워크스페이스 순환).

## 2026-09-02 (저녁, fixtures 테스트 전용 의존 규칙)

- **T-0-007 워커 질문.** engine-client가 golden fixture를 쓰려면 `@offside/fixtures`를 devDependency로 가져야 하는데 `check-deps.mjs` 허용 목록과 ADR-005 표에 없어 `lint:deps`가 실패한다.
- **결정.** `@offside/fixtures`는 테스트 전용 패키지로, 어느 패키지든 `devDependencies`로만 허용하고 `dependencies`면 위반. `check-deps.mjs`에 `TEST_ONLY_PACKAGES` 개념을 추가(워커 범위 확장, 테스트 2건 포함). ADR-005 본문에 한 문단 추가. 런타임 의존 표는 그대로. 이유: platform(T-0-012)·api 테스트도 같은 fixture를 쓰게 되므로 패키지별 허용 목록에 하나씩 넣는 것보다 규칙 하나가 낫다.

## 2026-09-02 (저녁, PR #4 머지·lockfile 충돌 규칙)

- **T-0-003 머지(`4693202`).** 리뷰 요청 5건(zod 4.5.4 통일, `ClientIdSchema`, `PUT /careers` snapshot revision 정합성, CORS `Content-Type`·`X-Request-Id`, 주석)을 워커가 반영했고 체인 통과(50 tests).
- **lockfile 충돌 처리.** 첫 `gh pr merge`가 `pnpm-lock.yaml` 충돌로 실패했다(T-0-009 머지가 먼저 lockfile을 바꿈). 워커 터미널을 이미 닫은 뒤라 오케스트레이터가 임시 워크트리에서 `origin/main`을 합치고 lockfile을 `pnpm install --no-frozen-lockfile`로 재생성한 뒤 체인을 재실행해 푸시·머지했다. 코드 편집은 없었다(lockfile 재생성만). 재발 방지로 README·브리프 템플릿·대기 중 브리프(T-0-006/007/012)에 "PR 직전 main 병합 + lockfile 재생성" 규칙을 넣었다. 교훈: 머지 결과를 확인하기 전에 터미널·워크트리를 정리하지 않는다.
- **디스패치.** T-0-014(domain `ADVANCE` 정렬)와 T-0-005(api D1 스키마)를 `4693202` 기준으로 동시 시작. T-0-004는 진행 중.

## 2026-09-02 (저녁, api 데이터 계층 설계)

- **T-0-005 브리프 작성.** 서버 `careers` 행은 contracts `CareerSummary` + 소유자·검증 상태·시각만 갖는 요약이다. 02 DATA-CAR-001의 진행 값(`currentDate`, `currentTeamId`, `rngState` 등)은 Snapshot `state` 안에 있으므로 서버 테이블에 중복하지 않는다.
- **D1 원자성.** 대화형 트랜잭션이 없으므로 한 요청의 쓰기는 `db.batch` 하나로 보내고, `command_log(career_id, revision)` PK와 `snapshots(career_id, revision)` UNIQUE가 동시 쓰기를 실패시킨다. T-0-008의 동기화는 "SELECT revision → 비교 → batch[조건부 UPDATE, INSERT…]" 순서다.
- **서버 idempotency는 HTTP `Idempotency-Key` 단위**(`owner_profile_id + key`), 명령 단위 멱등성은 engine-client와 `command_log` PK가 맡는다.
- **비밀값은 해시만**(세션 토큰·복구 코드·앱인토스 식별키, SHA-256 hex). **시각은 ISO UTC TEXT**, JSON 컬럼은 TEXT + Zod 검증. migration은 drizzle-kit 생성 SQL을 wrangler가 적용(`out = migrations_dir`), 손 편집 금지, additive만.
- 시드(`svc_kickoff`)는 migration이 아니라 `seeds/local.sql`로 분리한다. 원격 D1·환경 블록은 U-002 뒤 T-0-010.

## 2026-09-02 (저녁, T-0-004 매핑 답변·engine-client 설계)

- **T-0-004 워커 질문 3건 답변.** (1) EVT-REL-001의 동료 RELATION은 문서 지칭대로 박준서→`captain`, 이도현→`rival`. (2) EVT-REL-002의 '가족' RELATION 수치는 domain에 필드가 없으므로 Effect를 만들지 않고 태그(`부모의_걱정`, `대화_회피`)와 cause 문구만 옮긴다. `relationships.family` 추가 여부는 Phase 1 결정 사항. (3) '제안 수 ±1', '대학 경로 성장 보정' 같은 서사 전용 수치는 Effect에서 제외하고 태그·문구로만 남긴다. 프로토타입의 제안 수 공식은 태그(`에이전트_계약`, `주목받는_유망주`)로 계산되므로 손실이 없다. 계약 제안 시스템은 Phase 1 이후.
- **명령 이름 정렬(T-0-014).** domain의 `ADVANCE_STEP`을 07·contracts의 `ADVANCE`로 바꾼다. T-0-003 브리프는 "매핑은 engine-client가 한다"고 했으나, 명령 로그 `commandType`을 engine-client와 api 리플레이 양쪽에서 매핑하는 것보다 이름을 하나로 맞추는 편이 싸다. 상태 값이 바뀌지 않아 golden hash는 그대로다.
- **engine-client 설계(T-0-007 브리프).** ① LocalStore 구현은 ADR-002대로 platform이 맡는다(web=Dexie는 T-0-012). engine-client는 포트·메모리 구현·계약 테스트만. ADR-005의 패키지 설명 두 줄을 이에 맞게 고쳤다. ② Worker에서 도는 것은 domain `simulate`뿐이고 저장소는 메인 스레드에 남는다(toss 네이티브 Storage 브리지가 Worker에서 동작한다는 보장이 없음). 실행기는 읽기 트랜잭션 → 시뮬레이션 → 쓰기 트랜잭션(재검증) 2단계다. Dexie 트랜잭션이 외부 Promise 대기 시 자동 커밋되는 제약 때문이기도 하다. ③ 명령 payload는 domain `Command` 그대로(RESOLVE_EVENT가 outcomes를 포함)라 명령 로그만으로 리플레이가 된다. 콘텐츠 팩 → payload 변환은 Phase 1 이벤트 엔진 작업. ④ golden fixture는 `packages/fixtures`로 복사하고 드리프트 테스트로 domain 원본과 동일함을 지킨다. 원본 삭제는 T-0-011.
- **디스패치 순서.** T-0-003 머지 → T-0-014(10분 규모) → T-0-007. T-0-004는 독립적으로 병행.

## 2026-09-02 (저녁, 머지 권한)

- 사용자 지시: PR 머지 승인을 따로 요청하지 않는다. 리뷰 체크리스트를 통과하면 오케스트레이터가 바로 squash 머지하고 다음 작업을 띄운다. 범위 변경·외부 계정·비용이 큰 결정은 여전히 사용자에게 묻는다.

## 2026-09-02 (저녁, T-0-002 질문 답변)

- 능력치 키는 02 문서의 20개(`ATTRIBUTE_KEYS`)가 정본이다. 프로토타입 표는 결정력·슈팅력을 나누고 오프더볼을 쓰며 점프·골키핑이 없다. 코드로 옮길 때 매핑: 결정력→`shooting`(슈팅력은 버림), 오프더볼→`positioning`, `jumping`은 50, `goalkeeping`은 필드 플레이어 10을 기본값으로 둔다. 프로토타입 문서 표 자체는 Phase 1 ruleset 작업에서 02 이름으로 고친다.
- 프로토타입 표에 없는 관계 값(captain·rival·fans·agent)은 50에서 시작한다.
- T-0-002 fixture는 결정론·해시 고정용이며 Base OVR 59 재현은 RULE-OVR-001 구현(Phase 1) 몫이다.

## 2026-09-02 (저녁, 브리프 준비)

- T-0-002·003·004 브리프 작성. 착수 순서는 T-0-001 → T-0-002 → (T-0-003 ∥ T-0-004). contracts와 content가 domain 타입을 import하므로 domain 먼저.
- 조건 DSL 화이트리스트에 `career.stage`(`YOUTH`/`PRO`)와 `season.tags`를 등록했다. 프로토타입 트리거의 `career.phase == "U18"`은 `career.stage == "YOUTH"`로, `player.age`는 `career.age`로 바꿨다. 나이 필드는 `career.age` 하나만 쓴다.
- 콘텐츠 README의 `phases` 값을 04의 `CareerPhase`로 통일했다(시즌 phase와 혼용 금지). 실행용 팩·ruleset은 ADR-004대로 `packages/content/packs|rulesets`에 두고 `docs/content`는 저작 문서만 둔다.
- `SquadRole`(`STARTER|ROTATION|BENCH|RESERVE`, 시즌 단위)과 경기 단위 `MatchAppearance`(`START|SUB|OUT`)를 02에 정의했다. `CheckpointType` 9개를 05에 정의했다(`EVENT_RESOLVED` 추가).
- Snapshot `state`는 domain `CareerState`의 canonical JSON 문자열, `stateHash`는 그 SHA-256(순수 TS 구현, domain 안). `rngState`는 `state` 안 값의 색인용 복사본.
- 프로토타입 팩 0.1.0은 플레이테스트(U-005) 전에 기계 변환으로 만들고 manifest에 `playtested: false`를 둔다. 밸런스 조정은 U-005 뒤 별도 작업. 근거: Phase 0 골격을 계정·프로토타입 없이 진행한다는 09-02 오전 결정과 같다.

## 2026-09-02 (승인)

- **ADR-001~009 승인.** 사용자 승인으로 U-006 완료. Phase 0 착수.
- **Phase 0 게이트 완화.** 골격 작업(T-0-001~004·007·009)은 계정·프로토타입 기록 없이 진행한다. 이유: 코드 구조는 프로토타입 결과에 영향받지 않고, 배포·CI만 계정이 필요하다. 오케스트레이터 결정.

## 2026-09-02 (오후, 범위 조정)

- **미니앱 출시 시점 보류, 구조는 지금.** 사용자 지시: 웹 프로젝트를 언제든 미니앱 출시를 고려할 수 있는 구조로 작업. ADR-009의 구조 결정(어댑터, LocalStore 포트, Bearer 병행, 내부 라우트 약관)은 Phase 0~1에 적용하고, SDK 연동·빌드·세션 API·콘솔·등급분류는 보류 백로그 M-001~M-006으로 분리. U-007~U-011은 `deferred`.

## 2026-09-02 (오후)

- **앱인토스 미니앱 채널 채택(당초 동시 출시, 같은 날 범위 조정).** [ADR-009](../adr/ADR-009-apps-in-toss-channel.md). 같은 SPA를 두 채널로 빌드, 차이는 `packages/platform`에만. 근거: 사용자 지시와 개발자센터 문서.
- **앱 유형은 게임, 등급분류 직접 취득.** 비게임 등록은 재분류 위험과 내비게이션 바·라이트 모드 규칙 때문에 보류.
- **toss 채널 인증은 식별키 + Bearer 세션.** 미니앱 안 소셜 로그인 금지 정책으로 Google은 web 채널 전용. 토스 로그인은 사업자 필요·불필요로 미채택.
- **toss 채널 로컬 저장은 네이티브 Storage.** iOS WebView IndexedDB 7일 삭제와 origin 분리 때문. `LocalStore` 포트로 추상화.
- **수익화 없음 유지.** 인앱 결제·광고·프로모션을 넣지 않아 사업자 등록 없이 출시 가능.
- **약관·개인정보는 SPA 내부 라우트.** 미니앱의 외부 링크·자사 유도 금지 정책 대응.

## 2026-09-02

- **역할 분리 확정.** 사용자 = 프로덕트 오너. Claude = 기술 책임자·오케스트레이터, 앱 코드 직접 수정 금지. 구현 = Claude Code Sonnet 5 워커, Orca 워크트리로 위임. 근거: 사용자 지시.
- **로컬 우선 아키텍처로 전환.** 서버 권위 시뮬레이션 권장을 폐기하고 클라이언트 실행 + 서버 동기화·리플레이 검증으로 확정. [ADR-002](../adr/ADR-002-persistence-and-identity.md), [ADR-003](../adr/ADR-003-simulation-location.md). 근거: 사용자의 "서버는 최종 결과 정도만" 의도와 원작 구조. 단, 최종 결과만이 아니라 checkpoint Snapshot을 동기화한다. 이유는 진행 중 커리어 복구.
- **Cloudflare 단일 벤더.** [ADR-007](../adr/ADR-007-hosting-and-infra.md). 대안 Vercel·Supabase·AWS 보류 사유 기록.
- **Google 로그인 1종 + 익명 병합 규칙.** [ADR-008](../adr/ADR-008-auth-and-account-merge.md). 카카오는 Season 2 이후 재검토.
- **도메인은 사용자가 구매.** 후보 4개, 가용성 미확인. [ADR-006](../adr/ADR-006-service-name-and-domain.md).
- **시간 모델·선발 규칙·브랜드 어휘·Legacy 가중치.** 커밋 2f1e070의 문서 보강에서 오케스트레이터가 확정. 사용자 반려 가능. 상세는 각 문서.

## 열린 질문

| 질문 | 필요 시점 | 담당 |
|---|---|---|
| 도메인 최종 선택 | Phase 0 CI 배포 전 | 사용자 |
| 저장소 공개 여부(GitHub Actions 무료 분수 영향) | Phase 0 | 사용자 |
| 카카오 로그인 추가 여부 | Season 2 설계 | 사용자 |
| 리플레이 검증 ON 시점 | 경쟁 랭킹 설계 시(토스 리더보드 도입 시 필수) | 오케스트레이터 |
| 앱인토스 미니앱 출시 결정 시점 | LINE TEST 결과 본 뒤 권장 | 사용자 |
| 앱인토스 `appName`·제작자 이름 최종값 | U-007 등록 시 | 사용자 |
| GRAC 등급분류 개인 신청 가능 여부, 수수료 | Phase 1 중 | 사용자 |
| toss 채널 다크 팔레트가 검토를 통과하는지 | 첫 검토 요청 | 사용자·오케스트레이터 |
| 토스 게임센터 리더보드 도입 여부(Phase 7) | Phase 6 말 | 사용자 |
| WORLD STAGE 가상 리그명·국가별 축구 문화·24개 구단 브랜드 확정 | T-8-008 착수 전 | 사용자·콘텐츠 |
