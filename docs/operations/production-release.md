# 운영 웹 배포 런북

2026-09-06 사용자가 운영 배포를 승인했다. 이 문서는 기존 staging/expanded 배포와 별도로
운영의 첫 공개를 다룬다. **2026-09-06 12:33 KST 운영 API/web 배포와 후속 브라우저 저장 검증을 완료했다.**
사용자는 첫 시즌을 종료일 미정으로 열고, 나중에 직접 종료일을 정하기로 확정했다.
공개 문의 이메일은 `tasddc1569@gmail.com`으로 승인했다.

후속 완료: 2026-09-06 13:15 KST, PR #112의 `f557fa7`을
[run34010879775](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34010879775)로 운영 배포했다.
개인 계정 전용 프로젝트의 [Google 로그인 연결](google-login.md)은 실제 최초 연결·재로그인·
새로고침에서 기존 ID/revision/hash 보존까지 확인했다. Google 브랜딩 인증은 별도 미완료다.
아래 최초 공개의 검증 범위와 Google 미활성 상태는 최초 배포 시점의 기록이며,
실제 인증 활성화 여부는 연결 런북의 인수 결과를 따른다.

## 범위와 분리

| 대상 | 운영 값 |
| --- | --- |
| 웹 | `https://offside-web.tasddc1569.workers.dev` |
| API | `https://offside-api.tasddc1569.workers.dev` |
| D1 | `offside-production` / `2cfe462c-204e-4842-805c-5840fc9b1758` |
| 신규 운영 시즌 | `svc_season_1`, 표시명 `시즌 1`, ACTIVE, isTest=false |
| 기간 | 2026-09-06 00:00 KST부터, 종료일 미정(`endsAt: null`) |
| 문의 | `tasddc1569@gmail.com` |
| 현재 신규 커리어 버전 | ruleset 1.3.0 / content pack 0.5.0 (승격 대기: 1.4.0 / 0.5.1, 아래 "시즌 1 manifest 2차 승격") |

## 최초 공개 결과

- 구현 PR [#108](https://github.com/tasddc1226/offside-football-simulator/pull/108),
  D1 집계 점검 보정 [#109](https://github.com/tasddc1226/offside-football-simulator/pull/109),
  [#110](https://github.com/tasddc1226/offside-football-simulator/pull/110)을 main에 반영했다.
- 실제 배포 source: `82a46fcb1f21b6e24dffc1e88263632fcea32dad`.
  [운영 deploy run34009144236](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34009144236)
  성공(1분40초), [main staging run34009134418](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34009134418)
  성공(2분1초). 최초 실패에서 적용한 migration은 재실행 때 no-op이었다.
- API Worker version `9eaa9bb0-3007-4c75-bcdc-419ad1da01c6`,
  web Worker version `cec8d1b2-9827-4bb1-816f-3fb0ff876ebe`.
- 성공 배포 직전 bookmark: `00000007-00000000-000050de-b4429cab36d9b6f2d1fee0345d530c06`.
  운영 current API에서 `svc_season_1`, ACTIVE/non-test, `endsAt: null`, ruleset 1.1.0/pack 0.3.0을
  확인했다. health, 정확한 운영 CORS 허용 및 다른 origin 거부, web 200도 통과했다.
- migration 전후 실제 staging careers 11 / snapshots 47 / archives 2 / command_log 395가 동일했다.
  기존 Legacy 1.0/1.1 두 엔딩의 archive/Legacy hash도 동일하며 FK 오류는 0개였다.
- ego-browser 운영 smoke: `운영점검`(남성·대한민국·오른발·중앙 미드필더·클럽 아카데미·중앙 플레이메이커)을
  생성하고 첫 이벤트에서 `주장에게 중재 요청`을 선택했다. QA career ID는
  `ce73f6a6-167b-4c6b-bbd8-2b8053c5fcc3`. API 200, 운영 시즌·버전 고정,
  생성 revision 5와 첫 선택 revision 6의 서버 저장 및 각각 새로고침 후 동일 hash를 확인했다.
  최종 hash는 `bbe8c92c0c21335b3a87196d47fa6324b789b99bdcda848f216f4bc2ecf30b03`이다.
  이 기록은 QA 표본으로 구분하고 삭제하지 않았다. 복구 코드는 출력·캡처·문서화하지 않았다.
- 실제 개인정보 처리방침에서 문의 이메일 `tasddc1569@gmail.com` 노출을 확인했다.
- [종료일 제어 run34009319184](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34009319184)는
  빈 종료일로 실행해 성공(1분3초)했다. 기존 NULL과 같은 no-op으로 DB metadata 전후 동일,
  API null 유지, migration/build/deploy 미실행을 확인했다. 임의의 실제 종료일은 설정하지 않았다.
- 검증 범위는 운영의 익명 생성·첫 선택·저장·새로고침이다. 운영 전체 엔딩 재플레이 또는 Google
  실연동을 완료했다는 의미가 아니다. Phase 5 장기/엔딩 인수 근거는 기존 PR #103/#106을 따른다.

- 사용자 승인된 최신 main을 수동 배포한다. main push의 staging 자동 배포 정책은 바꾸지 않는다.
- 기존 GitHub Actions 비밀값으로 배포한다. 비밀값을 추출하거나 문서/로그에 출력하지 않는다.
- staging/expanded D1 및 QA 커리어를 운영 DB로 복사하지 않는다. 비운영 bootstrap SQL을 운영에 실행하지 않는다.
- 운영 시즌 행은 새 ID로 생성한다. 배포 재실행이 기존 행의 버전·날짜·상태를 덮어쓰지 않는다. 다른 ACTIVE 시즌이나
  동일 ID의 다른 설정이 발견되면 중단하고 전환 방향을 확인한다.
- 종료일 변경은 별도의 명시적 수동 mode에서만 수행한다. 미정은 SQL NULL/API null로 표현하며
  12월 31일이나 먼 미래의 날짜를 대신 넣지 않는다.
- 최초 공개 시점의 로그인 수단은 익명 프로필·복구 코드였고 Google 시작 API는 준비되지 않음 응답을 반환했다.
  후속 PR #112 운영 배포에서 Google 연결도 활성화됐다. 최신 상태는 위 후속 완료 및 연결 런북을 따른다.
- 콘텐츠의 동결 checksum이나 과거 Legacy 점수를 바꾸지 않는다. #104/#105는 알려진 비차단 후속이다.

## 2026-09-07 21:50 재배포 (Phase 7 1차 웨이브·핫픽스, 오케스트레이터 실행, D-71)

- source `308f9bcc8d133347ab3d0449ed3d8a2171ddb6f3`(main = T-7-011 머지 `45ff7b5` + 문서 커밋).
  [preflight run34123657025](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34123657025)
  성공 뒤 [deploy run34123837271](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34123837271)
  성공(21:48~21:50, 약 2분 40초). 입력은 9/7 01:52 배포와 동일(시작 `2026-09-05T15:00:00Z`, 종료 비움, `cs_season_1`).
- 포함 변경: PR #173·#174·#175·#176·#177·#178·#181·#182·#183·#184·#185·#186·#189(T-7-001~013: 룰셋 1.4.0 회복
  규칙 데이터·도메인·로컬 QA seed, 협상 결과 표시, 라벨 정합, 액션 독, 서명 프리필, RadioGroup Enter, 대표팀 요약,
  승격권 문구, e2e 정합, eyebrow 대비, 제안 비교 dl 구조)과 사용자 PR #187. **코드만 배포** — manifest plan은
  noop이라 운영 시즌 1은 ruleset 1.3.0/pack 0.5.0 그대로다. 1.4.0 번들은 포함되지만 운영 시즌이 가리키지 않는다.
- API Worker version `6b78751f-9b1c-40f0-8efa-9201be158340`, web Worker version `a37ab471-4172-4f4f-8c4a-e2314f3f3ba0`.
  신규 migration 없음(기존 적용분 no-op), 집계 전후 동일, bookmark는 run artifact에 있다.
- 배포 후 21:51 확인: health ok, current API `svc_season_1` ACTIVE/non-test/`endsAt: null`/1.3.0/0.5.0, web 200
  (번들 `index-CqqlZtGc.js` → `index-BEIKlKvF.js`), 운영 origin CORS 허용·다른 origin 거부.
- 플레이 검증(Playwright 360px, 21:51 KST): 랜딩 → 게임 시작 → 온보딩 → 생성(`QA배포2151`, 남성·대한민국·왼발·윙어·
  인사이드 포워드) → KICKOFF → 복구 코드 발급 200 → `PUT /v1/careers/{id}` 200 → 새로고침 뒤 진로 화면(`/path`)에
  이름·"저장됨" 유지 → 허브 카드 노출. QA career ID `46be888c-c794-4446-b43e-07d887b18932`. QA 표본으로 구분해
  삭제하지 않으며 통계·랭킹에서 제외한다. 복구 코드는 출력·캡처하지 않았다.
- 교훈: 워크플로 시작 직후 "Require exact current main SHA" 검사가 있어 실행 중 main 푸시(문서 커밋 포함)를 멈춰야
  한다(20:34 1차 preflight가 이 이유로 중단). 같은 self-hosted runner를 main CI가 쓰므로 푸시 직후 큐가 겹칠 수 있다.

## 사전 확인

1. 배포할 main SHA와 통과한 staging 검증을 연결한다. Phase 5 인수는 PR #103 `fb8b782`,
   문서 closure는 PR #106 `3fd201a`에 기록돼 있다.
2. 운영 Worker/D1 이름·ID·origin을 확인한다. 원격 DB는 스키마, aggregate count, 서비스 시즌
   메타데이터만 읽고 개별 이용자·복구 코드·Snapshot 본문은 출력하지 않는다.
3. 운영 시즌 기간과 공개 문의 주소를 확인한다. 이번 최초 배포는 시작 `2026-09-05T15:00:00Z`,
   종료일 입력은 비움, challenge-set ID는 `cs_season_1`이다. 임의의 개인 이메일을 공개하지 않는다.
4. migration/seed 이전 Time Travel bookmark를 확보한다. 계정별 보존 기간을 확인하며 무기한 백업으로
   오인하지 않는다. 일일 R2 export/Cron은 이 저장소에 아직 구현돼 있지 않다.
5. 검증된 source로 운영 API URL을 지정해 웹을 빌드한다. 로컬/expanded API로 연결된 번들을 배포하지 않는다.

2026-09-06 실제 읽기 전용 사전 확인: Cloudflare API의 production D1 UUID/이름이 설정과 같았고
크기는 12,288 bytes였다. `sqlite_master` 테이블 조회 결과 `_cf_KV`만 있어 앱 테이블과 운영
플레이 기록은 없었다. 최초 bookmark는
`00000001-00000000-000050de-bec332f2e29a6d8729c87f41b327f211`이다. 실제 배포 직전 다시 조회한다.
운영 웹과 API `/v1/health`도 당시에는 Cloudflare의 미배포 페이지를 반환했다.

첫 deploy 실행 `34008638141`에서는 migration 0000~0005가 모두 적용됐으나,
11개 테이블을 UNION ALL로 합친 점검 쿼리가 D1 compound SELECT 제한에 걸려 중단됐다.
시즌 INSERT와 API/web 배포는 실행되지 않았고, 운영 career/season/snapshot/archive는 모두 0개임을
직접 확인했다. 재실행 시 DB를 복원하거나 migration을 되돌리지 않는다. 후속 실행 `34008861370`의
6개·5개 compound 분할도 읽기 전용 사전 조회에서 같은 제한에 걸렸다. 최종 집계는 UNION 없이
11개의 독립 SELECT를 실행하고 다중 응답을 합친다. 최초 적용 직전 bookmark는
`00000003-00000000-000050de-3168698264c097987b0c3af31e5882ad`다.

## 실행 순서

수동 production workflow는 read-only preflight와 명시적 `DEPLOY_PRODUCTION` 배포 실행을
구분한다. main ref·정확한 expected SHA를 확인하고 production 작업은 직렬 실행한다.

1. 로컬 핵심 검증 및 운영 번들 build, 읽기 전용 preflight와 bookmark를 확인한다.
2. 등록된 migration을 순서대로 적용한다. 기존 적용분은 반복하지 않으며, 종료일 nullable 전환은
   기존 커리어·Snapshot·Archive를 보존하는 회귀를 먼저 확인한다.
   `0005`는 종료일을 새 nullable 컬럼으로 복사한 뒤 컬럼만 교체한다. 부모·자식 테이블은 삭제하지 않는다.
3. 승인한 운영 시즌만 INSERT 한다. 완전히 동일한 행은 no-op이며 다른 설정은 실패 처리한다.
4. 운영 API → 운영 web 순서로 배포한다. API의 active pointer는 운영 시즌 ID와 같아야 한다.
5. health·current service season·정확한 CORS 허용/거부·웹 응답을 확인한다.
6. ego-browser로 온보딩/새 선수 생성과 API 저장·새로고침을 확인한다. QA 기록을 실제 사용자 지표와
   혼동하지 않도록 이름과 검증 시각을 남기며, 기존 사용자 기록은 지우지 않는다.
7. 실행 URL·source SHA·Worker 버전·season manifest·배포 후 검증을 이 문서 또는 PR에 남긴다.

## 시즌 1 manifest 승격 (공통 절차)

시즌 ID와 기간을 바꾸지 않는 콘텐츠 승격은 호환 API, web, manifest 순으로 배포한다. 시작은
`2026-09-05T15:00:00Z`, 종료는 NULL, challenge set은 `cs_season_1`, ACTIVE/non-test를 유지한다.
1차 승격(`1.1.0/0.3.0` → `1.3.0/0.5.0`)은 2026-09-06 완료했고, 2차 승격(`1.3.0/0.5.0` → `1.4.0/0.5.1`)은
아래 절에 따른다.

1. API를 먼저 배포한다. 시즌 1에 한해 승인 manifest 목록(`apps/api/src/sync/season-version-compatibility.ts`
   `APPROVED_PRODUCTION_MANIFESTS`)에 있는 pair끼리만 신규 최초 sync를 상호 허용한다. mixed pair,
   목록에 없는 과거 버전, 다른 시즌 ID는 허용하지 않는다. 이미 서버에 있는 커리어는 기존처럼 생성 당시
   버전으로 후속 Snapshot·command 저장을 계속한다.
2. web을 배포한다. 이 짧은 전환 구간에는 구·신 web이 모두 있을 수 있으므로 API의 복수 pair 허용이
   필요하다.
3. 마지막으로 시즌 1 행을 old pair에서 new pair로 compare-and-set한다. 이름·상태·시작·NULL 종료·
   challenge set·isTest 및 old pair(`PREVIOUS_PRODUCTION_VERSION`)가 모두 일치하지 않으면 쓰지 않는다.
   즉시 D1을 다시 읽고 new pair 전체 메타데이터가 정확한지 검증한다.

workflow artifact의 `season-rollback.sql`은 자동 실행하지 않는다. 이는 행이 여전히 정확한 new
manifest일 때 버전 두 필드만 old pair로 되돌리는 역 compare-and-set이다. 실행 전 새 web 노출 범위와
영향을 확인하고 API의 복수 pair 호환 코드를 먼저 유지해야 한다. 서버에 저장된 신버전 커리어는 manifest
rollback과 무관하게 생성 버전으로 계속 동기화되며, 아직 offline인 신버전 커리어도 이 호환 API가 old
manifest에서 정확한 new pair를 허용하므로 업로드할 수 있다. DB Time Travel 복구나 사용자 기록 삭제를
manifest rollback 대신 사용하지 않는다.

## 시즌 1 manifest 2차 승격: 1.3.0/0.5.0 → 1.4.0/0.5.1 (사용자 결정 2026-09-12)

룰셋 1.4.0은 회복 규칙(D-67, T-7-001~003)과 2차 웨이브 도메인 가드(Wave D-D, `fix-domain-wave2`)를
담는다. 팩 0.5.1은 0.5.0 복사 + 이벤트 조건 추가이고 `compatibleRulesetVersions`는 1.3.0·1.4.0이다.
목표 manifest의 정본은 `tooling/scripts/production-release.mjs`의 `PRODUCTION_SEASON`(1.4.0/0.5.1)과
`PREVIOUS_PRODUCTION_VERSION`(1.3.0/0.5.0)이며, 워크플로 verify 단계는 `expect-version` 명령으로 이 값을
읽는다. 같은 값을 유지해야 하는 곳: `apps/api/src/sync/season-version-compatibility.ts`(승인 목록 마지막 두
항목), `apps/web/src/engine/versions.ts`(오프라인 폴백 상수), `apps/api/seeds/bootstrap-non-production.sql`
(`svc_line_test`, staging).

### 전제 (main 머지 순서)

1. 팩 0.5.1 PR(`content-pack-0-5-1`)이 main에 있어야 한다. 없으면 web 번들이
   `알 수 없는 contentPackVersion: 0.5.1`로 폴백 생성을 실패하고 `apps/web` 단위 테스트
   (`career-actions.test.ts`)가 모듈 로드에서 깨진다.
2. 도메인 2차 웨이브 PR(`fix-domain-wave2`)이 main에 있어야 한다(1.4.0 선택 키 가드 동작 확정).
3. 그 뒤 이 승격 PR(`release-ruleset-1-4-0`)을 머지한다. 이 PR은 코드만 바꾸며 운영 D1은 건드리지 않는다.

### 절차

1. **staging 확인.** 승격 PR 머지 → main CI가 `bootstrap-non-production.sql`을 staging D1에 upsert해
   `svc_line_test`가 1.4.0/0.5.1이 된다. staging web에서 새 커리어를 만들어 설정 화면·`PUT /v1/careers/{id}`
   응답의 룰셋·팩이 1.4.0/0.5.1인지, 기존 staging 커리어(1.0.0/0.1.0 등)가 그대로 열리는지 확인한다.
2. **preflight.** Production Release → `mode=preflight`, `expected_sha`=최신 main. 요약의 "Service-season
   metadata"에서 `svc_season_1`이 1.3.0/0.5.0 ACTIVE인지 본다. 워크플로 시작 직후 main SHA 검사가 있으므로
   실행 중 main 푸시(문서 커밋 포함)를 멈춘다.
3. **deploy.** `mode=deploy`, `confirmation=DEPLOY_PRODUCTION`, `season_starts_at=2026-09-05T15:00:00Z`,
   `season_ends_at` 비움, `challenge_set_id=cs_season_1`. "Validate exact production manifest transition"
   단계의 plan은 **activate**여야 한다(이미 승격됐다면 noop, 그 외 값이면 중단). 이어서 migration(없음,
   no-op) → API → web → 시즌 1 행 compare-and-set(1.3.0/0.5.0 → 1.4.0/0.5.1) → 재조회 plan=noop 확인.
4. **배포 후 검증.** 워크플로가 `GET /v1/service-seasons/current`를 `expect-version` 값(1.4.0/0.5.1)과
   비교한다. 추가로 health·CORS·web 200과 Playwright 360px 플레이(생성 → KICKOFF → 저장 → 새로고침)를
   기존 절차대로 남긴다. QA 커리어는 이름·시각으로 구분하고 삭제하지 않는다.
5. **롤백.** run artifact의 `.release/season-rollback.sql`이 1.4.0/0.5.1 행을 1.3.0/0.5.0으로 되돌리는 역
   compare-and-set이다. API는 1.1.0/0.3.0·1.3.0/0.5.0·1.4.0/0.5.1 셋을 상호 허용하므로 롤백 뒤에도 이미
   1.4.0/0.5.1로 만들어진 커리어의 최초 sync는 막히지 않는다. 자동 실행하지 않으며 실행 전 영향 범위를 기록한다.
6. **기록.** 실행 URL·source SHA·Worker 버전·manifest 전후·검증 결과를 이 문서와 `docs/tracking/`에 남기고,
   위 표의 "현재 신규 커리어 버전"을 1.4.0/0.5.1로 갱신한다.

## 나중에 종료일 정하기

GitHub Actions의 **Production Release → Run workflow**에서 `main`과 정확한 최신 main SHA를
선택하고 `mode=set-season-end`, `confirmation=SET_SEASON_END`를 입력한다.
기존 시즌 식별을 위해 `season_starts_at=2026-09-05T15:00:00Z`,
`challenge_set_id=cs_season_1`도 함께 입력한다. 이 값은 변경 대상이 아니라 기존 설정 확인용이다.
`season_ends_at`에 RFC3339 UTC 시각을 넣으면 종료일을 정하고, 비우면 다시 미정으로 둔다.
예를 들어 한국 시각 자정은 전날 15:00:00Z다. 이번 배포는 종료일 없이 유지한다.

이 mode는 현재 `svc_season_1`의 ACTIVE/non-test/규칙·콘텐츠·시작일·challenge 설정을 확인하고,
읽었던 종료일이 아직 같을 때만 종료일 한 필드를 변경한다. 다른 필드·선수 기록·게임 버전은 변경하지
않으며 migration이나 앱 재배포도 하지 않는다. 변경 후 API 응답을 확인한다.
현재 시즌 활성 여부는 날짜가 아닌 ACTIVE 포인터/상태 기준이다. 종료일 지정 자체가 자동 LOCK,
시즌 전환 또는 기록 삭제를 예약하는 것은 아니다. 시즌을 실제 종료할 때는 별도 전환 절차를 따른다.

## 장애 시 경계

- 마이그레이션을 DROP/복원해 롤백하지 않는다. 신규 운영 데이터가 생긴 이후 과거 DB로 복원하면
  플레이가 유실될 수 있으므로 신규 쓰기 중단·영향 확인·사용자 승인 없이 실행하지 않는다.
- 첫 1.1 커리어 생성 이후 1.1 reader/content/Legacy 참조집단을 제거하는 구 코드로 되돌리지 않는다.
  이전 active pointer로 변경해도 이미 생성된 커리어의 버전은 바뀌지 않는다. 수정 배포를 우선한다.
- 신규 생성 제한과 기존 기록 열람은 분리한다. ACTIVE 시즌을 닫을 필요가 있으면 대상 ID를 확인하고
  운영 변경을 명시적으로 기록한다. 이 workflow의 재실행이 닫힌 시즌을 자동으로 다시 열어서는 안 된다.
- 커스텀 도메인, Google OAuth, Apps-in-Toss 심사·출시, 유료 플랜 전환은 이번 배포에 포함하지 않는다.
