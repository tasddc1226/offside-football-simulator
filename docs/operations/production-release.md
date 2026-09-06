# 운영 웹 배포 런북

2026-09-06 사용자가 운영 배포를 승인했다. 이 문서는 기존 staging/expanded 배포와 별도로
운영의 첫 공개를 다룬다. **2026-09-06 12:33 KST 운영 API/web 배포와 후속 브라우저 저장 검증을 완료했다.**
사용자는 첫 시즌을 종료일 미정으로 열고, 나중에 직접 종료일을 정하기로 확정했다.
공개 문의 이메일은 `tasddc1569@gmail.com`으로 승인했다.

후속 작업: 개인 계정의 전용 프로젝트를 사용하는 [Google 로그인 연결](google-login.md)을 진행한다.
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
| 신규 커리어 버전 | ruleset 1.1.0 / content pack 0.3.0 / Legacy 1.1.0 |

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
- 익명 프로필과 복구 코드가 현재 로그인 수단이다. Google 연결은 실제 자격 증명·검증 전까지 사용할 수 없다.
  현재 설정 화면의 연결 버튼은 보이지만 인증 시작 API가 준비되지 않음 응답을 반환한다.
- 콘텐츠의 동결 checksum이나 과거 Legacy 점수를 바꾸지 않는다. #104/#105는 알려진 비차단 후속이다.

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
