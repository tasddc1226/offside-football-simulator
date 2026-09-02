# 진행 보드

갱신: 2026-09-02. 상태는 `todo`, `in-progress`, `in-review`, `blocked`, `completed`.

## 현재 게이트

**종이 프로토타입 → Phase 0 진입.** Phase 0은 사용자 액션 3건(U-001~003)과 프로토타입 플레이 기록이 있어야 시작한다.

## 사용자 액션

| ID | 내용 | 상태 | 메모 |
|---|---|---|---|
| U-001 | 도메인 구매, 네임서버를 Cloudflare로 | todo | ADR-006 후보 참고 |
| U-002 | Cloudflare 계정과 Workers Paid 플랜, API 토큰을 GitHub Secrets에 등록 | todo | ADR-007 |
| U-003 | Google Cloud 프로젝트에서 OAuth 클라이언트 ID·시크릿 발급 | todo | ADR-008. 콜백 URL은 도메인 확정 후 |
| U-004 | Sentry 프로젝트 생성, DSN 등록 | todo | ADR-007 |
| U-005 | 종이 프로토타입 3회 플레이, `docs/content/prototype/playtest-log.md` 작성 | todo | 오케스트레이터가 양식 제공 |
| U-006 | ADR-001~008 검토·승인 또는 반려 | todo | 반려 시 결정 로그에 사유 |

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

Phase 0 완료 조건은 [`phase-00-foundation.md`](../phases/phase-00-foundation.md)를 따른다.

## 진행 중

없음.

## 완료

| ID | 내용 | 커밋 |
|---|---|---|
| D-001 | 문서 전체 검토와 보강(시간 모델·브랜드·시각 시스템·Legacy·화면 6종·종이 프로토타입) | 2f1e070 |
| D-002 | 기술 스택·인프라 ADR-001~008, 진행 관리 체계 | 이 커밋 |
