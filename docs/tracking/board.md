# 진행 보드

갱신: 2026-09-03. 상태는 `todo`, `in-progress`, `in-review`, `blocked`, `deferred`(사용자 결정 전 보류), `completed`.

## 현재 게이트

**Phase 0 코드 작업 종료(2026-09-02 저녁, PR #14).** 남은 Phase 0 항목은 T-0-010(CI·배포)뿐이며 U-002 Cloudflare 계정을 기다린다. Phase 순서 규칙(2026-09-02 사용자 결정)에 따라 Phase 1 Wave 1(T-1-001~004)과 Wave 2(T-1-005·006·015)를 투입했다. 2026-09-03 02:10 기준 Wave 3·4의 T-1-009(진로~계약·대시보드, PR #26)와 T-1-011(동기화 배선, PR #30)까지 머지돼 온보딩부터 첫 계약·대시보드까지 브라우저에서 이어진다. T-1-012(설정 데이터 섹션·법적 문서)와 T-1-016(선수 성별·선호 포지션)이 병렬로 진행 중이며, 남은 Phase 1 작업은 T-1-013(Google, T-1-012 뒤)·T-1-014(E2E 완료 조건, T-1-012·016 뒤)다. 사용자가 작성한 콘텐츠 정본 `docs/content/kickoff/`(PR #24)는 Phase 2 콘텐츠 작업의 입력이며 지금 코드 작업을 요구하지 않는다. 계획·결정은 [phase-1-plan.md](phase-1-plan.md). ADR-001~009 승인(2026-09-02). Phase 1 브리프는 미리 작성한다. 계정·프로토타입에 의존하지 않는 골격 작업(T-0-001~004, 007, 009)은 먼저 진행한다. 게임 규칙 fixture의 수치(T-0-002 이후 실제 규칙)와 CI 배포(T-0-010)는 각각 프로토타입 기록(U-005)과 Cloudflare(U-002)를 기다린다. 앱인토스 출시 준비(U-007~U-011, M-001~M-006)는 사용자가 미니앱 출시를 결정할 때 착수한다.

WORLD STAGE 세계관 확장은 2026-09-03 승인된 Phase 8 후속 범위다. 현재 Phase 1~7의 국내 MVP 순서를 바꾸지 않으며, Phase 3~5와 Phase 7 완료 후 새 ruleset의 신규 Career에 해외 이적·가상 해외 리그·대륙대회를 연다. 정본은 [WORLD STAGE 개발 명세](../development/15-world-stage-expansion.md)와 [Phase 8](../phases/phase-08-world-stage.md)이다.

## 사용자 액션

| ID | 내용 | 상태 | 메모 |
|---|---|---|---|
| U-001 | 도메인 구매, 네임서버를 Cloudflare로 | todo | ADR-006 후보 참고 |
| U-002 | Cloudflare 계정과 Workers Paid 플랜, API 토큰을 GitHub Secrets에 등록 | todo | ADR-007 |
| U-003 | Google Cloud 프로젝트에서 OAuth 클라이언트 ID·시크릿 발급 | todo | ADR-008. 콜백 URL은 도메인 확정 후 |
| U-004 | Sentry 프로젝트 생성, DSN 등록 | todo | ADR-007 |
| U-005 | 종이 프로토타입 3회 플레이, `docs/content/prototype/playtest-log.md` 작성 | todo | 양식 제공됨(2026-09-02). 회차별 시트와 3회 합산 답만 채우면 된다. 고정 seed 3종 키트는 `docs/content/kickoff/paper-playtest-kit.md`(PR #24) |
| U-006 | ADR-001~009 검토·승인 또는 반려 | completed | 2026-09-02 승인 |
| U-007 | 앱인토스 콘솔 가입(토스 비즈니스, 만 19세), 워크스페이스·제작자 이름, 앱 등록(유형 **게임**, `appName` 확정), 고객문의 이메일 | deferred | ADR-009, ADR-006. appName은 변경 불가 |
| U-008 | 앱인토스 서버 mTLS 인증서 발급 → `wrangler mtls-certificate upload`, certificate_id 공유 | deferred | ADR-007. U-002·U-007 이후 |
| U-009 | 게임물 등급분류 신청(GRAC, 스토어명 `기타-앱인토스`). 개인 신청 가능 여부 먼저 확인 | deferred | ADR-009. 10~15일 + 수수료. 증명서 PDF를 콘솔에 등록 |
| U-010 | 약관·개인정보 처리방침 최종 문안 검토, 사업자명·문의 이메일·시행일 확정(`apps/web/src/legal/operator.ts`) | todo | D-20. T-1-012가 사실 기반 초안을 쓴다. 출시 전 필수 |
| U-010 | 이 세션에서 `/mcp` → `apps-in-toss-console` 인증 완료 | deferred | 서버는 등록됨, OAuth 로그인만 남음 |
| U-011 | (U-009에서 개인 신청 불가 시) 개인사업자 등록 후 콘솔 사업자 등록 | deferred | 조건부. 면세 사업자 불가 |

## Phase 0 백로그 (착수 순서)

| ID | 작업 | 참조 | 상태 | 워크트리 |
|---|---|---|---|---|
| T-0-001 | 모노레포 골격: pnpm·Turborepo·tsconfig·ESLint·의존 방향 lint | ADR-005 | completed | PR [#1](https://github.com/tasddc1226/offside-football-simulator/pull/1) squash 머지 `e9d7d30`(2026-09-02). 브리프 [briefs/T-0-001.md](briefs/T-0-001.md) |
| T-0-002 | `packages/domain` 순수 `simulate` fixture와 state hash, 결정론 1,000회 테스트 | RULE-RNG-001, TEST | completed | PR [#2](https://github.com/tasddc1226/offside-football-simulator/pull/2) squash 머지 `fcb49d4`. golden stateHash `ac3aae07…354e82`, 63 tests |
| T-0-003 | `packages/contracts` 응답 봉투·오류 코드·Snapshot 직렬화 Zod | 07 | completed | PR #4, `4693202`. zod 4.5.4, 50 tests |
| T-0-004 | `packages/content` Zod 스키마와 `content:validate` CLI, 프로토타입 이벤트 10개를 팩 0.1.0으로 | ADR-004, 04 | done | [브리프](briefs/T-0-004.md). PR #7 `cfc868f`. 리뷰 1회(수정 3건). 팩은 `playtested: false`, 콘텐츠 후속 항목은 결정 로그 참조 |
| T-0-005 | `apps/api` D1 스키마(profiles·sessions·careers·snapshots·command_log·idempotency·service_seasons), Drizzle migration, 저장소 함수, 로컬 D1 테스트 | 02, ADR-002, ADR-007, ADR-008 | done | [브리프](briefs/T-0-005.md). PR #6 `9b292b1`. 리뷰 1회(수정 2건: Workers 호환 base64url, db:check 미추적 파일) |
| T-0-006 | `apps/api` HTTP 계층: requestId·구조화 로그·오류 봉투·CORS/Origin, 세션 미들웨어(쿠키+Bearer), 익명 프로필 발급 `GET /profile`, `PATCH /profile/settings`, Idempotency-Key | API-PRO-001/002, 07, ADR-002, ADR-008 | done | [브리프](briefs/T-0-006.md). PR #9 `483001b`. 리뷰 1회(수정 1건: idempotency 동시 저장 레이스) |
| T-0-007 | `packages/engine-client` LocalStore 포트(메모리 구현 + 계약 테스트), 명령 실행기, revision·commandId 멱등성, Snapshot 복구, Web Worker 시뮬레이터 프로토콜, golden fixture를 `packages/fixtures`로 이관 | 05, ADR-002, ADR-003 | done | [브리프](briefs/T-0-007.md). PR #8 `9667dc7`. 리뷰 1회 통과(워커 /review:pr 1회 자체 수정). 후속: idempotency 응답 저장 크기(결정 로그) |
| T-0-008 | `apps/api` 커리어 동기화 `GET /careers`, `GET /careers/{id}`, `PUT /careers/{id}`(If-Match·409·422·무결성 검사), 100회 병렬 멱등 테스트 | API-CAR-001~003, 05, ADR-002 | done | [브리프](briefs/T-0-008.md). PR #13 `5969ec6`. 리뷰 1회 통과. 100회 병렬 테스트 timeout 20초 |
| T-0-009 | `apps/web` Vite·Router·Tailwind 토큰·상태 훅 골격, 허브 빈 상태 화면 | ADR-001, 13 | completed | PR [#3](https://github.com/tasddc1226/offside-football-simulator/pull/3) squash 머지 `fdb8a72`. 대비 24쌍 PASS, 초기 번들 91.81KB gzip |
| T-0-010 | GitHub Actions CI, Pages·Workers preview 배포, staging migration | ADR-007 | blocked | U-002 필요 |
| T-0-011 | Node(Vitest)·Cloudflare Workers(Miniflare) 동일 fixture state hash·SHA-256 경계·canonicalize 일치 테스트 | ADR-003, 08 | done | [브리프](briefs/T-0-011.md). PR #10 `c45bede`. 리뷰 1회 통과. 브라우저 Web Worker 검증은 Playwright 도입 시 |
| T-0-012 | `packages/platform` 골격: `LocalStore` 포트와 `Platform` 인터페이스, web 구현(Dexie), toss 스텁(SDK 의존성 없음), 화면·엔진의 SDK import·채널 분기 lint | ADR-009, ADR-005 | done | [브리프](briefs/T-0-012.md). PR #12 `675ac12`. 리뷰 1회 통과. 후속: KV 스토어 prefix 전체 백업 비용(결정 로그) |
| T-0-013 | Pretendard self-host 폰트를 dynamic subset(unicode-range 분할)으로 바꿔 초기 폰트 전송량 축소, 허브 LCP 2.5초 예산 측정 | 13 구현 체크리스트, 01 성능 예산 | done | [브리프](briefs/T-0-013.md). PR #11 `acbfd1d`. 전송 2109KB→269KB. 허브 LCP 재측정은 Phase 1 화면 후 |
| T-0-014 | domain 명령 이름 `ADVANCE_STEP` → `ADVANCE` 정렬(07·contracts와 동일), contracts 주석 정리 | 07 로컬 명령 계약 | completed | PR #5, `6b8e1a3`. golden 불변, 64 tests |
| T-0-015 | `packages/engine-client` 동기화 클라이언트: checkpoint마다 `PUT /careers/{id}`(fetch 주입), 재시도 큐, 409 시 서버 Snapshot 비교·"이 기기/다른 기기" 결정 신호, 오프라인 무시 | ADR-002 동기화 규칙, 01 명령 처리 6단계 | done | [브리프](briefs/T-0-015.md). PR #14 `620a3fb`. 리뷰 1회(수정 3건). engine-client 55 tests. '이 기기 우선' 해소는 T-1-011 |

Phase 0 완료 조건은 [`phase-00-foundation.md`](../phases/phase-00-foundation.md)를 따른다. T-0-006 세션 미들웨어는 쿠키와 Bearer를 모두 받도록 만든다.

## Phase 1 백로그 (착수 순서, 투입은 Phase 0 종료 후)

계획·설계 결정 정본: [phase-1-plan.md](phase-1-plan.md). Wave 1(T-1-001~004)은 서로 다른 패키지라 동시 투입한다. 브리프가 없는 행은 선행 작업 머지 뒤에 쓴다.

| ID | 패키지 | 작업 | 선행 | Wave | 상태 | 워크트리 |
|---|---|---|---|---|---|---|
| T-1-001 | domain | Player 모델·룰셋 입력·DRAFT→CONFIRM_PLAYER·Base OVR golden 59·타임라인·`ADVANCE` 이벤트 제시 | Phase 0 종료 | 1 | done | PR #17 `3a8f7c8`. 리뷰 1회 통과(engine-client 룰셋 배선 예외 승인). domain 90 tests, golden revision 8 `15eea997…`, Base OVR 59 |
| T-1-002 | content | 룰셋 1.0.0(아키타입 24·배경 3·팀 8·제안·계약 규칙)·`RulesetSchema`·`loadRuleset`, 팩 0.1.0 진로 태그 수정 | Phase 0 종료 | 1 | done | PR #15 `dff279f`. 리뷰 1회(수정 1건: lower-league-skipped 분기). content 80 tests, 룰셋 checksum `852ab110…` |
| T-1-003 | ui | Radix RadioGroup·Dialog·Tabs 래핑, Stepper·ChoiceCard·CompareCards·StatusStrip·PlayerHeader·ResultCard·DashboardSection·CareerTimeline·Toast | Phase 0 종료 | 1 | done | PR #16 `cb7d932`. 리뷰 1회(수정 3건: 배포 경과 정책 우회 되돌림, PlayerHeader h2, CompareCards renderAction). ui 45 tests, 번들 91.81KB 불변 |
| T-1-004 | api | 복구 코드 발급·복구(RECOVERY_CONFLICT·병합)·프로필 삭제 2단계·로그아웃·커리어 삭제·rate limit·감사 로그 | Phase 0 종료 | 1 | done | PR #20 `4797827`. 리뷰 1회 통과. migration 0001, api 113 tests. 후속: recovery_code_hash 인덱스, 세션 미들웨어 프로필 조회 JOIN(결정 로그) |
| T-1-005 | domain | `ADVANCE` 제안 생성(offerRules)·`ACCEPT_OFFER`·Contract·golden 확장 | T-1-001, T-1-002 | 2 | done | PR #19 `1a0ffed`. 리뷰 1회(수정 1건: verifySnapshot 계약+OFFERS만 충돌). golden revision 10 `37cc92a1…`, 계약 CTR-10. domain 129 tests |
| T-1-015 | content | `buildConditionContext`·`selectEligibleEvents`·`loadContentPack`, 룰셋 스키마 ↔ domain 타입 바인딩, fixtures 룰셋 일치 테스트 | T-1-001, T-1-002 | 2 | done | PR #21 `8a9345f`. 리뷰 1회 통과(블로커 1건 결정: 일치 테스트는 규칙 값만 비교). content 159 tests |
| T-1-006 | contracts | 명령 payload 유니온 6종, Player/Offer/Contract/Pending/Timeline 스키마, 복구·삭제·로그아웃·MergeChoice 스키마 | T-1-005(타입은 T-1-001에 이미 있어 병행 투입, 머지 전 main 재병합) | 2 | done | PR #22 `e2d0602`. 리뷰 1회 통과(범위 밖 수정 1건 승인: api 테스트 헬퍼 payload). contracts 132 tests |
| T-1-007 | web | 엔진 배선(engine-client·LocalStore·Worker), 룰셋·팩 로딩, 온보딩 SCR-034, 허브 SCR-001 카드·이어하기·삭제, 라우트 골격, ui-store 영속화 | T-1-001, T-1-003, T-1-015 | 2 | done | PR #23 `b400922`. 리뷰 1회 통과. web 53 tests, e2e 11, 초기 청크 165KB gzip |
| T-1-010 | web(e2e) | Playwright + axe 도입, 허브·법적 문서 스모크·접근성, 브라우저 Web Worker state hash 검증(dev probe) | Phase 0 종료 | 1(첫 머지 후) | done | PR #18 `01d64e8`. 리뷰 1회 통과. 7 specs, axe serious·critical 0건, 브라우저 Worker 해시 = golden revision 8. 실행 `pnpm --filter @offside/web e2e` |
| T-1-008 | web | 선수 만들기 SCR-002·003·004 + 복구 코드 발급 단계 | T-1-002, T-1-004, T-1-006, T-1-007 | 3 | done | PR #25 `122144f`. 리뷰 1회(수정 3건: apiFetch Content-Type, 오류 화면 복귀 버튼). web 99 tests, e2e 18 |
| T-1-009 | web | SCR-007 진로, SCR-008 입단 테스트, SCR-013·014 이벤트·결과, SCR-009 제안 비교, SCR-010 계약, SCR-029 대시보드 | T-1-005, T-1-006, T-1-007 | 3 | done | PR #26 `b40c168`. 리뷰 2회(수정 4건: 진행·다음 실패 표시, 아키타입 한글명, 룰셋·라벨 중복 정리) + 재검증 1회(e2e typecheck). web 181 tests, e2e 25(first-contract 전 구간 3.4~5.5초) |
| T-1-011 | web + engine-client | 동기화 클라이언트 배선·상태 표시·충돌 화면, LOCAL 선택 fork-by-replay | T-0-015, T-1-007, T-1-008 | 3 | done | PR #30 `280e2f4`. 리뷰 2회(/review:pr 1 + 오케스트레이터 2: 새로고침 뒤 저장 상태 보정, 401 삭제 재시도, CORS X-Request-Id 범위 확장). web 139 tests, engine-client 65, api 113, e2e 24 |
| T-1-012 | web + platform + engine-client + api | SCR-030 데이터 섹션(복구 코드 재발급·복구 입력·복구 뒤 대조·프로필 삭제·로그아웃·기기 데이터 삭제), 법적 문서 본문, api 복구·삭제 라우트 contracts 스키마 채택 | T-1-004, T-1-006, T-1-007, T-1-011 | 4 | in-progress | `T-1-012-settings-data`, [브리프](briefs/T-1-012.md) |
| T-1-013 | api + web + platform + contracts | Google OIDC start/callback/merge/unlink(가짜 OIDC로 E2E), SCR-030 Google 행, 병합 선택 화면 | T-1-004, T-1-012, U-003(실검증) | 4 | todo | [브리프](briefs/T-1-013.md) |
| T-1-014 | web(e2e) + docs | TEST-E2E-007·008·009, 키보드 전용 주 여정, 5분 세션 측정, 허브 LCP·폰트 CLS 재측정, 완료 조건 표 | T-1-008, T-1-009, T-1-011, T-1-012 | 4 | todo | [브리프](briefs/T-1-014.md) |
| T-1-016 | domain + contracts + web + fixtures | 선수 성별 프로필 정보, 선호/현재 포지션 분리, 생성 화면·migration·결정론 fixture | T-1-009, T-1-011 | 4 | in-progress | `T-1-016-player-gender-position`, [브리프](briefs/T-1-016.md) |

## Phase 8 WORLD STAGE 백로그 (Phase 3~7 완료 후 착수)

| ID | 패키지 | 작업 | 선행 | 슬라이스 | 상태 |
|---|---|---|---|---|---|
| T-8-001 | domain + content + contracts | Country·League·Competition·Team 확장·RegistrationPolicy·AdaptationContext 스키마 | Phase 3, 4 | 8A | todo |
| T-8-002 | domain + fixtures | ruleset 1.x Team 호환 어댑터와 구 Snapshot/Archive hash 회귀 | T-8-001 | 8A | todo |
| T-8-003 | domain + content + contracts | 해외 제안 생성, 통화 비교 지수, 등록 자격·원자 계약 판정·계약 근거 보존 | T-8-001, T-8-002 | 8B | todo |
| T-8-004 | web + ui | SCR-035~037 세계 관심·해외 제안 비교·등록 결과 | T-8-003 | 8B | todo |
| T-8-005 | domain + content + web | 적응 Context, SCR-038, 원인 태그와 적응 이벤트 | T-8-003 | 8B | todo |
| T-8-006 | domain + content | 복수 Competition 일정·우선순위·기록 집계 | T-8-001, Phase 2 | 8C | todo |
| T-8-007 | web + content | SCR-039 국제 경기 챕터와 SCR-032 대표팀 연계 | T-8-005, T-8-006 | 8C | todo |
| T-8-008 | content + ui assets | 해외 2개국·4개 디비전·24개 가상 구단·대륙대회 첫 팩 | T-8-001, Phase 7 | 8B~C | todo |
| T-8-009 | domain + web + api | SCR-040, Timeline·Archive·Legacy 리그 정규화 | T-8-006, Phase 5 | 8C | todo |
| T-8-010 | e2e + docs | TEST-E2E-011~013, 접근성·결정론·마이그레이션·밸런스 게이트 | T-8-004~009 | 8D | todo |

초기 24개 구단 슬라이스가 완주·선택 분포 게이트를 통과한 뒤에만 5개 리그 스타일로 확장한다. 실명 라이선스는 이 백로그에 포함하지 않는다.

## Phase 2 백로그 (착수 순서, 투입은 Phase 1 종료 후)

계획·결정은 [phase-2-plan.md](phase-2-plan.md). Phase 2는 순차 Phase(도메인 Wave 1·2 순서대로, 화면·검증 Wave 3·4 병렬). Phase 3 이후는 [로드맵 "Phase 3 이후 병렬화"](../development/00-development-roadmap.md#phase-3-이후-병렬화).

| ID | 패키지 | 작업 | 선행 | Wave | 상태 | 메모 |
|---|---|---|---|---|---|---|
| T-2-001 | domain + content | FootballSeason·CompetitionRecord·12 step 캘린더, START_SEASON·SETTLE_SEASON, ADVANCE 재정의, checkpoint·결정 예산 | Phase 1 종료 | 1 | todo | |
| T-2-002 | domain + content | 팀 전술·경쟁자, Tactical Fit·Squad Status, RULE-PERF-001·RULE-SEL-001, golden fixture A·B | T-2-001 | 1 | todo | |
| T-2-003 | domain | 포지션별 경기 통계 generator, 0분·교체·퇴장·부상, FAST/CHAPTER 분포 동일성, 1,000회 hash | T-2-002 | 2 | todo | |
| T-2-004 | domain + content | 핵심 경기 챕터 선택·판단 resolver, 팩 `chapters` 스키마 + 3종 | T-2-003 | 2 | todo | |
| T-2-005 | domain | 시즌 집계·SeasonResult, 성장·폼·체력·사기 Effect, 원인 태그, 결산 hash | T-2-003, T-2-004 | 2 | todo | |
| T-2-006 | contracts + api + engine-client | CMD-SIM 스키마, 시즌·결산·EffectQueue 스키마, Snapshot 크기, 동기화 회귀, Worker 계산 시간 | T-2-001 | 2 | todo | |
| T-2-007 | web | SCR-005·011·029(advance·전술실)·033 | T-2-002, T-2-006 | 3 | todo | |
| T-2-008 | web | SCR-031 챕터·SCR-012 역할 변경·재생 복원 | T-2-004, T-2-006 | 3 | todo | |
| T-2-009 | web | SCR-015 시즌 결산·연대기 요약·응답 유실 복구 | T-2-005, T-2-006 | 3 | todo | |
| T-2-010 | content | 콘텐츠 팩 0.2.0(챕터 3종·시즌 이벤트, SHIPPABLE 항목만) | T-2-004, 콘텐츠 승격 | 4 | todo | `docs/content/kickoff/production-backlog.md` 상태 기준 후속(PR #26): previewEffects에 성장·출전·제안 범위 구조화 필드, EVT-CON-002 C 성장 기대 줄 누락, 태그 한글 라벨(라커룸이 id 노출). |
| T-2-011 | domain + web(e2e) | 포지션군 4종 완주 fixture, B > A, 집계, FAST 6분·CHAPTER 12분, TEST-E2E-002·010 | T-2-007~009 | 4 | todo | 후속(PR #30): createWorkerSimulator 타임아웃을 포트 전체 broken이 아니라 요청당 예산으로. fixtures eligibleEvents가 selectEligibleEvents 실제 후보군과 다름(PR #26 기록). |
| T-2-012 | api + web + platform | LINE TEST 준비: `svc_line_test`, 테스트 보관함, 분석 이벤트, 스테이징 배포 | T-2-011, T-0-010 | 4 | todo | U-002 필요 |
| T-2-013 | docs | LINE TEST 운영 계획·기준선 양식·완료 조건 표 | T-2-012 | 4 | todo | |
| T-2-014 | domain + contracts | Phase 3+ 공유 계약: Effect 만료·중첩, 시장가치 입력, CareerTag 인터페이스 | T-2-005 | 3 | todo | Phase 3·4 병렬의 전제 |

## 미니앱 출시 준비 백로그 (보류, 사용자 결정 시 착수)

선행: U-007 콘솔 등록(`appName` 확정). 리드타임은 등급분류(U-009) 10~15일과 콘솔 검토 2~4주. 코드 작업은 M-001~M-004이며 구조가 준비돼 있으면 각각 워커 1건 규모다.

| ID | 작업 | 참조 | 상태 |
|---|---|---|---|
| M-001 | `platform/toss` 실제 구현: `@apps-in-toss/web-framework` 3.x, 네이티브 Storage, 식별키, SafeArea·백버튼·종료 모달, `@apps-in-toss/devtools` 모킹 | ADR-009 | deferred |
| M-002 | `apps/web` toss 빌드 모드: `apps-in-toss.config.ts`, `pnpm build:toss` → `.ait`, CORS origin 4종, Pages `_headers` | ADR-009, ADR-007 | deferred |
| M-003 | `POST /auth/toss/session`: mTLS 바인딩 식별키 검증, `LocalProfile.tossAnonKeyHash` | ADR-008, ADR-009 | deferred |
| M-004 | CI: 태그에서 `ait deploy`, `ait sentry upload-sourcemap` | ADR-007 | deferred |
| M-005 | 콘솔 제출: 로고 600×600, 썸네일 1932×828, 스크린샷, 앱 정보·개인정보 URL, 등급분류 증빙 | 13, ADR-009 | deferred |
| M-006 | QR 실기기 체크리스트(08) 통과 → 검토 요청 → 출시 | 08, 09 | deferred |

## 진행 중

| ID | 워커 | 시작 | 상태 |
|---|---|---|---|
| T-1-012 | Sonnet 5, Orca 워크트리 `T-1-012-settings-data` | 2026-09-03 | 구현 완료·/review:pr 1회 끝. 복구 뒤 대조 실패를 경고 토스트로 알리고 "다시 연결"에 대조 추가하도록 지시(02:05), PR 준비 중 |
| T-1-016 | Sonnet 5, Orca 워크트리 `T-1-016-player-gender-position` | 2026-09-03 | 브리프 전달 |

## 완료

| ID | 내용 | 커밋 |
|---|---|---|
| D-001 | 문서 전체 검토와 보강(시간 모델·브랜드·시각 시스템·Legacy·화면 6종·종이 프로토타입) | 2f1e070 |
| D-002 | 기술 스택·인프라 ADR-001~009, 진행 관리 체계 | 805f346 |
| D-003 | 앱인토스 미니앱 ADR-009와 채널 반영, 콘솔 MCP 등록 | ce67e1f |
| D-004 | 미니앱은 "언제든 출시 가능한 구조"로 범위 조정, 출시 준비를 보류 백로그로 분리 | 이 커밋 |
| D-005 | WORLD STAGE 세계관·화면·데이터·검증 명세와 Phase 8 백로그 확정 | 이 PR |
| T-0-001 | 모노레포 골격과 패키지 의존 방향 lint (PR #1, 리뷰 2회, 워커 비용 약 $15) | e9d7d30 |
| T-0-002 | domain 결정론 코어 (PR #2, 리뷰 1회 통과, 워커 비용 약 $5) | fcb49d4 |
| T-0-009 | web 라우터·디자인 토큰·공통 상태 훅·허브 빈 상태 (PR #3, 리뷰 1회 통과, 워커 비용 약 $14) | fdb8a72 |
| T-0-003 | PR #4 `4693202` | 2026-09-02 | 약 $3. 리뷰 1회(수정 5건) |
| T-0-014 | PR #5 `6b8e1a3` | 2026-09-02 | 약 $1. 리뷰 1회 통과 |
| T-0-005 | PR #6 `9b292b1` | 2026-09-02 | 약 $7. 리뷰 1회(수정 2건) |
| T-0-004 | PR #7 `cfc868f` | 2026-09-02 | 약 $12. 리뷰 1회(수정 3건 + main 재병합 1회) |
| T-0-007 | PR #8 `9667dc7` | 2026-09-02 | 약 $8. 리뷰 1회 통과 |
| T-0-006 | PR #9 `483001b` | 2026-09-02 | 약 $9. 리뷰 1회(수정 1건) |
| T-0-011 | PR #10 `c45bede` | 2026-09-02 | 약 $3. 리뷰 1회 통과 |
| T-0-013 | PR #11 `acbfd1d` | 2026-09-02 | 약 $5. 리뷰 1회 통과(질문 2회 답변) |
| T-0-012 | PR #12 `675ac12` | 2026-09-02 | 약 $5. 리뷰 1회 통과 |
| T-0-008 | PR #13 `5969ec6` | 2026-09-02 | 약 $9. 리뷰 1회 통과 |
| T-0-015 | PR #14 `620a3fb` | 2026-09-02 | Sonnet 5 약 $10.7, 43분, 리뷰 1회(수정 3건) |
| T-1-002 | PR #15 `dff279f` | 2026-09-02 | Sonnet 5 약 $9.4, 26분, 리뷰 1회(수정 1건) |
| T-1-003 | PR #16 `cb7d932` | 2026-09-02 | Sonnet 5 약 $11.4, 39분, 리뷰 1회(수정 3건) |
| T-1-001 | PR #17 `3a8f7c8` | 2026-09-02 | Sonnet 5 약 $13.1, 43분, 리뷰 1회 통과 |
| T-1-010 | PR #18 `01d64e8` | 2026-09-02 | Sonnet 5 약 $5.9, 23분, 리뷰 1회 통과 |
| T-1-005 | PR #19 `1a0ffed` | 2026-09-02 | Sonnet 5 약 $9.9, 28분, 리뷰 1회(수정 1건) |
| T-1-004 | PR #20 `4797827` | 2026-09-02 | Sonnet 5 약 $11.6, 75분, 리뷰 1회 통과(응답 중단 1회 재개) |
| T-1-015 | PR #21 `8a9345f` | 2026-09-02 | Sonnet 5 약 $9.6, 48분, 리뷰 1회 통과(블로커 결정 1건) |
| T-1-006 | PR #22 `e2d0602` | 2026-09-02 | Sonnet 5 약 $10.5, 36분, 리뷰 1회 통과(범위 경계 질문 1건 답변) |
| T-1-007 | PR #23 `b400922` | 2026-09-02 | Sonnet 5 약 $28.1, 87분, 리뷰 1회 통과(워커가 허용되지 않은 gstack /review를 추가 실행해 비용 증가 — 결정 로그) |
| T-1-008 | PR #25 `122144f` | 2026-09-02 | Sonnet 5 약 $22.1, 78분, 리뷰 1회(수정 3건). 첫 세션 TUI 멈춤으로 같은 워크트리에 재투입 1회 |
| T-1-011 | PR #30 `280e2f4` | 2026-09-03 | Sonnet 5 약 $34.9, 123분, 리뷰 2회(필수 2건·권장 3건 + CORS 범위 확장). 재투입 없음 |
| T-1-009 | PR #26 `b40c168` | 2026-09-03 | Sonnet 5 약 $36.9, 353분(main 병합 2회·first-contract e2e 포함), 리뷰 2회(수정 4건) + 재검증 1회. 재투입 없음 |
