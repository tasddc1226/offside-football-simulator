# 앱 새 소식 푸시 (T-11-067)

## 현재 단계

T-11-070에서 수동 공지 작성과 자동 릴리즈 노트 신규 게시를 운영 푸시 outbox에 연결한다.
기기 연결·수신 유도·알림 클릭 이동은 T-11-067에서 구현했고 iOS·Android 테스트 기기에서 확인했다.
네이티브 기능이 포함된 앱은 1.0.3이다. 심사 제출과 스토어 출시 여부는 별도로 확인한다.
이번 작업은 API·DB·운영 cron만 변경하며 앱 빌드나 OTA를 새로 게시할 필요가 없다.

## 확정한 발송 정책

- 사용자 선택: 공지·릴리즈 노트만, 한국 시간 같은 날 게시판별 첫 신규 공지 한 번.
- 하루 최대 공지 1회 + 릴리즈 노트 1회. 댓글·채팅·업적·팀 경기 알림은 제외한다.
- 같은 글 수정, 당일 릴리즈 노트 추가, 배포 재실행은 푸시를 추가로 보내지 않는다.
- 과거 글을 소급 발송하지 않는다. T-11-070 운영 배포 지시로 이후 신규 게시의 자동 발송을 활성화한다.
- 홈에서 수신 안내를 보여 주되 OS 권한은 자동으로 요청하지 않는다. 홈 안내나 설정의 '알림 받기'를 눌렀을 때만 요청한다. 안내를 닫거나 수신을 선택한 뒤에는 홈 안내를 반복하지 않는다.
- 거절해도 게임을 이용할 수 있고, 기기별로 해제할 수 있다.

이 정책은 `push_news_events`의 게시판·KST 날짜 고유 키와 기기별 `push_news_deliveries`로 시행한다.

## 구현 경로

| 경로                     | 역할                                            |
| ------------------------ | ----------------------------------------------- |
| `PUT /v1/push/device`    | app Bearer 세션으로 수신 기기 등록·토큰 교체    |
| `DELETE /v1/push/device` | 보안 저장소의 설치 식별자로 자기 기기 연결 해제 |
| `POST /v1/push/test`     | 현재 앱 세션의 본인 기기 한 대로 고정 테스트    |

`PUSH_TEST_ENABLED=1`일 때만 테스트 요청을 허용한다. 기본값은 꺼짐이다.
일반 사용자와 관리자 모두 본인 기기에 테스트를 요청할 수 있다. 운영은 `PUSH_TEST_ENABLED=1`로 활성화한다.
기기·프로필마다 10분에 1회, KST 하루 3회까지다. 동일 D1 batch에서 예산을 예약하므로
동시 요청·등록 해제·세션/토큰 교체로 한도를 초기화하지 않는다. 발송 실패·불명확 결과도 요청 횟수에 포함한다.
앱은 다음 요청 시각을 기기에 저장해 버튼을 잠시 비활성화한다. 시간 경과·앱 복귀는 로컬에서만 처리하며 서버를 폴링하지 않는다.

토큰 목록을 읽는 공개 API와 임의 대상 발송 API는 없다. 자동 발송은 아래의 저장된 신규 게시만 처리한다.
추후 Expo enhanced push security를 켜면 `EXPO_PUSH_ACCESS_TOKEN`은 Worker secret으로만 설정한다.
키를 클라이언트나 wrangler vars에 넣지 않는다.

설치 UUID는 SecureStore, 서버에는 해시만 저장한다. 토큰·플랫폼·실제 앱 버전·프로필·세션·갱신 시각을
D1 `push_devices`에 저장한다. 같은 설치의 계정 전환은 재바인딩하고, 다른 설치가 등록된 토큰을
가져오면 거절한다. 응답은 private/no-store이며 토큰이나 설치 식별자를 로그에 남기지 않는다.
동일 토큰·세션·버전의 서버 등록은 하루 동안 재사용하며 화면 진입마다 등록하지 않는다.
로그아웃·만료·폐기된 세션 및 삭제된 프로필은 테스트 대상이 될 수 없다. 동의 철회·계정 삭제 때 등록과
발송 토큰 사본을 같은 트랜잭션으로 삭제한다. 마지막 등록에서 90일 지난 기기는 조회에서 제외하고 매일 정리한다.
오프라인 해제는 기기에 대기를 저장하고 재연결 때 해제한다. 서버에 전달되기 전까지는 등록이 남을 수 있다.

푸시 탭은 공지·릴리즈 노트 게시판과 검증된 글 ID만 연다. 외부 URL·게임 명령은 실행하지 않는다.
앱이 켜져 있으면 기존 배너와 OS 배너가 겹치지 않는다. 테스트 알림은 켜진 앱에서도 OS 배너를 표시한다.

## 인증과 새 빌드

기존 OFFSIDE EAS 프로젝트의 iOS APNs key와 Android FCM v1 발송 자격을 연결하고 원격 조회로 확인했다.
Firebase Android 앱은 기존 Firebase 프로젝트에 추가했다. 전용 발송 서비스 계정에는
`roles/firebasecloudmessaging.admin`만 추가했다. 개인 키는 저장소 밖에 보관하며 공개 저장소에는
Android 앱의 공개 클라이언트 설정인 `google-services.json`만 넣는다.

`expo-notifications`와 config plugin이 추가되어 기존 앱 런타임과 다르다. 기존 앱에 OTA만 보내서
푸시를 활성화할 수 없다. 버전은 실제 스토어 빌드 준비 시 현재 출시·심사 버전과 시즌 규칙을 확인한 뒤
결정한다. 현재 앱 버전은 이 작업에서 올리지 않았다.

사용자 결정에 따라 iOS는 격리된 로컬 시뮬레이터로 검증한다. `push-test-simulator`는 staging에 연결한
독립 실행 빌드이며 실기기 등록 없이 설치한다. 다른 작업이 소유한 시뮬레이터·서버는 변경하지 않는다.
`eas.json` 변경도 런타임에 영향을 주므로 최종 설정으로 Android 테스트 빌드도 새로 만든다.

## 자동 발송·재처리 (T-11-070)

- 수동 글 생성과 자동 릴리즈 첫 생성은 글·발송 이벤트·수신 기기를 같은 D1 batch에 저장한다.
  저장 실패는 전체 롤백한다. 기존 글의 수정·릴리즈 항목 추가·dry-run은 큐를 만들지 않는다.
- 게시판별 그날 먼저 생성된 글이 이미 있으면(삭제된 글도 포함) 새 글을 보내지 않는다.
  배포 이전의 글, 이후 등록한 기기에 과거 공지를 소급 발송하지 않는다.
- 게시 시점의 수신 등록·유효 앱 세션·미삭제 프로필을 저장하고 발송 직전 다시 확인한다.
  철회·로그아웃·토큰/계정 교체·글 삭제·90일 미갱신은 발송을 취소한다.
- `NEWS_PUSH_ENABLED=1`과 `ENVIRONMENT=production`을 모두 만족할 때만 외부 발송한다.
  staging과 로컬은 외부 발송을 하지 않는다. 운영 설정을 `0`으로 배포하면 큐 처리를 중단한다.
- 게시 요청의 `waitUntil`에서 처리하고, 운영 5분 cron이 남은 큐와 실패 재처리를 잇는다.
  기존 KST 04:00 정리·백업 cron은 그대로 유지한다. 앱·웹 GET에 발송이나 polling을 추가하지 않는다.
- 게시 요청에서는 최대 100기기, cron에서는 최대 300기기를 100개 이하 묶음으로 순차 발송한다. 원자적 lease로 겹친 실행을 막는다.
  HTTP 429/5xx와 접수 단계의 MessageRateExceeded는 5·10·20분 간격, 총 최대 4회 시도한다.
  게시 24시간 뒤에는 오래된 알림을 보내지 않는다. Expo 접수 후 기기 전달 TTL은 1시간이다.
- 네트워크 타임아웃·불완전한 응답·중단된 발송 lease는 접수됐을 가능성이 있어 `unknown`으로 끝낸다.
  자동 재발송하지 않는다. 외부 푸시 서비스까지 정확히 한 번 전달하는 보장은 없으며,
  불명확한 경우 일부 알림 누락을 감수하고 중복 발송을 줄인다.
- 접수 `accepted`와 APNs/FCM 확인 `confirmed`를 구분한다. 15분 뒤 receipt를 조회하고
  없거나 조회가 실패하면 15분 뒤 다시 조회한다(24시간까지). receipt 조회 실패로 재발송하지 않는다.
  `confirmed`도 사용자 화면의 실제 수신을 보장하는 값은 아니다.
- DeviceNotRegistered는 당시 토큰·세션과 같은 등록만 제거한다. 새 토큰으로 바뀐 등록은 보존한다.
  끝난 발송의 토큰 사본은 즉시 비우고 이벤트·접수 번호는 만료 30일 뒤 cascade로 정리한다.
- Workers Logs의 `job=news-push`에서 상태별 건수만 남긴다. 토큰·프로필·글 내용·인증값을 기록하지 않는다.
  운영 로그와 1% trace sampling을 켠다. 아래 조회도 건수만 확인한다.

```sql
SELECT board, day, COUNT(*) events FROM push_news_events GROUP BY board, day;
SELECT state, COUNT(*) deliveries FROM push_news_deliveries GROUP BY state;
```

공식 참고: [Expo 발송·ticket·receipt](https://docs.expo.dev/push-notifications/sending-notifications/),
[Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 검증

권한·오프라인 해제·설정 도중 계정/토큰 변경은 app-core 테스트에서, 등록/교체/충돌/세션 자격/계정 삭제/
기본 off/본인 기기 한정/기기·프로필 예산/동시 요청 제한/발송 횟수/invalid token은 실제 D1(Miniflare) 테스트에서 검증한다.
발송 테스트는 네트워크 stub이며 실제 기기 수신 증거가 아니다. UI 실기기 확인과 스토어 출시는 미완료다.

참고: [Expo 설정](https://docs.expo.dev/push-notifications/push-notifications-setup/),
[Expo 발송·receipt](https://docs.expo.dev/push-notifications/sending-notifications/),
[FCM v1 자격](https://docs.expo.dev/push-notifications/fcm-credentials/).

### 2026-10-03 테스트 환경 준비 기록

- 최신 메인 `7f8d39ec`를 포함한 준비 커밋: `03b59ed4`.
- D1 staging 백업 후 기존 미적용 마이그레이션과 `0053_curvy_blue_blade.sql`까지 적용했다. 운영 DB는 변경하지 않았다.
- staging API version: `28605ea3-4a6c-4266-b8c9-28aebc87c064` (이후 관리자 secret 설정도 배포로 기록된다).
- staging 웹 version: `14eda15b-cf47-49a6-8982-01a7e7f6b46f`. 기존 누락된 OG staging Worker도 프로젝트 배포 스크립트로 준비했다.
- Android 내부 테스트 빌드: `25d41c0f-5521-4c96-a199-1e9684c47a8b`, `push-test` 프로필·채널, staging API를 사용한다. 생성 당시 빌드 중이며 완료·설치를 별도로 확인해야 한다.
- iOS는 사용자 지시로 로컬 시뮬레이터 검증으로 변경했다. staging 테스트 전용 Google OAuth 생성과 Google 사용자 데이터 정책 동의를 확인받고 진행했다.
- API·계정 관련 테스트 총 49건, app-core 6건, 정적 페이지 9건이 통과했다. 계정 테스트는 장비 부하로 10초 hook timeout에 실패한 뒤, 로컬 CLI의 hook 대기를 60초로 늘려 재실행해 통과했다. 저장소의 전역 테스트 제한은 변경하지 않았다.
- API/mobile/app-core 타입 검사, 변경 파일 ESLint·서식, 공개 저장소 위생 검사, staging API·웹/OG dry-run을 통과했다. 기기 UI·실제 수신·스토어 심사·운영 푸시 배포 검증은 수행 전이다.

### 초기 테스트 빌드 준비

- 토큰 교체 경쟁 방어와 최종 빌드 설정 커밋: `15318031`.
- staging API 최종 코드 version: `2661df80-c22d-41db-ba73-6d74f42b08b2`.
- Android 초기 테스트 빌드: `9d985df4-2485-4b14-9057-3b363dac0567` (`push-test`).
- iOS 시뮬레이터 빌드: `becd6faa-4c9e-45ad-af77-c30da4ffff08` (`push-test-simulator`).
- 두 빌드 모두 `FINISHED`를 확인했다. 아래 APNs 반복 이벤트 문제가 포함되어 있으므로 수정본 검증용으로 사용하지 않는다.
- 격리된 iOS 18.1 기기: `OFFSIDE Push Test iPhone 16`, `4C89C694-C807-4EAD-8533-B397DF7FF65E`.
- 모바일 전체 린트·타입 검사가 통과했다. 테스트 대상 외 기기와 운영 채널은 변경하지 않았다.

### OAuth 연결과 실제 인증 확인

- Google Cloud 기존 OFFSIDE 프로젝트에 테스트 전용 웹 클라이언트 `OFFSIDE Push Test`를 생성했다.
- 외부/테스트 모드를 유지하고 지정된 소유자 계정 한 개만 테스트 사용자로 등록했다.
- 리디렉션 URI는 staging API의 `/v1/auth/google/callback` 한 개다. 운영 OAuth 설정은 변경하지 않았다.
- client ID/secret은 staging Worker secret으로만 설정했다. 개인 비밀정보는 저장소 밖 0600 파일에 보관했다.
- secret 설정 후 staging API version: `11c0200b-acd2-4e85-a0bd-03e83cfe461d`.
- 앱 OAuth 시작 요청에서 테스트 client ID, staging 콜백, `openid email` scope를 원격 확인했다.
- staging 웹에서 실제 Google 로그인과 운영자 계정 표시까지 확인했다. 가짜 Google 로그인을 사용하지 않았다.
- staging 웹의 API 빌드 환경 누락을 고쳐 재배포했다. version: `0301cf5c-7f57-4c38-ad02-a40ef052b895`.
  staging 빌드에는 `VITE_API_BASE_URL=https://offside-api-staging.tasddc1569.workers.dev`를 설정해야 한다.
- iOS 빌드 runtime: `03fc5c14d328f5cd28ce035e8e97ba922e4b6ceb`.
- Android 빌드 runtime: `0a236c7e7de6afcb2eccd672c4d7eca459a8e12b`.
- iOS 빌드 파일 다운로드·설치를 완료했다. iOS 18.1과 26.5 전용 기기에서 앱 실행이
  `NSPOSIXErrorDomain code 3`으로 실패하고, Safari도 정상 화면을 표시하지 못하는 상태를 관찰했다.
  Mac load average가 600 이상이었다. 부하가 원인인지 확정하지 않았으며, 앱 수신 성공으로 기록하지 않는다.
- iOS 26.5 격리 기기: `OFFSIDE Push Test iPhone 17`, `0891CEE3-0F94-48AF-8207-1E5C734E0C16`.
  iOS 18.1 전용 기기는 종료했다. 다른 작업의 기기·프로세스는 변경하지 않았다.

### 실행 환경 복구와 네이티브 회귀 수정

- 사용자가 다른 작업 기기의 잠시 중단을 허용한 뒤 CoreSimulator 서비스를 재시작했다.
  기존 `OFFSIDE Local Main iPhone 16`은 다시 부팅했고 앱 설치·데이터는 변경하지 않았다.
- 전용 iOS 26.5 기기에서 앱 UI·설정 화면·알림 권한 요청과 거절 후 OS 설정 안내를 확인했다.
- 전용 iOS 18.1 기기에서 권한 허용과 Expo 토큰·서버 연결까지 확인했지만, 동일 APNs 이벤트가
  등록을 반복시켜 앱을 중지했다. staging에는 iOS 등록 한 행만 남았고 시간당 요청 제한이 작동했다.
- 수정 커밋 `5492c309`: 최초 네이티브 토큰 이벤트는 기준값으로 저장하고 동일 토큰 이벤트를
  무시한다. 실제 변경은 새 네이티브 토큰으로 Expo 토큰을 조회해 재연결한다.
- 실제 네이티브 어댑터 회귀 테스트 3건이 통과했다. 최초/동일 이벤트, 실제 교체,
  초기 획득 중 교체를 검증하며 반복 등록과 busy 상태 정착 실패를 재현한다.
  모바일 전체 린트·타입 검사도 통과했다.
- 회귀 테스트 실행: `pnpm --filter @offside/app-core exec vitest run --config ../../apps/mobile/vitest.push.config.mjs`.
- 수정 후 iOS fingerprint는 `03fc5c14d328f5cd28ce035e8e97ba922e4b6ceb`로 기존 테스트 빌드와 일치한다.
  설치된 앱은 수정본을 반영하기 전까지 중지한다. 운영 채널에는 OTA를 게시하지 않았다.
- 로컬 디스크 부족으로 수정 iOS 빌드의 첫 업로드가 실패했다. 실패한 임시 압축 파일을 정리하고
  EAS의 `EAS_NO_VCS=1` 모드로 동일 작업 트리의 소스만 업로드했다. Git 이력 복사 없이 16.1 MB로
  업로드했으며 원격 빌드의 Git SHA는 비어 있다. 빌드 소스는 깨끗한 `5492c309` 작업 트리다.
- 수정 iOS 시뮬레이터 빌드: `64ca4065-20f5-49dd-b01a-923497a3dcea` (`push-test-simulator`).
- 수정 Android 내부 빌드: `527fa809-6124-48c2-959a-05157620b5ea` (`push-test`).
  두 빌드 모두 `FINISHED`를 확인했다. iOS 완료 `2026-10-03T15:25:03.583Z`,
  Android 완료 `2026-10-03T15:34:41.639Z`. runtime은 위 초기 테스트 빌드의 값과 각각 일치한다.
- 사용자 본인이 전용 iOS 18.1 기기의 Safari에서 실제 Google 로그인을 완료했다.
- 앱 설치·조회 지연이 재발해 전용 기기만 재부팅한 뒤, 앞서 허용된 범위에서 CoreSimulator 서비스를
  다시 복구하고 Simulator GUI도 재연결했다. 기존 Local Main 기기는 다시 부팅했고,
  GUI가 자동으로 부팅한 기본 iPhone 17은 원래 상태인 Shutdown으로 돌렸다. 기기 데이터를 지우지 않았다.
- 전용 iOS 18.1 기기에 수정 앱을 덮어 설치했다. 설치된 실행 파일과 JS 번들 SHA-256이 다운로드한
  수정 빌드와 일치함을 확인했다. 수정 앱 홈·구단주 화면을 확인하고 실제 Google 앱 인증을 시작했다.
- Android 수정 APK를 `Downloads/OFFSIDE-push-test-1.0.2.apk`에 저장했다.
  연결된 Android 에뮬레이터는 다른 작업 소유이므로 설치하지 않았다. 실제 Android 수신은 미확인이다.
- 별도 Android AVD `OFFSIDE_Push_Test_API_36`을 기존 Google APIs ARM64 시스템 이미지로 생성했다.
  전용 경로·RAM 2 GB·CPU 2개·데이터 파티션 4 GB이며 기존 AVD와 데이터를 공유하지 않는다.
  이후 전용 포트 5556으로 기동했고 수정 APK 설치와 앱 실행 요청 성공을 확인했다.
  기존 Android 포트 5554는 변경하지 않았다. 앱 UI·실제 Android 수신은 미확인이다.
- 네이티브 앱의 Google 인증창에서는 Safari 로그인 후에도 계정 입력을 다시 요구했다.
  이후 사용자가 실제 앱 Google 로그인을 완료했고 관리자 본인 테스트 버튼이 표시됐다.
- Android 테스트 APK는 staging에 연결하고 운영 앱과 같은 `com.offsidelab.app` 식별자를 사용한다.
  운영 앱이 설치된 실기기에 덮어 설치하지 않고 격리된 테스트 환경에서 먼저 검증한다.

### 실제 앱 로그인과 Cloudflare 발송 수정

- iOS 수정 앱에서 실제 Google 관리자 로그인, 알림 연결 준비 완료, busy 상태 해제를 확인했다.
  로그인 후 서버 등록은 한 번 증가했고 `push_devices`는 iOS 한 행이다. 반복 이벤트 수정이 실제
  설치 앱에서도 반영됐다.
- 첫 테스트 발송은 Cloudflare 런타임에서 `redirect: error`가 거부되어 Expo에 연결하기 전에 실패했다.
  Node fetch 모의 테스트와 달리 workerd는 `follow`와 `manual`만 허용한다.
- 수정 커밋 `7e645d54`: `manual`로 변경하고 3xx 응답을 HTTP 오류로 거절한다. 리디렉션을
  따라가거나 결과가 불명확한 발송을 자동 재시도하지 않는다.
- 실제 발송 모듈을 번들링해 Miniflare/workerd에서 실행하는 회귀 테스트와 리디렉션 거절 테스트를
  추가했다. 관련 API 테스트 16건, API 타입 검사, 변경 파일 ESLint·서식 검사가 통과했다.
  이전 검증을 포함한 서로 다른 관련 테스트는 69건이며 전체 검증 체인을 실행했다는 뜻은 아니다.
- 수정 staging API version: `53589f89-2d3c-41ea-8457-a378cf99f0b7`.
- 수정 서버로 관리자 본인 기기 테스트를 한 번 요청해 Expo 접수 성공 UI를 확인했다.
  이 결과는 APNs 전달·OS 표시·알림 탭 성공을 보장하지 않는다. 실제 수신은 별도로 확인한다.
  전체 사용자나 운영 환경에 발송하지 않았다.

### 미수신 진단과 APNs sandbox 수정

- 사용자가 iOS 알림센터에 테스트 알림이 없음을 확인했다. 접수 성공을 수신 성공으로 기록하지 않는다.
- 수정 `78f3b1d8`: 마지막 본인 테스트 ticket ID와 발송 시각을 등록 행에 보관한다.
  토큰·세션 교체 시 지우고, 발송 중 교체되면 과거 결과가 새 등록을 덮어쓰지 않는다.
  공개 응답·로그에는 ticket나 토큰을 노출하지 않는다. migration `0054_common_the_leader.sql`을
  staging에만 적용했다. API 테스트 17건, API 타입·변경 파일 린트·서식 검사가 통과했다.
- staging API version: `79a7b202-2586-4ff2-9373-413c9b5b9905`.
- 앱 재실행이 시뮬레이터에서 지연되어, 유효한 관리자 iOS 등록 한 대에 한정해 실제 발송 모듈을
  사용하는 운영자 진단 CLI로 한 번 발송했다. 토큰·ticket는 저장소 밖 비공개 파일에서 처리했다.
- Expo receipt의 실제 결과는 `error`, `DeveloperError`, APNs `BadDeviceToken`(400)이었다.
  Expo 접수 후 Apple이 토큰을 거절한 것을 확인했다.
- SDK의 iOS provisioning profile 조회는 시뮬레이터에서 null이며, Expo 토큰 등록 기본값은
  APNs production이다. 시뮬레이터 sandbox 토큰의 환경 불일치와 일치하는 코드 경로다.
- 수정 `889101a3`: 네이티브 release type이 SIMULATOR일 때만 `development: true`로 등록한다.
  SDK의 production 자동 갱신도 끄고 기존 어댑터의 실제 토큰 이벤트 갱신을 사용한다.
  실기기 iOS와 Android의 SDK 환경 판별은 유지한다. 기존 포함된 `expo-application`을 직접 의존성으로 선언했다.
- 네이티브 회귀 테스트 5건, 모바일 타입·변경 파일 린트·서식 검사가 통과했다.
  테스트 빌드의 iOS fingerprint `03fc5c14d328f5cd28ce035e8e97ba922e4b6ceb`와 일치해
  `push-test` iOS 채널에만 OTA를 게시한다. 운영 채널은 변경하지 않는다.
- 현재 실제 OS 수신·알림 탭은 수정 OTA 적용 뒤 다시 확인해야 한다.

- 최초 sandbox 테스트 OTA group: `6b219af7-32b0-4901-877d-092a57dc38c2`,
  iOS update: `01a10292-3f4a-751d-89b4-0209da7e901d`. 앱 내부 업데이트 DB에서
  성공 실행 횟수 1·실패 횟수 0을 확인했다. 이 기록은 푸시 등록·수신 성공의 증거는 아니다.
- 설치된 SDK의 `setAutoServerRegistrationEnabledAsync(false)`는 JS에서 null을 전달하지만
  iOS 네이티브 `setRegistrationInfoAsync`는 String 매개변수를 요구하는 추가 호환성 문제가 있다.
- 수정 `484dcc34`: SDK 해제 호출이 실패하면 같은 네이티브 모듈에 `isEnabled: false`를
  JSON 문자열로 저장한다. SDK가 시작한 자동 갱신은 먼저 중지하고, simulator만 이 경로를 사용한다.
  이미 포함된 `expo-modules-core`를 직접 의존성으로 선언했다.
- 실제 String-only 브리지 거절을 재현하는 테스트를 추가해 네이티브 테스트 6건, 모바일 타입·린트
  검사가 통과했다. iOS runtime은 기존 테스트 앱과 일치한다. 후속 테스트 OTA로 이 호환성 처리를
  게시한다. 화면 제어 도구가 반복 시간 초과되어 실제 OS 표시·알림 탭 확인은 아직 끝나지 않았다.

- 호환성 보완 후 테스트 OTA group: `bf814d4a-6544-4921-accc-f359a80f7dc7`,
  iOS update: `01a1029c-7bc2-7eac-b779-3090fec048f0`, 게시 시각 `2026-10-03T16:32:52.162Z`.
  채널 `push-test`, 플랫폼 iOS, runtime `03fc5c14d328f5cd28ce035e8e97ba922e4b6ceb`다.

- 최신 호환성 OTA는 전용 iOS 기기의 업데이트 DB에 다운로드 완료(status 1)로 확인했다.
  이 시점 최신 OTA 성공 실행 횟수는 0이며, 이전 sandbox OTA는 성공 3·실패 0이었다.
  제어 도구의 반복 시간 초과로 사용자에게 최신 OTA 재시작·본인 테스트 1회 확인을 요청했다.
  최초 BadDeviceToken 이후 수정본의 APNs receipt·OS 실제 수신 성공을 아직 기록하지 않는다.

### iOS 실제 원격 푸시 수신 확인

- `2026-10-04 01:42 KST` 사용자 요청으로 본인 iOS 테스트 기기 한 대에 한 번 발송했다.
  전용 시뮬레이터의 최신 호환성 OTA 성공 실행 횟수 1·실패 0과 유효한 등록 한 대를 확인했다.
- 발송 시각 `2026-10-03T16:42:16.446Z`, Expo ticket 접수 성공, APNs receipt `ok`를 확인했다.
  이 단계에서는 아직 OS 수신을 확정하지 않았다.
- 사용자가 `01:42:50 KST` 시뮬레이터 알림센터 캡처를 제공했다. 알림센터에
  '오프사이드 알림 테스트'와 '공지와 릴리즈 노트 알림이 연결됐어요.'가 실제 표시됐다.
  Expo 원격 발송 → APNs 전달 → iOS OS 알림 표시를 확인했다. `simctl push` 모의 주입이 아니다.
- 최초 BadDeviceToken은 simulator sandbox 등록과 iOS String-only 브리지 호환성 수정 뒤 해소됐다.
  운영 채널·운영 사용자 발송은 변경하지 않았다.
- 알림 탭 → 소식의 공지사항 이동은 사용자 확인을 요청했다. Android 실제 수신·앱 종료 상태
  탭·계정 전환·해제의 기기 UI 검증, 자동 발송 outbox·KST 중복 방지는 별도 후속 작업이다.

- 사용자가 실제 알림을 눌렀을 때 앱이 정상으로 열리고 공지 목록으로 이동함을 확인했다.
  iOS 실제 원격 수신 → OS 알림 탭 → 허용된 공지 목록 이동 검증을 완료했다.
  앱이 완전히 종료된 상태의 cold-start와 Android는 별도 검증 대상이다.

### Android 원격 테스트 전달 확인

- 사용자가 전용 Android 에뮬레이터에서 실제 Google 로그인과 알림 연결을 완료했다.
  staging에서 본인 iOS 기기와 같은 프로필의 유효한 Android 앱 세션·등록 한 대를 확인했다.
  앱 버전은 `1.0.2`이며, 다른 기기와 운영 사용자에게는 발송하지 않았다.
- `2026-10-04 02:05 KST` 실제 발송 모듈로 본인 Android 기기에 고정 테스트를 한 번 보냈다.
  발송 시각 `2026-10-03T17:05:53.437Z`, Expo ticket 접수와 FCM receipt `ok`를 확인했다.
  ticket은 저장소 밖의 접근 제한된 진단 파일에 보관했다.
- OS 알림 표시와 알림 탭의 공지 목록 이동은 사용자 확인을 요청했다.
  FCM 전달 성공만으로 실제 화면 표시나 앱 종료 상태의 동작을 확정하지 않는다.
- 이후 사용자가 Android에서도 앱 푸시가 정상 동작함을 확인했다.
  iOS·Android의 실제 원격 테스트 수신 검증을 완료했으며, 앱 완전 종료 상태의 별도 검증은 남아 있다.

홈 동의 안내와 첫 커리어 종료 뒤 스토어 리뷰 요청은 [앱 이용 안내](app-engagement.md)에 정리한다.
