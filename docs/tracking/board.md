# 진행 보드

갱신: 2026-09-07. 상태는 `todo`, `in-progress`, `in-review`, `blocked`, `deferred`(사용자 결정 전 보류), `completed`.

2026-09-07 후속: **운영 서비스 출시(SEASON 1: KICKOFF).** 2026-09-06 12:33 사용자 세션이 수동 `Production Release`로 첫 운영 배포를 마쳤고 [offside-lab.com](https://offside-lab.com)에서 시즌 1(`svc_season_1`, 테스트 아님, 종료일 미정, 룰셋 1.3.0·팩 0.5.0)이 ACTIVE다. Phase 5(PR #103)·Phase 6은 종결, Phase 7 운영·밸런스가 진행 중이다. 아래 [Phase 5](#phase-5-백로그-장기-성장은퇴legacy--2026-09-06-통합-pr-103으로-종결)·[Phase 6](#phase-6-출시-항목-season-1-kickoff--2026-09-06-1233-운영-출시-사용자-세션)·[Phase 7](#phase-7-운영-항목-라이브-운영밸런스-2026-09-06) 표와 [현재 게이트](#현재-게이트) 마지막 문단이 이 문서의 나머지 이력보다 우선한다.

2026-09-06 후속: **U-003 완료** — Google 로그인 PR #112 운영 배포와 실제 최초 연결·재로그인·기존 기록 보존 검증을 마쳤다. 아래 과거 이력의 U-003 대기 표기보다 이 결과와 [연결 런북](../operations/google-login.md)이 우선한다. Google 브랜딩 인증은 별도 후속이다.

## 현재 인계 현황 — T-4-022

Claude 한도 중단으로 Codex가 Phase 3·4를 인계했다. **이 표가 아래 과거 진행 이력보다 우선한다.** 사용자 승인: 검증 및 CI 통과 후 main 병합. 아래 코드 완료 상태는 T-4-022 통합 PR의 변경 기준이며 main 반영 시점은 해당 PR 병합 기록을 따른다. Phase 5 #77은 보류 유지.

| 묶음 | 현재 상태 | 범위 |
|---|---|---|
| T-4-009·014·015·016·021 | completed(코드) | 기존 PR #84·#78·#82·#79·#83 커밋을 통합 브랜치에서 보존 |
| T-4-012·018 | completed(코드) | domain 감사 수정·계약/임대 안전 경로·시장 사유 UI 보강 |
| T-4-005a/b/c | completed(코드) | Phase 4 맥락 화면·점진 공개·실제 결과 카드·포지션 챕터 표시. 대표팀 자연 플레이 캡처는 출시 QA 잔여 |
| T-4-006 최종 통합 게이트 | completed(D-62 범위) | 기존 회귀 2,238건·브라우저 98건 통과, 완료 조건별 증거·한계 정리. CI는 통합 PR 게이트 |
| T-4-017·정식 콘텐츠·실사용자 플레이 측정 | deferred | 출시 전 별도 게이트, 기능 코드 완료와 구분 |

구현·검증·캡처: [Phase 3·4 통합 기록](../qa/phase34-completion.md), [인수 조건별 검토](../qa/phase34-acceptance.md). 최신 인계·검증 정책은 [D-62~64](phase-3-4-plan.md)를 따른다.

## 현재 게이트

**Phase 0 코드 작업 종료(2026-09-02 저녁, PR #14).** 남은 Phase 0 항목 T-0-010(CI·배포)은 U-002 완료에 따라 2026-09-04 착수했다. Phase 순서 규칙(2026-09-02 사용자 결정)에 따라 Phase 1 Wave 1(T-1-001~004)과 Wave 2(T-1-005·006·015)를 투입했다. **Phase 1 코드 작업 종료(2026-09-03 12:12, PR #35).** T-1-009~017이 전부 머지돼 온보딩부터 첫 계약·대시보드, 복구 코드·프로필 복구·삭제, Google 연결·로그아웃, 성별·선호 포지션까지 브라우저에서 이어진다. [완료 조건 표](phase-1-completion.md) 15행 중 14행 ✅(#12는 오케스트레이터 수동 점검), #15 Google 실계정 검증만 U-003 대기. Phase 2 Wave 1 종료: T-2-001(시즌 구조, PR #36)·T-2-002(팀 전술·경쟁자·선발, PR #37)가 머지됐고 Wave 2로 T-2-003(경기 계산)·T-2-006(계약·동기화·크기)을 나란히 투입했다 — Phase 2는 순차(웨이브 안 병행)이며 계획·결정은 [phase-2-plan.md](phase-2-plan.md)(D-24~D-36). 사용자가 작성한 콘텐츠 정본 `docs/content/kickoff/`(PR #24)는 Phase 2 콘텐츠 작업의 입력이며 지금 코드 작업을 요구하지 않는다. 계획·결정은 [phase-1-plan.md](phase-1-plan.md). ADR-001~009 승인(2026-09-02). Phase 1 브리프는 미리 작성한다. 계정·프로토타입에 의존하지 않는 골격 작업(T-0-001~004, 007, 009)은 먼저 진행한다. CI 배포를 막던 Cloudflare 준비(U-002)는 완료됐고, 종이 프로토타입 기록(U-005)은 별도 사용자 액션으로 남아 있다. 앱인토스 출시 준비(U-007~U-011, M-001~M-006)는 사용자가 미니앱 출시를 결정할 때 착수한다. **Phase 2 Wave 2 종료(2026-09-03 19:05, PR #39).** 시즌 구조·전술/선발·경기 계산·계약/동기화 검증이 main에 있고, Wave 3 T-2-004(챕터)·T-2-005(결산·성장)를 병행 투입했고, 사용자의 '속도 올리자'(2026-09-03 저녁)에 따라 선행 작업이 머지되는 즉시 다음 작업을 투입한다(동시 3개 상한). T-2-007(시즌 화면)을 3번째 워커로 투입했고, **T-2-005(PR #40)가 먼저 머지**됐다. **Phase 2 Wave 3 종료(2026-09-03 22:03, PR #41)**: T-2-004(챕터)도 머지됐다. T-2-014(Phase 3+ 공유 계약)를 투입했고, T-2-007(시즌 화면, PR #42, 23:15)이 머지돼 T-2-008(챕터 화면)·T-2-009(결산 화면)를 투입했다(동시 3개: T-2-014·008·009). T-2-014(공유 계약, PR #43, 23:32)가 머지돼 Phase 3·4 병렬 투입의 전제가 닫혔다 — **ADR-010은 워커 작성본이라 사용자 승인 대기(U-012)**. 2026-09-04 01:20 PR #44(T-2-008) 검증 체인에서 e2e 2건이 실패(season.spec 이중 클릭 TOCTOU, chapter.spec 0분 시즌으로 데뷔 챕터 미발생)해 워커에게 수정을 요청했고(TUI 멈춤으로 터미널 재투입), PR #45(T-2-009)는 #44 뒤 main 머지 대기. 01:31 T-2-011(Phase 2 완료 조건 검증)을 3번째 워커로 투입 — 도메인 항목 먼저, web 항목은 #44·#45 머지 뒤. **PR #44(T-2-008 챕터 화면, `4f11110`) 01:56 머지** — 챕터가 브라우저에서 열리고 판단→결과→재생까지 e2e 62 통과. **PR #45(T-2-009 결산 화면, `1065272`) 02:08 머지** — Phase 2 화면 작업(T-2-007·008·009)이 전부 main에 있어 계약→프리시즌→시즌 12 step(챕터 포함)→결산→다음 시즌이 브라우저에서 이어진다(e2e 66 통과). 남은 Phase 2: T-2-011(진행 중, web 항목 착수)·T-2-010(콘텐츠, U-005 대기). 동시 워커 1개. 02:18 **Phase 3·4 병렬 계획 초안**([phase-3-4-plan.md](phase-3-4-plan.md), D-43~D-53, T-3-001~006·T-4-001~006) 작성 — 투입은 Phase 2 종료·U-012 승인 뒤, 브리프는 미리 쓴다. **PR #47(T-2-011 Phase 2 완료 조건 검증, `0c27965`) 03:41 머지 — Phase 2 코드 작업 종료.** [완료 조건 표](phase-2-completion.md) 9행 전부 자동 검증(fixture 3종·결정론·집계·B > A·세션 측정·e2e 68건 3회 무결점), 후속 정리 a·b·d 처리. 남은 Phase 2는 사용자 게이트: T-2-010(콘텐츠, U-005)·T-2-012(LINE TEST, U-002)·T-2-013(012 뒤). 동시 워커 0개. Phase 3·4 투입은 U-012(ADR-010 승인)·U-013 확인 뒤이며 T-3-001 브리프를 먼저 쓴다. **2026-09-04 오전 사용자 결정**: PR #46(T-0-010 Cloudflare 배포 파이프라인, `abf9bfa`) 머지 승인, ADR-010 설계 승인(U-012), 이벤트 문구 `PROTOTYPE` 허용(U-013 (A)), 가상 구단 12개 확장. 이에 따라 **T-2-012(LINE TEST 준비)·T-3-001(Phase 3·4 타입 슬라이스)** 를 10:07 나란히 투입(동시 2개). T-3-001 머지 뒤 T-4-001·T-3-002·T-3-006. **T-0-010 completed(10:40)**: staging 자동 배포·smoke 통과 — Phase 0 전 항목 종료. **T-3-001 머지(2026-09-04 11:43, PR #48 b756999) — Phase 3·4 병렬 투입 시작**: T-4-001(트랙 B 타입)·T-3-002(이적시장 생성기) 먼저, T-3-006(팩 0.2.0·팀 12)은 T-2-012 머지 뒤(동시 워커 3개 상한). **T-2-012 머지(2026-09-04 12:18, PR #49 c90b769)** — LINE TEST 코드 준비 끝. 남은 것: staging `svc_line_test` 응답 확인, U-014(Paid 플랜), T-2-013(운영 계획, docs). T-3-006 투입(12:21, 동시 워커 3개: T-4-001·T-3-002·T-3-006). T-2-013(LINE TEST 운영 계획, docs) 완료 — Phase 2 남은 것은 T-2-010(U-005)과 LINE TEST 게이트([line-test-plan.md](line-test-plan.md) 7행, U-014·U-015). **staging 확인·예행(12:34~12:56)**: `svc_line_test` 정상 반환, 온보딩→계약→FAST·CHAPTER 시즌 완주 통과. 결함 3건(20건 배치 503 = D1 변수 100개 상한, 오류 본문 SQL 노출, 온보딩 안내 없음) → T-2-015 브리프, 첫 워커 종료 뒤 최우선 투입. **T-3-006 머지(13:01, PR #51 31e321d)**, PR #50(T-3-002) 수정 요청 1건 진행 중, T-2-015 투입(13:02). 동시 워커 3개: T-4-001·T-3-002·T-2-015.

**T-3-003 완료·오케스트레이터 인계(2026-09-04 16:47).** PR #54는 Luna Max 독립 리뷰에서 태그 판정 순서·LOAN 팬 페널티·임대 만료 자동 FA 복원 P1 세 건을 고쳐 `e1ae3de`로 squash 머지했다. 새 head의 Quality·Browser·PR preview와 Node 22 전체 테스트(domain 535·web 308·api 169)가 통과했다. 기존 Claude 세션 `ec0b55e0-72c5-48f4-81e0-e287cece7700`은 이 경계에서 정지했다. 이후 Codex가 기술 오케스트레이터를 맡고, 구현·테스트 코드는 Orca `gpt-5.6-luna` reasoning `max` 워커에게만 위임한다(동시 최대 3개).

**Phase 3 코드 작업 종료(2026-09-05 02:25, PR #65).** 밤사이 T-3-004(PR #55)·T-4-002(PR #64)·T-3-005(PR #65)·T-4-003(PR #67)과 로컬 QA 표시 수정(PR #63)이 머지됐다. Phase 4는 T-4-001~003 완료, T-4-004는 PR #68 마감 중, T-4-005(화면)·T-4-006(통합 검증)은 미착수. 디자인 PR #66(19개 화면 모바일 개편, 사용자 작업)은 최신 main 재통합 대기(DIRTY). 이 문단과 현황판은 2026-09-05 오전 사용자 요청으로 Claude 세션이 갱신했다(오케스트레이션은 Codex 유지).

**오케스트레이션 Claude 복귀·Sonnet 5 워크플로 전환(2026-09-05 10:50).** 사용자 지시로 기술 오케스트레이션은 다시 Claude 세션이 맡는다. Codex 세션은 T-4-004(PR #68)까지만 마무리하고 사용자가 정리한다. 이후 코드 작업은 Claude Code `Workflow`(다이나믹 워크플로)로 띄우는 **Sonnet 5 에이전트가 전담**하고, Claude는 브리프·검증 체인·리뷰·머지와 화면 검증(ego-browser)을 맡는다([README](README.md) 갱신). 다음 웨이브 브리프 T-4-007(디자인 PR #66 재통합)·T-4-005·T-4-006을 작성했고 결정 D-56~D-58을 [phase-3-4-plan.md](phase-3-4-plan.md)에 추가했다. 투입은 #68 머지 직후 T-4-007 ‖ T-4-006(domain) → T-4-005 → T-4-006(e2e).

**T-4-004 완료(PR #68 `29e1a08`, 2026-09-05 11:07).** Codex 세션이 Luna 최종 리뷰·정리 커밋(`44b04f8`) 뒤 머지하고 일시중지했다. Phase 4 domain·content는 끝났고 남은 것은 T-4-007(디자인 재통합)·T-4-005(화면)·T-4-006(통합 검증)이다. 11:07에 T-4-007과 T-4-006(domain)을 Sonnet 5 워크플로로 투입했다.

**병렬 상한 해제·2차 웨이브 투입(2026-09-05 11:48, D-59).** 사용자 지시 "병렬 진행을 최대로"에 따라 동시 워커 상한(3개)을 없애고 파일 소유권(D-53)으로만 병렬을 제한한다. T-4-007 ‖ T-4-006(domain)에 더해 **T-4-008(콘텐츠 팩 0.3.0, `packages/content`만)·T-4-009(Phase 4 화면 준비: DEV 팩 오버라이드·라벨 함수·seed 탐색, 라우트 파일 제외)·T-2-016(staging 리허설 자동화)** 을 Sonnet 5 워크플로로 투입했고, 읽기 전용 **Phase 3·4 코드 감사 워크플로**(관점 7 → finding별 3렌즈 반박 검증 → 수정 묶음 제안)를 병행한다. T-4-005는 T-4-007·T-4-009 머지 뒤 화면 묶음 3개로 쪼개 병행한다. CI 참고: main `29e1a08`의 Browser gates가 season.spec `signFirstOffer` 링크 클릭에서 1건 실패(77 통과)했고 다음 커밋 `1b85a7f`는 녹색 — 간헐 실패로 보고 T-4-006 e2e 3회 반복에서 재확인한다.

**세션 한도 중단과 재개, PR #66·#69 머지, 감사 1차 결과(2026-09-05 15:20~15:30).** 12:30 무렵 Claude 세션 한도(15:20 초기화)로 진행 중이던 워커 4개(T-4-006 domain·T-4-008·T-4-009·T-4-010)와 감사 검증 에이전트 34개가 중단됐다. 그 사이 **사용자가 별도 세션에서 디자인 PR #66(T-4-007 재통합 포함, `7bd3d84`, 14:59)과 Phase 5 PR #70·#71(T-5-001 커리어 기록·Legacy, T-5-002 은퇴 아카이브, [phase-5-plan.md](phase-5-plan.md))을 머지**했고, 오케스트레이터는 PR #69(T-2-016, `a468837`)를 머지했다. 15:20 중단된 워커의 작업물을 WIP 커밋으로 보존한 뒤 브랜치를 이어받는 워커 4명 + T-4-011(SCR-020 잔류 결과)을 `wf_4498dfc0-665`로 재투입했다. 감사 1차: finding 33건 중 14건 확인(3렌즈 2/3 이상), 8건 반박, 11건은 검증 에이전트가 한도로 죽어 재검증 중. **정정**: 앞서 P1로 보고한 "구 커리어 비호환(GET 503)"은 3렌즈 모두 반박 — D-53·T-3-001 브리프가 공개 출시 전 in-place 변경(마이그레이션 없음)을 명시적으로 수용한 관례라 결함이 아니다. 다만 staging의 #67 이전 커리어는 실제로 열리지 않으므로 LINE TEST 시작 전 staging D1 커리어 초기화를 운영 항목으로 둔다. 확인된 finding은 소유권별 수정 묶음(T-4-012 domain, T-4-013 api 테스트, T-4-014 web)으로 투입한다. main 검증 체인(`3f39511`)은 부하 중 타임아웃 3건(domain 1,000회 결정론 10초 예산·Phase 5 20시즌 집계·web 5초 라우트 테스트)이 단독 재실행에서 전부 통과했고, api `100회 병렬` 테스트 2건은 단독 실행에서도 20초를 넘겨 T-4-013으로 예산을 올린다.

**사용자 세션 출시 기록(2026-09-05 밤~2026-09-07 새벽, Codex·Sol·Luna).** 9/5 23:22 PR #102로 CI를 PR quick checks·main staging 배포·수동 운영 릴리스 구조로 줄였다(self-hosted runner, U-017 완료). 9/6 09:46 **Phase 5 통합 PR #103**(#77 대체: 선수 생성·게임 연출·Legacy 1.1·한국 모듈, T-5-001~008)이 main에 들어갔고 10:01 PR #106으로 배포 후 인수 검증을 마쳤다(후속 이슈 #104·#105). 11:57 PR #107 수동 `Production Release` 워크플로, 12:14 PR #108 시즌 1 무기한 운영 시즌·문의 이메일(U-010 해소), #109·#110 D1 릴리스 검사 수정 뒤 **12:33 첫 운영 배포 성공**(run 34009144236, `82a46fc`, 기록 PR #111). 13:11 PR #112·13:29 #114 Google 로그인 운영 연결(U-003 완료). 오후 운영 3회 플레이 QA(Luna, 커리어 A/B/C: 실패 뒤 회복·성인 진로 전환 약함) → 17:46 PR #115 시즌 1 게임성 개선(19세 시작, 룰셋 1.3.0·팩 0.5.0), #116 스모크. 19:49~20:02 PR #117·#118·#119 공개 가이드·**offside-lab.com 도메인**(U-001 완료)·공개 검색. 21:51 PR #120 UI/UX 개편, #121 홈 허브 소식·피드백, 22:25 #122 두 환경 정리(expanded 제거), 23:09~23:32 UX-001~005(#123~#128)·FOUC #129·플래그 브랜드 #130. 9/7 00:10~01:46 앱 셸 UX-006(#131)·커리어 홈 UX-007(#134)·TeamBadge UX-008(#133)·시네마틱 인트로 UX-009(#135)·결과 연출 UX-010(#139)·트레이딩 카드 UX-011(#138)·수정 #132·#136·#137 머지 → **01:51~01:52 운영 재배포**(`939fe48`). 이 Claude 세션은 9/7 오전에 복귀해 문서·현황판만 갱신했다(코드 수정 없음). 남은 것은 Phase 7 표 참조: 이슈 #104·#105, Google 브랜딩 인증, Search Console·네이버 등록, staging 룰셋·팩 승격, 실사용자 플레이 측정, U-014·U-004·U-005. U-015 LINE TEST는 시즌 1 공개 출시로 대체됐다.

WORLD STAGE 세계관 확장은 2026-09-03 승인된 Phase 8 후속 범위다. 현재 Phase 1~7의 국내 MVP 순서를 바꾸지 않으며, Phase 3~5와 Phase 7 완료 후 새 ruleset의 신규 Career에 해외 이적·가상 해외 리그·대륙대회를 연다. 정본은 [WORLD STAGE 개발 명세](../development/15-world-stage-expansion.md)와 [Phase 8](../phases/phase-08-world-stage.md)이다.

## 사용자 액션

| ID | 내용 | 상태 | 메모 |
|---|---|---|---|
| U-001 | 도메인 구매, 네임서버를 Cloudflare로 | completed | 2026-09-06 PR #118로 `offside-lab.com`(web)·`api.offside-lab.com`(api) 연결, legacy `workers.dev` 로그인 호환 유지. 공개 검색은 PR #119. 런북 [custom-domain.md](../operations/custom-domain.md). Search Console·네이버 등록은 Phase 7 후속 |
| U-002 | Cloudflare 계정·최소 권한 API 토큰·환경별 D1 준비 | completed | 2026-09-04. GitHub Secrets 2종 등록, APAC D1 `offside-preview`·`staging`·`production` 생성. Free 플랜 유지 |
| U-003 | Google Cloud 프로젝트에서 OAuth 클라이언트 ID·시크릿 발급 | completed | 2026-09-06 개인 계정의 `offside-football-prod` 생성·외부/프로덕션 공개, 운영 secrets 설정 및 PR #112 배포. 실제 최초 연결·같은 계정 재로그인·새로고침에서 기존 ID/revision/hash 유지 확인. 브랜딩 인증은 별도 미완료. [연결 런북](../operations/google-login.md) |
| U-004 | Sentry 프로젝트 생성, DSN 등록 | todo | ADR-007 |
| U-005 | 종이 프로토타입 3회 플레이, `docs/content/prototype/playtest-log.md` 작성 | todo | 양식 제공됨(2026-09-02). 회차별 시트와 3회 합산 답만 채우면 된다. 고정 seed 3종 키트는 `docs/content/kickoff/paper-playtest-kit.md`(PR #24) |
| U-006 | ADR-001~009 검토·승인 또는 반려 | completed | 2026-09-02 승인 |
| U-007 | 앱인토스 콘솔 가입(토스 비즈니스, 만 19세), 워크스페이스·제작자 이름, 앱 등록(유형 **게임**, `appName` 확정), 고객문의 이메일 | deferred | ADR-009, ADR-006. appName은 변경 불가 |
| U-008 | 앱인토스 서버 mTLS 인증서 발급 → `wrangler mtls-certificate upload`, certificate_id 공유 | deferred | ADR-007. U-002·U-007 이후 |
| U-009 | 게임물 등급분류 신청(GRAC, 스토어명 `기타-앱인토스`). 개인 신청 가능 여부 먼저 확인 | deferred | ADR-009. 10~15일 + 수수료. 증명서 PDF를 콘솔에 등록 |
| U-010 | 약관·개인정보 처리방침 최종 문안 검토, 사업자명·문의 이메일·시행일 확정(`apps/web/src/legal/operator.ts`) | completed | 2026-09-06 PR #108: 운영자 `OFFSIDE 운영팀`, 문의 이메일 확정, 시행일 2026-09-02. 설정 화면 제작자·피드백 푸터는 PR #123(UX-002). 초안 이력: PR #31(`privacy.tsx`·`terms.tsx`), D-20 |
| U-010 | 이 세션에서 `/mcp` → `apps-in-toss-console` 인증 완료 | deferred | 서버는 등록됨, OAuth 로그인만 남음 |
| U-011 | (U-009에서 개인 신청 불가 시) 개인사업자 등록 후 콘솔 사업자 등록 | deferred | 조건부. 면세 사업자 불가 |
| U-013 | Phase 3·4 워커의 이벤트 문구 `PROTOTYPE` 작성 허용 여부, 가상 구단 8→12 확장 | completed | 2026-09-04 오전: (A) 워커가 메커니즘 검증용 최소 문구를 `PROTOTYPE`·`playtested: false`로 작성, 정식 문구는 콘텐츠 승격 뒤 교체. 가상 구단 12개로 확장(T-3-006) |
| U-012 | ADR-010(Phase 3+ 공유 계약: Effect 규칙·시장가치 입력·CareerTag) 검토·승인 | completed | 2026-09-04 오전 설계 승인(사용자). PR #43 코드는 이미 main. T-3-001 투입 |
| U-014 | Workers Paid 플랜으로 전환 | todo | 시즌 1은 2026-09-06 Free 플랜으로 출시됨. Workers·D1 무료 한도 접근 시 전환(운영 트래픽 관찰 뒤 결정). 개발·staging은 Free 유지 |
| U-015 | LINE TEST 테스터 모집(10~30명)·안내문 발송·피드백 채널 결정 | deferred | 2026-09-06 사용자 결정으로 시즌 1 공개 출시(PR #108, `svc_season_1` 테스트 아님·종료일 미정)가 LINE TEST를 대체. 별도 테스트 시즌·모집 없음. [line-test-plan.md](line-test-plan.md)는 staging 예행·D1 측정 쿼리 절차로만 유지. 피드백 채널은 홈 허브 피드백(PR #121)·설정 푸터(PR #123) |
| U-016 | 오케스트레이터 기기 wrangler 로그인(LINE TEST 기준선 D1 조회용) | done | 2026-09-04 14:56 사용자가 `! pnpm --filter @offside/api exec wrangler login` 실행(OAuth 성공). 5절 쿼리 실행 확인, line-test-plan 준비 체크리스트 #3·#7 ✅ |
| U-017 | GitHub Actions 결제·지출 한도 해결 → 사용자가 PR #96(21:33 머지)으로 CI·배포를 Mac self-hosted runner(`self-hosted, macOS, ARM64, offside`)로 전환 | completed | 2026-09-05 21:33 PR #96 self-hosted runner 전환 → 23:22 PR #102 CI 정리(PR quick checks·main staging·수동 운영 릴리스). 2026-09-06 main·staging·`Production Release`(run 34009144236 등) 전부 runner에서 성공, 9/7 01:51~01:52 재배포 성공. 런북 [self-hosted-runner.md](../operations/self-hosted-runner.md). 이력: 2026-09-05 20:21부터 main CI 잡이 "recent account payments have failed or your spending limit needs to be increased"로 시작조차 안 됨(run 33962595554 Deploy staging, 33963157095 Quality·Browser gates). 비공개 저장소라 Actions 분수가 과금 대상. 해결 전까지 staging 배포·PR CI 없음, 머지 게이트는 로컬 체인 EXIT 0만. 브랜치 보호 없음(Free 플랜) |

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
| T-2-016 | web(e2e) | staging 리허설 자동화: `playwright.staging.config.ts`·`staging-rehearsal.spec.ts`·`e2e:staging` 스크립트 커밋(오케스트레이터 임시 worktree 산출물 이관) | T-2-015 | 1 | done | PR #69 `a468837`(2026-09-05 12:35), [브리프](briefs/T-2-016.md). 기본 config `testIgnore` 1줄. staging 1회 실행 2 passed, 생성 careerId `4faf91c6-f843-4aec-8d56-f58dbbd728eb`(svc_line_test, LINE TEST 전 D1 정리 대상) |
| T-2-014 | domain + contracts | Phase 3+ 공유 계약: Effect 만료·중첩, 시장가치 입력, CareerTag 인터페이스, ADR-010 | T-2-004, T-2-005 | 3 | done | PR #43 dd480a2, [브리프](briefs/T-2-014.md) |

## Phase 3·4 백로그 (계획 초안 2026-09-04, 투입은 Phase 2 종료·U-012 승인 후)

계획·결정(D-43~D-53)은 [phase-3-4-plan.md](phase-3-4-plan.md). 트랙 A(계약·임대·이적)와 트랙 B(부상·관계·평판)를 병렬로 돌리되 타입 슬라이스(T-3-001 → T-4-001)는 순차. 동시 워커 3개.

| ID | 트랙 | 영역 | 내용 | 선행 | 상태 | 비고 |
|---|---|---|---|---|---|---|
| T-3-001 | A | domain + contracts + content | 계약·제안 v2 타입, clubHistory, 제안 상태기계, 타임라인 kind 예약(양 트랙), DSL contract.*, CON payload 스키마 | U-012 | done | PR #48 b756999(2026-09-04 11:43), [브리프](briefs/T-3-001.md). 리뷰 수정 1건(`contract.isLastSeason` 의미), 골든 9종 재기록(draws 불변) |
| T-3-002 | A | domain + content | 결산 뒤 이적시장 생성(D-43·D-44), 안전 잔류 제안, step 7 사전 협상, offerRulesV2·transferRules | T-3-001 | done | PR #50 408a765(2026-09-04 13:33), [브리프](briefs/T-3-002.md). 리뷰 수정 1건(결산 뒤 STARTER·평점 INTEREST 분기 도달 불가 → `currentSquadPerformance` 폴백). 워커 결정 3건 수용. 결산 배선·명령은 T-3-003 |
| T-3-003 | A | domain + 룰셋 필드 + web 최소 배선 | NEGOTIATE·ACCEPT_OFFER v2·REJECT_OFFER·LOAN_RETURN, 원자 전환(D-45), 임대(D-46), 약속 위반(D-47), 태그 5종(D-48), 결산 배선, golden career-10·11 | T-3-002 | done | PR #54 `e1ae3de`(2026-09-04 16:47), [브리프](briefs/T-3-003.md). 최초 구현 `cafb870` → Luna Max 리뷰 P1 3건 → 수정 `7d31f07`. Quality·Browser·PR preview와 전체 테스트 녹색. |
| T-3-004 | A | contracts + api + engine-client | payload·상태 strict 검증, 동기화 회귀, Snapshot 크기 | T-3-003 | done | PR #55 dc2cbaa(2026-09-04 21:42, Luna Max·Codex 리뷰), [브리프](briefs/T-3-004.md). career-10·11 strict 명령·snapshot 불변, API PUT 3경로·멱등, 크기 probe, engine replay/fork/import, Worker hash probe. 제품 동작 변경 없음 |
| T-3-005 | A | web | SCR-017 계약 상태·제안 비교·협상, SCR-019 루머, SCR-020 이적·임대 결과, TEST-E2E-003 | T-3-003, T-3-004 | done | PR #65 3032bdd(2026-09-05 02:25), [브리프](briefs/T-3-005.md). PRE_NEGOTIATION 제안 비교·상세·협상·거절·수락, LOAN_RETURN 결정, SCR-020 결과 복구, FIRST_CONTRACT SCR-009/010 보존. 0.2.0 미활성(RUMOUR 도달성은 별도 결정 게이트). **Phase 3 코드 종료** |
| T-3-006 | A | content | 루머·잔류·에이전트 이벤트, 협상·이적 문구, 팀 풀 확장(열린 질문) | T-3-001 | done | PR #51 31e321d(2026-09-04 13:01), [브리프](briefs/T-3-006.md). 팩 0.2.0 등록(활성 0.1.0 유지)·PRO 이벤트 5종 PROTOTYPE·팀 12·authoring 스키마·agent 토큰. 리뷰 수정 0건. 후속: web narrative.ts에 `agent` 토큰(T-3-005) |
| T-4-001 | B | domain + contracts + content | 관계 로그·감독·부상·평판 타입, HEALTH Effect(ADR-010 표 갱신), RESOLVE_EVENT의 INJURY·NATIONAL_TEAM 수용(D-52), 훅 골격 | U-012, T-3-001 | done | PR #53 aba154a(2026-09-04 13:57), [브리프](briefs/T-4-001.md). 리뷰 수정 0건. main 재머지 2회(PR #50 충돌 해결), 재기록 골든 미커밋(PLACEHOLDER)을 오케스트레이터 체인이 잡아 추가 커밋. 후속: T-4-002(부상)·T-4-003(관계) 브리프 |
| T-4-002 | B | domain + content | 부상 모델(D-49): 심각도·부위·진단 범위·재활 선택·재발·후유증, 강제 사건 상한, career-12-injury | T-4-001 | done | PR #64 27292d4(2026-09-05 01:36), [브리프](briefs/T-4-002.md). MODERATE/MAJOR 부상은 일반 이벤트보다 우선하는 INJURY pending, MINOR는 STANDARD 자동, 재활·복귀·재발·후유증 상태기계, career-12-injury 골든 |
| T-4-003 | B | domain + content | 감독 교체·라커룸·슬럼프·윤리·SNS 이벤트 pool, popularityCenti, 관계 로그, 안전장치, 태그 5종(D-50) | T-4-001 | done | PR #67 b180536(2026-09-05 04:17), [브리프](briefs/T-4-003.md). 관계 5축 clamp delta 감사 로그·memory tag LRU, 결산 평판·주장단 승격·감독 교체 예약·인계, Phase 4 태그 5종 평가기, SLUMP/LOCKER_ROOM/ETHICS/MEDIA 이벤트·스키마 |
| T-4-004 | B | domain + content | 대표팀 차출 기본 모듈(D-51), NATIONAL_DEBUT 챕터 | T-4-002, T-4-003 | done | PR #68 `29e1a08`(2026-09-05 11:07, Luna Max 구현·리뷰, Codex 머지), [브리프](briefs/T-4-004.md). step 8 자격 판정·NATIONAL_TEAM pending·callUp 3종·부상 자동 사양·CHP-NAT-001 데뷔 예약, 웹은 NATIONAL_TEAM을 SCR-013으로 라우팅·데뷔 챕터 맥락(전용 SCR-032는 T-4-005). 최종 수정 `44b04f8`로 불필요한 e2e 변경 정리 |
| T-4-005 | B | web | SCR-016·018·021·022·024·032, 라커룸·휴대폰 관계 수치 점진 공개(D-57), SCR-023 경기 판단 변형, TEST-E2E-004, DEV 팩 오버라이드(D-56) | T-4-004, T-4-007, T-4-009 | done | [브리프](briefs/T-4-005.md) → 분할 브리프 [T-4-005a](briefs/T-4-005a.md)(분기·디스패처·SCR-022·032, T-4-009 뒤) · [T-4-005b](briefs/T-4-005b.md)(SCR-021·018·016·024, (a) 뒤) · [T-4-005c](briefs/T-4-005c.md)(대시보드 점진 공개·SCR-014 확장·SCR-023, T-4-009·T-4-014 뒤). D-61로 TEST-E2E-004·단위 테스트 보류 → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. T-4-005a/b/c를 Codex가 `routes/-phase4/` 6개 body로 통합 구현(캡처 `docs/qa/phase34/`). 대표팀 SCR-032 자연 플레이 캡처는 출시 QA 잔여. a/b/c 브리프 미투입 |
| T-4-006 | A+B | domain + web(e2e) | 트랙 통합 검증: 3시즌 fixture `career-13-integration`, OVR 불변 property, 결정 예산·세션 길이, Snapshot 크기, e2e 3회, 완료 조건 표(테스트 전용) | T-4-004(domain 부분), T-4-005(e2e 부분) | done(domain) / deferred(e2e) | domain 부분 **PR #72 `518db98`**(2026-09-05 16:30, Sonnet 5 `wf_0b8d9171-68c` → 한도 중단 → `wf_4498dfc0-665` 재개), [브리프](briefs/T-4-006.md). e2e 부분(5절)과 Node/workerd probe(T-4-017)는 D-61로 보류 |
| T-4-007 | B | web + ui | 디자인 PR #66 재통합(D-58): 최신 main merge·충돌 해결·T-3-005/T-4-004 화면 디자인 정합 | T-4-004 | done | PR #66 `7bd3d84`(사용자 머지 2026-09-05 14:59, 워커 커밋 5bb89e6·07f2ce4), [브리프](briefs/T-4-007.md). 오케스트레이터 체인 통과(타임아웃 3건 단독 재실행 통과). staging 360px ego-browser 확인(16:10): 허브·커리어 생성 1단계 새 디자인 렌더, 가로 오버플로 0 |
| T-4-008 | A | content | 콘텐츠 팩 0.3.0(0.2.0 복사 + 부상·관계·감독·슬럼프·윤리·미디어·대표팀 이벤트 승격, 포지션 전용 챕터 3종), 0.1.0·0.2.0 무변경, 도달성 표 | T-4-004 | done | **PR #75 `13eeaaf`**(2026-09-05 16:45), [브리프](briefs/T-4-008.md). 워커는 PR 게이트에 막혀 push+PR_BODY로 멈춤 → 오케스트레이터가 REST로 개설. EVT-NAT-002 트리거는 `popularityCenti ≥ 5200` 대체(잠정) |
| T-4-009 | B | web(engine·labels·e2e helper) | Phase 4 화면 준비: D-56 DEV 팩 오버라이드 `resolveActiveContentPackVersion`, D-57 라벨 함수, presentation 도달 seed 탐색 도구·`phase4-seeds.ts`, 도달성 보고 | T-4-004 | done | [브리프](briefs/T-4-009.md). Sonnet 5 워크플로 투입(2026-09-05 11:48), 브랜치 `T-4-009-phase4-prep`. 라우트·`packages/ui` 금지(T-4-007과 소유권 분리). 15:20 세션 한도로 중단 → `wf_4498dfc0-665`로 재개(WIP 1efbb5d) → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. 원 PR #84 MERGED |
| T-4-010 | B | web(e2e) + ci | e2e 간헐 실패 안정화: season-result 카운트업 건너뛰기 경쟁, signFirstOffer 잔류 경로 허용, INTEREST 고정 seed 케이스, CI 실패 아티팩트 업로드 | T-3-005 | done | **PR #74 `552481c`**(2026-09-05 16:48), [브리프](briefs/T-4-010.md). INTEREST 고정 seed 케이스는 D-61 이전 요구분으로 유지 |
| T-4-011 | B | web | SCR-020 잔류 결과(STAY): INTEREST 시장 안전 잔류 수락 시 결과 카드 렌더·loader redirect 튕김 제거 | T-4-007 | done | **PR #76 `25544b3`**(2026-09-05 16:50), [브리프](briefs/T-4-011.md). 워커 구현분(구조화 출력 강제 종료로 커밋 전 중단)을 오케스트레이터가 커밋·개설. e2e TEST-E2E-003(c) STAY 카드 포함 97 passed |
| T-4-012 | A | domain | 감사 확인 finding domain 묶음: 감독 교체 roll RNG(C1), walk 중 stale 부상 상태 대표팀 자동 사양(C2), 시장 파생 시드 careerId(C3), EXPIRED 전부 거절 안전 잔류 미체결(C4·C10), 임대→FA 이적 유령 stint(C5), FIRST_CONTRACT 전부 거절(C6), step 7 빈 제안 nextAction(C7), 재검증 확정 F6~F8·F10·F11(step 7 재계약 계약 교체 시점·결산 시장 생략·임대 복귀 감독 이력) | T-4-006(domain) | done | [브리프](briefs/T-4-012.md)(D-60 정정). Sonnet 5 워크플로 `wf_6ba9548e-839` 투입(2026-09-05 16:31), 브랜치 `T-4-012-domain-audit`. C12·C13(테스트 공백)은 D-61로 보류 → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. Codex가 §1~§3를 재구현·통합. Claude 워커(`wf_6ba9548e-839`)는 19:50 중단, 커밋 3개(`0f9bbbc`·`7b63f2e`·`e3d185d`)는 워크트리 `wf_6ba9548e-839-1`에 참조용 보존 |
| T-4-013 | A | api(test) | careers.test.ts 100회 병렬 테스트 2건 타임아웃 60초(러너·부하 flake) | — | done | **PR #73 `add9f53`**(2026-09-05 16:35), [브리프](briefs/T-4-013.md). 체인은 api 파일 부하 게이트 뒤 단독 재실행 25/25 |
| T-4-014 | B | web | 감사 web 묶음: step 7 사전 협상 '전부 거절' 문구·안내(C9), 휴대폰 탭 시장 사유·제안 수(C11) | T-4-007 | done | [브리프](briefs/T-4-014.md). 워커 완료 **PR #78 `384a37e`**(2026-09-05 16:50) . 360px 스크린샷 2장(offers·휴대폰 탭) 확인 완료. 체인 2회: 16:56(main 회귀·injury 레이스, 무관) / 17:30(season.spec:17 랜덤 seed 잔여 → T-4-021, 무관). T-4-021 머지 뒤 재큐. 후속 발견 → T-4-018 → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. 원 PR #78 MERGED |
| T-4-015 | B | content | 감사 content 묶음: season.stats 8필드 playerStats 파생(F2), 슬럼프 게이트 `recentRatedMatches`·sentinel(F1), EVT-CON-010 phase 정합(F2), INJURY previewEffects 룰셋 대조 검증기(F4; C14 테스트는 D-61 보류) | T-4-008 | done | [브리프](briefs/T-4-015.md). 워커 완료 **PR #82 `db29402`**(2026-09-05 17:40, 오케스트레이터 REST 개설). 워커 체인 그린(content:validate 경고 0, test 401, e2e 98). 잔여: EVT-CON-010은 phase 수정 뒤에도 D-52 RUMOUR presentation 제외로 미도달(RUMOUR pending 생성기 부재, T-3-005 기지 공백) → 백로그. T-4-021 머지 뒤 검증 큐 → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. 원 PR #82 MERGED |
| T-4-016 | B | web | 감사 web 소수정: SCR-020 RETURN 관계 문구(C8), `{manager}` 서사 토큰을 `season.manager.name` 우선으로(F5) | T-4-011 | done | [브리프](briefs/T-4-016.md). 워커 완료 **PR #79 `193e3e3`**(2026-09-05 16:59). T-4-019 핫픽스 머지 뒤 검증 큐 → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. 원 PR #79 MERGED |
| T-4-017 | A | api(test) | Node/workerd 해시 probe에 career-12·career-13 fixture 추가(T-4-006 §1(d) 잔여) | T-4-006(domain) | done | [브리프](briefs/T-4-017.md). Sonnet 5 워커 PR #90 `ce4eac3` → 오케스트레이터 체인 EXIT 0(e2e 98 passed) → 2026-09-05 20:10 squash 머지 `84709ec`. career-12 rev20 `ad92d9c3…`·career-13 rev45 `b21c5c65…` Node·workerd·golden 일치 |
| T-4-018 | B | web | SCR-017 offers 화면 eyebrow를 시장 사유별로(INTEREST/LOAN_END/PRE_NEGOTIATION에서 "계약 만료·FA" 고정 노출 수정; PR #78 스크린샷 발견) | T-4-014 | done | [브리프](briefs/T-4-018.md). PR #78 머지 뒤 투입(`offers.tsx` 소유권) → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. Codex 구현(시장 사유 UI 보강), 브리프 미투입 |
| T-4-019 | — | web(e2e) | [핫픽스] main 회귀: `signFirstOffer` 헬퍼 정규식(PR #74)이 STAY 결과 URL `&interested=N`(PR #76)을 거부해 season.spec:121 결정적 실패 | T-4-010, T-4-011 | done | [브리프](briefs/T-4-019.md). 17:01 투입 → 17:10 BLOCKED(헬퍼 수정 커밋 `a6e8136`, season.spec:143 단언이 #76 프리시즌 경로와 불일치) → 17:12 단언 완화 허용해 재투입 → 17:22 완료 **PR #81 `689aaa0`**(워커 체인 전부 그린, e2e 98). 검증 큐 #81→#80→#78→#79(앞 PR 머지 대기 게이트 추가) |
| T-4-020 | — | web(e2e) | [핫픽스] injury.spec `reachForcedInjury` poll의 타임아웃 없는 `textContent()`가 `/event` 전환 순간 무한 대기 → 반복 60초 타임아웃(trace로 확정) | T-4-010 | done | [브리프](briefs/T-4-020.md). 17:05 투입 → 17:15 워커 완료 **PR #80 `67835d8`**(오케스트레이터 REST 개설, 훅 차단). `--repeat-each=3` 3/3, 체인 통과(season.spec:121은 T-4-019 대상). 오케스트레이터 체인 CHAIN EXIT 0(e2e 98) → **머지 `01be661`**(17:28) |
| T-4-021 | — | web(e2e) | [핫픽스] season.spec:17(랜덤 seed)에서 STAY 수락 뒤 `/preseason` 도착 시 "계획하러 가기" 기대가 실패(PR #76 경로, #81 1차 수정의 잔여) | T-4-019 | done | [브리프](briefs/T-4-021.md). 17:35 투입 → 17:43 완료 **PR #83 `1aee5e7`**(워커 체인 그린, `--repeat-each=4` 12 passed). 검증 큐 재시작 #83→#82→#78→#79 → **PR #85(T-4-022, 사용자·Codex 통합, 2026-09-05 19:01 `a2354a5`)로 main 반영**. 원 PR #83 MERGED |
| T-4-023 | — | web(e2e)·qa | SCR-032 대표팀 소집 자연 플레이 도달 seed 탐색(0.3.0/0.2.0, 200 seed×30시즌)·360px 캡처 2장·phase4-seeds 갱신 (D-62 출시 QA 잔여) | T-4-022 | done | [브리프](briefs/T-4-023.md). Sonnet 5 워커(턴 종료 뒤 마무리 워커) PR #100 `6ffc1c4` → 오케스트레이터 체인 EXIT 0(e2e 98 passed) → 2026-09-05 21:55 squash 머지 `42046ef`. 0.3.0 seed `offside-nat-search-0` 시즌 20 step 8 EVT-NAT-001(RATING_AND_POPULARITY: baseOvr 73<78, popularity 100%≥60%), 0.2.0은 시즌 19. `phase4-seeds.ts` NATIONAL_TEAM·reachability 항목(53.9s)·`find-seed.ts` 출력 필드, 캡처 `docs/qa/phase34/national-team*.png` |
| T-4-024 | — | web·api | 실사용자 플레이 시간 측정 준비: `season_settled`·`step_passed`에 초 단위 `elapsedSec` 추가, 측정 쿼리·프로토콜 문서(오케스트레이터) | T-2-012 | done | [브리프](briefs/T-4-024.md). Sonnet 5 워커 PR #94 `adfa212` → 리뷰 후속 3건 `30ad35c` → 오케스트레이터 체인 EXIT 0(e2e 98 passed) → 2026-09-05 20:40 squash 머지 `232bc83`. `season_settled`·`step_passed`에 `elapsedSec`(정수 초, 상한 7200, optional), 호출부 careerId 배선. 측정 프로토콜 [play-time-measurement.md](../qa/play-time-measurement.md). staging 반영은 U-017 뒤 |
| T-4-028 | — | web(문구) | 대표팀 `agent` 축 문구 정합: SCR-032 안내·SCR-014 결과 맥락 2줄 (P4-7 문구 게이트, T-4-023 캡처에서 확인) | T-4-023 | done | [브리프](briefs/T-4-028.md). Sonnet 5 워커 PR #98 `d816420` → 오케스트레이터 체인 EXIT 0(e2e 98 passed) → 2026-09-05 21:47 squash 머지 `452d32d`. SCR-032 안내·SCR-014 결과 맥락에 "에이전트 관계(협회 관계의 대리값)" 명시(D-66) |

## Phase 5 백로그 (장기 성장·은퇴·Legacy — 2026-09-06 통합 PR #103으로 종결)

사용자 세션이 Phase 5를 구현·통합했다(PR #70·#71 → #77 보류 → #103 통합, `fb8b782`, 09:46). 배포 후 인수 검증은 PR #106(10:01). 정본은 [Phase 5 계획](phase-5-plan.md)·[인수 감사](phase-5-acceptance-audit.md)·[검증 기록](phase-5-verification.md)·[통합 기록](game-experience-refresh-2026-09-06.md). 후속 이슈 #104(GK 관계 이벤트·NPC 이름 충돌)·#105(챕터 제목 내부 TAG 노출)는 Phase 7 표에 있다.

| ID | 패키지 | 내용 | 상태 | 비고 |
|---|---|---|---|---|
| T-5-001 | domain | 통산 기록 projection, 정규화된 Legacy 가중합·밴드, 엔딩 우선순위 | completed | PR #70 `3a5a79e` (9/5) |
| T-5-002 | domain·contracts·api | 통산·업적 정본, 불변 Archive, Legacy 1.1 저장 계약·버전/checksum, D1 owner GET·복구·삭제 | completed | PR #71 → #103. 구버전 hash/null binding·신규 1.1 재로드 확인 |
| T-5-003 | domain | 다년 성장·노쇠, 은퇴 압력, 마지막 선택, RETIRE/terminal 명령 거부, 연령 회귀 | completed | PR #103. 신규 1.1 실제 커리어 은퇴·새로고침 확인 |
| T-5-004 | domain | 기록→Legacy 5축 정규화, source 연결, 동일 품질 4포지션 공정성 | completed | PR #103. 40k 발행·무결성·네 포지션 고득점 경로 확인 |
| T-5-005 | domain·content | 14종 엔딩 eligibility·폴백, 최고 순간·기여 이유·선택하지 않은 기회 | completed | PR #103. RAW_EVIDENCE 검증, 자연 플레이 14회 오표현 금지 |
| T-5-006 | web | SCR-025~028 FULL TIME→Legacy→연대기→최종 프로필, 보관함→새 커리어 | completed | PR #103. 실제 1.1 브라우저/API 보관·재로드 확인 |
| T-5-007 | domain·api·web | 4포지션 20시즌 완주, Archive 원자성·복구·변조·중복 요청 회귀, E2E | completed | PR #103·#106. main/expanded 배포와 신규 1.1 실제 은퇴 인수 |
| T-5-008 | domain·content | 한국 복무/휴식/U23/특례/멘토링 규칙 모듈, Archive 연결·연대기 검증 | completed | PR #103. 관련 3파일 17 tests |

## Phase 6 출시 항목 (SEASON 1: KICKOFF — 2026-09-06 12:33 운영 출시, 사용자 세션)

사용자 세션(Codex·Sol·Luna) 작업이라 T- 번호 대신 PR 번호로 적는다. 런북: [production-release.md](../operations/production-release.md)·[public-test-launch.md](../operations/public-test-launch.md)·[two-environments.md](../operations/two-environments.md)·[google-login.md](../operations/google-login.md)·[custom-domain.md](../operations/custom-domain.md)·[ci-and-staging.md](../operations/ci-and-staging.md).

| ID | 영역 | 내용 | 상태 | 비고 |
|---|---|---|---|---|
| PR #102 | CI | PR은 quick checks만, staging 배포는 main에서만(self-hosted runner) | completed | 2026-09-05 23:22. U-017 종결 |
| PR #107 | CI | 수동 `Production Release` 워크플로(가드·D1 검사) | completed | 2026-09-06 11:57 |
| PR #108 | api·web | 시즌 1 무기한 운영 시즌(`svc_season_1`, isTest=false, 종료일 없음)·문의 이메일 | completed | 12:14. U-010 해소, LINE TEST 대체 |
| PR #109·#110 | api | 릴리스 검사 D1 compound select 상한·독립 count 쿼리 | completed | 12:22·12:29 |
| 운영 출시 | 배포 | `Production Release` run 34009144236 (`82a46fc`) 성공 → 시즌 1 오픈 | completed | 12:33. 기록 PR #111(12:40) |
| PR #112·#114 | api·web | Google 로그인 운영 연결(개인 GCP `offside-football-prod`)·재인증 중 미동기화 진행 보존 | completed | 13:11·13:29, 운영 배포 13:15 run 34010879775. U-003 완료, 브랜딩 인증은 Phase 7 |
| PR #117·#118·#119 | web·CI | 공개 가이드·opt-in SEO → `offside-lab.com` 도메인 연결(legacy 로그인 호환) → 공개 검색 허용 | completed | 19:49~20:02. U-001 완료 |
| PR #122·#127 | CI·infra | staging·production 두 환경으로 정리(expanded 삭제, 참조 정리) | completed | 22:25·23:09 |

## Phase 7 운영 항목 (라이브 운영·밸런스, 2026-09-06~)

| ID | 영역 | 내용 | 상태 | 비고 |
|---|---|---|---|---|
| QA 3회 | qa | 운영 3회 플레이 QA(Luna, 커리어 A/B/C) — 실패 뒤 회복·성인 진로 전환 약함 | completed | 2026-09-06 [기록](../qa/2026-09-06-production-three-runs/README.md) |
| PR #115·#116 | domain·content·web | 시즌 1 게임성 개선: 19세 시작·성인 진로 진행, 룰셋 1.3.0·팩 0.5.0 운영 활성 + 스모크 안정화 | completed | 17:46·17:52 |
| PR #120·#121 | web | 밝고 정돈된 스포츠 앱 UI/UX 개편, 홈 허브 소식·피드백 | completed | 21:51·22:10. 설계 [app-experience-redesign.md](../design/app-experience-redesign.md) |
| UX-001~005 | web·ui | 구단 이름 커스터마이즈(#128)·설정 푸터(#123)·접이식 설정(#125)·포인트 색상(#126)·앱 버전(#124) + FOUC 제거(#129)·플래그 브랜드(#130) | completed | 23:09~23:32 |
| UX-006~009 | web·ui | 앱 셸 100dvh(#131)·커리어 홈 탭(#134)·TeamBadge(#133)·시네마틱 인트로(#135) + 태그 ID 노출 제거(#132) | completed | 2026-09-07 00:10~01:15 |
| UX-010·011 | web·api | 결과 서사 헤드라인·선수 배너(#139)·트레이딩 카드(#138) + 홈 탭 정리(#136)·api health CORS(#137) | completed | 01:45~01:46 → 01:51~01:52 운영 재배포 `939fe48` |
| 이슈 #104 | content | GK에도 윙어 전용 관계 이벤트 노출, NPC 이름이 선수와 충돌 (P2) | todo | PR #103 후속. 사용자 세션 배정 |
| 이슈 #105 | web | 핵심 경기 제목에 내부 TAG(프로_데뷔) 노출 (P2) | todo | PR #103 후속 |
| staging 승격 | infra | staging 활성 시즌·룰셋·팩을 운영과 맞춤(`svc_line_test` 1.0.0/0.1.0 → 1.3.0/0.5.0) | todo | [two-environments.md](../operations/two-environments.md) |
| 외부 등록 | 운영 | Google 브랜딩 인증, Search Console·네이버 등록 | todo | 사용자 외부 절차. [seo-rollout.md](../operations/seo-rollout.md)·[google-login.md](../operations/google-login.md) |
| 플레이 측정 | 운영 | 실사용자 플레이 시간·퍼널 측정(D1 `analytics_events`, elapsedSec) → D-62 실사용자 판정 | todo | [play-time-measurement.md](../qa/play-time-measurement.md). 시즌 1 데이터 |
| 플랜·모니터링 | 운영 | U-014 Workers Paid 전환, U-004 Sentry DSN | todo | 사용자 액션 |

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

진행 중 워커 없음 (2026-09-07 오전 — 이 세션은 문서 전담. 9/5 밤~9/7 새벽 코드 작업은 사용자 세션(Codex·Sol·Luna)이 PR #91~#139로 직접 머지·배포. 남은 항목은 Phase 7 표와 사용자 액션 U-014·U-004·U-005)

## 완료

| ID | 내용 | 커밋 |
|---|---|---|
| Phase 6·7 (사용자 세션) | PR #102~#139 | 2026-09-05 23:22 ~ 2026-09-07 01:52 | 운영 출시·도메인·Google 로그인·게임성 1.3.0·UI/UX 개편·UX-001~011. 목록은 위 Phase 6·7 표, 운영 재배포 `939fe48` |
| T-5-001~008 | PR #103 `fb8b782` (Phase 5 통합, 사용자 세션) | 2026-09-06 09:46 | 선수 생성·게임 연출·Legacy 1.1·한국 모듈. PR #77 대체, 인수 검증 PR #106. 후속 이슈 #104·#105 |
| T-4-023 | PR #100 `42046ef` | 2026-09-05 21:55 | 대표팀 seed·reachability·캡처 2장(e2e helpers·web test·docs/qa) |
| T-4-028 | PR #98 `452d32d` | 2026-09-05 21:47 | 대표팀 agent 축 문구 2줄(web) |
| T-4-024 | PR #94 `232bc83` | 2026-09-05 20:40 | season_settled·step_passed elapsedSec(web funnel·route, contracts) |
| T-4-017 | PR #90 `84709ec` | 2026-09-05 20:10 | 해시 probe career-12·13, api 테스트 2파일 |
| T-4-005·009·012·014·015·016·018·021 | PR #85 `a2354a5` (T-4-022) | 2026-09-05 | 사용자·Codex 통합 PR로 일괄 반영. 원 PR #78·#79·#82·#83·#84 MERGED. 증거: `docs/qa/phase34-completion.md`·`phase34-acceptance.md` |
| T-4-020 | PR #80 `01be661` | 2026-09-05 | 핫픽스: injury.spec poll `textContent` 타임아웃(반복 60초 타임아웃의 실제 원인). 체인 e2e 98 passed |
| T-4-019 | PR #81 `9bf89fc` | 2026-09-05 | 핫픽스: e2e 헬퍼 `&interested=` 허용·season.spec:121 프리시즌 경로. main 회귀(#74×#76) 해소, 체인 e2e 98 passed |
| T-4-011 | PR #76 `25544b3` | 2026-09-05 | Sonnet 5 구현 + 오케스트레이터 커밋·개설. 체인 CHAIN EXIT 0(e2e 97, STAY 카드 a11y 0) |
| T-4-010 | PR #74 `552481c` | 2026-09-05 | Sonnet 5 두 세션(한도 중단·WIP 이어받기). 체인 재실행 CHAIN EXIT 0(e2e 97) |
| T-4-008 | PR #75 `13eeaaf` | 2026-09-05 | Sonnet 5 두 세션(한도 중단·WIP 이어받기), 이벤트 12·챕터 3·도달성 테스트. 체인 CHAIN EXIT 0(content 22/22, e2e 96) |
| T-4-013 | PR #73 `add9f53` | 2026-09-05 | Sonnet 5, 타임아웃 2줄. 체인은 api 파일 부하 게이트 뒤 단독 재실행 통과, e2e 96 passed |
| T-4-006(domain) | PR #72 `518db98` | 2026-09-05 | Sonnet 5 두 세션(한도 중단·WIP 이어받기), 테스트 전용 13파일 +2,897. 체인은 부하 타임아웃 2파일 단독 재실행 통과, e2e 96 passed |
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
| T-3-004 | career-10·11 strict 명령·snapshot 불변 검증, API PUT 3경로·멱등·크기 probe, engine replay/fork/import, 브라우저 Worker hash probe, CompareCards e2e 시드 고정. 제품 동작 변경 없음 | dc2cbaa |
| (fix) | 로컬 QA 화면 표시 오류 4건(#57 컵 코드 한국어, #60 0분 출전·미사용 교체 제외, #58 진로 서사 고정 문구, #59 입단 테스트 내부 ID 노출) | 0b9fb69 |
| T-4-002 | 결정론적 부상·재활·재발·후유증 모델, INJURY forced pending 우선, career-12-injury 골든 | 27292d4 |
| T-3-005 | 계약·협상·이적 UI: PRE_NEGOTIATION 제안 비교·협상·거절·수락, LOAN_RETURN 결정, SCR-020 결과 복구. Phase 3 코드 종료 | 3032bdd |
| T-4-003 | 관계 감사 로그·memory tag LRU, 결산 평판·주장단·감독 교체 예약, Phase 4 태그 5종, SLUMP/LOCKER_ROOM/ETHICS/MEDIA 이벤트 | b180536 |
| T-3-003 | 이적시장 명령 4종·결산 배선·임대·약속 위반·Phase 3 태그 5종·golden career-10/11. Luna Max 사후 리뷰로 태그 판정 순서·LOAN 팬 페널티·임대 만료 자동 FA 복원 P1 3건 수정, 처리기 행렬 회귀 테스트 11건 추가. 새 head CI·전체 테스트 통과 | e1ae3de |
| T-4-004 | PR #68 `29e1a08` | 2026-09-05 | 대표팀 차출·데뷔 예약. Luna Max 구현·독립 리뷰 2회, 정리 커밋 44b04f8, Codex 머지 |
| T-2-016 | staging 리허설 자동화: `playwright.staging.config.ts`(webServer 없음, workers 1·retries 0, testMatch 전용)·`staging-rehearsal.spec.ts`(온보딩→첫 계약→FAST 시즌→결산, LINE TEST 안내, careerId·복구 코드 attachment)·`e2e:staging`·README 절, 기본 config testIgnore. PR #69, 리뷰 수정 0건 | a468837 |
| T-4-007 | 디자인 PR #66 재통합: origin/main(29e1a08) merge 커밋 5bb89e6(chapter·contract·offers·index 충돌 "기능 main·시각 design", diff 오정렬 2건 수동 교정), SCR-020 디자인 정합·mobile-game-refresh 표 4행(07f2ce4). 체인 녹색(contrast 30/30, e2e 96/96). PR #66은 사용자가 머지 | 7bd3d84 |
