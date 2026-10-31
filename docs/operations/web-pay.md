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
  그대로 잡힌다(금액 · 통화는 사용자가 낸 통화). T-11-471부터 결제 슬랙 알림은 제목이 '🌐 웹 결제' · '↩️ 웹 결제 환불'이고 결제 경로 줄로
  앱 인앱 결제와 갈리며, 운영 도구 매출 요약에 '앱 인앱 결제' · '웹 결제' 합이 따로 보인다(스토어별 · 최근 결제는 '웹 결제 (Xsolla)'). 옛 앱이 엄격한 enum으로 읽는 `IapStoreSchema` · `GET /v1/items`의 `iap.stores`에는 넣지 않았다.
- 주문은 `web_pay_orders`(0128): 우리 주문 id · 구단주 · 상품 · 엑솔라 주문 번호 · 상태(READY · PAID · CANCELED).
- API (`apps/api/src/routes/webPay.ts`, 엑솔라 호출은 `apps/api/src/iap/xsolla.ts`)
  - `GET /v1/web-pay/config`: 로그인 구단주에게 켜져 있는지 · 상품 목록.
  - `POST /v1/web-pay/orders`: 엑솔라 결제 토큰을 만들고(`POST store.xsolla.com/api/v3/project/{id}/admin/payment/token`, 프로젝트 id:API 키
    Basic 인증) 결제창 주소를 돌려준다. 나라는 Cloudflare가 알려 준 나라, 언어는 화면 언어. 구단주당 시간당 30번.
  - `GET /v1/web-pay/orders/:orderId`: 결제창에서 돌아온 웹이 상태를 묻는다(주문한 구단주만).
  - `POST /v1/web-pay/webhook`: 엑솔라 웹훅. `Authorization: Signature sha1(본문 + 웹훅 비밀 키)`로 확인한다.
    `user_validation`(프로필이 있으면 204), `order_paid`(아이템 지급), `order_canceled`(환불 · 차지백 회수, 결제보다 먼저 와도 나중 지급을 막는다).
    처리하면 204, 받을 수 없는 요청은 400(엑솔라가 다시 보내지 않는다), 우리 쪽 일시 오류는 5xx(12시간 안에 다시 보낸다).
- 웹: `ui/cup/WebPayPacks.svelte`(아이템별 묶음), `ui/cup/webPay.svelte.ts`. T-11-471부터 앱이 스토어 묶음(`IapPacks`)을 보이는
  자리마다 같은 가격의 웹 묶음을 보인다: 구단주 화면 리롤권 · 잠재력 강화권 · 프리미엄 스카우트권 · 선수 이름 변경권 상점, 선수 탭 잠재력
  강화 카드, 이름 변경 창(변경권이 없을 때). 웹 결제가 꺼져 있으면 예전처럼 '앱에서 살 수 있어요'만 보인다. 설정(`GET /v1/web-pay/config`)은
  묶음이 처음 보일 때 한 번 묻는다(10분 메모). 상품을 누르면 같은 탭에서 결제창으로 가고 `/?webpay=<주문>`으로 돌아와 결제를 시작한
  화면(진행 중 선수 · 구단주 화면)으로 간다. 아이템은 웹훅이 주므로 웹은 2초 간격으로 6번까지 상태를 묻고, 그래도 확인이 안 되면 다음에
  묶음이 보일 때 한 번 더 묻는다.
- 광고 제거(`com.offsidelab.app.remove_ads`)는 앱 광고를 끄는 스토어 상품이라 웹에서 팔지 않는다.
- T-11-591부터 시즌 패스(`com.offsidelab.app.season_pass`, 9,900원)와 클럽 멤버십(`com.offsidelab.app.club_monthly`, 4,900원)도 판다.
  엑솔라 카탈로그에 같은 SKU로 등록했다(아이템 10개). 설정 응답의 `pass`는 앱과 같은 조건(`SEASON_PASS_ENABLED=1`이고 서버 시즌 일정상 판매
  기간, `passSaleOpen`)일 때만 붙어서 시즌 2가 열리는 순간 웹에서도 같이 열린다. `membership`은 `MEMBERSHIP_ENABLED=1`이면 붙는다.
  - 시즌 패스: 결제 웹훅이 앱과 같은 원장(`season_passes`, `store='xsolla'`, 거래 id = 엑솔라 주문 번호)에 이번 시즌 패스를 연다. 환불이면
    `revokeSeasonPass`로 닫고 받은 단계 보상을 회수한다.
  - 멤버십: 자동 갱신이 없는 30일 이용권이다. 결제 한 번이 `memberships`에 `store='xsolla'`, `chain_id = 엑솔라 주문 번호` 행 하나를 만들고,
    이미 이용 중이면 지금 끝나는 날부터 30일을 잇는다. 환불이면 그 주문 행의 끝을 지금으로 당긴다(앞서 산 이용권을 환불해도 뒤에 산 이용권이
    이어 붙인 날짜는 그대로 남는다). `GET /v1/membership`은 웹 이용권에 `store: null` · `autoRenew: null`을 돌려 '끝나는 날'만 보인다.
    앱 스토어 구독 중인 구단주에게는 웹 구매 버튼을 숨긴다.
  - 결제창에서 돌아오면 구단주 화면으로 가서 산 창(시즌 패스 · 멤버십)을 다시 열고 상태를 다시 읽는다.
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

1. 엑솔라 라이선스 계약 서명(퍼블리셔 계정에서 사업자 정보 · 정산 계좌). 계약 전에는 샌드박스만 된다. (2026-10-29 승인)
2. 통신판매업 신고, 사이트 아래 사업자 정보 표시. T-11-589부터 GitHub production 환경 변수 `BUSINESS_INFO`(JSON)를 넣으면
   홈 · 설정 푸터와 이용약관 7항에 보인다. 공개 저장소라 실명 · 주소를 코드에 두지 않는다. 칸이 하나라도 비면 아무것도 보이지 않는다.
   ```json
   {
     "name": "상호",
     "owner": "대표자",
     "regNo": "000-00-00000",
     "mailOrderNo": "제0000-경기광명-0000호",
     "address": "사업장 주소",
     "phone": "전화번호"
   }
   ```
3. 게임물 등급: 웹 배포 게임의 등급분류(GRAC) 필요 여부를 확인한다. 앱 스토어의 IARC 등급은 웹에 적용되지 않는다.
4. 이용약관(1항 웹 결제 · 청약철회 · 미성년자 취소) · 개인정보처리방침(4항 · 9항 Xsolla) · 가이드 상점 문구는 T-11-589에서 고쳤다.
   약관 시행일은 켜는 날로 바꾼다.

## 켜기 (운영)

1. GitHub production 환경 변수 `BUSINESS_INFO`를 넣는다(위 2번).
2. 운영 API: var `WEB_PAY_ENABLED=1` · `XSOLLA_PROJECT_ID=318798`은 T-11-589에서 `apps/api/wrangler.jsonc` production vars에 넣어 두었다.
   secret은 운영자가 직접 넣는다(`pnpm --filter @offside/api exec wrangler secret put <이름> --env production`). **`WEB_PAY_TESTERS`(운영자
   프로필 id)를 먼저 넣고** `XSOLLA_API_KEY` · `XSOLLA_WEBHOOK_SECRET`을 넣는다. 두 키가 들어가는 순간 열리므로 순서를 바꾸면 모두에게 열린다.
   `XSOLLA_SANDBOX`는 넣지 않는다.
3. 엑솔라 프로젝트 설정 → 웹훅 서버 주소를 `https://api.offside-lab.com/v1/web-pay/webhook`으로 바꾸고 '웹훅 사용'을 켠다(프로젝트당 1개라
   staging 시험은 이때부터 못 한다). 웹훅 비밀 키는 staging에 쓴 것과 같다.
4. 운영 배포 뒤 운영자 계정으로 가장 싼 묶음 실결제 1건 → 아이템 확인 → 퍼블리셔 계정에서 환불 → 회수 · 매출 탭 확인.
5. `WEB_PAY_TESTERS`를 지우면(`wrangler secret delete`) 모든 로그인 구단주에게 열린다.

## 환불

받은 아이템을 쓰지 않았으면 결제일로부터 7일 안에 환불한다(웹 상점 안내 문구). 운영자가 엑솔라 퍼블리셔 계정(고객 지원 → 거래 검색)에서
환불하면 `order_canceled` 웹훅이 와서 남은 장수 안에서 회수한다(`revokeIapPurchase`, 이미 쓴 장수는 회수하지 못하고 `revoked_qty`에 남는다).
사용자가 엑솔라에 직접 낸 환불 · 카드사 차지백도 같은 웹훅으로 온다.

## 잠재력 강화권 100장 판매 준비

- SKU: `com.offsidelab.app.boost_100`, 지급 100장, 한국 기준가 19,800원(10장 상품 대비 장당 10% 할인).
- Xsolla 카탈로그에 동일 SKU와 한국 가격을 등록하고 샌드박스 결제·지급·환불을 확인한다.
- 서버를 먼저 배포한 뒤 해당 환경에 `WEB_PAY_BOOST_100_ENABLED=1`을 설정한다. 기본값은 판매 중지이며,
  설정 전에는 목록에서 숨기고 직접 주문 요청도 거절한다. 기존 상품과 이미 생성한 주문의 지급·환불은 유지한다.
- iOS/Android도 동일 ID의 소모성 상품을 등록한다. 앱은 스토어가 가격을 반환한 상품만 표시하므로,
  서버 지원 배포 전에 스토어 상품을 판매하지 않는다. 앱의 새 SKU 반영에는 OTA 또는 앱 업데이트도 필요하다.
- 스토어별 등록·승인과 실제 판매 여부를 확인한 후 판매 개시 릴리즈 노트를 별도로 추가한다.
