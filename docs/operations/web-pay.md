# 웹 결제 (엑솔라)

T-11-454. 웹(offside-lab.com) 구단주 화면에서 앱과 같은 인앱 상품(리롤권 · 잠재력 강화권 · 프리미엄 스카우트권 · 선수 이름 변경권 묶음)을 판다.
결제는 게임 전용 판매 대행사(merchant of record)인 엑솔라 Pay Station이 맡는다. 해외 카드 · PayPal · Apple Pay · Google Pay와 나라별 결제
수단을 결제창 하나로 받고, 나라별 통화 · 가격 · 부가세 · 환불 · 사기 방지를 엑솔라가 처리한다.

기본은 **꺼져 있다**. 아래 출시 전 확인이 끝나야 켠다.

## 구조

- 상품: 엑솔라 퍼블리셔 계정의 아이템 카탈로그에 앱 상품 id를 SKU 그대로 등록한다(`com.offsidelab.app.reroll_5` 등 8개, 목록은
  `packages/contracts/src/cup.ts`의 `IAP_PRODUCTS`). 원화 가격은 앱 한국 정가(`IAP_PRICE_KRW`)와 같게 두고, 다른 통화는 엑솔라 자동 환산이나
  나라별 가격을 쓴다. 웹 상점에는 한국 기준가를 보이고 "결제 화면에서 사는 나라 통화로 보여요"를 붙인다.
- 원장은 앱과 같은 `iap_purchases`이고 `store = 'xsolla'`, `transaction_id = 엑솔라 주문 번호`다. 매출 탭 · 결제 알림 · 운영 도구 구매 기록에
  그대로 잡힌다(금액 · 통화는 사용자가 낸 통화). 옛 앱이 엄격한 enum으로 읽는 `IapStoreSchema` · `GET /v1/items`의 `iap.stores`에는 넣지 않았다.
- 주문은 `web_pay_orders`(0124): 우리 주문 id · 구단주 · 상품 · 엑솔라 주문 번호 · 상태(READY · PAID · CANCELED).
- API (`apps/api/src/routes/webPay.ts`, 엑솔라 호출은 `apps/api/src/iap/xsolla.ts`)
  - `GET /v1/web-pay/config`: 로그인 구단주에게 켜져 있는지 · 상품 목록.
  - `POST /v1/web-pay/orders`: 엑솔라 결제 토큰을 만들고(`POST store.xsolla.com/api/v3/project/{id}/admin/payment/token`, 프로젝트 id:API 키
    Basic 인증) 결제창 주소를 돌려준다. 나라는 Cloudflare가 알려 준 나라, 언어는 화면 언어. 구단주당 시간당 30번.
  - `GET /v1/web-pay/orders/:orderId`: 결제창에서 돌아온 웹이 상태를 묻는다(주문한 구단주만).
  - `POST /v1/web-pay/webhook`: 엑솔라 웹훅. `Authorization: Signature sha1(본문 + 웹훅 비밀 키)`로 확인한다.
    `user_validation`(프로필이 있으면 204), `order_paid`(아이템 지급), `order_canceled`(환불 · 차지백 회수, 결제보다 먼저 와도 나중 지급을 막는다).
    처리하면 204, 받을 수 없는 요청은 400(엑솔라가 다시 보내지 않는다), 우리 쪽 일시 오류는 5xx(12시간 안에 다시 보낸다).
- 웹: `ui/cup/WebPayShop.svelte`(구단주 화면 상점 아래), `ui/cup/webPay.svelte.ts`. 상품을 누르면 같은 탭에서 결제창으로 가고
  `/?webpay=<주문>`으로 돌아온다. 아이템은 웹훅이 주므로 웹은 2초 간격으로 6번까지 상태를 묻고, 그래도 확인이 안 되면 다음에 상점을 열 때 한 번 더 묻는다.
- 앱은 바뀌지 않는다. 앱 안에서 웹 결제로 안내하지 않는다(스토어 정책).

## 설정

| 이름                    | 종류   | 값                                                                                                   |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `WEB_PAY_ENABLED`       | var    | `1`이면 연다. 없거나 다른 값이면 닫힌다.                                                             |
| `XSOLLA_PROJECT_ID`     | var    | 엑솔라 프로젝트 id.                                                                                  |
| `XSOLLA_SANDBOX`        | var    | `1`이면 샌드박스 결제창(테스트 카드 · 테스트 PayPal, 실제 돈이 오가지 않음). 구매는 테스트로 적힌다. |
| `XSOLLA_API_KEY`        | secret | 퍼블리셔 계정에서 만든 API 키(만들 때 한 번만 보인다).                                               |
| `XSOLLA_WEBHOOK_SECRET` | secret | 프로젝트 설정 → 웹훅의 비밀 키.                                                                      |
| `WEB_PAY_TESTERS`       | secret | 쉼표 구분 프로필 id. 있으면 이 구단주에게만 연다. 실결제 확인 뒤 지운다.                             |

엑솔라 프로젝트 설정 → 웹훅의 서버 주소에 `https://api.offside-lab.com/v1/web-pay/webhook`(staging은 staging API 주소)을 넣는다.

## 테스트 (계약 전에도 된다)

1. 엑솔라 퍼블리셔 계정 가입 → 프로젝트 만들기 → 아이템 카탈로그에 SKU 8개 등록 → API 키 · 웹훅 비밀 키 만들기.
2. staging에 `WEB_PAY_ENABLED=1` · `XSOLLA_SANDBOX=1` · 프로젝트 id · 두 키를 넣고, 웹훅 주소를 staging API로 둔다.
3. staging 웹에서 사서 샌드박스 테스트 카드로 결제 → 아이템이 들어오는지, 퍼블리셔 계정에서 환불 → 회수되는지, 매출 탭에 테스트로 잡히는지 본다.

## 출시 전 확인 (운영자)

1. 엑솔라 라이선스 계약 서명(퍼블리셔 계정에서 사업자 정보 · 정산 계좌). 계약 전에는 샌드박스만 된다.
2. 통신판매업 신고, 사이트 아래 사업자 정보 표시(상호 · 대표자 · 사업자등록번호 · 통신판매업 신고번호 · 주소 · 연락처).
3. 게임물 등급: 웹 배포 게임의 등급분류(GRAC) 필요 여부를 확인한다. 앱 스토어의 IARC 등급은 웹에 적용되지 않는다.
4. 이용약관 · 개인정보처리방침 · 가이드 FAQ에 웹 결제(엑솔라가 판매자로 처리하는 결제 정보, 환불 · 청약철회)를 더한다(`apps/web/scripts/seo.mjs`).
   지금 문구는 "결제 상품은 앱에서 삽니다"라서, 켜는 PR에서 함께 고친다.
5. 운영에 `XSOLLA_SANDBOX` 없이 + `WEB_PAY_TESTERS`(본인)로 실결제 1건 · 환불 1건을 해 본 뒤 테스터 목록을 지운다.

## 환불

받은 아이템을 쓰지 않았으면 결제일로부터 7일 안에 환불한다(웹 상점 안내 문구). 운영자가 엑솔라 퍼블리셔 계정(고객 지원 → 거래 검색)에서
환불하면 `order_canceled` 웹훅이 와서 남은 장수 안에서 회수한다(`revokeIapPurchase`, 이미 쓴 장수는 회수하지 못하고 `revoked_qty`에 남는다).
사용자가 엑솔라에 직접 낸 환불 · 카드사 차지백도 같은 웹훅으로 온다.
