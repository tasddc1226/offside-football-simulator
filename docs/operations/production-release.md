# 운영 웹 배포 런북

2026-09-06 사용자가 운영 배포를 승인했다. 이 문서는 기존 staging/expanded 배포와 별도로
운영의 첫 공개를 다룬다. 현재는 배포 준비 단계이며, 실행 결과 없이 배포 완료로 표현하지 않는다.
운영 시즌 기간과 공개 문의 이메일은 사용자 확인 중이다.

## 범위와 분리

| 대상 | 운영 값 |
| --- | --- |
| 웹 | `https://offside-web.tasddc1569.workers.dev` |
| API | `https://offside-api.tasddc1569.workers.dev` |
| D1 | `offside-production` / `2cfe462c-204e-4842-805c-5840fc9b1758` |
| 신규 운영 시즌 후보 | `svc_season_1`, 표시명 `시즌 1`, ACTIVE, isTest=false; 기간 승인 후 활성화 |
| 신규 커리어 버전 | ruleset 1.1.0 / content pack 0.3.0 / Legacy 1.1.0 |

- 사용자 승인된 최신 main을 수동 배포한다. main push의 staging 자동 배포 정책은 바꾸지 않는다.
- 기존 GitHub Actions 비밀값으로 배포한다. 비밀값을 추출하거나 문서/로그에 출력하지 않는다.
- staging/expanded D1 및 QA 커리어를 운영 DB로 복사하지 않는다. 비운영 bootstrap SQL을 운영에 실행하지 않는다.
- 운영 시즌 행은 새 ID로 생성한다. 기존 행의 버전·날짜·상태를 덮어쓰지 않는다. 다른 ACTIVE 시즌이나
  동일 ID의 다른 설정이 발견되면 중단하고 전환 방향을 확인한다.
- 익명 프로필과 복구 코드가 현재 로그인 수단이다. Google 연결은 실제 자격 증명·검증 전까지 사용할 수 없다.
  현재 설정 화면의 연결 버튼은 보이지만 인증 시작 API가 준비되지 않음 응답을 반환한다.
- 콘텐츠의 동결 checksum이나 과거 Legacy 점수를 바꾸지 않는다. #104/#105는 알려진 비차단 후속이다.

## 사전 확인

1. 배포할 main SHA와 통과한 staging 검증을 연결한다. Phase 5 인수는 PR #103 `fb8b782`,
   문서 closure는 PR #106 `3fd201a`에 기록돼 있다.
2. 운영 Worker/D1 이름·ID·origin을 확인한다. 원격 DB는 스키마, aggregate count, 서비스 시즌
   메타데이터만 읽고 개별 이용자·복구 코드·Snapshot 본문은 출력하지 않는다.
3. 운영 시즌 기간과 공개 문의 주소를 확인한다. 임의의 사용자 이메일을 공개하지 않는다.
4. migration/seed 이전 Time Travel bookmark를 확보한다. 계정별 보존 기간을 확인하며 무기한 백업으로
   오인하지 않는다. 일일 R2 export/Cron은 이 저장소에 아직 구현돼 있지 않다.
5. 검증된 source로 운영 API URL을 지정해 웹을 빌드한다. 로컬/expanded API로 연결된 번들을 배포하지 않는다.

2026-09-06 실제 읽기 전용 사전 확인: Cloudflare API의 production D1 UUID/이름이 설정과 같았고
크기는 12,288 bytes였다. `sqlite_master` 테이블 조회 결과 `_cf_KV`만 있어 앱 테이블과 운영
플레이 기록은 없었다. 최초 bookmark는
`00000001-00000000-000050de-bec332f2e29a6d8729c87f41b327f211`이다. 실제 배포 직전 다시 조회한다.
운영 웹과 API `/v1/health`도 당시에는 Cloudflare의 미배포 페이지를 반환했다.

## 실행 순서

수동 production workflow는 read-only preflight와 명시적 `DEPLOY_PRODUCTION` 배포 실행을
구분한다. main ref·정확한 expected SHA를 확인하고 production 작업은 직렬 실행한다.

1. 로컬 핵심 검증 및 운영 번들 build, 읽기 전용 preflight와 bookmark를 확인한다.
2. 기존 migration 0000~0004를 순서대로 적용한다. 이미 적용된 것은 반복 적용하지 않는다.
3. 승인한 운영 시즌만 INSERT 한다. 완전히 동일한 행은 no-op이며 다른 설정은 실패 처리한다.
4. 운영 API → 운영 web 순서로 배포한다. API의 active pointer는 운영 시즌 ID와 같아야 한다.
5. health·current service season·정확한 CORS 허용/거부·웹 응답을 확인한다.
6. ego-browser로 온보딩/새 선수 생성과 API 저장·새로고침을 확인한다. QA 기록을 실제 사용자 지표와
   혼동하지 않도록 이름과 검증 시각을 남기며, 기존 사용자 기록은 지우지 않는다.
7. 실행 URL·source SHA·Worker 버전·season manifest·배포 후 검증을 이 문서 또는 PR에 남긴다.

## 장애 시 경계

- 마이그레이션을 DROP/복원해 롤백하지 않는다. 신규 운영 데이터가 생긴 이후 과거 DB로 복원하면
  플레이가 유실될 수 있으므로 신규 쓰기 중단·영향 확인·사용자 승인 없이 실행하지 않는다.
- 첫 1.1 커리어 생성 이후 1.1 reader/content/Legacy 참조집단을 제거하는 구 코드로 되돌리지 않는다.
  이전 active pointer로 변경해도 이미 생성된 커리어의 버전은 바뀌지 않는다. 수정 배포를 우선한다.
- 신규 생성 제한과 기존 기록 열람은 분리한다. ACTIVE 시즌을 닫을 필요가 있으면 대상 ID를 확인하고
  운영 변경을 명시적으로 기록한다. 이 workflow의 재실행이 닫힌 시즌을 자동으로 다시 열어서는 안 된다.
- 커스텀 도메인, Google OAuth, Apps-in-Toss 심사·출시, 유료 플랜 전환은 이번 배포에 포함하지 않는다.
