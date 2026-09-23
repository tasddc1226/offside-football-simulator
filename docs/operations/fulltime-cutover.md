# 풀타임(fulltime) 운영 전환 — 1회성 cutover 런북

T-9-001 마이그레이션(React/서버 저장 게임 → 바닐라 TypeScript + localStorage 저장 "풀타임" 게임)을
운영에 반영하는 절차다. migration `0015`가 운영 D1의 모든 게임 테이블(`careers`, `snapshots`,
`service_seasons`, `command_log` 등)을 **영구히 드롭**한다. 운영에 실제 사용자가 없다는 전제로
설계했다 — 있다면 이 절차를 실행하기 전에 반드시 재확인한다.

이 문서는 OWNER(저장소 소유자)가 직접 실행해야 하는 수동 단계를 순서대로 나열한다. 각 단계 앞에
**[되돌릴 수 없음]** 또는 **[되돌릴 수 있음]**을 표시했다.

## 0. 전제 조건

- [되돌릴 수 있음] 이 브랜치 계보(T-9-001a/b/c)의 PR이 모두 main에 머지되고 `ci.yml`이 main에서
  통과했는지 확인한다.
- [되돌릴 수 있음] 운영 D1(`offside-production`)에 실제 사용자 커리어가 없다는 것을 확인한다
  (`SELECT COUNT(*) FROM careers` 등 — preflight의 migration 전 집계 건수로도 간접 확인 가능하나,
  careers/snapshots는 preflight가 읽는 5개 테이블에 포함되지 않으므로 필요하면 별도 조회한다).
  있다면 중단하고 데이터 보존 계획을 먼저 세운다.

## 1. 머지

- [되돌릴 수 있음] T-9-001c(이 작업)를 포함한 모든 관련 PR을 main에 머지한다.
- 머지된 main SHA를 기록한다(`git rev-parse origin/main`). 이후 모든 단계에서 이 SHA를
  `expected_sha`로 사용한다.

## 2. Production Release preflight 실행

- [되돌릴 수 있음] GitHub Actions → **Production Release** → Run workflow.
  `mode=preflight`, `expected_sha=<1단계 SHA>`.
- 요약에서 다음을 확인한다:
  - D1 Time Travel bookmark가 기록됐는지(비상 복구용).
  - 현재 스키마에 옛 게임 테이블이 아직 있는지(있는 것이 정상 — 아직 `0015`를 적용하지 않았다).
  - `profiles`/`sessions`/`auth_attempts`/`audit_log`/`idempotency` 집계 건수.

## 3. Production Release deploy 실행 — **[되돌릴 수 없음]**

- GitHub Actions → **Production Release** → Run workflow.
  `mode=deploy`, `expected_sha=<1단계 SHA>`, `confirmation=DEPLOY_PRODUCTION`.
- 이 실행이 `pnpm --filter @offside/api db:migrate:production`으로 `0015`를 적용해
  careers/snapshots/service_seasons 등 모든 게임 테이블을 드롭한다. **적용 후에는 되돌릴 수 없다**
  — D1 Time Travel로 migration 이전 시점까지 되돌리는 것 외에는 복구 수단이 없고, 그 경우 이후에
  생긴 프로필/세션도 함께 사라진다.
- 이어서 API → (Google secret 동기화, 설정돼 있으면) → web 순으로 배포하고, web-readiness와
  health/profile/web read-back까지 통과해야 workflow가 성공으로 끝난다.
- 실패하면 [production-release.md](production-release.md)의 "실패 시 점검 순서"를 따른다.

## 4. 검증

- [되돌릴 수 있음] `curl https://api.offside-lab.com/v1/health` 200.
- [되돌릴 수 있음] `curl https://api.offside-lab.com/v1/profile` 200 (익명 프로필이 새로 생성된다 —
  운영에 실사용자가 없으므로 문제 없다. QA 목적이 아니면 굳이 반복 호출하지 않는다).
- [되돌릴 수 있음] `https://offside-lab.com/`을 열어 `오프사이드` 문구와 온보딩까지 정상 동작하는지
  확인한다. `/guide/`, `/legal/privacy/`, `/legal/terms/`도 200인지 확인한다.
- [되돌릴 수 있음] 브라우저에서 실제로 선수를 한 명 만들어 온보딩 → 첫 시즌 진행 → 새로고침 후
  localStorage 저장이 유지되는지 확인한다(서버에는 저장되지 않는다 — 정상 동작이다).

## 5. 선택: 정리

- [되돌릴 수 있음] staging/과거 preview D1의 남은 QA 데이터를 정리한다(원한다면 —
  운영에는 영향 없음). `docs/operations/ci-and-staging.md`의 "이전 Preview 정리"를 참고한다.
- [되돌릴 수 있음] Google Cloud Console(OAuth 동의 화면)에서:
  - 앱 이름 `오프사이드 (OFFSIDE)`가 여전히 유효한지 확인한다(브랜딩 인증은 별도 게이트이며 이
    cutover로 자동 완료되지 않는다).
  - 개인정보 처리방침 URL을 `https://offside-lab.com/legal/privacy/`로, 이용약관 URL을
    `https://offside-lab.com/legal/terms/`로 갱신한다(끝의 슬래시까지 정확히 맞춘다 — `seo.mjs`가
    생성하는 실제 경로다).
  - 저장 후 페이지를 다시 열어 값이 유지되는지 재확인한다. client secret은 출력·복사하지 않는다.

## 요약: 되돌릴 수 없는 지점

| 단계 | 되돌릴 수 있음? |
| --- | --- |
| 0~2 (전제 확인, 머지, preflight) | 예 — 아무것도 쓰지 않는다 |
| 3의 `db:migrate:production` (0015 적용) | **아니오** — 게임 테이블 영구 삭제 |
| 3의 API/web 배포, 4의 검증 | 예 — 재배포로 수정 가능(단, 0015 자체는 되돌릴 수 없음) |
| 5 (정리, GCP 설정) | 예 |
