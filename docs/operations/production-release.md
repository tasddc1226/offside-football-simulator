# 운영 배포 런북 — Production Release workflow

풀타임(Phase 9) 이후 버전. `apps/web`은 localStorage에 세이브하는 클라이언트 게임(Svelte 5 SPA)이고,
`apps/api`는 프로필·로그인, 커리어·시즌 요약, 명예의 전당, 게시판, 구단명 커스텀, 서버 밸런스 설정,
운영 도구를 다룬다. migration `0015`가 원작 게임 테이블을 드롭했고, `0016`부터 풀타임용 테이블을
다시 쌓았다. 배포가 기대하는 운영 D1 테이블 목록의 정본은 `tooling/scripts/production-release.mjs`의
`EXPECTED_TABLES`다(2026-09-25 기준 11개: profiles, sessions, auth_attempts, audit_log, idempotency,
careers, career_seasons, club_customs, board_posts, board_comments, balance_versions). 새 테이블을 만드는
migration은 이 목록도 함께 고친다.

2026-09-06~09-23의 시즌 1 승격 절차(ruleset/content pack 버전 전환, `set-season-end` 모드 등)는
`0015`로 무의미해졌다. 과거 기록이 필요하면 git 이력에서 이 파일의 이전 버전을 참고한다.

## 실행 대상: `.github/workflows/deploy-production.yml` ("Production Release")

- 트리거: `workflow_dispatch`만. `mode`는 `preflight`(읽기 전용) 또는 `deploy`.
- `main` ref만 허용하고, `expected_sha`가 checkout한 HEAD·원격 `main` 양쪽과 정확히 같아야 한다.
- `deploy`는 `confirmation` 입력이 정확히 `DEPLOY_PRODUCTION`이어야 통과한다.
- `concurrency: cloudflare-production`으로 직렬 실행한다(취소 없음).
- 두 모드 모두 D1 Time Travel bookmark, 현재 스키마, 주요 테이블의 집계 건수를 확인·기록한다.
  스키마가 `EXPECTED_TABLES`와 다르면 요약에 남지만 preflight 자체를 실패시키지 않는다 — 새 테이블을
  만드는 migration이 아직 적용되기 전이면 당연히 불일치이기 때문이다. migration 적용 뒤에는 정확히
  일치해야 하며, 다르면 배포를 실패시킨다.

### `preflight`

읽기 전용. D1 bookmark·스키마·집계 건수만 확인하고 아무것도 쓰지 않는다. 배포 전 검토용이다.

### `deploy`

1. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`이 둘 다 있거나 둘 다 없는지 검증한다(하나만 있으면 실패).
2. `VITE_API_BASE_URL=https://api.offside-lab.com`로 웹을 빌드하고 `check:bundle`을 통과한다.
3. D1 bookmark·스키마·집계 건수(migration 전)를 기록한다.
4. `pnpm --filter @offside/api db:migrate:production` — 등록된 migration을 순서대로 적용한다.
   **이 단계는 되돌릴 수 없다** — 되돌려야 하면 D1 Time Travel bookmark로 복원한다.
5. migration 후 집계 건수와 스키마를 다시 확인한다. 스키마가 `EXPECTED_TABLES`와 다르면 실패한다.
6. `pnpm --filter @offside/api deploy:production`.
7. Google secret이 설정돼 있으면 `wrangler secret bulk`로 API worker에 동기화한다. `ADMIN_EMAILS`
   secret(운영 도구·게시판 관리자)도 있으면 같은 방식으로 옮긴다.
8. `pnpm --filter @offside/web deploy:production`.
9. `tooling/scripts/web-readiness.mjs`로 배포된 웹이 이번에 빌드한 자산(모듈 entry·CSS의
   SHA-256)을 실제로 서빙하는지 확인한다(2회 연속 일치, 요청당 10초·전체 180초 한도, redirect 거부).
10. read-back: `GET $PRODUCTION_API_URL/v1/health` 200, `GET $PRODUCTION_API_URL/v1/profile` 200
    (인증 없이도 익명 프로필을 만들고 200을 반환한다 — 운영에 실사용자가 없으므로 문제 없다),
    `GET $PRODUCTION_WEB_URL/`가 200이며 본문에 `오프사이드`를 포함.
11. **릴리즈 태그** (`release-tag` 잡, 위 단계가 모두 성공했을 때만): `.github/scripts/release-tag.mjs`가
    기존 `v*` 태그를 보고 `vYYYY.MM.DD.N`(KST 날짜 + 그날 순번)을 정하고, `gh release create`로 배포한
    SHA에 태그와 GitHub 릴리즈를 만든다. 노트는 배포 실행 링크 + 직전 릴리즈 이후 머지된 PR 목록
    (`--generate-notes`). 같은 SHA를 다시 배포하면 새 태그를 만들지 않는다. 이 잡만 `contents: write`
    권한을 갖는다.
12. **앱 OTA** (`app-update` 잡, T-11-010, 위 배포가 성공했을 때만): 같은 커밋의 앱 JS 번들을
    `eas update --channel production --environment production`으로 EAS Update에 올린다. 스토어 앱은 다음
    실행 때 받거나, 앱으로 돌아올 때 받아 두고 '다시 시작' 배너로 바로 적용한다.
    - 직전 production OTA 커밋 이후 `apps/mobile`·`packages`·루트 `package.json`·`pnpm-lock.yaml`이 그대로면
      게시하지 않는다(웹·API만 바뀐 배포에 새 버전 배너가 뜨지 않게).
      판단 전에 `pnpm install`을 한다(eas가 `app.json` 플러그인을 풀어야 조회가 된다).
    - `runtimeVersion`은 `fingerprint` 정책이다. 네이티브(모듈 추가·SDK·`app.json` 네이티브 설정)가 바뀐 커밋은
      런타임이 달라 기존 스토어 앱에 내려가지 않는다 — 그때는 새 스토어 빌드(`eas build`)와 심사가 필요하다.
    - 게시 전에 플랫폼별 `eas fingerprint:generate` 해시를 완료된 production 빌드의
      `runtime.version`과 대조해(`build:list --runtime-version`), 맞는 빌드가 없으면 `::warning::`과 요약 줄을 남긴다(실패시키지는 않는다).
      네이티브 변경이 아닌데 이 경고가 뜨면 `eas.json`·`app.json` 수정을 먼저 의심한다.
    - **`apps/mobile/eas.json`은 수정만 해도 런타임이 바뀐다**(fingerprint source `easBuild`). 2026-09-30
      `submit.production.ios.ascAppId` 한 줄 추가(#393)로 iOS `9e9ebda2`→`9243e6d7`, Android
      `965907c7`→`e9d03a9d`가 되어 그날 OTA가 설치된 어느 앱에도 가지 않았다(T-11-013에서 되돌림).
      `ascAppId` 같은 submit 전용 설정도 다음 네이티브(스토어) 빌드 때 함께 넣는다. `.fingerprintignore`로
      `eas.json`을 빼는 것도 그 자체로 해시를 바꾸므로 새 스토어 빌드와 같이 할 때만 한다.
    - GitHub `production` 환경 secret `EXPO_TOKEN`(expo.dev → Access tokens)이 없으면 이 잡은 건너뛴다.
    - 되돌리기: `cd apps/mobile && npx eas-cli@latest update:rollback` 또는 이전 커밋으로 다시 `eas update`.
    - 앱 OTA가 아직 안 간(또는 옛 런타임) 앱도 한동안 남으므로 API는 하위 호환을 유지한다.

실패한 단계 이후의 단계는 실행되지 않는다(예: web-readiness 실패 시 read-back을 하지 않음). 워크플로
자체에 자동 롤백은 없다 — 문제가 생기면 사람이 판단해서 수정 배포하거나 `wrangler d1 time-travel
restore`로 되돌린다(그 경우도 그 시점 이후의 사용자 프로필/세션은 사라진다는 뜻이다).

## 앱 버전 규칙 (2026-10-02)

`apps/mobile/app.json`의 `version`은 `1.<시즌>.<빌드>`로 쓴다.

| 자리       | 의미                                                         | 올리는 때                                        |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------ |
| 메이저 `1` | 고정                                                         | 앱을 갈아엎는 수준의 변화가 아니면 올리지 않는다 |
| 가운데     | 시즌 번호 — `1.0.x` 프리시즌, `1.1.x` 시즌 1, `1.N.x` 시즌 N | 그 시즌에 처음 내는 스토어 빌드                  |
| 끝자리     | 같은 시즌 안의 스토어 빌드                                   | 네이티브 변경으로 새 스토어 빌드가 필요할 때     |
| 빌드 번호  | EAS가 관리(`appVersionSource: remote`, `autoIncrement`)      | 빌드마다 자동                                    |

- JS만 바뀐 수정은 OTA로 내보내고 버전을 올리지 않는다. 시즌 중 업데이트는 대부분 이쪽이다.
- `version`도 fingerprint에 들어가므로 **버전을 올린 빌드부터 OTA 런타임이 바뀐다**. 새 시즌 빌드(`1.N.0`)를
  낸 뒤의 OTA는 옛 시즌 빌드에 가지 않으니, 시즌 경계마다 스토어 업데이트를 안내한다(T-11-042).
- 버전은 "그 시즌에 처음 낸 빌드" 기준이다. 심사가 늦어 새 시즌이 옛 버전 앱으로 잠깐 시작해도 게임은 그대로 돈다.
- 서버의 시즌 룰셋·콘텐츠 팩 버전과는 별개 체계다. 앱 버전과 맞추지 않는다.
- 시즌 1 개막 빌드는 `1.1.0`이다(GA4, PR #414와 함께). 원래 `1.0.1`로 준비하던 빌드다.

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

## 최초 cutover (완료)

풀타임 전환의 첫 `deploy`가 `0015`로 원작 게임 테이블을 드롭했다(2026-09-24). 당시 절차는
[fulltime-cutover.md](fulltime-cutover.md)에 기록으로 남아 있다.

## 실패 시 점검 순서

- `expected_sha` 불일치: 최신 main SHA로 다시 실행한다. 다른 브랜치/오래된 SHA를 강제로 배포하지 않는다.
- Google secret 절반만 설정: 워크플로가 그 단계에서 멈춘다. 두 secret을 모두 채우거나 모두 비운다.
- migration 후 스키마 불일치: 배포를 중단하고 원인을 조사한다. 강제로 다음 단계를 진행하지 않는다.
- web-readiness 실패(자산 전파 지연): 몇 분 뒤 워크플로를 다시 실행하거나, Cloudflare 대시보드에서
  실제 배포된 Worker 버전을 확인한다. 이 gate를 끄거나 이전 해시를 허용해 진행하지 않는다.
- release-tag 실패: 운영 배포 자체는 끝난 상태다. 워크플로를 다시 돌리지 말고(같은 SHA면 앱은 그대로
  재배포된다) 원인을 고친 뒤 실패한 잡만 다시 실행한다(Re-run failed jobs).
- read-back 실패: API/web 로그와 CORS·health 응답을 직접 확인한다. 필요하면 `preflight`를 다시
  돌려 현재 상태를 읽기 전용으로 점검한다.

## 이전 시즌 승격 이력 (마이그레이션 0015로 무의미해짐)

이 파일의 이전 버전에는 시즌 1의 ruleset/content pack 승격(1.1.0/0.3.0 → … → 2.0.0/0.7.0) 각각의
실행 절차와 배포 기록이 있었다. `service_seasons` 테이블 자체가 드롭됐으므로 그 절차는 더 이상
실행할 수 없다. 과거 배포 시각·Worker 버전·검증 기록이 필요하면 git 이력에서 이 파일을 찾는다.
