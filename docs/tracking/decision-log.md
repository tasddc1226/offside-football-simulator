# 결정 로그

날짜 역순. ADR로 승격된 결정은 링크만 남긴다.

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
