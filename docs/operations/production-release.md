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
| 현재 신규 커리어 버전 | ruleset 1.7.1 / content pack 0.6.5 (2026-09-15 작업 입력 기준 운영 current; 기존 커리어는 생성 당시 버전 유지) |
| 다음 승격 목표        | ruleset 1.7.2 / content pack 0.6.6 (첫 계약 흐름 단축, 코드·런북 준비; 배포 전에는 운영 current가 아님) |

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

## 2026-09-14 12:43 재배포 (실시간 플레이 중 배지 D-78 + K리그식 룰셋 1.5.0/0.6.0 3차 승격, 오케스트레이터 실행)

- source `643cd2af3c8850f7b9cf713e21db641e736f8b87`(main = #211 T-7-014 `b05867b` → #208 `ceff29c` → #209 `139d1ca` → #212 T-7-015 `c77375f` → #215(#210 재적용) `4b29c4d` + 문서 3커밋).
  [preflight run34803042783](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34803042783)
  성공 뒤 [deploy run34803426999](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34803426999)
  성공(12:40:53 큐 → 12:41:28 시작 → 12:43:00 완료, 약 1분 30초). 입력은 9/7과 동일(시작 `2026-09-05T15:00:00Z`, 종료 비움, `cs_season_1`).
  사용자 지시(12:20) "오픈된 PR을 순차적으로 운영환경까지 배포".
- 러너: 셀프호스트 `offside-mac-arm64`(사용자 맥북)가 잠자기로 오프라인이라 사용자 선택으로 이 맥에 임시 러너
  `offside-mac-arm64-tmp`(같은 라벨, `~/offside-runner-tmp`)를 등록해 CI·스테이징·이 배포를 돌렸다. 다른 세션 PR CI가 쓰고 있어 당분간 유지한다.
- 포함 변경: `GET /v1/presence`·`POST /v1/presence/heartbeat`(D-78, 마이그레이션 `0006_flat_nova` = `sessions_last_seen_at_idx`)와
  상단 네비바 "N명 플레이 중" 배지·하트비트, K리그식 리그·팀 구조 룰셋 1.5.0·팩 0.6.0, 시즌=연도 표기, 1.5.0/0.6.0 승격 준비.
  **manifest plan=activate** — 시즌 1 행이 1.4.0/0.5.1 → 1.5.0/0.6.0으로 compare-and-set되고 재조회 plan=noop 통과. 기존 커리어는 생성 당시 버전을 유지한다.
- API Worker version `16808919-8fed-41a5-a5d2-36edca971e71`, web Worker version `b69dc26d-c966-4662-9538-4f6491fc4dd6`.
  마이그레이션 0006 적용(인덱스 1개, 집계 전후 동일), bookmark는 run artifact에 있다.
- 배포 후 12:43 확인(`https://api.offside-lab.com`): health ok, current `svc_season_1` ACTIVE/non-test/`endsAt: null`/**1.5.0/0.6.0**,
  `GET /v1/presence` 200(`Cache-Control: public, max-age=30`), 세션 없는 heartbeat 204, 웹 200(번들 `index-DFfxjwla.js` → `index-BVYHFVZG.js`),
  운영 origin `https://offside-lab.com` CORS 허용·다른 origin 거부. 주의: `offside-api.tasddc1569.workers.dev` 호스트는 offside-lab.com origin을
  거부하므로 운영 CORS 검사는 `api.offside-lab.com`으로 한다.
- 플레이 검증(Playwright 360px, 12:44 KST): 랜딩 → 게임 시작 → 온보딩 → 생성(`QA배포1244`, 윙어 19세) → KICKOFF → 복구 코드 발급 200 →
  `PUT /v1/careers/{id}` 200 → 새로고침 뒤 이벤트 화면에 이름 유지 → 허브 카드 "저장됨". QA career ID `69255a9e-236c-45cb-8d4e-a6c9e1941cf4`.
  QA 표본으로 구분해 삭제하지 않으며 통계·랭킹에서 제외한다. 복구 코드는 출력·캡처하지 않았다.
- 배지 검증: 허브(설정 아이콘 옆)와 커리어 화면(커리어 캡션 옆)에 "1명 플레이 중" 표시, `.os-app-nav` 360px 한 줄·가로 넘침 없음,
  네트워크에 `GET /v1/presence`·`POST /v1/presence/heartbeat` 정상. 운영 번들 `labels-DikQ6hX_.js`에 K1 구단명(서울 한강 FC 등) 포함 확인.
  계약 화면까지는 진행하지 않아 K1 구단 오퍼 화면의 실제 노출은 다음 QA 세션 항목이다.
- 검증 체인: 최종 합본(main+#208+#210+#209+#212) 전체 체인 12:18~12:28 통과(단위 10/10·빌드·번들·대비). e2e는 main 기존 16건(단독 실행에서도 실패, #207)
  - 부하 3건(단독 통과) + `season-result SCR-015` seed 드리프트 1건(1.5.0 전환 영향, #207 기록) 외 새 실패 0.
- 사고·교훈: (1) #210이 스택 PR(base `feat-kleague-structure`)인데 #208 머지 뒤 브랜치를 남겨 base가 main으로 안 바뀌었고 스크립트가 그대로
  머지해 feature 브랜치에 들어감 → squash 커밋 cherry-pick #215로 재적용(트리 동일 확인). (2) 워커의 `pkill -f "vite"`가 오케스트레이터 `vitest` 체인을
  죽임 → 템플릿에 PID 종료 규칙. (3) 검증 체인 2개 + CI + 다른 세션이 겹쳐 load 100에서 타임아웃 → 체인은 한 번에 하나, turbo concurrency 2.

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
1차 승격(`1.1.0/0.3.0` → `1.3.0/0.5.0`)은 2026-09-06, 2차 승격(`1.3.0/0.5.0` → `1.4.0/0.5.1`)은 2026-09-13,
3차 승격(`1.4.0/0.5.1` → `1.5.0/0.6.0`)은 2026-09-14 완료했고, 4차 승격
(`1.5.0/0.6.0` → `1.7.0/0.6.3`)·5차 승격(`1.7.0/0.6.3` → `1.7.0/0.6.4`)·6차 승격
(`1.7.0/0.6.4` → `1.7.1/0.6.5`)도 완료됐다. 7차 승격(`1.7.1/0.6.5` → `1.7.2/0.6.6`)은 아래 절에 따른다.

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
(`svc_line_test`, staging), `apps/web/playwright.smoke.config.ts`(`expectedSeason` — main push CI의 staging
smoke가 seed upsert 직후 검증한다), `apps/web/e2e/staging-rehearsal.spec.ts`(수동 리허설 기대값).

자동 게이트: `apps/web/src/engine/versions.test.ts`와 `apps/api/src/sync/season-version-compatibility.test.ts`가
ACTIVE 상수·승인 목록의 룰셋·팩이 번들 레지스트리(`RULESET_VERSIONS`·`PACK_VERSIONS`)에 있고 팩의
`compatibleRulesetVersions`가 룰셋을 포함하는지 검사한다. 두 파일은 main CI와 Production Release
"Validate release inputs" 단계 양쪽에서 돌므로, 아래 전제 순서를 어기면(팩 0.5.1이 main에 없으면) CI와
preflight/deploy가 여기서 멈춘다.

### 전제 (main 머지 순서)

1. 팩 0.5.1 PR(`content-pack-0-5-1`)이 main에 있어야 한다. 없으면 web 번들이
   `알 수 없는 contentPackVersion: 0.5.1`로 폴백 생성을 실패하고 `apps/web` 단위 테스트
   (`career-actions.test.ts`)가 모듈 로드에서 깨진다.
2. 도메인 2차 웨이브 PR(`fix-domain-wave2`)이 main에 있어야 한다(1.4.0 선택 키 가드 동작 확정).
3. 그 뒤 이 승격 PR(`release-ruleset-1-4-0`)을 머지한다. 이 PR은 코드만 바꾸며 운영 D1은 건드리지 않는다.

### 절차

**주의 — `set-season-end` 모드는 이 PR 머지 후 승격(3단계) 완료 전까지 실패한다.** `decideSeasonEnd`가 현재
행의 룰셋·팩을 코드의 `PRODUCTION_SEASON`(1.4.0/0.5.1)과 비교해 "Production season metadata differs"로 중단하기
때문이다. 이 구간에 종료일을 바꿔야 하면 승격을 먼저 끝내거나, `PRODUCTION_SEASON`을 1.3.0/0.5.0으로 되돌린
코드를 main에 머지한 뒤 실행한다(5단계 롤백 뒤에도 같은 조건이다).

1. **staging 확인.** 승격 PR 머지 → main CI가 `bootstrap-non-production.sql`을 staging D1에 upsert해
   `svc_line_test`가 1.4.0/0.5.1이 된다. 같은 CI의 staging smoke(`playwright.smoke.config.ts` →
   `e2e/staging-smoke.spec.ts`)가 `GET /v1/service-seasons/current`의 1.4.0/0.5.1을 자동 검증한다. 추가로
   staging web에서 새 커리어를 만들어 설정 화면·`PUT /v1/careers/{id}` 응답의 룰셋·팩이 1.4.0/0.5.1인지, 기존
   staging 커리어(1.0.0/0.1.0 등)가 그대로 열리는지 확인한다.
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
   - **실행.** artifact를 내려받아 수동으로 실행한다(비밀값은 GitHub Actions에만 있으므로 로컬에서는
     `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`를 동일 권한으로 준비한다):
     `pnpm --filter @offside/api exec wrangler d1 execute offside-production --remote --env production --file <artifact>/season-rollback.sql --yes --json`
   - **성공 기준.** compare-and-set이 0행을 갱신해도 wrangler는 오류 없이 종료한다. 반드시 출력 JSON의
     `meta.changes`가 **1**인지 확인한다. 0이면 WHERE 조건(이름·상태·시작·`ends_at IS NULL`·challenge set·
     is_test·1.4.0/0.5.1)이 현재 행과 맞지 않은 것이므로 롤백되지 않았다고 기록하고 원인을 찾는다.
     특히 승격 뒤 `set-season-end`로 종료일을 바꿨다면 artifact의 SQL은 `ends_at IS NULL`이라 매치되지 않는다
     — 이때는 `ends_at IS NULL`을 현재 값(`ends_at = '<RFC3339>'`)으로 고친 SQL을 새로 만들어 쓰고 그 사실을
     기록한다. 다른 조건은 고치지 않는다.
   - **읽기 확인.** 이어서 재조회한다:
     `pnpm --filter @offside/api exec wrangler d1 execute offside-production --remote --env production --json --command "SELECT id, ruleset_version, content_pack_version, ends_at FROM service_seasons WHERE id = 'svc_season_1'"`
     → 1.3.0/0.5.0이어야 한다(같은 JSON을 `node tooling/scripts/production-release.mjs plan <파일>`에 넣으면
     `activate`가 나온다). 운영 `GET /v1/service-seasons/current`도 1.3.0/0.5.0을 돌려주는지 확인한다.
   - **코드 되돌림(필수).** 롤백 SQL을 실행했다면 코드의 `PRODUCTION_SEASON`은 여전히 1.4.0/0.5.1이므로,
     그 상태에서 핫픽스 등으로 Production Release `deploy`를 한 번이라도 돌리면 "Validate exact production
     manifest transition"이 plan=activate를 정상 경로로 받아들여 `season-activate.sql`을 다시 실행해
     **롤백이 조용히 무효화된다**. 따라서 다음 deploy 전에 `tooling/scripts/production-release.mjs`의
     `PRODUCTION_SEASON`을 1.3.0/0.5.0으로 되돌리는 PR을 main에 먼저 머지한다(`PREVIOUS_PRODUCTION_VERSION`은
     1.1.0/0.3.0으로, 스크립트 테스트·`apps/web/src/engine/versions.ts` 폴백·`bootstrap-non-production.sql`·
     `playwright.smoke.config.ts`·`staging-rehearsal.spec.ts`도 같이 맞춘다. API 승인 목록 세 항목은 유지한다).
     그러면 plan이 noop이 되어 재승격되지 않고 `set-season-end`의 verify도 다시 맞는다.
   - **금지.** 그 PR이 main에 머지되기 전에는 Production Release `deploy`·`set-season-end`를 실행하지 않는다
     (`deploy`는 재승격, `set-season-end`는 "metadata differs" 실패).
6. **기록.** 실행 URL·source SHA·Worker 버전·manifest 전후·검증 결과를 이 문서와 `docs/tracking/`에 남기고,
   위 표의 "현재 신규 커리어 버전"을 1.4.0/0.5.1로 갱신한다.

## 시즌 1 manifest 3차 승격: 1.4.0/0.5.1 → 1.5.0/0.6.0 (사용자 결정 2026-09-13)

룰셋 1.5.0(PR #208, 브랜치 `feat-kleague-structure`)은 K리그식 리그·팀 구조다 — `leagues`를 R리그·K1
리그·K2 리그·K3 리그로, `teams`를 출발 B팀 + K1 12개(전부 이름·색·전술 스타일 지정) + K2 14개(전부
지정) + K3 필러 4개(생성 이름, 오퍼 풀용)로 전면 교체하고 `calendar.startYear` 선택 필드를 추가했다.
팩 0.6.0은 0.5.1을 그대로 복사하고 narrative/tokens.json의 club·team 풀만 새 구단 이름으로 교체했다
(이벤트·챕터는 바이트 동일). `compatibleRulesetVersions`는 1.5.0만이다(0.5.1의 1.3.0·1.4.0과 달리
1.4.0 호환은 없다 — 팀 구조가 전면 교체라 과거 룰셋과 같은 팩을 공유할 이유가 없다). 목표 manifest의
정본은 `tooling/scripts/production-release.mjs`의 `PRODUCTION_SEASON`(1.5.0/0.6.0)과
`PREVIOUS_PRODUCTION_VERSION`(1.4.0/0.5.1)이며, 워크플로 verify 단계는 `expect-version` 명령으로 이 값을
읽는다. 같은 값을 유지해야 하는 곳: `apps/api/src/sync/season-version-compatibility.ts`(승인 목록 마지막 두
항목), `apps/web/src/engine/versions.ts`(오프라인 폴백 상수), `apps/api/seeds/bootstrap-non-production.sql`
(`svc_line_test`, staging), `apps/web/playwright.smoke.config.ts`(`expectedSeason` — main push CI의 staging
smoke가 seed upsert 직후 검증한다), `apps/web/e2e/staging-rehearsal.spec.ts`(수동 리허설 기대값). 로컬
`apps/api/seeds/local.sql`의 `svc_kickoff`도 이 값으로 맞춰(D-75 후속) 오프라인 폴백 상수와의 불일치를
없앴다 — 이 행은 운영 승격 목표와 무관하게 항상 `ACTIVE_RULESET_VERSION`/`ACTIVE_CONTENT_PACK_VERSION`을
따른다.

자동 게이트: `apps/web/src/engine/versions.test.ts`와 `apps/api/src/sync/season-version-compatibility.test.ts`가
ACTIVE 상수·승인 목록의 룰셋·팩이 번들 레지스트리(`RULESET_VERSIONS`·`PACK_VERSIONS`)에 있고 팩의
`compatibleRulesetVersions`가 룰셋을 포함하는지 검사한다. 두 파일은 main CI와 Production Release
"Validate release inputs" 단계 양쪽에서 돌므로, 아래 전제 순서를 어기면(팩 0.6.0이 main에 없으면) CI와
preflight/deploy가 여기서 멈춘다.

### 전제 (main 머지 순서)

1. K리그 구조 PR #208(`feat-kleague-structure`, 룰셋 1.5.0·팩 0.6.0)이 main에 있어야 한다. 없으면 web
   번들이 `알 수 없는 contentPackVersion: 0.6.0`으로 폴백 생성을 실패하고 `apps/web` 단위 테스트
   (`career-actions.test.ts`)가 모듈 로드에서 깨진다.
2. 그 뒤 이 승격 PR(`release-ruleset-1-5-0`)을 머지한다. 이 PR은 코드·문서만 바꾸며 운영 D1은 건드리지
   않는다. 이 브랜치는 #208 위에 스택돼 있어(base가 `feat-kleague-structure`) GitHub PR이 그 상태로는
   #208의 커밋까지 함께 보여준다 — #208이 먼저 main에 머지되면 GitHub이 이 PR의 base를 자동으로 main으로
   바꾼다(리뷰 대상 diff가 이 PR만의 변경으로 줄어든다). #208이 머지되지 않은 채 이 PR만 머지하지 않는다.

### 절차

**주의 — `set-season-end` 모드는 이 PR 머지 후 승격(3단계) 완료 전까지 실패한다.** `decideSeasonEnd`가 현재
행의 룰셋·팩을 코드의 `PRODUCTION_SEASON`(1.5.0/0.6.0)과 비교해 "Production season metadata differs"로 중단하기
때문이다. 이 구간에 종료일을 바꿔야 하면 승격을 먼저 끝내거나, `PRODUCTION_SEASON`을 1.4.0/0.5.1로 되돌린
코드를 main에 머지한 뒤 실행한다(5단계 롤백 뒤에도 같은 조건이다).

1. **staging 확인.** 승격 PR 머지 → main CI가 `bootstrap-non-production.sql`을 staging D1에 upsert해
   `svc_line_test`가 1.5.0/0.6.0이 된다. 같은 CI의 staging smoke(`playwright.smoke.config.ts` →
   `e2e/staging-smoke.spec.ts`)가 `GET /v1/service-seasons/current`의 1.5.0/0.6.0을 자동 검증한다. 추가로
   staging web에서 새 커리어를 만들어 설정 화면·`PUT /v1/careers/{id}` 응답의 룰셋·팩이 1.5.0/0.6.0인지, 홈
   색상 프리셋·구단 이름 설정에 K1 12개 구단이 새 이름으로 뜨는지, 기존 staging 커리어(1.0.0/0.1.0 등)가
   그대로 열리는지 확인한다.
2. **preflight.** Production Release → `mode=preflight`, `expected_sha`=최신 main. 요약의 "Service-season
   metadata"에서 `svc_season_1`이 1.4.0/0.5.1 ACTIVE인지 본다. 워크플로 시작 직후 main SHA 검사가 있으므로
   실행 중 main 푸시(문서 커밋 포함)를 멈춘다.
3. **deploy.** `mode=deploy`, `confirmation=DEPLOY_PRODUCTION`, `season_starts_at=2026-09-05T15:00:00Z`,
   `season_ends_at` 비움, `challenge_set_id=cs_season_1`. "Validate exact production manifest transition"
   단계의 plan은 **activate**여야 한다(이미 승격됐다면 noop, 그 외 값이면 중단). 이어서 migration(없음,
   no-op) → API → web → 시즌 1 행 compare-and-set(1.4.0/0.5.1 → 1.5.0/0.6.0) → 재조회 plan=noop 확인.
4. **배포 후 검증.** 워크플로가 `GET /v1/service-seasons/current`를 `expect-version` 값(1.5.0/0.6.0)과
   비교한다. 추가로 health·CORS·web 200과 Playwright 360px 플레이(생성 → KICKOFF → 저장 → 새로고침)를
   기존 절차대로 남긴다. 생성 화면에서 K1 구단명이 정상 노출되는지도 확인한다. QA 커리어는 이름·시각으로
   구분하고 삭제하지 않는다.
5. **롤백.** run artifact의 `.release/season-rollback.sql`이 1.5.0/0.6.0 행을 1.4.0/0.5.1로 되돌리는 역
   compare-and-set이다. API는 1.1.0/0.3.0·1.3.0/0.5.0·1.4.0/0.5.1·1.5.0/0.6.0 네 pair를 상호 허용하므로
   롤백 뒤에도 이미 1.5.0/0.6.0으로 만들어진 커리어의 최초 sync는 막히지 않는다. 자동 실행하지 않으며
   실행 전 영향 범위를 기록한다.
   - **실행.** artifact를 내려받아 수동으로 실행한다(비밀값은 GitHub Actions에만 있으므로 로컬에서는
     `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`를 동일 권한으로 준비한다):
     `pnpm --filter @offside/api exec wrangler d1 execute offside-production --remote --env production --file <artifact>/season-rollback.sql --yes --json`
   - **성공 기준.** compare-and-set이 0행을 갱신해도 wrangler는 오류 없이 종료한다. 반드시 출력 JSON의
     `meta.changes`가 **1**인지 확인한다. 0이면 WHERE 조건(이름·상태·시작·`ends_at IS NULL`·challenge set·
     is_test·1.5.0/0.6.0)이 현재 행과 맞지 않은 것이므로 롤백되지 않았다고 기록하고 원인을 찾는다.
     특히 승격 뒤 `set-season-end`로 종료일을 바꿨다면 artifact의 SQL은 `ends_at IS NULL`이라 매치되지 않는다
     — 이때는 `ends_at IS NULL`을 현재 값(`ends_at = '<RFC3339>'`)으로 고친 SQL을 새로 만들어 쓰고 그 사실을
     기록한다. 다른 조건은 고치지 않는다.
   - **읽기 확인.** 이어서 재조회한다:
     `pnpm --filter @offside/api exec wrangler d1 execute offside-production --remote --env production --json --command "SELECT id, ruleset_version, content_pack_version, ends_at FROM service_seasons WHERE id = 'svc_season_1'"`
     → 1.4.0/0.5.1이어야 한다(같은 JSON을 `node tooling/scripts/production-release.mjs plan <파일>`에 넣으면
     `activate`가 나온다). 운영 `GET /v1/service-seasons/current`도 1.4.0/0.5.1을 돌려주는지 확인한다.
   - **코드 되돌림(필수).** 롤백 SQL을 실행했다면 코드의 `PRODUCTION_SEASON`은 여전히 1.5.0/0.6.0이므로,
     그 상태에서 핫픽스 등으로 Production Release `deploy`를 한 번이라도 돌리면 "Validate exact production
     manifest transition"이 plan=activate를 정상 경로로 받아들여 `season-activate.sql`을 다시 실행해
     **롤백이 조용히 무효화된다**. 따라서 다음 deploy 전에 `tooling/scripts/production-release.mjs`의
     `PRODUCTION_SEASON`을 1.4.0/0.5.1로 되돌리는 PR을 main에 먼저 머지한다(`PREVIOUS_PRODUCTION_VERSION`은
     1.3.0/0.5.0으로, 스크립트 테스트·`apps/web/src/engine/versions.ts` 폴백·`bootstrap-non-production.sql`·
     `playwright.smoke.config.ts`·`staging-rehearsal.spec.ts`도 같이 맞춘다. API 승인 목록 네 항목은 유지한다
     — 이미 1.5.0/0.6.0으로 만들어진 커리어의 미동기화 최초 sync를 계속 보호한다).
     그러면 plan이 noop이 되어 재승격되지 않고 `set-season-end`의 verify도 다시 맞는다.
   - **금지.** 그 PR이 main에 머지되기 전에는 Production Release `deploy`·`set-season-end`를 실행하지 않는다
     (`deploy`는 재승격, `set-season-end`는 "metadata differs" 실패).
6. **기록.** 실행 URL·source SHA·Worker 버전·manifest 전후·검증 결과를 이 문서와 `docs/tracking/`에 남기고,
   위 표의 "현재 신규 커리어 버전"을 1.5.0/0.6.0으로 갱신한다.

## 시즌 1 manifest 4차 승격: 1.5.0/0.6.0 → 1.7.0/0.6.3 (T-7-033, 사용자 승인 2026-09-15)

운영 current API의 출발점은 `svc_season_1`, `ACTIVE`, `isTest=false`, 시작
`2026-09-05T15:00:00Z`, 종료 `null`, `cs_season_1`, ruleset `1.5.0` / pack `0.6.0`이다.
승격은 ID·이름·상태·기간·challenge set·test 여부를 바꾸지 않고 버전 두 필드만
`1.7.0/0.6.3`으로 compare-and-set한다. 목표 manifest의 정본은
`tooling/scripts/production-release.mjs` 속 `PRODUCTION_SEASON`, 출발 pair의 정본은
`PREVIOUS_PRODUCTION_VERSION`(실제 운영 `1.5.0/0.6.0`)이다.

`1.7.0`은 `1.6.1`의 성장·은퇴 밸런스와 Legacy 1.2.0을 계승하고 실제 리그 원장을
추가한다. matched 1,000 회귀의 Legacy 상위 밴드는 `1.6.1` 33.3%에서 `1.7.0`
22.7%로 낮아졌다. 이 수치 비교는 검증됐지만 원장 순위 코드 경로 변화가 원인이라는
설명은 합리적 추정이며 별도 인과 실험은 수행하지 않았다. 사용자는 이 구분과 수치를 알고 승격을 승인했다.
이는 예전 32% 목표를 통과했다는 기록이 아니며, T-7-033에서 Legacy 컷·가중치를
재조정하지 않는 알고 받은 활성화 선택이다.

동기화해야 하는 곳은 API 승인 manifest 목록, web 오프라인 폴백, local
`svc_kickoff`, non-production `svc_line_test`, staging smoke 기대값, staging rehearsal 기대값이다.
API 목록은 신 `1.7.0/0.6.3`을 마지막에 추가하되 실제 과거 운영 pair
`1.1.0/0.3.0`, `1.3.0/0.5.0`, `1.4.0/0.5.1`, `1.5.0/0.6.0`을 모두 유지한다.
어느 승격 지점으로 롤백해도 승인 pair로 만든 오프라인 커리어의 늦은 최초 sync를
허용하며, mixed pair·목록 밖 버전·다른 시즌 ID는 계속 거부한다. 이미 서버에
생성된 커리어는 서비스 시즌 포인터와 무관하게 생성 버전으로 후속 PUT을 계속한다.

### 실행 순서와 게이트

1. **로컬 호환성.** release 전환/noop/fail-closed/역 compare-and-set, 승인 pair 전체 상호
   최초 sync, mixed pair 거부, 오프라인 폴백·seed·smoke 값의 동기화를 검증한다.
   신 ruleset/content pack/checksum/Legacy 산출물은 수정하지 않고 구버전 golden을 유지한다.
2. **실제 로컬 경로.** 일회성 검증으로 실 HTTP API + 로컬 D1에서 신 포인터 상태의
   구 `1.5.0/0.6.0` 오프라인 최초 PUT과 롤백 포인터 상태의 신 `1.7.0/0.6.3`
   오프라인 최초 PUT을 각각 확인한다. 동일 명령은 실제 브라우저 Web Worker와 domain
   replay의 hash·RNG draw가 같아야 한다. 서버는 incoming snapshot을 검증·저장하지
   domain replay를 하지 않으므로, 이 결과를 "서버 replay" 증거로 표현하지 않는다.
3. **저장 예산.** 20시즌 `1.7.0/0.6.3` state는 UTF-8 256KiB 이하, 실제 HTTP PUT body는
   1MiB 이하여야 한다. 기존 합성 최대 shape·fake transport·CLI 모델링 측정과
   실 HTTP/D1/Worker 측정을 서로 바꿔 부르지 않고 PR에 분리해 기록한다.
4. **staging.** PR merge 후 main CI가 `svc_line_test`를 `1.7.0/0.6.3`으로 upsert하고
   staging smoke가 current manifest를 검증해야 한다. staging에서 신규 `1.7.0/0.6.3`
   커리어 생성·저장·새로고침과 기존 커리어 열림을 확인한다.
5. **preflight.** Production Release `mode=preflight`, `expected_sha`=최신 main으로 실행하고
   운영 행이 위 출발 메타데이터와 `1.5.0/0.6.0`으로 정확한지 본다. 실행 중 main
   push를 멈춘다.
6. **deploy.** root만 `mode=deploy`, `confirmation=DEPLOY_PRODUCTION`, 시작
   `2026-09-05T15:00:00Z`, 종료 비움, `challenge_set_id=cs_season_1`로 실행한다.
   remote write 전 plan은 `activate`, CAS 후 재조회 plan은 `noop`이어야 한다. 다른 plan은 중단한다.
7. **배포 후.** current API가 동일 시즌 메타데이터와 `1.7.0/0.6.3`을 돌려주고,
   health·정확한 CORS 허용/거부·web 200이어야 한다. 360px 실제 플레이로 생성 → KICKOFF
   → PUT 200 → 새로고침 뒤 동일 ID/revision/hash·`1.7.0/0.6.3`을 확인하고 QA 표본은
   삭제하지 않는다.

### 롤백

workflow artifact의 `season-rollback.sql`은 행이 여전히 정확한 `1.7.0/0.6.3`일 때만
버전 두 필드를 `1.5.0/0.6.0`으로 돌리는 역 compare-and-set이다. 자동 실행하지
않으며, 실행 시 Wrangler JSON의 `meta.changes` 합이 정확히 1인지와 D1/API 재조회
`1.5.0/0.6.0`을 모두 확인한다. 0이면 롤백 성공으로 기록하지 않는다.

롤백 뒤 API의 다중 pair 호환 코드를 유지해야 이미 생성되었거나 아직 오프라인인
`1.7.0/0.6.3` 커리어가 저장된다. 다음 production deploy 전에는 코드의
`PRODUCTION_SEASON`을 `1.5.0/0.6.0`, `PREVIOUS_PRODUCTION_VERSION`을 `1.4.0/0.5.1`로
돌리는 롤백 후속 PR을 main에 먼저 머지하고, fallback·seed·smoke·rehearsal도 같이 맞춘다.
API 승인 manifest 목록의 `1.7.0/0.6.3`을 제거하지 않는다. 이 후속 PR 전에
Production Release `deploy`나 `set-season-end`를 실행하지 않는다.

## 시즌 1 manifest 5차 승격: 1.7.0/0.6.3 → 1.7.0/0.6.4 (사용자 승인 2026-09-15)

운영 current의 출발점은 `svc_season_1`, `시즌 1`, `ACTIVE`, `isTest=false`, 시작
`2026-09-05T15:00:00Z`, 종료 `null`, `cs_season_1`, ruleset `1.7.0` / pack `0.6.3`이다.
이 승격은 시즌 행의 ID·이름·상태·기간·challenge set·test 여부와 ruleset을 유지하고
content pack만 `0.6.4`로 compare-and-set한다. `0.6.4`는 PR #233의 상황 기반 연속 사건을 담고
PR #234의 게임 모달 선택 화면과 함께 main `e71c71c59111d657f4e03845d84671baa509a77f`에 등록돼 있다.
`1.7.0` ruleset과 기존 pack 파일·checksum은 수정하지 않는다.

동기화 대상은 `production-release.mjs`, API 승인 manifest 목록, web 오프라인 폴백,
local `svc_kickoff`, non-production `svc_line_test`, staging smoke와 수동 rehearsal 기대값이다.
API 승인 목록에는 `1.7.0/0.6.4`를 추가하되 최초 공개 이후 다섯 기존 pair를 모두 보존한다.
따라서 포인터 전환과 롤백 중 승인된 구·신 커리어의 늦은 최초 sync는 계속 허용하고,
mixed pair·목록 밖 버전·다른 시즌 ID는 거부한다. 이미 생성된 커리어의 저장 버전은 바꾸지 않는다.

### 실행 순서와 게이트

1. Node `22.23.1`로 release CAS의 activate/noop/fail-closed/역 CAS, API 승인 pair 전체 상호 호환,
   web ACTIVE registry·pack 호환, content validation, lint·typecheck·unit·build·bundle checks를 통과시킨다.
2. PR merge 뒤 main CI가 staging `svc_line_test`를 `1.7.0/0.6.4`로 upsert하고 staging smoke가
   current manifest를 검증해야 한다. 신규 커리어의 생성·선택·후속 사건·저장·새로고침과 기존
   `1.7.0/0.6.3` 커리어 열림은 실제 staging에서 별도로 확인한다.
3. Production Release `mode=preflight`, `expected_sha`=배포할 최신 main으로 실행해 운영 행이 위
   고정 메타데이터와 `1.7.0/0.6.3`으로 정확한지 확인한다. 실행 중 main push를 멈춘다.
4. root만 `mode=deploy`, `confirmation=DEPLOY_PRODUCTION`, 시작
   `2026-09-05T15:00:00Z`, 종료 비움, `challenge_set_id=cs_season_1`로 실행한다. remote write 전
   plan은 `activate`, CAS 후 재조회 plan은 `noop`이어야 한다. 다른 plan은 중단한다.
5. current API가 같은 시즌 메타데이터와 `1.7.0/0.6.4`를 돌려주는지, health·CORS·web 200을
   확인한다. 360px 실제 플레이로 새 커리어의 `1.7.0/0.6.4` 고정, 사건 선택과 후속 사건,
   PUT 200, 새로고침 뒤 동일 ID/revision/hash를 검증한다. QA 표본은 삭제하지 않는다.

### 롤백

workflow artifact의 `season-rollback.sql`은 행이 여전히 정확한 `1.7.0/0.6.4`일 때만 버전 두
필드를 `1.7.0/0.6.3`으로 돌리는 역 compare-and-set이다. 자동 실행하지 않으며 Wrangler JSON의
`meta.changes` 합이 정확히 1인지와 D1/API 재조회 결과를 모두 확인한다. 0이면 성공으로 기록하지 않는다.

롤백 뒤에도 API 승인 목록의 `1.7.0/0.6.4`를 유지해 이미 생성됐거나 아직 오프라인인 신 팩 커리어를
보호한다. 다음 production deploy 전에는 `PRODUCTION_SEASON`을 `1.7.0/0.6.3`으로 되돌리는 후속 PR을
먼저 머지하고 fallback·seed·smoke·rehearsal도 함께 맞춘다. 그 전에는 Production Release `deploy`나
`set-season-end`를 실행하지 않는다. DB Time Travel 복구나 사용자 기록 삭제를 manifest rollback
대신 사용하지 않는다.

## 시즌 1 manifest 6차 승격: 1.7.0/0.6.4 → 1.7.1/0.6.5 (사용자 승인 2026-09-15)

운영 current `1.7.0/0.6.4`는 FAST 신규 커리어에서 EVENT 슬롯이 모두 optional이라 상황 기반
연속 사건의 root를 열 수 없다. 이 승격은 기존 파일을 수정하지 않고, `1.7.0`을 복사한
`1.7.1`에서 FAST 달력 step 4·5 EVENT 슬롯만 `required: true`로 바꾸며, 내용이 동일한
`0.6.5`를 `1.7.1` 전용 pair로 등록한다. 성장·은퇴·Legacy 1.2·대표팀·리그 원장 정책과
과거 커리어 replay는 그대로 유지한다.

두 슬롯이 모두 일반 결정을 여는 것은 아니므로 시즌당 실제 추가 일반 선택 수는 `+0..2`다.
후속은 persistent queue가 아니라 마지막 `EVENT_RESOLVED` 기록에서 파생되므로 step 5에서 처음
root가 열리면 같은 시즌에 후속 슬롯이 없고, step 4 root 뒤 step 5 강제 부상이 먼저 열리면
부상 해소가 마지막 기록을 덮어 후속이 중단될 수 있다. 새 follow-up queue나 저장 마이그레이션은
이번 승격 범위에 넣지 않는다.

### 실행 순서와 게이트

1. Node `22.23.1`로 새 ruleset/pack checksum, FAST 자연 진행, 포지션 필터, linked follow-up,
   같은 seed의 `1.7.0/0.6.4` zero-root 비교, 리그 원장·은퇴·과거 replay 회귀를 검증한다.
2. PR merge 뒤 main CI가 staging `svc_line_test`를 `1.7.1/0.6.5`로 upsert하고 smoke가 current
   manifest를 검증해야 한다. 실제 staging에서는 신규 커리어 생성부터 step 3 챕터 해소,
   step 4·5 사건 선택·저장·새로고침과 기존 `1.7.0/0.6.4` 커리어 열림을 별도로 확인한다.
3. Production Release `mode=preflight`, `expected_sha`=배포할 최신 main으로 실행해 운영 행이
   고정 메타데이터와 `1.7.0/0.6.4`로 정확한지 확인한다. 실행 중 main push를 멈춘다.
4. root만 `mode=deploy`, `confirmation=DEPLOY_PRODUCTION`, 시작
   `2026-09-05T15:00:00Z`, 종료 비움, `challenge_set_id=cs_season_1`로 실행한다. plan은
   쓰기 전 `activate`, CAS 뒤 재조회에서 `noop`이어야 한다.
5. current API가 `1.7.1/0.6.5`를 반환하는지와 health·CORS·web 200을 확인하고, 360px 실제
   신규 플레이로 사건 root/후속, PUT 200, 새로고침 뒤 동일 ID/revision/hash를 검증한다.

### 롤백

workflow artifact의 역 CAS는 행이 여전히 정확한 `1.7.1/0.6.5`일 때만 두 버전 필드를
`1.7.0/0.6.4`로 돌린다. 자동 실행하지 않으며 `meta.changes` 합 1과 D1/API 재조회를 확인한다.
롤백 뒤에도 승인 목록의 `1.7.1/0.6.5`를 제거하지 않아 이미 생성된 커리어를 보호한다.

## 시즌 1 manifest 7차 승격: 1.7.1/0.6.5 → 1.7.2/0.6.6 (첫 계약 흐름 단축, 사용자 결정 2026-09-15)

운영 current의 출발점은 `svc_season_1`, `시즌 1`, `ACTIVE`, `isTest=false`, 시작
`2026-09-05T15:00:00Z`, 종료 `null`, `cs_season_1`, ruleset `1.7.1` / pack `0.6.5`이다. 이 승격은
시즌 행의 ID·이름·상태·기간·challenge set·test 여부를 유지하고 ruleset·content pack 두 필드를
`1.7.2/0.6.6`으로 compare-and-set한다. `1.7.2`는 `1.7.1` 전체 복사 + `offerRules.preContract`
(계약 전 최대 이벤트 수·브리지 이벤트 화이트리스트) 선택 키 추가이고, 이 키가 없는 과거 룰셋
(1.7.1 이하)은 기존 배열을 그대로 써 기존 동작이 바뀌지 않는다(`packages/domain` 전체 골든·해시
회귀로 확인). `0.6.6`은 `0.6.5` 전체 복사 + EVT-REL-001(라커룸 갈등)·EVT-DEV-002(훈련 코칭)
트리거에 `{ "neq": ["contract.kind", ""] }` 조건 추가뿐이고 나머지 정의는 바이트까지 동일하다.
원인·변경 근거는 PR #238(`feat-first-contract-flow`)에 있다.

동기화 대상은 `production-release.mjs`, API 승인 manifest 목록, web 오프라인 폴백, local
`svc_kickoff`, non-production `svc_line_test`, staging smoke와 수동 rehearsal 기대값이다. API
승인 목록에는 `1.7.2/0.6.6`을 추가하되 기존 일곱 pair를 모두 보존한다. 따라서 포인터 전환과
롤백 중 승인된 구·신 커리어의 늦은 최초 sync는 계속 허용하고, mixed pair·목록 밖 버전·다른 시즌
ID는 거부한다. 이미 생성된 커리어의 저장 버전은 바꾸지 않는다.

### 전제 (main 머지 순서)

1. 첫 계약 흐름 PR #238(`feat-first-contract-flow`, 룰셋 1.7.2·팩 0.6.6)이 main에 있어야 한다. 없으면
   web 번들이 `알 수 없는 contentPackVersion: 0.6.6`으로 폴백 생성을 실패하고 `apps/web` 단위 테스트
   (`career-actions.test.ts`)가 모듈 로드에서 깨진다.
2. 그 뒤 이 승격 PR(`release-ruleset-1-7-2`)을 머지한다. 이 PR은 코드·문서만 바꾸며 운영 D1은
   건드리지 않는다. 이 브랜치는 #238 위에 스택돼 있어(base가 `feat-first-contract-flow`) GitHub PR이
   그 상태로는 #238의 커밋까지 함께 보여준다 — #238이 먼저 main에 머지되면 GitHub이 이 PR의 base를
   자동으로 main으로 바꾼다(리뷰 대상 diff가 이 PR만의 변경으로 줄어든다). #238이 머지되지 않은 채
   이 PR만 머지하지 않는다.

### 실행 순서와 게이트

1. release CAS의 activate/noop/fail-closed/역 CAS, API 승인 pair 전체 상호 호환, web ACTIVE
   registry·pack 호환, content validation, lint·typecheck·unit·build·bundle checks를 통과시킨다.
2. PR merge 뒤 main CI가 staging `svc_line_test`를 `1.7.2/0.6.6`으로 upsert하고 staging smoke가
   current manifest를 검증해야 한다. 신규 커리어의 진로 선택 → 스카우트 평가 → 첫 제안 → 계약 서명
   흐름(계약 전 사건 최대 1건)과 기존 `1.7.1/0.6.5` 커리어 열림은 실제 staging에서 별도로 확인한다.
3. Production Release `mode=preflight`, `expected_sha`=배포할 최신 main으로 실행해 운영 행이 위
   고정 메타데이터와 `1.7.1/0.6.5`로 정확한지 확인한다. 실행 중 main push를 멈춘다.
4. root만 `mode=deploy`, `confirmation=DEPLOY_PRODUCTION`, 시작 `2026-09-05T15:00:00Z`, 종료 비움,
   `challenge_set_id=cs_season_1`로 실행한다. remote write 전 plan은 `activate`, CAS 후 재조회
   plan은 `noop`이어야 한다. 다른 plan은 중단한다.
5. current API가 같은 시즌 메타데이터와 `1.7.2/0.6.6`을 돌려주는지, health·CORS·web 200을 확인한다.
   360px 실제 플레이로 새 커리어의 첫 계약 흐름과 PUT 200, 새로고침 뒤 동일 ID/revision/hash를
   검증한다. QA 표본은 삭제하지 않는다.

### 롤백

workflow artifact의 `season-rollback.sql`은 행이 여전히 정확한 `1.7.2/0.6.6`일 때만 버전 두 필드를
`1.7.1/0.6.5`로 돌리는 역 compare-and-set이다. 자동 실행하지 않으며 Wrangler JSON의 `meta.changes`
합이 정확히 1인지와 D1/API 재조회 결과를 모두 확인한다. 0이면 성공으로 기록하지 않는다.

롤백 뒤에도 API 승인 목록의 `1.7.2/0.6.6`을 유지해 이미 생성됐거나 아직 오프라인인 신 룰셋·팩
커리어를 보호한다. 다음 production deploy 전에는 `PRODUCTION_SEASON`을 `1.7.1/0.6.5`로 되돌리는
후속 PR을 먼저 머지하고 fallback·seed·smoke·rehearsal도 함께 맞춘다. 그 전에는 Production Release
`deploy`나 `set-season-end`를 실행하지 않는다. DB Time Travel 복구나 사용자 기록 삭제를 manifest
rollback 대신 사용하지 않는다.

## 공지 테이블 마이그레이션 + 운영 공지 seed 실행 (2026-09-14, notices)

사용자 결정(2026-09-14): 홈 공지사항을 웹 코드 상수(`HOME_NOTICES`)에서 D1 `notices` 테이블로
옮긴다(API-NOTICE-001, `GET /v1/notices`). 시즌 승격과 달리 이 변경은 **스키마 마이그레이션 +
데이터 seed** 두 단계이고, seed는 위 "실행 순서"의 일반 migration 단계에 포함되지 않는다(운영
INSERT는 워크플로 입력이 아니라 정적 SQL 파일이다) — 그래서 별도로 적는다.

1. **마이그레이션**은 새로 추가하지 않는다. 이 변경이 머지된 PR의 `apps/api/migrations/0007_*.sql`
   (notices 테이블 생성)이 위 "실행 순서" 2단계(`pnpm --filter @offside/api db:migrate:production`,
   `deploy-production.yml`)에서 다른 등록 migration과 함께 자동 적용된다 — 이 항목만을 위해 workflow를
   따로 실행할 필요는 없다. 다음 정기 production 배포(또는 이 변경만을 위한 별도 실행) 때 0007이
   적용됐는지 `sqlite_master`에서 `notices` 테이블 존재로 확인한다.
2. **운영 공지 seed**는 workflow 밖에서 오케스트레이터가 직접 실행한다(운영 계정 권한 필요,
   0007 적용 확인 뒤):
   ```
   pnpm --filter @offside/api exec wrangler d1 execute offside-production --remote --env production \
     --file seeds/notices-production-2026-09-14.sql
   ```
   `apps/api/seeds/notices-production-2026-09-14.sql`은 이관 대상 공지 2건을 `ON CONFLICT(id) DO
   UPDATE`로 넣는 멱등 SQL이다 — 재실행해도 완전히 같은 값이면 no-op이다. 운영자가 이후 이 두 공지를
   직접 SQL로 편집했다면 재실행이 그 편집을 덮어쓰므로, 재실행 전 `SELECT id, title, published_at
   FROM notices`로 현재 값을 먼저 확인한다.
3. **검증.** `curl https://api.<운영 도메인>/v1/notices`로 공지 2건과 `Cache-Control: public,
   max-age=60`을 확인하고, 운영 웹 홈에서 "공지사항" 배지가 2개로 보이는지 ego-browser로 확인한다.
4. **롤백.** 이 변경은 새 테이블 추가 + INSERT뿐이라 기존 테이블·행을 건드리지 않는다. 되돌릴 일이
   생기면 `notices` 테이블을 DROP하지 않고(아래 "장애 시 경계"의 일반 원칙) 대신 문제 있는 공지 행만
   `UPDATE notices SET is_published = 0 WHERE id = '...'`로 내린다 — API는 `is_published = 1`만
   돌려주므로 배포 없이 즉시 숨겨진다. 앱 자체의 폴백(오프라인 kv-store 캐시 → 빈 목록)은 API가 아예
   응답하지 않을 때만 쓰인다.

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


## 2026-09-20 시뮬레이터 전면 개편 승격

사용자가 개편 전체의 운영 배포와 서비스 적용을 승인했다. 운영 API 사전 조회에서 현재 시즌은
`svc_season_1`, ACTIVE/non-test, 시작 `2026-09-05T15:00:00Z`, 종료일 미정, **1.7.2/0.6.6**이다.
이번 릴리스는 같은 시즌 행의 manifest만 **2.0.0/0.7.0**으로 compare-and-set한다.
선수 생성·시즌 허브·훈련·사건 화면을 함께 배포하고, 신규 선수에게 사건 반복 완화와 육성 기회를 적용한다.
기존 선수의 생성 버전·저장 상태는 유지하며 구버전과 신버전의 동기화를 모두 허용한다.
시즌 기간·챌린지·종료일은 변경하지 않는다. API → web → 시즌 manifest 순으로 배포하며,
배포 직전 D1 복구 bookmark와 정확한 1.7.2/0.6.6 복원 SQL은 workflow artifact에 보존한다.

릴리스 정본, 승인 manifest 목록, 오프라인 폴백, staging/local seed와 검증 기대값을 함께 갱신했다.
검증과 실제 배포 결과는 완료 후 아래에 기록한다.
