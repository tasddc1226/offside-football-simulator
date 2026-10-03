# 앱 새 소식 푸시 (T-11-060)

## 현재 단계

공지·릴리즈 노트 푸시의 기기 연결과 관리자 본인 테스트를 구현했다. staging API·웹·DB는
최신 메인 위의 구현으로 배포하고, 등록·해제·비관리자 발송 차단과 개인정보 안내 페이지를 확인했다.
iOS·Android 테스트 빌드는 성공했고 iOS 설치와 staging 실제 Google 로그인을 확인했다.
시뮬레이터 실행 장애로 앱 UI·실제 푸시 수신은 아직 확인하지 못했다. 운영 API 배포와 자동 발송은 미완료다.
기존 게임 내 새 소식 배너와 릴리즈 노트 자동 게시는 그대로 사용한다.

## 확정한 발송 정책

- 사용자 선택: 공지·릴리즈 노트만, 한국 시간 같은 날 게시판별 첫 신규 공지 한 번.
- 하루 최대 공지 1회 + 릴리즈 노트 1회. 댓글·채팅·업적·팀 경기 알림은 제외한다.
- 같은 글 수정, 당일 릴리즈 노트 추가, 배포 재실행은 푸시를 추가로 보내지 않는다.
- 과거 글을 소급 발송하지 않는다. 전체 발송 전에는 테스트 기기만 사용한다.
- 앱 시작 때 권한을 묻지 않는다. 설정에서 알림 받기를 눌렀을 때만 요청한다.
- 거절해도 게임을 이용할 수 있고, 기기별로 해제할 수 있다.

이 정책은 후속 발송 작업의 요구사항이다. 이 PR의 기기 등록 API가 하루 제한을 시행하는 것은 아니다.

## 구현 경로

| 경로                     | 역할                                             |
| ------------------------ | ------------------------------------------------ |
| `PUT /v1/push/device`    | app Bearer 세션으로 수신 기기 등록·토큰 교체     |
| `DELETE /v1/push/device` | 보안 저장소의 설치 식별자로 자기 기기 연결 해제  |
| `POST /v1/push/test`     | 관리자 현재 세션의 본인 기기 한 대로 고정 테스트 |

`PUSH_TEST_ENABLED=1`일 때만 테스트 요청을 허용한다. 기본값은 꺼짐이다.
토큰 목록을 읽는 공개 API, 임의 대상 발송, 자동 전체 발송은 없다.
추후 Expo enhanced push security를 켜면 `EXPO_PUSH_ACCESS_TOKEN`은 Worker secret으로만 설정한다.
키를 클라이언트나 wrangler vars에 넣지 않는다.

설치 UUID는 SecureStore, 서버에는 해시만 저장한다. 토큰·플랫폼·실제 앱 버전·프로필·세션·갱신 시각을
D1 `push_devices`에 저장한다. 같은 설치의 계정 전환은 재바인딩하고, 다른 설치가 등록된 토큰을
가져오면 거절한다. 응답은 private/no-store이며 토큰이나 설치 식별자를 로그에 남기지 않는다.
동일 토큰·세션·버전의 서버 등록은 하루 동안 재사용하며 화면 진입마다 등록하지 않는다.
로그아웃·만료·폐기된 세션 및 삭제된 프로필은 테스트 대상이 될 수 없다. 계정 삭제 때 등록도 같은
트랜잭션으로 삭제한다. 마지막 등록에서 90일 지난 기기는 조회에서 제외하고 매일 정리한다.
오프라인 해제는 기기에 대기를 저장하고 재연결 때 해제한다. 서버에 전달되기 전까지는 등록이 남을 수 있다.

푸시 탭은 공지·릴리즈 노트 게시판과 검증된 글 ID만 연다. 외부 URL·게임 명령은 실행하지 않는다.
앱이 켜져 있으면 기존 배너와 OS 배너가 겹치지 않는다. 관리자 테스트는 켜진 앱에서도 OS 배너를 표시한다.

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

## 이어서 진행할 순서

1. 테스트 기기를 정하고 이 API가 있는 격리된 테스트 서버·빌드를 연결한다. 실기기 iOS·Android에서
   권한 허용/거절, 앱 실행/백그라운드/종료 상태 수신, 알림 탭, 계정 전환, 해제를 확인한다.
2. 테스트 접수 ticket ID와 receipt를 저장·확인하는 운영 경로를 더한다. 현재 `{accepted:true}`는 Expo가
   요청을 수락했다는 뜻이며, 기기 수신 성공을 뜻하지 않는다. 네트워크 결과가 불명확하면 자동 재전송하지 않는다.
3. 게시판 글 저장 트랜잭션에 KST 날짜·게시판 고유 제한과 outbox를 함께 저장한다. 수동 공지 생성과
   자동 릴리즈 노트 신규 게시를 모두 연결한다. 수정은 연결하지 않는다.
4. 적은 수의 동의한 테스트 기기로 비동기 발송·중복 방지·실패 복구·invalid token 정리를 검증한다.
   설정 해제·세션 변경을 발송 직전 다시 확인한다. Expo ticket 수락과 APNs/FCM receipt를 구분한다.
5. 개인정보 안내·스토어 데이터 표시와 새 빌드를 확인한 뒤, 사용자의 운영 배포 지시에 맞춰 전체 발송을 켠다.

## 검증

권한·오프라인 해제·설정 도중 계정/토큰 변경은 app-core 테스트에서, 등록/교체/충돌/세션 자격/계정 삭제/
기본 off/관리자 본인 한정/발송 횟수/invalid token은 실제 D1(Miniflare) 테스트에서 검증한다.
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

### 최종 테스트 빌드 준비

- 토큰 교체 경쟁 방어와 최종 빌드 설정 커밋: `15318031`.
- staging API 최종 코드 version: `2661df80-c22d-41db-ba73-6d74f42b08b2`.
- Android 최종 테스트 빌드: `9d985df4-2485-4b14-9057-3b363dac0567` (`push-test`).
- iOS 시뮬레이터 빌드: `becd6faa-4c9e-45ad-af77-c30da4ffff08` (`push-test-simulator`).
- 두 빌드 모두 `FINISHED`를 확인했다. 실제 앱 실행·수신은 아직 확인 전이다.
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

### 실행 환경 복구 대기

- 기존 작업이 사용하는 iOS 기기가 함께 실행 중이어서 CoreSimulator 서비스 재시작 승인을 요청했다.
  확인 전에는 공유 서비스나 다른 작업의 기기를 종료하지 않는다.
- Android 최종 내부 빌드 완료 시각: `2026-10-03T14:23:45.017Z`.
- Android 테스트 APK는 staging에 연결하고 운영 앱과 같은 `com.offsidelab.app` 식별자를 사용한다.
  운영 앱이 설치된 실기기에 덮어 설치하지 않고 격리된 테스트 환경에서 먼저 검증한다.
