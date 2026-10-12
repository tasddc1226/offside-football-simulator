# Club Membership 서버 연동 준비

2026-10-12 로컬 구현 체크포인트. 운영 배포·판매 활성화·스토어 Sandbox 검증은 하지 않았다.

## 경로

| 경로 | 인증 | 역할 |
| --- | --- | --- |
| GET /v1/membership | 게임 계정 | 현재 권한·기간·아이템·스토어 계정 식별자. no-store |
| POST /v1/membership/claim | 게임 계정 | 최신 스토어 검증 후 구매/복원 반영 |
| PUT /v1/membership/appearance | 활성 구독 계정 | theme/frame 저장. 대표 칭호는 기존 owner/title 사용 |
| POST /v1/iap/apple/notifications | Apple 알림과 거래 JWS | 기존 소모성 환불 + 구독 최신 상태 확인 |
| POST /v1/membership/google/notifications | Google 서명 OIDC | RTDN 구독/구독 환불 알림. 세션 인증과 별도 |

신규 구매는 앱이 GET 응답의 stores와 스토어 상품 조회 결과를 모두 확인해야 한다. 서버 claim은 판매 중단 후에도 복원을 허용한다. Apple 거래 완료 / Google acknowledge는 서버 검증 및 원장 반영 뒤에 처리한다.

## 환경 설정 (아직 미배포)

| 변수 | 의미 |
| --- | --- |
| MEMBERSHIP_SALES_ENABLED=1 | 신규 판매 허용. 기본 닫힘 |
| MEMBERSHIP_TESTERS | 쉼표 구분 게임 계정 ID. 닫힌 판매와 production 환경 Sandbox 테스트 예외 |
| MEMBERSHIP_RECONCILE_ENABLED=1 | 주기적 재확인. 신규 판매 중단 시에도 유지해야 함 |
| APPLE_IAP_ISSUER_ID / APPLE_IAP_KEY_ID / APPLE_IAP_PRIVATE_KEY | App Store Server API 전용 인증. Sign in with Apple 키와 혼동 금지 |
| GOOGLE_PLAY_SA_JSON | 기존 Play Developer API 서비스 계정. 구독/주문 조회·acknowledge 권한 확인 필요 |
| MEMBERSHIP_TOKEN_KEY | 32바이트 무작위 키의 base64url. 암호화 키 교체는 저장 토큰 재암호화와 함께 해야 함 |
| GOOGLE_MEMBERSHIP_PUSH_AUDIENCE | Pub/Sub push에 지정한 정확한 audience |
| GOOGLE_MEMBERSHIP_PUSH_EMAIL | 해당 push의 서비스 계정 이메일. Play API 서비스 계정과 별개일 수 있음 |

비밀 값은 코드·문서·로그에 기록하지 않는다. 운영 판매 플래그를 여는 것으로 서버 알림 설정이나 실제 결제 검증을 대체할 수 없다.

## 알림 처리와 한계

Google push는 RS256 서명, Google issuer, audience, 서비스 계정 이메일, email_verified, 만료를 확인한다. 공개키는 1시간 캐시하고 알 수 없는 kid로 매 요청 외부 조회가 발생하지 않도록 재조회 간격을 제한한다. 인증 없는 요청은 처리하지 않는다. [Google 인증 문서](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)

RTDN은 상태 변경의 신호로만 사용하고 Developer API를 다시 조회한다. 원문 purchaseToken은 이벤트 원장에 보존하지 않는다. [Google RTDN 문서](https://developer.android.com/google/play/billing/rtdn-reference)

이미 계정에 귀속된 체인만 알림으로 갱신한다. 구매/복원 전에 온 알림이 임의의 게임 계정에 혜택을 생성하지 않는다. Apple은 후속 claim의 거래 이력으로 복구한다. Google의 미등록 새 토큰/중간 갱신 누락 복구는 출시 전 추가 보완 대상이다.

현재 콜백은 동기 검증 뒤 성공 응답을 보내며 실패한 전달은 공급자가 다시 보내야 한다. 별도 Queue/DLQ와 서버 inbox 독립 재처리는 아직 연결하지 않았다. 재확인 작업은 보조 복구 수단이며 모든 과거 주문을 완전히 복구하는 경로가 아니다.

공개 첫 페이지 랭킹 캐시는 상태 반영 시 무효화하고 다른 페이지는 기존 TTL을 따른다. 이미 연결된 채팅 작성자의 환불 즉시 반영은 추가 보완해야 한다.

## 다음 검증

실제 양 스토어 Sandbox에서 최초 구매 → 자동 갱신 → 중복 알림 → 취소 → 만료 → 복원 → 환불, 다른 게임 계정 거절, 앱 종료 중 결제, 알림 장애 복구를 확인한다. 모의 응답 단위 테스트는 이 증거를 대체하지 않는다.


## Local client and team-slot checkpoint (2026-10-12)

- Web membership page is informational for purchases; checkout is app-only. Native purchase/restore calls server verification before finishing store transactions. Lifetime ad-free ownership remains separate from expiring membership access.
- Migration 0094 preserves existing teams in slot 0 and adds the unique owner/season/slot key plus season/slot ranking indexes. Extra slots require active/grace membership for mutations and friendly matches; reads survive expiry. Official ranks, season close, opponents and cups use slot 0. Friendly quota remains owner-scoped.
- Local API `http://localhost:8797` and web `http://membership.localhost:5207` use this worktree's fresh local D1. The linked test owner, retired players and local membership are synthetic fixtures, not store transactions or production data.
- Web tested against this actual local API: three independently saved teams, extra-team ranked button disabled, appearance save and retired-player comparison. Server tests cover entitlement gating and expiry. Store keys and actual Sandbox lifecycle evidence remain release gates.
