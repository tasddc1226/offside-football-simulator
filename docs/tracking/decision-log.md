# 결정 로그

날짜 역순. ADR로 승격된 결정은 링크만 남긴다.

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
