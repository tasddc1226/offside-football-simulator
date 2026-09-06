# ADR-008. 인증과 계정 연결·병합

- 상태: 확정 (2026-09-02)
- 관련: [ADR-002](ADR-002-persistence-and-identity.md), [ADR-007](ADR-007-hosting-and-infra.md), [화면 SCR-030](../screens/05-hub-and-support.md)

## 맥락

비로그인 플레이가 기본이고, 소셜 로그인은 한 가지만 제공한다. 로그인의 목적은 다른 기기 복구와 동기화이지 플레이 조건이 아니다.

## 결정

| 항목 | 선택 |
|---|---|
| 익명 식별 (web) | 서버 발급 `profileId`, HttpOnly 쿠키(ADR-002) |
| 익명 식별 (toss) | 앱인토스 `User.getAnonymousKey()` hash. `POST /auth/toss/session`이 mTLS로 검증하고 Bearer 세션을 발급. Google 로그인은 toss 채널에 노출하지 않는다(WebView OAuth 차단, 토스 계정이 이미 식별 수단) |
| 소셜 로그인 | Google 1종 (OpenID Connect). 다른 제공자는 추가하지 않는다 |
| 구현 | Hono + `arctic`(OAuth 클라이언트) + 자체 세션 테이블. Auth 프레임워크 없음 |
| 세션 | 서버에서 해시로 보관하는 무작위 세션 토큰의 HttpOnly 쿠키. Google 식별자는 프로필에 연결하며, 로그인 성공·프로필 전환·병합 확정 시 세션 토큰을 회전한다 |
| 저장 정보 | `googleSub`, 검증된 `email`, `linkedAt`. 프로필 사진·이름은 저장하지 않는다 |
| 복구 수단 | 복구 코드(비로그인)와 Google 로그인(로그인) 둘 다 유지. web↔toss 채널 간 이동은 복구 코드 |
| 로그아웃 | 세션 무효화. 로컬 IndexedDB는 지우지 않는다. "이 기기 데이터 삭제"는 별도 동작 |

## 연결·병합 규칙

| 상황 | 동작 |
|---|---|
| 익명 프로필 A에서 Google 로그인, Google 계정이 처음 | A에 Google을 연결한다. 커리어 ID 유지 |
| 익명 프로필 A에서 로그인, Google이 이미 프로필 B에 연결 | A에 진행 중 Career가 없으면 B로 전환. 있으면 사용자에게 "A의 커리어를 B로 옮기기 / B만 사용하기" 선택 |
| 옮기기 선택 | A의 Career·Archive·시즌 진행을 B로 이동. Career ID 유지. A는 빈 프로필로 남기고 30일 뒤 삭제 |
| B만 사용하기 선택 | 이 기기에서 B의 서버 저장본을 사용한다. 같은 ID의 미전송 기기 저장본도 명시적 선택에 따라 원자 교체하며, 원격 검증 실패 시 로컬 전용 기록 삭제를 미룬다. 이 선택 자체가 A의 서버 기록을 삭제하지는 않는다 |
| 같은 시즌 도전 보상을 A·B가 각각 받은 경우 | 하나만 유지. unique key `serviceSeasonId + challengeId + ownerProfileId`로 서버가 판정 |
| 복구 코드로 복구 중 현재 프로필에 커리어가 있음 | 같은 선택 화면. `RECOVERY_CONFLICT` |
| toss 프로필에서 web 복구 코드 입력 | 같은 병합 규칙. 결과 프로필은 `tossAnonKey`와 `googleSub`를 동시에 가질 수 있다 |
| 토스 hash가 이미 다른 프로필에 연결 | 항상 그 프로필로 전환한다(hash는 사용자당 하나). 현재 로컬에 미동기 커리어가 있으면 옮기기 선택 |

병합은 서버 트랜잭션 하나로 처리하고 감사 로그에 `fromProfileId`, `toProfileId`, 이동한 careerId 목록을 남긴다.

## 보안

- OAuth `state`와 PKCE 사용. 인증 요청은 시작한 세션에 결속하고 다른 세션의 callback은 거부한다.
  운영 콜백은 `https://offside-api.tasddc1569.workers.dev/v1/auth/google/callback` 하나만 등록한다.
- OAuth로 이동하기 전에 미전송 진행의 동기화 완료를 확인한다. 저장 실패 시 이동하지 않는다.
- 로그인 성공·프로필 전환은 새 web 세션 발급과 이전 세션 폐기를 한 D1 batch로 처리한다.
  Google 병합의 소유권 이동과 세션 회전도 같은 batch로 확정한다.
- 세션 쿠키 `HttpOnly; Secure; SameSite=Lax`. CSRF는 SameSite와 `Origin` 검사로 막고 상태 변경은 JSON 본문만 받는다.
- toss 채널 세션은 Bearer 토큰(만료 7일, 재발급은 식별키 재검증). 토큰은 네이티브 `Storage`에 두고 web 저장소에 남기지 않는다. `Origin`이 허용 목록(ADR-007)에 없으면 거부한다.
- 식별키 검증 API는 앱당 분당 3,000회 제한이 있으므로 검증 결과를 세션 수명 동안 캐시한다.
- 로그인 시도·복구 코드 입력에 KV 기반 rate limit.
- 이메일은 표시와 지원 문의 확인에만 쓴다. 마케팅 발송 없음.
  `email_verified=true`인 이메일만 저장하며 계정 연결·병합의 키는 이메일이 아닌 `sub`다.

2026-09-06 운영 연결의 설정·인수 상태는 [Google 로그인 런북](../operations/google-login.md)을 따른다.
실계정 인증 왕복을 끝내기 전에는 자격 증명 발급이나 로컬 가짜 OIDC 테스트를 운영 인증 완료로 보지 않는다.

## 개인정보

- 개인정보 처리방침과 이용약관은 SPA 내부 라우트(`/legal/privacy`, `/legal/terms`)로 두 채널에서 같은 내용을 보여주고 랜딩에서도 링크한다. 수집 항목: Google 식별자, 이메일, 토스 미니앱 사용자 식별키, 게임 저장 데이터, 오류 로그. 저장 위치가 Cloudflare 해외 리전이므로 국외 이전 항목(이전받는 자, 국가, 항목, 목적, 보유 기간)을 명시한다. Phase 1 완료 조건에 포함한다.
- 삭제 요청은 SCR-030에서 즉시 처리하며 09 문서의 삭제 규칙을 따른다.
- 14세 미만 가입 제한 문구를 약관에 둔다. 연령 확인 절차는 두지 않는다. 앱인토스는 플랫폼이 만 19세 이상만 제공하므로 toss 채널은 별도 문구가 없다.
- 개인정보 처리방침 URL은 앱인토스 콘솔 앱 정보에도 등록한다. 수집 항목에 "토스 미니앱 사용자 식별키"를 추가한다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| Auth.js | Next.js 밖에서는 이점이 작고 익명 프로필 연결을 직접 짜야 함 |
| Supabase Auth 익명 사용자 + linkIdentity | 가장 편하지만 ADR-007에서 Supabase를 채택하지 않음 |
| Apple·카카오 추가 | 사용자 결정으로 1종만. 카카오는 한국 사용자에게 유리하므로 Season 2 이후 재검토 후보 |

## 결과

- 07 API 계약에 `auth` 그룹을 추가한다.
- 02 데이터 모델의 LocalProfile에 `googleSub`, `email`, `linkedAt`, `tossAnonKeyHash`, `tossLinkedAt`을 추가한다.
- SCR-030 설정 화면에 "Google로 연결" 항목을 추가한다.
