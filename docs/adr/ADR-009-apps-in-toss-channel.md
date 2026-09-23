# ADR-009. 앱인토스 미니앱 대응 구조와 출시 준비

- 상태: Amended by ADR-013 (2026-09-24, 출시 보류 유지, `packages/platform` 채널 어댑터는 코드에서 제거됨 — 필요 시 git 이력에서 복원). 확정 (2026-09-02, 같은 날 범위 조정). 구조 결정은 지금 적용한다. 출시 준비 항목은 사용자가 미니앱 출시를 결정한 뒤 착수한다
- 관련: [ADR-001](ADR-001-web-framework.md), [ADR-002](ADR-002-persistence-and-identity.md), [ADR-007](ADR-007-hosting-and-infra.md), [ADR-008](ADR-008-auth-and-account-merge.md), [배포·운영](../development/09-deployment-and-operations.md)
- 근거 문서: 앱인토스 개발자센터(2026-09-02 열람). 정책은 수시로 개정되므로 검토 요청 전에 [서비스 오픈 정책](https://developers-apps-in-toss.toss.im/intro/guide)과 [게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-game)를 다시 확인한다.

## 맥락

일반 웹(자체 도메인)을 먼저 출시한다. 토스 앱 안의 미니앱(앱인토스)은 등급분류·콘솔 검토·인증서 같은 별도 준비가 필요하므로 출시 시점을 따로 결정하되, 웹 프로젝트는 처음부터 언제든 미니앱으로 출시할 수 있는 구조로 만든다. 앱인토스는 WebView SDK와 React Native SDK를 제공하며, 웹 번들을 토스가 호스팅하고 콘솔 검토를 거쳐 노출한다. 플랫폼 이용자는 만 19세 이상이다.

## 지금 적용하는 것과 미루는 것

| 구분 | 내용 | 시점 |
|---|---|---|
| 구조 (지금) | `packages/platform` 어댑터와 `LocalStore` 포트, 화면·엔진의 채널 분기 금지, 세션 미들웨어의 쿠키·Bearer 동시 지원, CORS 목록의 환경 변수화, 약관·개인정보의 SPA 내부 라우트, SafeArea·종료 확인·뒤로 가기의 어댑터 경유, 콘텐츠 팩 지연 로드와 초기 청크 예산 | Phase 0~1 |
| 구조 (지금) | 아래 "검토 통과를 위한 구현 규칙" 중 SDK가 필요 없는 항목은 web 채널에서도 그대로 지킨다 | Phase 1~ |
| 준비 (보류) | `@apps-in-toss/web-framework` 의존성 추가와 `platform/toss` 실제 구현, `apps-in-toss.config.ts`, `.ait` 빌드·`ait deploy`, `POST /auth/toss/session`과 mTLS 바인딩, 콘솔 등록·자산·등급분류·검토 요청 | 사용자가 출시를 결정한 뒤. 진행 보드의 M-001~M-006 |

출시 결정 뒤 필요한 리드타임은 등급분류 10~15일과 콘솔 검토 2~4주다. 구조가 준비돼 있으면 코드 작업은 M-001~M-004 네 건이다.

## 결정

| 항목 | 선택 |
|---|---|
| 채널 구조 | 별도 앱을 만들지 않는다. `apps/web`의 같은 SPA를 `web`·`toss` 두 모드로 빌드하고, 채널 차이는 `packages/platform` 어댑터에만 둔다 |
| SDK | WebView SDK `@apps-in-toss/web-framework` 3.x. 설정 파일 `apps-in-toss.config.ts`(`appName`, `brand.primaryColor`, `webView`, `permissions: []`, `webBundleDir: 'dist'`). React Native SDK·Unity는 쓰지 않는다 |
| 빌드·업로드 | `vite build --mode toss && ait build` → `<appName>.ait`. CI가 `ait deploy --api-key`로 콘솔에 올린다. 검토 요청·출시·롤백은 사람이 콘솔(또는 콘솔 MCP)에서 실행 |
| 앱 유형 | **게임**. 카테고리는 스포츠(장르 선택지에 따름). 게임물 등급분류 증빙이 필수이므로 GRAC 등급분류를 직접 받는다(스토어 미출시 게임은 스토어명 `기타-앱인토스`로 신청) |
| 사용자 식별 | `User.getAnonymousKey()`(게임 미니앱, 토스앱 5.232.0 이상)가 주는 미니앱별 고정 hash. 서버는 `POST /api-partner/v1/apps-in-toss/users/anon-key/verify`(mTLS, `x-anon-key`)로 검증한 뒤 프로필에 연결하고 Bearer 세션을 발급한다 |
| 로그인 | 미니앱 안에서는 토스 로그인 외 어떤 로그인도 금지다. Google 로그인은 toss 채널에 노출하지 않는다. 토스 로그인은 사업자 등록이 필요하고 식별키만으로 충분하므로 쓰지 않는다 |
| 로컬 저장 | 네이티브 `Storage`(문자열 KV, 용량 제한 없음). IndexedDB는 iOS WebView에서 7일 미사용 시 삭제되고 QR·라이브 origin이 달라 공유되지 않으므로 정본으로 쓰지 않는다 |
| 동기화 | 모든 step 경계에서 `PUT /careers/{id}`. 식별키가 항상 있으므로 서버가 사실상 정본 복제본이 된다 |
| 서버 통신 | 미니앱 origin `https://<appName>.web.tossmini.com`·`private-web`·`apps`·`private-apps` 4종을 API와 Static Assets `/content/*` CORS에 허용. HTTPS만. 앱인토스 서버 API는 Workers `mtls_certificates` 바인딩으로 호출 |
| 수익화 | 인앱 결제·인앱 광고·토스 포인트 프로모션은 넣지 않는다. 따라서 사업자 등록 없이 출시 가능하다(정책: "사업자 등록은 필수가 아니지만 인앱 결제·토스페이·프로모션·비즈 월렛·토스 로그인을 사용하려면 필수") |
| 성장 기능 | Phase 7에서 토스 게임센터 리더보드(미니앱당 1개, Legacy Score), `Share.createLink`, `Analytics`, `Review.request`. 리더보드는 클라이언트 제출값을 토스가 검증하지 않으므로 서버 리플레이 검증을 통과한 Archive만 제출한다 |
| 디자인 시스템 | TDS를 쓰지 않는다. 방송 그래픽 방향 유지. toss 채널은 시스템 테마 감지를 끄고 고정 팔레트를 쓴다(아래 위험 참조) |
| 오류 추적 | Sentry JS SDK 그대로. 출시 후 `ait sentry upload-sourcemap --deployment-id`로 소스맵 업로드 |
| 테스트 | 로컬은 `@apps-in-toss/devtools` Vite 플러그인으로 브라우저에서 SDK 모킹(3.x는 샌드박스 앱 미지원). 실기기는 콘솔 QR(`intoss-private://…?_deploymentId=`), 워크스페이스 멤버·만 19세·토스 로그인 필요 |

## 검토 통과를 위한 구현 규칙

게임 출시 가이드 체크리스트 중 이 제품에 해당하는 항목을 구현 요구사항으로 고정한다.

- 최초 화면이 10초 안에 열린다. 초기 청크 300KB 이하, 콘텐츠 팩은 지연 로드.
- 우상단 프레임워크 닫기(X) 버튼 영역과 Safe Area(Dynamic Island 포함)를 침범하지 않는다(DSN-CHN-001).
- 진입 직후 바텀시트·모달을 자동으로 띄우지 않는다. 온보딩(SCR-034)은 화면 안 카드로 표시한다.
- 모든 화면에서 미니앱을 나갈 수 있고, 종료 시 확인 모달을 띄운다. 안드로이드 백버튼은 뒤로 가기 또는 종료로 동작한다(SDK 백 이벤트 구독).
- 자사 서비스 이동·앱 설치 유도 금지. 미니앱 안에 "웹 버전에서 열기" 링크를 두지 않는다. 약관·개인정보 처리방침은 SPA 내부 라우트로 렌더링한다.
- `eval`, 외부 코드 실행, `window.location.replace`로 자사 사이트 이동, SSR, iframe(YouTube 제외) 금지. SPA 라우팅의 `pushState`는 허용 범위다.
- 사용자 식별키를 저장하고 종료 후 재진입 시 플레이 기록이 유지된다. 이는 네이티브 `Storage` + 서버 동기화로 만족한다.
- 사운드를 넣는다면 On/Off 설정과 백그라운드 전환 시 즉시 정지가 필수다. Season 1은 무음 + 햅틱(`Device.triggerHaptic`)만 쓴다.
- 세로 고정(`Screen.setOrientation`). 인게임 화면은 전체 화면.
- 생성형 AI가 런타임에 만든 텍스트를 노출하지 않는다. 서사는 저작된 콘텐츠 팩만 쓴다. 저작 과정에 LLM을 쓰더라도 사용자에게 노출되는 결과는 사람이 확정한 팩이다.
- 개인정보 처리방침에 "토스 미니앱 사용자 식별키" 수집과 Cloudflare(해외 리전) 저장에 따른 국외 이전 항목을 넣는다. 토스 로그인을 쓰지 않으므로 콘솔의 국외 이전 동의문 등록 의무는 없으나 처리방침에는 명시한다.

## 위험과 대응

| 위험 | 대응 |
|---|---|
| 게임 유형 선택 시 등급분류 없이는 검토 요청 자체가 불가. GRAC 심의 10~15일 + 수수료 | U-009를 Phase 1 중에 시작한다. 개인 신청 가능 여부를 GRAC에 먼저 확인하고, 불가하면 개인사업자 등록(U-011) 후 신청 |
| FAQ "라이트 모드 기준으로 개발·디자인·출시"가 게임의 자체 다크 팔레트에도 적용될 수 있음 | 게임 체크리스트에는 라이트 모드 항목이 없다. toss 채널은 시스템 테마와 무관한 고정 팔레트로 제출하고, 반려되면 DSN-THM-001의 라이트 토큰 세트로 전환한다. 토큰만 바꾸면 되도록 컴포넌트에 hex를 쓰지 않는다 |
| 검토팀이 앱 유형을 비게임으로 재분류 | 비게임이면 `getAnonymousKey`와 앱인토스 내비게이션 바·라이트 모드가 요구된다. `platform/toss`가 식별 함수를 카테고리별로 분기할 수 있게 둔다 |
| 검토 대기 중 번들과 라이브 번들이 동시에 존재 | API 응답 스키마는 추가만 하고, 두 릴리스 뒤에 삭제한다(09 문서) |
| 토스 앱 삭제 시 네이티브 Storage 소실 | 서버 동기화가 매 step 경계이므로 손실은 마지막 step 이후 결정 하나 이하 |
| 식별키 검증 API 분당 3,000회 | 세션 수명(7일) 동안 재검증하지 않는다 |
| SDK 3.x origin 정책이 2026-08-25 이후 다시 바뀜 | CORS 목록에 4개 origin을 모두 두고 환경 변수로 관리한다 |

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| React Native SDK(Granite)로 별도 앱 | 코드베이스 둘. 웹 SPA와 화면 명세를 공유할 수 없음 |
| 비게임 유형으로 등록 | 등급분류는 피하지만 토스 내비게이션 바·라이트 모드·핀치줌 규칙이 붙고 리더보드를 못 쓴다. 축구 커리어 시뮬레이션은 게임이며 검토 중 재분류될 가능성이 큼 |
| 토스 로그인 도입 | 사업자 등록·약관 등록·연결 끊기 콜백이 필요하고 식별키로 충분 |
| 미니앱에서 IndexedDB 유지 | iOS 7일 삭제와 origin 분리로 커리어 손실 위험 |

## 결과

- ADR-001·002·005·007·008에 채널 관련 행을 추가했다. 01·07·08·09·12·13 문서와 화면 인덱스, Phase 0·2·7에 반영했다.
- 사용자 액션 U-007~U-011(콘솔 등록, mTLS 인증서, 등급분류, MCP 인증, 조건부 사업자 등록)은 보류 상태로 보드에 둔다. 미니앱 출시 결정이 곧 착수 신호다.
- Phase 0 백로그에는 구조 작업 T-0-012(`platform` 골격과 toss 스텁)만 둔다. SDK 연동·빌드·세션 API는 보류 백로그 M-001~M-006이다.
- 콘솔 MCP(`apps-in-toss-console`)는 상태 조회·번들 업로드·검토 신청에 쓴다. 출시·롤백·예산 충전은 사용자 확인 후에만 실행한다.
