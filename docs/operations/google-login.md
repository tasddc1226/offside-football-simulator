# Google 로그인 운영 연결

## 상태와 승인 범위

2026-09-06 사용자가 개인 계정 `tasddc1569@gmail.com`에 오프사이드 전용 Google Cloud
프로젝트를 생성하도록 승인했다. 회사 계정의 `plab-mcp`는 사용하거나 변경하지 않는다.
현재 상태는 **운영 배포·실계정 연결 검증 완료**다. 2026-09-06 13:20 KST까지 최초 연결,
로그아웃 직후 같은 계정 재로그인, 새로고침과 기존 기록 보존을 확인해 U-003을 완료 처리했다.
결제 계정·유료 서비스·Google의 다른 API는 추가하지 않는다.

개인 계정 로그인을 확인하고 조직 없이 `OFFSIDE Football Simulator` 프로젝트
(`offside-football-prod`)를 생성했다. 같은 개인 계정의 기존 `kbo-lab-prod`도 변경하지 않았다.
`OFFSIDE Production Web` 웹 클라이언트를 생성하고 아래 운영 callback만 등록했다.
client ID·secret은 메모리에서 CLI 표준 입력으로 GitHub production environment secrets에
전달했으며 값 출력·스크린샷·JSON 파일 다운로드는 하지 않았다. 두 secret 이름의 존재를 확인했다.

익명 플레이는 계속 기본 경로다. Google 연결은 기존 프로필의 복구·동기화 수단을 추가하며,
선수 생성 조건이나 게임 진행 조건이 아니다. 토스 채널에는 이 웹 OAuth 흐름을 노출하지 않는다.

## 운영 설정

| 항목                                 | 값                                                                   |
| ------------------------------------ | -------------------------------------------------------------------- |
| Google Cloud 소유 계정 / 지원 연락처 | `tasddc1569@gmail.com`                                               |
| 앱 이름                              | 오프사이드 (OFFSIDE)                                                 |
| 클라이언트 유형                      | 웹 애플리케이션                                                      |
| 운영 웹                              | `https://offside-web.tasddc1569.workers.dev`                         |
| 승인된 리디렉션 URI                  | `https://offside-api.tasddc1569.workers.dev/v1/auth/google/callback` |
| 개인정보 처리방침                    | `https://offside-web.tasddc1569.workers.dev/legal/privacy`           |
| 이용약관                             | `https://offside-web.tasddc1569.workers.dev/legal/terms`             |
| 요청 scope                           | `openid email`                                                       |
| Worker                               | `offside-api`, Wrangler environment `production`                     |
| 자격 증명 이름                       | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                           |

2026-09-06 콘솔에서 **외부 / 프로덕션 단계** 전환과 저장된 scope 2개를 재조회해 확인했다.
인증 센터는 민감/제한 범위가 없어 데이터 액세스 인증이 필요하지 않다고 표시한다.
앱 이름·로고에 대한 **브랜딩 인증은 별도 미완료**다. 따라서 Google 로그인 화면에는 앱 브랜드 대신
운영 도메인이 표시될 수 있다. 프로덕션 공개와 Google의 브랜드 인증 완료를 혼동하지 않는다.
브랜드 표시를 위한 도메인 소유 확인·브랜딩 심사는 별도 후속 게이트다.

클라이언트가 직접 Google 토큰을 받는 방식이 아니라 API가 authorization code를 교환한다.
브라우저 번들에 client secret을 넣지 않으며 Gmail·연락처·Drive 접근 권한을 요청하지 않는다.
Google 계정의 안정적인 `sub`를 연결 키로 사용하고 이메일로 자동 병합하지 않는다.

## 비밀값 전달과 배포

1. 개인 계정 로그인과 필요한 사용자 인증은 사용자가 직접 수행한다. 비밀번호·2단계 인증 코드를
   채팅이나 실행 로그에 받지 않는다.
2. 발급한 두 자격 증명은 GitHub의 **production environment secrets**에 전달한다. 특히 client
   secret은 채팅·PR·커밋·스크린샷·평문 임시 파일에 남기지 않는다. CLI를 사용할 때는 인수가 아닌
   표준 입력으로 전달한다.
3. 기존 수동 **Production Release**의 `deploy` 경로로 검증된 정확한 main SHA를 배포한다.
   배포 절차는 두 자격 증명이 함께 있는지 먼저 확인하고, 승인된 운영 Worker에만 반영한다.
   둘 다 없으면 기존 Worker secrets를 건드리지 않는다. 하나만 있는 설정은 실패 처리한다.
   `preflight`와 `set-season-end`는 자격 증명을 쓰지 않는다.
4. staging/expanded에는 운영 자격 증명을 복사하지 않는다. 테스트 환경 실계정 인증이 필요하면
   별도 클라이언트와 정확한 환경별 callback을 준비한다. `GOOGLE_FAKE=1`은 local에서만 허용한다.
5. secret 변경도 인증 동작을 바꾸는 운영 변경이다. 배포 및 연결 검증 결과를 아래 표에 남긴다.

기존 [운영 배포 런북](production-release.md)의 시즌·D1 보존 규칙을 그대로 따른다.
이번 작업으로 `svc_season_1`의 종료일, 게임 버전, 커리어·엔딩·Legacy 기록을 바꾸지 않는다.

## 최소 인수 검증

| 확인                 | 검증 기준                                                                  | 현재 결과       |
| -------------------- | -------------------------------------------------------------------------- | --------------- |
| 최초 연결            | 기존 익명 선수 ID·revision·hash 유지, Google 연결 표시                     | 운영 통과       |
| 저장 중 연결         | 미전송 저장을 끝낸 뒤 이동; 일반 저장 실패는 차단, 소유권 복구 필요 시 재인증 허용 | 로컬 통과       |
| 세션 전환            | 인증 성공 후 새 세션 사용, 이전 토큰으로 인증 불가                         | 로컬 통과       |
| 취소·잘못된 callback | 기존 플레이 유지, 실패 안내, 로그인 성공으로 처리하지 않음                 | API 테스트 통과 |
| 재로그인             | 연결한 Google 계정으로 같은 프로필과 저장 기록 복원                        | 운영 통과       |
| 명시적 병합          | 옮기기는 ID 보존; Google 프로필만 사용은 선택한 서버 기록과 기기 저장 정합 | 로컬 통과       |
| 운영 상태            | 실제 Google 인증 왕복 성공, 대상 공개 상태 확인                            | 운영 통과       |

### 운영 인수 결과 — 2026-09-06

- 구현 [PR #112](https://github.com/tasddc1226/offside-football-simulator/pull/112)을 main에 병합했다.
  최초 Google 활성화 배포 source는 `f557fa7eb73208ea67a771c96ae8d0c2c7749e42`다. 후속 수정 배포와 구분한다.
- [Production Release run34010879775](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34010879775)
  성공(1분35초, 13:15 KST). Google secret 조합 검증·Worker 동기화, API/web 배포,
  health·시즌·CORS 검증을 통과했다. main staging run34010863739도 성공(2분13초)했다.
- ego-browser에서 실제 개인 Google 계정을 선택하고 이메일 권한 동의 후 설정으로 돌아왔다.
  연결 이메일은 마스킹되어 표시됐으며, Google 화면의 서비스명은 `tasddc1569.workers.dev`였다.
- 기존 프로필 `prf_3fdaa4c0-f0cd-4337-a15d-0492632fc9af`의 연결 상태가 false → true로 바뀌었다.
  기존 선수 `수구리`, career ID `8d767e80-f717-4727-9b05-ce08d41f75a5`, revision **18**,
  state hash `ee51d72af7bd863f93684d683ec594497ce77f35b2298315c4760f91b91566c4`는
  최초 연결 전후와 재로그인 후 모두 같았다. 프로필·커리어 GET은 모두 200이었다.
- 로그아웃 직후 다른 플레이 없이 같은 Google로 재로그인하자 병합 선택 없이 원래 프로필로
  돌아왔다. 새로고침 후에도 연결 표시와 허브의 선수 1명·마지막 갱신 시각이 유지됐다.
  서버·기기 데이터 삭제, 복구 코드 재발급, 커리어 진행은 하지 않았다.
- 시즌 1의 `endsAt: null`, ruleset 1.1.0 / pack 0.3.0은 유지했다.
  실제 계정 간 파괴적 병합, 별도 기기 로그인, 로그아웃 상태에서 추가 플레이한 뒤 재로그인은
  이번 운영 smoke의 범위가 아니다. 병합 안전성의 로컬 검증과 구분한다.

### 재로그인 저장 예외 — #113

운영 smoke 후 코드 점검에서 [#113](https://github.com/tasddc1226/offside-football-simulator/issues/113)을 발견했다.
로그아웃 후 기존 로컬 선수를 진행하면 새 익명 세션에 원 서버 기록의 소유권이 없어
`CAREER_NOT_OWNED`(403)가 발생한다. 이 저장 실패로 Google 인증 진입까지 막으면 소유권을
회복할 수 없는 순환이 된다.

후속 수정은 **미전송 revision + FAILED + 정확한 CAREER_NOT_OWNED**에만 OAuth를 허용한다.
일반 네트워크/서버 오류, 오프라인, 충돌에 대한 저장 사전검사는 유지한다. 같은 Google 계정으로
복귀하면 새 문서의 동기화 클라이언트와 `NONE` 대조가 로컬 진행을 보존하고 재전송한다.
다른 Google 계정을 선택해도 자동 전환 경로는 원 계정의 서버 기록이나 미전송 로컬을 삭제하지 않는다.

명시적 병합의 `Google 저장본만 사용`은 여전히 기기 기록 교체·삭제 선택이다. 이때 미전송분도
없어질 수 있으므로 대화상자에 개수와 손실 경고를 표시한다. 보존하려면 `커리어를 보존하며 전환하기`를 선택한다.
단, 다른 Google 계정이 소유한 기존 선수의 서버 소유권까지 자동으로 옮긴다는 뜻은 아니다.

Node 22에서 사전검사·복구 대조 23건과 로컬 실제 API + fake OAuth 회귀를 통과했다.
후자는 새 QA draft를 저장 → 로그아웃 → 로컬 이름 수정 → 소유권 저장 실패 → 같은 계정 재인증 →
자동 PUT 200 후 GET의 revision·hash 일치까지 확인한다. 운영 사용자의 플레이로 재현하지 않았다.

2026-09-06 Node 22.22.1 로컬 검증: API 인증·세션 36건, 웹 저장 준비·대조 20건,
엔진 import 4건 통과. 실제 로컬 API + 가짜 OIDC의 연결·병합 브라우저 테스트와 병합 UI 스텁
테스트도 2/2 통과했다. 기존 테스트가 선수 생성 개편 전의 탭을 찾던 실패를 현행 공용 생성
helper로 고쳤으며, 수동 `저장됨` 대기를 제거해 앱의 연결 전 flush 경로를 실행했다.
웹·API 타입 검사, API/웹 변경 범위 lint, 운영 URL 웹 build 및 초기 번들 예산 검사도 통과했다.
배포 workflow는 actionlint 및 기존 운영 릴리스 테스트 7건으로 확인했다.
이 근거는 실제 Google 계정 인증·공개 대상 검증을 대체하지 않는다.

병합의 파괴적인 선택은 기존 사용자 데이터가 아닌 로컬 QA 프로필로 검증한다. Google 프로필만
사용한다는 선택은 이전 프로필의 서버 기록을 삭제한다는 의미가 아니다. 로컬 데이터 교체·정리는
명시적인 선택과 성공한 원격 읽기·검증을 전제로 한다.

증거에는 실행 URL·배포 SHA·검증 시각·QA 선수 ID와 hash 등 비밀이 아닌 식별 정보만 남긴다.
OAuth code/state/PKCE verifier, 세션 쿠키, ID token, 복구 코드, client secret은 기록하지 않는다.

## 실패 시 점검 순서

- 시작 API 503: 운영 Worker에 두 자격 증명이 모두 있는지 **존재 여부만** 확인한다.
- `redirect_uri_mismatch`: Google 클라이언트와 Worker의 callback이 위 URI와 정확히 같은지 확인한다.
- 접근 제한: 콘솔의 대상·테스트 사용자·게시 상태를 확인한다. 이 문제를 API 예외 처리로 우회하지 않는다.
- 설정 취소/검증 실패: 익명 기록은 유지하고 다시 연결한다. 오류를 해결하려고 DB·브라우저 저장소를 지우지 않는다.
- 병합 성공 후 세션 쿠키 응답까지 유실: 폐기한 이전 토큰을 다시 허용하지 않는다. 같은 Google 계정으로
  재인증해 병합 대상 프로필과 서버 기록을 되찾는다. 새 쿠키를 받은 뒤 응답 본문만 유실된 경우는 같은
  idempotency key의 재시도로 처리한다. 쿠키 교체와 브라우저 수신까지 원자적이라고 보장하지 않는다.
- 노출된 secret: 해당 클라이언트 secret을 교체하고 운영 binding을 갱신한다. 기록과 복구 코드는 별개이며 삭제하지 않는다.

인증 흐름과 토큰 검증 기준은 [Google OpenID Connect 공식 문서](https://developers.google.com/identity/openid-connect/openid-connect)를 따른다.
