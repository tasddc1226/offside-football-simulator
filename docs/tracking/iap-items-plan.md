# 유료 리롤권 · 잠재력 강화권 (T-11-174)

광고 제거(T-11-069, 비소모성) 다음으로 파는 소모성 인앱 상품이다. 2026-10-09 결정을 정리한 문서다.

## 상품

App Store Connect · Play Console에 같은 ID로 소모성(Consumable · 일회성 관리 상품)으로 만든다. 정본은
`packages/contracts/src/cup.ts`의 `IAP_PRODUCTS`다.

| 상품 ID                        | 지급               | 가격(KRW) |
| ------------------------------ | ------------------ | --------- |
| `com.offsidelab.app.reroll_5`  | 리롤권 5장         | ₩1,100    |
| `com.offsidelab.app.reroll_15` | 리롤권 15장        | ₩2,200    |
| `com.offsidelab.app.reroll_40` | 리롤권 40장        | ₩5,500    |
| `com.offsidelab.app.boost_3`   | 잠재력 강화권 3장  | ₩1,100    |
| `com.offsidelab.app.boost_10`  | 잠재력 강화권 10장 | ₩2,200    |

- 로그인한 구단주만 산다(아이템이 구단주 계정에 들어온다). 웹에서는 팔지 않고, 가진 아이템은 웹에서도 쓴다.
- 스토어가 가격을 알려 준 상품만 보인다. 상품을 등록하기 전에는 아무것도 보이지 않는다.
- 새 앱 빌드는 필요 없다(expo-iap는 1.1.0 빌드에 들어 있다). 서버 배포 + OTA로 나가고, Apple은 상품마다 심사한다.

## 강화권 규칙

- 강화권 한 장 = 광고 · 구단 자금으로 받는 시도 한 번과 같다(`tryBoost(s, 'ticket')`). 자금이 모자란 시즌의 한 번과
  그 뒤 추가 시도(한 선수에 2번)에만 쓰고, 횟수 상한과 성공 확률은 그대로다. 기록에는 `tk`로 남는다.
- 서버는 장수만 뺀다(`POST /v1/items/boost/use`, 멱등 키). 강화는 응답을 받은 기기가 한다(구단 자금 보상과 같다).
- 광고 강화(T-11-172)와 구단 자금 강화(T-11-173)에 하루 횟수가 없어서, 강화권은 "광고 한 번 건너뛰기"에 가깝다.
  광고 제거 구매자는 이미 광고 없이 시도하므로 강화권 묶음을 보이지 않는다.
- 확률형 아이템 표시: 성공 확률은 강화 카드 · 확률 도감에 그대로 보이고, 공정성 · FAQ · 가이드에 강화권이 확률을 바꾸지
  않는다고 적었다.

## 구매 흐름

1. 앱이 `GET /v1/items`로 구단주 표시(`iap.account`, 프로필 uuid)와 서버가 확인할 수 있는 스토어(`iap.stores`)를 받는다.
2. 구매 요청에 구단주 표시를 붙인다(Apple `appAccountToken`, Google `obfuscatedAccountId`).
3. 결제가 끝나면 앱이 `POST /v1/items/iap { store, productId, token }`을 보낸다. token은 Apple 서명 거래(JWS) · Google purchaseToken.
4. 서버가 확인한다.
   - Apple: x5c 사슬(잎 → 중간 → 루트)의 서명과 루트가 Apple Root CA - G3인지 지문으로 보고, 번들 · 상품 · 소모성 ·
     환불 여부 · 구단주 표시를 확인한다. 네트워크 없이 끝난다. Sandbox(TestFlight · 심사) 구매도 받고 `test`로 적는다.
   - Google: 서비스 계정(secret `GOOGLE_PLAY_SA_JSON`)으로 `purchases.products.get`을 불러 결제 상태와 구단주 표시를 본다.
     받은 뒤 서버가 승인(acknowledge)해 3일 자동 환불을 막는다. 키가 없으면 Android에서는 상품을 보이지 않는다.
5. `iap_purchases`(store, transaction_id PK)에 넣은 batch에서만 아이템을 더한다. 같은 거래는 한 번만 주고, 다른 구단주가 받은
   거래는 거절한다.
6. 앱은 서버가 준 뒤에만 스토어 거래를 소비(`finishTransaction isConsumable`)한다. 못 받으면 거래가 남아 다음 실행 때 다시 보낸다.

## 운영 준비 (사용자)

- [x] Google Cloud(offside-eef89): Google Play Android Developer API 사용 설정, 서비스 계정
      `play-billing-verifier` 생성, Play Console에 이 앱 권한으로 초대(2026-10-09)
- [x] 서비스 계정 JSON 키 생성 → `wrangler secret put GOOGLE_PLAY_SA_JSON --env production` → 키 파일 삭제
- [ ] Play Console 결제 프로필 인증(2026-11-06 전)
- [ ] App Store Connect · Play Console에 상품 5종 등록, Apple 상품 심사 제출
- [ ] TestFlight · 라이선스 테스터로 Sandbox 구매 한 번씩 확인(`iap_purchases.test = 1`)
- [ ] 상품이 보이기 시작하면 릴리즈 노트를 따로 올린다(이 PR은 보이는 변화가 없어 노트 없음)

## 후속

- 환불 알림(App Store Server Notifications · Google RTDN)으로 환불된 구매의 아이템 회수. 지금은 운영 DB에서 `iap_purchases`로 확인한다.
