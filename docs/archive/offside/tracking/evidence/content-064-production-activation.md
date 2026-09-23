# 콘텐츠 팩 0.6.4 운영 활성화 준비 검증

- 기준: `origin/main` = `e71c71c59111d657f4e03845d84671baa509a77f` (PR #233, #234 포함), 작업 시작 시 clean.
- 목표: production `svc_season_1`의 고정 메타데이터와 ruleset `1.7.0`을 유지하면서 content pack만
  `0.6.3`에서 `0.6.4`로 compare-and-set한다.
- 보존: 기존 승인 manifest 5개, 과거 pack/ruleset/checksum, 생성 시 버전에 고정된 커리어,
  ruleset `1.7.0`의 성장·은퇴·리그 밸런스. 콘텐츠 팩과 룰셋 파일은 수정하지 않았다.

## 구현 범위

- `production-release.mjs`: target `1.7.0/0.6.4`, previous `1.7.0/0.6.3`.
- API: `1.7.0/0.6.4`를 승인 목록 끝에 추가하고 기존 5개 pair를 유지.
- web/비운영: ACTIVE 폴백, local `svc_kickoff`, staging `svc_line_test`, smoke와 rehearsal 기대값을
  `1.7.0/0.6.4`로 동기화.
- release test: 정확한 운영 시작 시각 `2026-09-05T15:00:00Z`와 `ends_at IS NULL`을 CAS WHERE에
  고정하고, activate/noop/rollback/mixed pair 실패 및 seed/smoke 값 동기화를 검증.
- 운영 런북: 5차 승격 순서, root 전용 배포 경계와 역 CAS 롤백 절차를 추가.

## 검증 (Node 22.23.1)

- PASS: `pnpm lint`
- PASS: `pnpm lint:deps`
- PASS: `pnpm typecheck`
- PASS: `pnpm content:validate` — pack `0.6.3` checksum
  `b7eac78ecd9ea3e56baecc57017ba041f5b0fad428b9b0f3c918a0d1ca3a9f5f`, pack `0.6.4` checksum
  `d53c96f2b43182847b17e101e1b90b7c1757fda6c8aef630d4a8a0269b2acc37`, ruleset `1.7.0` checksum
  `e417df41d3dc5dbbc2f4c8fe8d9c5f51940489221d600e530d98d023cecc8766`.
- PASS: focused release/API/web tests — 10 + 4 + 9 tests.
- PARTIAL: one concurrent `pnpm test` wave passed 8 packages, while two API cases hit the 5-second
  timeout. This run alone does not establish a product regression or its root cause.
- PASS: isolated complete API suite, 34 files / 230 tests; isolated complete web suite,
  83 files / 658 tests plus SEO 4 tests. The two concurrent timeout cases also passed alone (18/18).
- PASS: `pnpm build`.
- PASS: `pnpm --filter @offside/web check:bundle` — initial JS 105.13 KiB gzip / 300 KiB.
- PASS: focused Playwright `e2e/service-season.spec.ts` — 4 passed, actual-API case 1 skipped by config.
- PASS: `git diff --check`.

## 제한과 인계

- 운영 D1을 읽거나 쓰지 않았고 production/staging deploy, workflow 실행, merge를 하지 않았다.
- 실제 staging smoke와 actual-API Playwright, production 360px 신규·기존 커리어 및 은퇴 플레이는
  배포 뒤 root가 수행해야 한다.
- sandbox 내 최초 전체 테스트는 Wrangler log와 tsx IPC `EPERM`으로 중단됐다. 승인된 범위에서
  sandbox 밖으로 재실행했으며, 이후 동시 full wave의 API timeout 2건은 package 단독 실행에서 모두 통과했다.
- Prettier check는 4개 기존 파일의 전체-file formatting 차이를 보고했다. activation과 무관한 줄까지
  넓게 재서식하지 않았으며 ESLint, typecheck, diff whitespace 검사는 통과했다.
