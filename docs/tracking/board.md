# 진행 보드

갱신: 2026-09-02. 상태는 `todo`, `in-progress`, `in-review`, `blocked`, `deferred`(사용자 결정 전 보류), `completed`.

## 현재 게이트

**종이 프로토타입 → Phase 0 진입.** Phase 0은 사용자 액션 U-001~003과 프로토타입 플레이 기록이 있어야 시작한다. 앱인토스 출시 준비(U-007~U-011, M-001~M-006)는 사용자가 미니앱 출시를 결정할 때 착수한다.

## 사용자 액션

| ID | 내용 | 상태 | 메모 |
|---|---|---|---|
| U-001 | 도메인 구매, 네임서버를 Cloudflare로 | todo | ADR-006 후보 참고 |
| U-002 | Cloudflare 계정과 Workers Paid 플랜, API 토큰을 GitHub Secrets에 등록 | todo | ADR-007 |
| U-003 | Google Cloud 프로젝트에서 OAuth 클라이언트 ID·시크릿 발급 | todo | ADR-008. 콜백 URL은 도메인 확정 후 |
| U-004 | Sentry 프로젝트 생성, DSN 등록 | todo | ADR-007 |
| U-005 | 종이 프로토타입 3회 플레이, `docs/content/prototype/playtest-log.md` 작성 | todo | 오케스트레이터가 양식 제공 |
| U-006 | ADR-001~009 검토·승인 또는 반려 | todo | 반려 시 결정 로그에 사유 |
| U-007 | 앱인토스 콘솔 가입(토스 비즈니스, 만 19세), 워크스페이스·제작자 이름, 앱 등록(유형 **게임**, `appName` 확정), 고객문의 이메일 | deferred | ADR-009, ADR-006. appName은 변경 불가 |
| U-008 | 앱인토스 서버 mTLS 인증서 발급 → `wrangler mtls-certificate upload`, certificate_id 공유 | deferred | ADR-007. U-002·U-007 이후 |
| U-009 | 게임물 등급분류 신청(GRAC, 스토어명 `기타-앱인토스`). 개인 신청 가능 여부 먼저 확인 | deferred | ADR-009. 10~15일 + 수수료. 증명서 PDF를 콘솔에 등록 |
| U-010 | 이 세션에서 `/mcp` → `apps-in-toss-console` 인증 완료 | deferred | 서버는 등록됨, OAuth 로그인만 남음 |
| U-011 | (U-009에서 개인 신청 불가 시) 개인사업자 등록 후 콘솔 사업자 등록 | deferred | 조건부. 면세 사업자 불가 |

## Phase 0 백로그 (착수 순서)

| ID | 작업 | 참조 | 상태 | 워크트리 |
|---|---|---|---|---|
| T-0-001 | 모노레포 골격: pnpm·Turborepo·tsconfig·ESLint·의존 방향 lint | ADR-005 | todo | |
| T-0-002 | `packages/domain` 순수 `simulate` fixture와 state hash, 결정론 1,000회 테스트 | RULE-RNG-001, TEST | todo | |
| T-0-003 | `packages/contracts` 응답 봉투·오류 코드·Snapshot 직렬화 Zod | 07 | todo | |
| T-0-004 | `packages/content` Zod 스키마와 `content:validate` CLI, 프로토타입 이벤트 10개를 팩 0.1.0으로 | ADR-004, 04 | todo | |
| T-0-005 | `apps/api` Hono 골격, D1 스키마(LocalProfile·Career·Snapshot·CommandLog·Idempotency·ServiceSeason), Drizzle migration | 02, ADR-007 | todo | |
| T-0-006 | 익명 프로필 쿠키, `GET /profile`, requestId·구조화 로그·오류 봉투 | API-PRO-001, 01 | todo | |
| T-0-007 | `packages/engine-client` Dexie 저장소, Web Worker 엔진 래퍼, revision·commandId 멱등성 | 05, ADR-003 | todo | |
| T-0-008 | Career 동기화 `PUT /careers/{id}` If-Match 409, 100회 병렬 멱등 테스트 | API-CAR-003, 05 | todo | |
| T-0-009 | `apps/web` Vite·Router·Tailwind 토큰·상태 훅 골격, 허브 빈 상태 화면 | ADR-001, 13 | todo | |
| T-0-010 | GitHub Actions CI, Pages·Workers preview 배포, staging migration | ADR-007 | blocked | U-002 필요 |
| T-0-011 | 브라우저·Workers 동일 fixture state hash 일치 테스트 | ADR-003 | todo | T-0-002, 007 이후 |
| T-0-012 | `packages/platform` 골격: `LocalStore` 포트와 `Platform` 인터페이스, web 구현(Dexie), toss 스텁(SDK 의존성 없음), 화면·엔진의 SDK import·채널 분기 lint | ADR-009, ADR-005 | todo | T-0-007 이후 |

Phase 0 완료 조건은 [`phase-00-foundation.md`](../phases/phase-00-foundation.md)를 따른다. T-0-006 세션 미들웨어는 쿠키와 Bearer를 모두 받도록 만든다.

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

없음.

## 완료

| ID | 내용 | 커밋 |
|---|---|---|
| D-001 | 문서 전체 검토와 보강(시간 모델·브랜드·시각 시스템·Legacy·화면 6종·종이 프로토타입) | 2f1e070 |
| D-002 | 기술 스택·인프라 ADR-001~009, 진행 관리 체계 | 805f346 |
| D-003 | 앱인토스 미니앱 ADR-009와 채널 반영, 콘솔 MCP 등록 | ce67e1f |
| D-004 | 미니앱은 "언제든 출시 가능한 구조"로 범위 조정, 출시 준비를 보류 백로그로 분리 | 이 커밋 |
