# 진행 보드

갱신: 2026-09-04. 상태는 `todo`, `in-progress`, `in-review`, `blocked`, `deferred`(사용자 결정 전 보류), `completed`.

## 현재 게이트

**Phase 0 코드 작업 종료(2026-09-02 저녁, PR #14).** 남은 Phase 0 항목 T-0-010(CI·배포)은 U-002 완료에 따라 2026-09-04 착수했다. Phase 순서 규칙(2026-09-02 사용자 결정)에 따라 Phase 1 Wave 1(T-1-001~004)과 Wave 2(T-1-005·006·015)를 투입했다. **Phase 1 코드 작업 종료(2026-09-03 12:12, PR #35).** T-1-009~017이 전부 머지돼 온보딩부터 첫 계약·대시보드, 복구 코드·프로필 복구·삭제, Google 연결·로그아웃, 성별·선호 포지션까지 브라우저에서 이어진다. [완료 조건 표](phase-1-completion.md) 15행 중 14행 ✅(#12는 오케스트레이터 수동 점검), #15 Google 실계정 검증만 U-003 대기. Phase 2 Wave 1 종료: T-2-001(시즌 구조, PR #36)·T-2-002(팀 전술·경쟁자·선발, PR #37)가 머지됐고 Wave 2로 T-2-003(경기 계산)·T-2-006(계약·동기화·크기)을 나란히 투입했다 — Phase 2는 순차(웨이브 안 병행)이며 계획·결정은 [phase-2-plan.md](phase-2-plan.md)(D-24~D-36). 사용자가 작성한 콘텐츠 정본 `docs/content/kickoff/`(PR #24)는 Phase 2 콘텐츠 작업의 입력이며 지금 코드 작업을 요구하지 않는다. 계획·결정은 [phase-1-plan.md](phase-1-plan.md). ADR-001~009 승인(2026-09-02). Phase 1 브리프는 미리 작성한다. 계정·프로토타입에 의존하지 않는 골격 작업(T-0-001~004, 007, 009)은 먼저 진행한다. CI 배포를 막던 Cloudflare 준비(U-002)는 완료됐고, 종이 프로토타입 기록(U-005)은 별도 사용자 액션으로 남아 있다. 앱인토스 출시 준비(U-007~U-011, M-001~M-006)는 사용자가 미니앱 출시를 결정할 때 착수한다. **Phase 2 Wave 2 종료(2026-09-03 19:05, PR #39).** 시즌 구조·전술/선발·경기 계산·계약/동기화 검증이 main에 있고, Wave 3 T-2-004(챕터)·T-2-005(결산·성장)를 병행 투입했고, 사용자의 '속도 올리자'(2026-09-03 저녁)에 따라 선행 작업이 머지되는 즉시 다음 작업을 투입한다(동시 3개 상한). T-2-007(시즌 화면)을 3번째 워커로 투입했고, **T-2-005(PR #40)가 먼저 머지**됐다. **Phase 2 Wave 3 종료(2026-09-03 22:03, PR #41)**: T-2-004(챕터)도 머지됐다. T-2-014(Phase 3+ 공유 계약)를 투입했고, T-2-007(시즌 화면, PR #42, 23:15)이 머지돼 T-2-008(챕터 화면)·T-2-009(결산 화면)를 투입했다(동시 3개: T-2-014·008·009). T-2-014(공유 계약, PR #43, 23:32)가 머지돼 Phase 3·4 병렬 투입의 전제가 닫혔다 — **ADR-010은 워커 작성본이라 사용자 승인 대기(U-012)**. 2026-09-04 01:20 PR #44(T-2-008) 검증 체인에서 e2e 2건이 실패(season.spec 이중 클릭 TOCTOU, chapter.spec 0분 시즌으로 데뷔 챕터 미발생)해 워커에게 수정을 요청했고(TUI 멈춤으로 터미널 재투입), PR #45(T-2-009)는 #44 뒤 main 머지 대기. 01:31 T-2-011(Phase 2 완료 조건 검증)을 3번째 워커로 투입 — 도메인 항목 먼저, web 항목은 #44·#45 머지 뒤. **PR #44(T-2-008 챕터 화면, `4f11110`) 01:56 머지** — 챕터가 브라우저에서 열리고 판단→결과→재생까지 e2e 62 통과. **PR #45(T-2-009 결산 화면, `1065272`) 02:08 머지** — Phase 2 화면 작업(T-2-007·008·009)이 전부 main에 있어 계약→프리시즌→시즌 12 step(챕터 포함)→결산→다음 시즌이 브라우저에서 이어진다(e2e 66 통과). 남은 Phase 2: T-2-011(진행 중, web 항목 착수)·T-2-010(콘텐츠, U-005 대기). 동시 워커 1개. 02:18 **Phase 3·4 병렬 계획 초안**([phase-3-4-plan.md](phase-3-4-plan.md), D-43~D-53, T-3-001~006·T-4-001~006) 작성 — 투입은 Phase 2 종료·U-012 승인 뒤, 브리프는 미리 쓴다. **PR #47(T-2-011 Phase 2 완료 조건 검증, `0c27965`) 03:41 머지 — Phase 2 코드 작업 종료.** [완료 조건 표](phase-2-completion.md) 9행 전부 자동 검증(fixture 3종·결정론·집계·B > A·세션 측정·e2e 68건 3회 무결점), 후속 정리 a·b·d 처리. 남은 Phase 2는 사용자 게이트: T-2-010(콘텐츠, U-005)·T-2-012(LINE TEST, U-002)·T-2-013(012 뒤). 동시 워커 0개. Phase 3·4 투입은 U-012(ADR-010 승인)·U-013 확인 뒤이며 T-3-001 브리프를 먼저 쓴다. **2026-09-04 오전 사용자 결정**: PR #46(T-0-010 Cloudflare 배포 파이프라인, `abf9bfa`) 머지 승인, ADR-010 설계 승인(U-012), 이벤트 문구 `PROTOTYPE` 허용(U-013 (A)), 가상 구단 12개 확장. 이에 따라 **T-2-012(LINE TEST 준비)·T-3-001(Phase 3·4 타입 슬라이스)** 를 10:07 나란히 투입(동시 2개). T-3-001 머지 뒤 T-4-001·T-3-002·T-3-006. **T-0-010 completed(10:40)**: staging 자동 배포·smoke 통과 — Phase 0 전 항목 종료. **T-3-001 머지(2026-09-04 11:43, PR #48 b756999) — Phase 3·4 병렬 투입 시작**: T-4-001(트랙 B 타입)·T-3-002(이적시장 생성기) 먼저, T-3-006(팩 0.2.0·팀 12)은 T-2-012 머지 뒤(동시 워커 3개 상한). **T-2-012 머지(2026-09-04 12:18, PR #49 c90b769)** — LINE TEST 코드 준비 끝. 남은 것: staging `svc_line_test` 응답 확인, U-014(Paid 플랜), T-2-013(운영 계획, docs). T-3-006 투입(12:21, 동시 워커 3개: T-4-001·T-3-002·T-3-006). T-2-013(LINE TEST 운영 계획, docs) 완료 — Phase 2 남은 것은 T-2-010(U-005)과 LINE TEST 게이트([line-test-plan.md](line-test-plan.md) 7행, U-014·U-015). **staging 확인·예행(12:34~12:56)**: `svc_line_test` 정상 반환, 온보딩→계약→FAST·CHAPTER 시즌 완주 통과. 결함 3건(20건 배치 503 = D1 변수 100개 상한, 오류 본문 SQL 노출, 온보딩 안내 없음) → T-2-015 브리프, 첫 워커 종료 뒤 최우선 투입. **T-3-006 머지(13:01, PR #51 31e321d)**, PR #50(T-3-002) 수정 요청 1건 진행 중, T-2-015 투입(13:02). 동시 워커 3개: T-4-001·T-3-002·T-2-015.

WORLD STAGE 세계관 확장은 2026-09-03 승인된 Phase 8 후속 범위다. 현재 Phase 1~7의 국내 MVP 순서를 바꾸지 않으며, Phase 3~5와 Phase 7 완료 후 새 ruleset의 신규 Career에 해외 이적·가상 해외 리그·대륙대회를 연다. 정본은 [WORLD STAGE 개발 명세](../development/15-world-stage-expansion.md)와 [Phase 8](../phases/phase-08-world-stage.md)이다.

## 사용자 액션

| ID | 내용 | 상태 | 메모 |
|---|---|---|---|
| U-001 | 도메인 구매, 네임서버를 Cloudflare로 | todo | ADR-006 후보 참고 |
| U-002 | Cloudflare 계정·최소 권한 API 토큰·환경별 D1 준비 | completed | 2026-09-04. GitHub Secrets 2종 등록, APAC D1 `offside-preview`·`staging`·`production` 생성. Free 플랜 유지 |
| U-003 | Google Cloud 프로젝트에서 OAuth 클라이언트 ID·시크릿 발급 | todo | ADR-008. 콜백 URL은 도메인 확정 후. 코드는 PR #33으로 준비됨(가짜 OIDC 검증 완료) — ID·시크릿은 `wrangler secret put`, 발급 뒤 오케스트레이터가 실계정 검증 |
| U-004 | Sentry 프로젝트 생성, DSN 등록 | todo | ADR-007 |
| U-005 | 종이 프로토타입 3회 플레이, `docs/content/prototype/playtest-log.md` 작성 | todo | 양식 제공됨(2026-09-02). 회차별 시트와 3회 합산 답만 채우면 된다. 고정 seed 3종 키트는 `docs/content/kickoff/paper-playtest-kit.md`(PR #24) |
| U-006 | ADR-001~009 검토·승인 또는 반려 | completed | 2026-09-02 승인 |
| U-007 | 앱인토스 콘솔 가입(토스 비즈니스, 만 19세), 워크스페이스·제작자 이름, 앱 등록(유형 **게임**, `appName` 확정), 고객문의 이메일 | deferred | ADR-009, ADR-006. appName은 변경 불가 |
| U-008 | 앱인토스 서버 mTLS 인증서 발급 → `wrangler mtls-certificate upload`, certificate_id 공유 | deferred | ADR-007. U-002·U-007 이후 |
| U-009 | 게임물 등급분류 신청(GRAC, 스토어명 `기타-앱인토스`). 개인 신청 가능 여부 먼저 확인 | deferred | ADR-009. 10~15일 + 수수료. 증명서 PDF를 콘솔에 등록 |
| U-010 | 약관·개인정보 처리방침 최종 문안 검토, 사업자명·문의 이메일·시행일 확정(`apps/web/src/legal/operator.ts`) | todo | D-20. 초안 완료(PR #31, `apps/web/src/legal/privacy.tsx`·`terms.tsx`, 연락처는 "준비 중"으로 표시). 사용자가 문안·사업자명·문의 이메일·시행일을 정하면 오케스트레이터가 반영 작업을 만든다. 출시 전 필수 |
| U-010 | 이 세션에서 `/mcp` → `apps-in-toss-console` 인증 완료 | deferred | 서버는 등록됨, OAuth 로그인만 남음 |
| U-011 | (U-009에서 개인 신청 불가 시) 개인사업자 등록 후 콘솔 사업자 등록 | deferred | 조건부. 면세 사업자 불가 |
| U-013 | Phase 3·4 워커의 이벤트 문구 `PROTOTYPE` 작성 허용 여부, 가상 구단 8→12 확장 | completed | 2026-09-04 오전: (A) 워커가 메커니즘 검증용 최소 문구를 `PROTOTYPE`·`playtested: false`로 작성, 정식 문구는 콘텐츠 승격 뒤 교체. 가상 구단 12개로 확장(T-3-006) |
| U-012 | ADR-010(Phase 3+ 공유 계약: Effect 규칙·시장가치 입력·CareerTag) 검토·승인 | completed | 2026-09-04 오전 설계 승인(사용자). PR #43 코드는 이미 main. T-3-001 투입 |
| U-014 | Workers Paid 플랜으로 전환 | todo | LINE TEST 공개 직전(T-2-012 코드는 2026-09-04 머지됨). 개발·PR preview·내부 staging은 Free 유지 |
| U-015 | LINE TEST 테스터 모집(10~30명)·안내문 발송·피드백 채널 결정 | todo | [line-test-plan.md](line-test-plan.md) 2·4절. 일정 제안 2026-09-08 시작, 2주. 오케스트레이터가 staging 예행(FAST·CHAPTER 1시즌)을 먼저 끝낸다 |
| U-016 | 오케스트레이터 기기 wrangler 로그인(LINE TEST 기준선 D1 조회용) | todo | 이 세션에서 `! pnpm --filter @offside/api exec wrangler login` 1회(브라우저 OAuth). 2026-09-04 12:32 토큰 만료 확인. 로그인 전에는 D1 건수 확인 불가 |

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
| T-0-010 | GitHub Actions CI, 웹 Static Assets·API Workers preview 배포, staging migration | ADR-007 | completed | PR #46 `abf9bfa`(2026-09-04 09:59 머지, 사용자 승인). main 푸시 staging 자동 배포 성공(run 33824576382, Deploy staging success)·smoke 200/200 확인(10:40). [브리프](briefs/T-0-010.md). 후속: `docs/**` paths-ignore |
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
| T-1-012 | web + platform + engine-client + api | SCR-030 데이터 섹션(복구 코드 재발급·복구 입력·복구 뒤 대조·프로필 삭제·로그아웃·기기 데이터 삭제), 법적 문서 본문, api 복구·삭제 라우트 contracts 스키마 채택 | T-1-004, T-1-006, T-1-007, T-1-011 | 4 | done | PR #31 `1e97406`. 리뷰 1회(/review:pr 1 + 오케스트레이터 필수 2건: 대조 부분 실패 집계·실패 경로 캐시 갱신) + 범위 확장 1건(대조 실패 토스트·"다시 연결" 대조). web 203 tests, api 114, e2e 37+1(실제 api 복구 왕복) |
| T-1-013 | api + web + platform + contracts | Google OIDC start/callback/merge/unlink(가짜 OIDC로 E2E), SCR-030 Google 행, 병합 선택 화면 | T-1-004, T-1-012, U-003(실검증) | 4 | done | PR #33 547686c, [브리프](briefs/T-1-013.md). 실계정 검증은 U-003 뒤 |
| T-1-014 | web(e2e) + docs | TEST-E2E-007·008·009, 키보드 전용 주 여정, 5분 세션 측정, 허브 LCP·폰트 CLS 재측정, 완료 조건 표 | T-1-008, T-1-009, T-1-011, T-1-012 | 4 | done | PR #34 2bbfdf0, [브리프](briefs/T-1-014.md), [완료 조건 표](phase-1-completion.md). 미구현분은 T-1-017 |
| T-1-016 | domain + contracts + web + fixtures | 선수 성별 프로필 정보, 선호/현재 포지션 분리, 생성 화면·migration·결정론 fixture | T-1-009, T-1-011 | 4 | done | PR #32 4eb8112, [브리프](briefs/T-1-016.md) |
| T-1-017 | web + ui | Phase 1 완료 조건 보완: SCR-002 포지션 탭 키보드 도달(출시 차단), 선호/주포지션 구분 표시, 국외 이전 표, 결과 aria-live, COMMITTING 이탈 경고, careerPhase 상수 | T-1-014 | 3 | done | PR #35 d5fbf11, [브리프](briefs/T-1-017.md) |

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
| T-2-001 | domain + content | FootballSeason·CompetitionRecord·12 step 캘린더, START_SEASON·SETTLE_SEASON, ADVANCE 재정의, checkpoint·결정 예산 | Phase 1 종료 | 1 | done | PR #36 a806e21, [브리프](briefs/T-2-001.md) |
| T-2-002 | domain + content | 팀 전술·경쟁자, Tactical Fit·Squad Status, RULE-PERF-001·RULE-SEL-001, golden fixture A·B | T-2-001 | 1 | done | PR #37 41b89e6, [브리프](briefs/T-2-002.md) |
| T-2-003 | domain | 포지션별 경기 통계 generator, 0분·교체·퇴장·부상, FAST/CHAPTER 분포 동일성, 1,000회 hash | T-2-002 | 2 | done | PR #39 4409052, [브리프](briefs/T-2-003.md) |
| T-2-004 | domain + content | 핵심 경기 챕터 선택·판단 resolver, 팩 `chapters` 스키마 + 3종 | T-2-003 | 2 | done | PR #41 7859e8a, [브리프](briefs/T-2-004.md) |
| T-2-005 | domain | 시즌 집계·SeasonResult, 성장·폼·체력·사기 Effect, 원인 태그, 결산 hash | T-2-003, T-2-004 | 2 | done | PR #40 eaeb6cf, [브리프](briefs/T-2-005.md) |
| T-2-006 | contracts + api + engine-client | CMD-SIM 스키마, 시즌·결산·EffectQueue 스키마, Snapshot 크기, 동기화 회귀, Worker 계산 시간 | T-2-001 | 2 | done | PR #38 6f2f00e, [브리프](briefs/T-2-006.md) |
| T-2-007 | web | SCR-005·011·012·029(시즌화·전술실)·033, e2e 포트 override | T-2-002, T-2-006 | 3 | done | PR #42 4feeb15, [브리프](briefs/T-2-007.md) |
| T-2-008 | web | SCR-031 챕터·chapterCandidates 전달·재생 복원(SCR-012는 T-2-007로 이동) | T-2-004, T-2-007 | 3 | done | PR #44 4f11110, [브리프](briefs/T-2-008.md) |
| T-2-009 | web | SCR-015 시즌 결산(+SCR-006)·연대기 요약·응답 유실 복구 | T-2-005, T-2-007 | 3 | done | PR #45 1065272, [브리프](briefs/T-2-009.md) |
| T-2-010 | content | 콘텐츠 팩 0.2.0(챕터 3종·시즌 이벤트, SHIPPABLE 항목만) | T-2-004, 콘텐츠 승격 | 4 | todo | `docs/content/kickoff/production-backlog.md` 상태 기준 후속(PR #26): previewEffects에 성장·출전·제안 범위 구조화 필드, EVT-CON-002 C 성장 기대 줄 누락, 태그 한글 라벨(라커룸이 id 노출). |
| T-2-011 | domain + web(e2e) | 포지션군 4종 완주 fixture, B > A, 집계, FAST 6분·CHAPTER 12분, TEST-E2E-002·010 | T-2-007~009 | 4 | done | PR #47 0c27965, [브리프](briefs/T-2-011.md), [완료 조건 표](phase-2-completion.md). 후속 PR #30 타임아웃(요청당 예산)·PR #26 eligibleEvents(EVT-REL-001 가중치 관찰 → T-2-010 입력) 처리 |
| T-2-012 | api + web + platform | LINE TEST 준비: 서비스 시즌 포인터·`svc_line_test` 테스트 보관함·분석 이벤트 수집·스테이징 시드 | T-2-011, T-0-010 | 4 | done | PR #49 c90b769(2026-09-04 12:18), [브리프](briefs/T-2-012.md), D-54·D-55. 리뷰 수정 0건, 실 api e2e 7건 통과. Orca PR 게이트(`gh pr create` 차단)로 오케스트레이터가 GitHub API로 PR 개설. 후속: staging `svc_line_test` 확인, U-014, T-2-013 |
| T-2-013 | docs | LINE TEST 운영 계획·기준선 양식·완료 조건 표 | T-2-012 | 4 | done | [line-test-plan.md](line-test-plan.md)(2026-09-04 오케스트레이터 작성): 일정 제안 09-08~09-21, 측정 쿼리 7종, 기준선 양식, 게이트 완료 조건 7행. 공개 전 사용자 할 일 U-014·U-015 |
| T-2-015 | api + web | 분석 이벤트 삽입 D1 변수 상한 청크(예행 503), 알 수 없는 오류 메시지 고정(SQL 노출), 온보딩 LINE TEST 안내 | T-2-012 | 4 | done | PR #52 5462dc7(2026-09-04 13:21), [브리프](briefs/T-2-015.md). 14행 청크 순차 insert·고정 문구·`onboarding-service-season-notice`. 리뷰 수정 0건, 실 api e2e 8건 포함 녹색. 후속: staging 재예행 |
| T-2-014 | domain + contracts | Phase 3+ 공유 계약: Effect 만료·중첩, 시장가치 입력, CareerTag 인터페이스, ADR-010 | T-2-004, T-2-005 | 3 | done | PR #43 dd480a2, [브리프](briefs/T-2-014.md) |

## Phase 3·4 백로그 (계획 초안 2026-09-04, 투입은 Phase 2 종료·U-012 승인 후)

계획·결정(D-43~D-53)은 [phase-3-4-plan.md](phase-3-4-plan.md). 트랙 A(계약·임대·이적)와 트랙 B(부상·관계·평판)를 병렬로 돌리되 타입 슬라이스(T-3-001 → T-4-001)는 순차. 동시 워커 3개.

| ID | 트랙 | 영역 | 내용 | 선행 | 상태 | 비고 |
|---|---|---|---|---|---|---|
| T-3-001 | A | domain + contracts + content | 계약·제안 v2 타입, clubHistory, 제안 상태기계, 타임라인 kind 예약(양 트랙), DSL contract.*, CON payload 스키마 | U-012 | done | PR #48 b756999(2026-09-04 11:43), [브리프](briefs/T-3-001.md). 리뷰 수정 1건(`contract.isLastSeason` 의미), 골든 9종 재기록(draws 불변) |
| T-3-002 | A | domain + content | 결산 뒤 이적시장 생성(D-43·D-44), 안전 잔류 제안, step 7 사전 협상, offerRulesV2·transferRules | T-3-001 | done | PR #50 408a765(2026-09-04 13:33), [브리프](briefs/T-3-002.md). 리뷰 수정 1건(결산 뒤 STARTER·평점 INTEREST 분기 도달 불가 → `currentSquadPerformance` 폴백). 워커 결정 3건 수용. 결산 배선·명령은 T-3-003 |
| T-3-003 | A | domain + 룰셋 필드 + web 최소 배선 | NEGOTIATE·ACCEPT_OFFER v2·REJECT_OFFER·LOAN_RETURN, 원자 전환(D-45), 임대(D-46), 약속 위반(D-47), 태그 5종(D-48), 결산 배선, golden career-10·11 | T-3-002 | in-progress | `T-3-003-market-commands`, [브리프](briefs/T-3-003.md)(13:20 작성, 2026-09-04 13:34 투입, E2E_PORT 5194). `parentContract` 추가(골든 9종 hash 갱신), `imposedPositionProficiency`·`promotionSlots` 룰셋 필드, 웹은 SCR-009 재사용 라우팅만. |
| T-3-004 | A | contracts + api + engine-client | payload·상태 strict 검증, 동기화 회귀, Snapshot 크기 | T-3-003 | todo | |
| T-3-005 | A | web | SCR-017 계약 상태·제안 비교·협상, SCR-019 루머, SCR-020 이적·임대 결과, TEST-E2E-003 | T-3-003, T-3-004 | todo | |
| T-3-006 | A | content | 루머·잔류·에이전트 이벤트, 협상·이적 문구, 팀 풀 확장(열린 질문) | T-3-001 | done | PR #51 31e321d(2026-09-04 13:01), [브리프](briefs/T-3-006.md). 팩 0.2.0 등록(활성 0.1.0 유지)·PRO 이벤트 5종 PROTOTYPE·팀 12·authoring 스키마·agent 토큰. 리뷰 수정 0건. 후속: web narrative.ts에 `agent` 토큰(T-3-005) |
| T-4-001 | B | domain + contracts + content | 관계 로그·감독·부상·평판 타입, HEALTH Effect(ADR-010 표 갱신), RESOLVE_EVENT의 INJURY·NATIONAL_TEAM 수용(D-52), 훅 골격 | U-012, T-3-001 | done | PR #53 aba154a(2026-09-04 13:57), [브리프](briefs/T-4-001.md). 리뷰 수정 0건. main 재머지 2회(PR #50 충돌 해결), 재기록 골든 미커밋(PLACEHOLDER)을 오케스트레이터 체인이 잡아 추가 커밋. 후속: T-4-002(부상)·T-4-003(관계) 브리프 |
| T-4-002 | B | domain + content | 부상 모델(D-49): 심각도·부위·진단 범위·재활 선택·재발·후유증, 강제 사건 상한, career-12-injury | T-4-001 | todo | |
| T-4-003 | B | domain + content | 감독 교체·라커룸·슬럼프·윤리·SNS 이벤트 pool, popularityCenti, 관계 로그, 안전장치, 태그 5종(D-50) | T-4-001 | todo | T-4-002와 병행 |
| T-4-004 | B | domain + content | 대표팀 차출 기본 모듈(D-51), NATIONAL_DEBUT 챕터 | T-4-002, T-4-003 | todo | |
| T-4-005 | B | web | SCR-016·018·021·022·024·032, 라커룸·휴대폰 관계 수치 점진 공개, SCR-023 경기 판단 변형, TEST-E2E-004 | T-4-004 | todo | |
| T-4-006 | A+B | domain + web(e2e) | 트랙 통합 검증: 3시즌 fixture, OVR 불변 property, 결정 예산·세션 길이, e2e 3회, 완료 조건 표 | T-3-005, T-4-005 | todo | |

## 미니앱 출시 준비 백로그 (보류, 사용자 결정 시 착수)

선행: U-007 콘솔 등록(`appName` 확정). 리드타임은 등급분류(U-009) 10~15일과 콘솔 검토 2~4주. 코드 작업은 M-001~M-004이며 구조가 준비돼 있으면 각각 워커 1건 규모다.

| ID | 작업 | 참조 | 상태 |
|---|---|---|---|
| M-001 | `platform/toss` 실제 구현: `@apps-in-toss/web-framework` 3.x, 네이티브 Storage, 식별키, SafeArea·백버튼·종료 모달, `@apps-in-toss/devtools` 모킹 | ADR-009 | deferred |
| M-002 | `apps/web` toss 빌드 모드: `apps-in-toss.config.ts`, `pnpm build:toss` → `.ait`, CORS origin 4종, Static Assets `/content/*` handler | ADR-009, ADR-007 | deferred |
| M-003 | `POST /auth/toss/session`: mTLS 바인딩 식별키 검증, `LocalProfile.tossAnonKeyHash` | ADR-008, ADR-009 | deferred |
| M-004 | CI: 태그에서 `ait deploy`, `ait sentry upload-sourcemap` | ADR-007 | deferred |
| M-005 | 콘솔 제출: 로고 600×600, 썸네일 1932×828, 스크린샷, 앱 정보·개인정보 URL, 등급분류 증빙 | 13, ADR-009 | deferred |
| M-006 | QR 실기기 체크리스트(08) 통과 → 검토 요청 → 출시 | 08, 09 | deferred |

## 진행 중

| ID | 워커 | 시작 | 상태 |
|---|---|---|---|
| T-3-003 | Sonnet 5, Orca 워크트리 `T-3-003-market-commands` | 2026-09-04 | NEGOTIATE·ACCEPT_OFFER v2·REJECT_OFFER·LOAN_RETURN·결산 배선·임대·약속 위반·태그 5종·골든 career-10·11, 웹 SCR-009 재사용 라우팅 |

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
| T-1-012 | PR #31 `1e97406` | 2026-09-03 | Sonnet 5 약 $20.7, 448분(질문 대화상자 대기 약 7시간 포함, 실작업 약 1시간 반), 리뷰 1회(필수 2건) + 질문 1회. 재투입 없음 |
| T-1-016 | 선수 성별·선호/현재 포지션 프로필 계약, golden 갱신(PR #32, 리뷰 수정 0건, 워커 비용 약 $15.7, 43분) | 4eb8112 |
| T-1-013 | Google OIDC 연결·병합·해제, SCR-030 Google 행·로그아웃, 가짜 OIDC e2e(PR #33, 리뷰 수정 0건, 워커 비용 약 $22.2, 79분) | 547686c |
| T-1-014 | Phase 1 E2E 완료 조건 측정(resilience·recovery-conflict·session-length·keyboard·a11y 확장·perf), 완료 조건 표 15행(PR #34, 리뷰 수정 0건, 워커 비용 약 $19.8, 80분) | 2bbfdf0 |
| T-1-017 | Phase 1 완료 조건 보완: 포지션 탭 키보드 도달·선호/주포지션 표시·국외 이전 표·결과 aria-live·COMMITTING 이탈 경고(PR #35, 리뷰 수정 0건, 워커 비용 약 $12.2, 51분) | d5fbf11 |
| T-2-001 | 시즌 구조: FootballSeason·12 step 캘린더·START_SEASON/SETTLE_SEASON·ADVANCE 재정의·결정 예산·STEP_BOUNDARY, golden career-02-season FAST·CHAPTER(PR #36, 리뷰 수정 4건, 워커 비용 약 $24.3, 102분) | a806e21 |
| T-2-002 | 팀 전술 스타일 3종·리그 4·FA컵·경쟁자 8×2·Tactical Fit·Squad Status·Selection Score(RULE-SEL-001)·step-1 역할 제안 RESOLVE_ROLE·전술실 뷰, golden career-02(RESOLVE_ROLE)·career-03-underdog(OVR 58 선발)(PR #37, 리뷰 수정 3건, 워커 비용 약 $30.6, 109분) | 41b89e6 |
| T-2-006 | 계약·동기화 검증 체인: contracts golden 순회(strict 파싱+재해시)·목록 가드, Snapshot·PUT 크기 측정(최대 15.3 KB, 예산 6%), api 3경로 시즌 동기화·Miniflare 순회, engine-client replay·fork·import 시즌 golden, 로컬 저장 checkpoint 계약, 브라우저 Worker 시즌 리플레이 9.6~15 ms(PR #38, 리뷰 수정 2건, 워커 비용 약 $11.3, 114분) | 6f2f00e |
| T-2-003 | 경기 계산 generator: 일정(roll 없음)·팀 결과·선발·출전 시간·관여량·포지션군 통계·평점(×10 정수)·카드·부상 이탈·시즌 누계·리그 순위·컵 진행, 경기 전용 RNG 스트림(D-37), 룰셋 matchRules, golden career-04-gk 신규·02·03 재기록, FAST 시즌 domain 7.4 ms(PR #39, 리뷰 수정 2건 + PR #38 후속, 워커 비용 약 $42.7, 128분) | 4409052 |
| T-2-005 | 시즌 결산: SeasonResult(팀 성적·개인 통계·성장 Δ·원인 태그·hash)·성장식(D-39: 연령대 예산·잠재력 gap·출전 계수·경험 보너스·훈련 집중, 밸런스 표 200 seed×3 연령 통과)·폼/체력/사기 매 step 갱신(conditionRules)·출전 약속 이행·DEFERRED 효과의 시즌 단위 적용(season.scheduledEffects)·golden career-06-settled(PR #40, 리뷰 수정 2건, 워커 비용 약 $37.6, 139분) | eaeb6cf |
| T-2-004 | 핵심 경기 챕터: 후보 선택(`ADVANCE.chapterCandidates`, roll 없음, 0분 경기 제외, FAST는 MAJOR만, MAJOR>weight>id)·`RESOLVE_CHAPTER` resolver(판단당 roll 1회, 재전송 거부, 평점 ±1.5 clamp)·`ChapterRecord`·`resolvedChapterIds`(`id@season`)·팩 chapters 스키마(CURRENT/RELATION/DEFERRED만, ±12, priorProbability ±500bp)·CHP-MATCH-001/002/004·리그 라이벌/승격·강등 정보·`selectChapterCandidates`·golden career-05-chapter(PR #41, 리뷰 수정 1건 + main 머지 placeholder 교체, 워커 비용 약 $45.8, 177분) | 7859e8a |
| T-2-007 | 시즌 화면: SCR-005 프리시즌 계획(모드 기본값 RULE-TIME-003·훈련 계획 4종→trainingFocus)·SCR-011 시즌 준비·SCR-012 역할 제안(KEEP/POSITION_CHANGE/ROLE_CHANGE→RESOLVE_ROLE)·SCR-029 대시보드 시즌화(다음 결정 카드·일정표·전술실)·SCR-033 능력치 상세(truePotential 미노출)·SCR-031/015 자리표시·startSeason/resolveRole/settleSeason 액션·playwright E2E_PORT·e2e season/a11y 6개(PR #42, 리뷰 수정 0건, 워커 비용 약 $27.6, 111분) | 4feeb15 |
| T-2-014 | Phase 3+ 공유 계약(ADR-010): Effect kind→타깃 소유권·ONCE_PER_SEASON·AT_SEASON_END/SEASONS_AFTER 만료·REPLACE 복원·reasonTag·결산 직전 만료(D-40), 시장가치 지수 순수 함수·marketValueRules·truePotential 배제(D-41), CareerTag 16종·grant/evaluate·결산 훅·평가기 3종(D-42), RESOLVE_CHAPTER outcomes.kind·ChapterRecord.trigger/outcomeKind(PR #43, 리뷰 수정 2건, 워커 비용 약 $24.8, 84분) | dd480a2 |
| T-2-008 | 핵심 경기 챕터 화면 SCR-031: advance()가 selectChapterCandidates→ADVANCE.chapterCandidates를 채워 챕터가 실제로 열림·경기 전 맥락(트리거·상대·출전·선발 사유·감독 지시)·스코어보드(D-30 표시 전용, OffsideLine 320ms)·판단 1~3(ChoiceCard→RESOLVE_CHAPTER, outcomes.kind)·ResultCard·경기 결과(평점 변화·태그)·deriveChapterView 새로고침/뒤로 가기 재생(roll 미소비, revision 불변)·chapter e2e(TEST-E2E-010)·a11y SCR-031·season.spec CHAPTER-aware 헬퍼·e2e 결정론(exact locator·step 변화 대기, DEV 전용 시드 오버라이드 `offside:e2e-seed`)(PR #44, 리뷰 수정 0건 + 검증 e2e 결함 2건 수정, 워커 비용 약 $30.0, 140분) | 4f11110 |
| T-2-009 | 시즌 결산 화면 SCR-015(+SCR-006 유소년 변형): deriveSeasonResultView(공통 지표·포지션 카드·팀 성적·역할 시작/종료·출전 약속·챕터)·OVR 변화(원인 태그·가장 큰 원인)와 경기 예상치 변화(폼·체력·사기·감독 신뢰, 경계 회귀 캡션) 분리(D-29)·CompareCards(지난 시즌/계약 약속, 차이만 보기)·CountUp(data-value 확정값·건너뛰기·모션 감소)·결산 응답 유실 복구(commandId 멱등, 같은 result.hash)·대시보드 다이어리 연대기(시즌 N 결산 보기)·e2e season-result.spec(TEST-E2E-002)·a11y SCR-015·main(PR #44) 머지 시 e2e 헬퍼를 helpers/player-creation.ts로 통합(PR #45, 리뷰 수정 0건, 워커 비용 약 $33.6, 165분) | 1065272 |
| T-2-011 | Phase 2 완료 조건 검증 9/9: 포지션군 fixture 3종(career-07-df·08-mf·09-fw)+golden·fixtures export·contracts 크기/스키마·api Node↔workerd 해시, 시즌 결정론(같은 시드 stateHash 일치)·집계(playerStats ↔ matches 재합산), career-03-underdog 시즌 완주 shadow-replay(선수 START > COMP-W-2), selection A/B 시즌(B > A), session-length e2e FAST·CHAPTER 시즌 완주 시간·명령 수, chapter e2e rngState.draws 새로고침 전후 비교(TEST-E2E-010), e2e 68건 3회 무결점, 후속 (a) truePotential ≥ baseOvr+1 (b) 워커 타임아웃 요청당 예산 (d) TrainingFocus 재수출(PR #47, 리뷰 수정 0건, 워커 비용 약 $26.1, 122분) | 0c27965 |
| T-3-001 | Phase 3·4 타입 슬라이스(D-53): Offer/Contract v2·ClubStint·MarketSummary, pending OFFERS/CONTRACT/LOAN_RETURN/INJURY/NATIONAL_TEAM, 타임라인 kind 15종 예약, 제안 상태기계 함수(negotiation.ts), Command NEGOTIATE·REJECT_OFFER·LOAN_RETURN 스텁 + payload 스키마, DSL contract.* 등 15경로(트랙 B는 NOT_MODELED), 이벤트 presentation 필터, SeasonResult.stepSummaries(11), 골든 9종 재기록(draws 불변) | b756999 |
| T-2-012 | LINE TEST 준비(D-54·D-55): API `ACTIVE_SERVICE_SEASON_ID` 포인터(local/preview `svc_kickoff`, staging `svc_line_test`, production 미설정→503), `GET /v1/service-seasons/current`(status·isTest·notice), 신규 커리어 생성 시 시즌 상태 검사(LOCKED/ARCHIVED 409), `service_seasons.is_test`·`analytics_events` 마이그레이션 0003, `POST /v1/analytics/events`(12개 이벤트 화이트리스트·32KB·50건·rate limit 60/분·익명 clientId), platform 분석 큐(배치 20/10초/pagehide, sendBeacon→fetch keepalive), web `useServiceSeason`(kv 캐시·폴백)·허브 LINE TEST 배너·테스트 시즌 배지·LOCKED 시 생성 비활성·퍼널/결산/이탈 이벤트, e2e service-season 4종. 리뷰 수정 0건 | c90b769 |
| T-2-013 | LINE TEST 운영 계획(line-test-plan.md): 환경·일정·준비 체크리스트·테스터 안내문·D1 측정 쿼리 7종·기준선 기록 양식·게이트 완료 조건 7행. 종료는 시드 status LOCKED PR로 | 이 커밋 |
| T-4-001 | 트랙 B 타입 슬라이스(D-49~D-53): InjuryEpisode·RehabPlan·NationalTeamCallUp·SeasonManager·RelationshipLogEntry, CareerState.health/relationshipLog/memoryTags/reputation, season.manager/injuryCount, Effect kind HEALTH(SUM·즉시·만료 없음, activeEffects 미저장)·RELATION reputation.* bag, RESOLVE_EVENT가 INJURY(rehabPlan)·NATIONAL_TEAM(callUp) pending을 닫음(자동 통과 제외), 훅 골격 onMatchInjury·onSettlementRelations·buildDefaultManager(rng 없음), 룰셋 섹션 5종·DSL 토큰·contracts·ADR-010 표. 골든 11종 stateHash만 변경(draws 불변). 리뷰 수정 0건 | aba154a |
| T-3-002 | 이적시장 생성기: `judgeMarketReason`(만료·태그·STARTER 평점·시장가치 지수, rng 0)·`generateMarket`(구단 후보·kind 가중 추첨·제안 3~5 + 안전 잔류)·`buildRenewalOffer`(step 7 사전 협상, 미응답 자동 만료는 T-3-003까지 임시)·`openMarketAfterSettlement`·negotiation.ts, offerRulesV2·transferRules 룰셋 1.0.0/proto, 시장 골든 3종, career-04·07 stateHash만 변경. 리뷰 수정 1건(결산 뒤 상태 도달 불가 분기 → `currentSquadPerformance` 폴백, 테스트 3건) | 408a765 |
| T-2-015 | 분석 이벤트 INSERT를 D1 변수 상한(문장당 100개)에 맞춰 14행씩 순차 청크(`ANALYTICS_INSERT_CHUNK_ROWS`, spy 테스트 50→14·14·14·8), unknown error 응답을 고정 문구로(원문은 logger `errorMessage` 500자), 온보딩 첫 슬라이드 LINE TEST 안내 + e2e 스텁. 리뷰 수정 0건 | 5462dc7 |
| T-3-006 | 콘텐츠 팩 0.2.0 등록(활성 0.1.0 유지): 0.1.0 복제 + PRO 이벤트 5종(EVT-CON-010 루머 RUMOUR·011 에이전트·012 약속 위반·013 재계약 압박·EVT-MEDIA-006 친정팀 원정) `authoring: PROTOTYPE`, RELATION delta ≤ 8, `EventDefinitionSchema.authoring`, 내러티브 토큰 `agent`, 룰셋 1.0.0 팀 12개(tier 3·4·4·YOUTH 1), 이벤트 카탈로그 10절. 골든 재기록 불필요(domain ruleset-proto 사용). 리뷰 수정 0건 | 31e321d |
