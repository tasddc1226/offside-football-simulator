# 운영 배포 런북 — Production Release workflow

T-9-001(풀타임 마이그레이션) 이후 버전. `apps/web`은 localStorage 저장 방식의 클라이언트 전용
"풀타임" 커리어 게임이고, `apps/api`는 health·profile·Google 로그인만 남았다. `service_seasons`를
포함한 모든 게임 테이블은 migration `0015`가 드롭한다. migration 적용 후 운영 D1에 남는 테이블은
`profiles`·`sessions`·`auth_attempts`·`audit_log`·`idempotency` 다섯 개뿐이다. 시즌 manifest
compare-and-set, ruleset/content pack 승격, 시즌 종료일 변경 같은 옛 절차는 더 이상 존재하지 않는다
— 남은 게임 데이터가 없으므로 데이터 보존도 더 이상 고려사항이 아니다.

2026-09-06~09-23의 시즌 1 승격 이력(ruleset/content pack 버전 전환, `set-season-end` 모드,
`season-rollback.sql` 등)은 이 마이그레이션으로 전부 무의미해졌다. 과거 기록이 필요하면 git 이력에서
이 파일의 이전 버전을 참고한다.

## 실행 대상: `.github/workflows/deploy-production.yml` ("Production Release")

- 트리거: `workflow_dispatch`만. `mode`는 `preflight`(읽기 전용) 또는 `deploy`.
- `main` ref만 허용하고, `expected_sha`가 checkout한 HEAD·원격 `main` 양쪽과 정확히 같아야 한다.
- `deploy`는 `confirmation` 입력이 정확히 `DEPLOY_PRODUCTION`이어야 통과한다.
- `concurrency: cloudflare-production`으로 직렬 실행한다(취소 없음).
- 두 모드 모두 D1 Time Travel bookmark, 현재 스키마, 남은 5개 테이블의 집계 건수를 확인·기록한다.
  스키마가 예상(위 5개 테이블)과 다르면 요약에 남지만 preflight 자체를 실패시키지 않는다 — `0015`
  적용 전(최초 cutover의 preflight)에는 게임 테이블이 아직 남아 있어 당연히 불일치이기 때문이다.
  migration 적용 뒤에는 정확히 일치해야 하며, 다르면 배포를 실패시킨다.

### `preflight`

읽기 전용. D1 bookmark·스키마·집계 건수만 확인하고 아무것도 쓰지 않는다. 배포 전 검토용이다.

### `deploy`

1. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`이 둘 다 있거나 둘 다 없는지 검증한다(하나만 있으면 실패).
2. `VITE_API_BASE_URL=https://api.offside-lab.com`로 웹을 빌드하고 `check:bundle`을 통과한다.
3. D1 bookmark·스키마·집계 건수(migration 전)를 기록한다.
4. `pnpm --filter @offside/api db:migrate:production` — 등록된 migration을 순서대로 적용한다.
   최초 cutover에서는 이 단계가 `0015`(게임 테이블 드롭)를 적용한다. **이 단계는 되돌릴 수 없다**
   — `0015`가 적용되면 careers/snapshots/service_seasons 등은 영구히 사라진다.
5. migration 후 집계 건수와 스키마를 다시 확인한다. 스키마가 위 5개 테이블과 정확히 다르면 실패한다.
6. `pnpm --filter @offside/api deploy:production`.
7. Google secret이 설정돼 있으면 `wrangler secret bulk`로 API worker에 동기화한다.
8. `pnpm --filter @offside/web deploy:production`.
9. `tooling/scripts/web-readiness.mjs`로 배포된 웹이 이번에 빌드한 자산(모듈 entry·CSS의
   SHA-256)을 실제로 서빙하는지 확인한다(2회 연속 일치, 요청당 10초·전체 180초 한도, redirect 거부).
10. read-back: `GET $PRODUCTION_API_URL/v1/health` 200, `GET $PRODUCTION_API_URL/v1/profile` 200
    (인증 없이도 익명 프로필을 만들고 200을 반환한다 — 운영에 실사용자가 없으므로 문제 없다),
    `GET $PRODUCTION_WEB_URL/`가 200이며 본문에 `오프사이드`를 포함.

실패한 단계 이후의 단계는 실행되지 않는다(예: web-readiness 실패 시 read-back을 하지 않음). 워크플로
자체에 자동 롤백은 없다 — 문제가 생기면 사람이 판단해서 수정 배포하거나 `wrangler d1 time-travel
restore`로 되돌린다(그 경우도 그 시점 이후의 사용자 프로필/세션은 사라진다는 뜻이다).

## `tooling/scripts/production-release.mjs`

read-only 보고 유틸리티. 시즌/manifest 관련 커맨드(`seasons`, `plan`, `plan-end`, `proposal`,
`expect-version`)는 대응하는 테이블이 사라져 전부 제거했다. 남은 커맨드:

- `bookmark <wrangler-json>` — Time Travel 응답에서 bookmark 문자열을 찾아 `$GITHUB_STEP_SUMMARY`에 남긴다.
- `schema <wrangler-json>` — 테이블 목록을 `EXPECTED_TABLES`(profiles/sessions/auth_attempts/
  audit_log/idempotency)와 비교해 `true`/`false`를 stdout에 쓰고 요약에 남긴다. 실패시키지 않는다
  — 워크플로가 migration 전/후 어느 시점인지에 따라 이 값을 어떻게 쓸지 결정한다.
- `counts <wrangler-json>` — 집계 count 쿼리 결과를 정리해 요약에 남긴다.

테스트는 `tooling/scripts/production-release.test.mjs` (`pnpm --filter @offside/scripts test`).

## 사전 확인

1. 배포할 main SHA가 CI(`ci.yml`)의 최근 성공한 main push와 같은 계보인지 확인한다.
2. 운영 Worker/D1 이름·ID를 확인한다 — `offside-api`/`offside-web`, D1 `offside-production`
   (`2cfe462c-204e-4842-805c-5840fc9b1758`). 원격 DB는 스키마·집계 건수만 읽고 개별 프로필/세션
   내용은 출력하지 않는다.
3. migration 적용 전 Time Travel bookmark를 확보한다. 계정별 보존 기간을 확인하며 무기한 백업으로
   오인하지 않는다. 일일 R2 export/Cron은 이 저장소에 구현돼 있지 않다.

## 최초 cutover (게임 테이블 드롭)

이 저장소의 첫 `deploy` 실행은 `0015`를 적용해 운영 D1에서 careers/snapshots/service_seasons 등
모든 게임 테이블을 영구히 드롭한다. 실행 순서와 "되돌릴 수 없는 단계" 표시는
[fulltime-cutover.md](fulltime-cutover.md)를 따른다. 사전에 사용자(OWNER) 승인이 필요하다.

## 실패 시 점검 순서

- `expected_sha` 불일치: 최신 main SHA로 다시 실행한다. 다른 브랜치/오래된 SHA를 강제로 배포하지 않는다.
- Google secret 절반만 설정: 워크플로가 그 단계에서 멈춘다. 두 secret을 모두 채우거나 모두 비운다.
- migration 후 스키마 불일치: 배포를 중단하고 원인을 조사한다. 강제로 다음 단계를 진행하지 않는다.
- web-readiness 실패(자산 전파 지연): 몇 분 뒤 워크플로를 다시 실행하거나, Cloudflare 대시보드에서
  실제 배포된 Worker 버전을 확인한다. 이 gate를 끄거나 이전 해시를 허용해 진행하지 않는다.
- read-back 실패: API/web 로그와 CORS·health 응답을 직접 확인한다. 필요하면 `preflight`를 다시
  돌려 현재 상태를 읽기 전용으로 점검한다.

## 이전 시즌 승격 이력 (마이그레이션 0015로 무의미해짐)

이 파일의 이전 버전에는 시즌 1의 ruleset/content pack 승격(1.1.0/0.3.0 → … → 2.0.0/0.7.0) 각각의
실행 절차와 배포 기록이 있었다. `service_seasons` 테이블 자체가 드롭됐으므로 그 절차는 더 이상
실행할 수 없다. 과거 배포 시각·Worker 버전·검증 기록이 필요하면 git 이력에서 이 파일을 찾는다.
