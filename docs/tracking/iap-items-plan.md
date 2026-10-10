# 유료 리롤권 · 잠재력 강화권 (T-11-174)

광고 제거(T-11-069, 비소모성) 다음으로 파는 소모성 인앱 상품이다. 2026-10-09 결정을 정리한 문서다.

## 상품

App Store Connect · Play Console에 같은 ID로 소모성(Consumable · 일회성 관리 상품)으로 만든다. 정본은
`packages/contracts/src/cup.ts`의 `IAP_PRODUCTS`다.

| 상품 ID                        | 지급                    | 가격(KRW) |
| ------------------------------ | ----------------------- | --------- |
| `com.offsidelab.app.reroll_5`  | 리롤권 5장              | ₩1,100    |
| `com.offsidelab.app.reroll_15` | 리롤권 15장             | ₩2,200    |
| `com.offsidelab.app.reroll_40` | 리롤권 40장             | ₩5,500    |
| `com.offsidelab.app.boost_3`   | 잠재력 강화권 3장       | ₩1,100    |
| `com.offsidelab.app.boost_10`  | 잠재력 강화권 10장      | ₩2,200    |
| `com.offsidelab.app.scout_1`   | 프리미엄 스카우트권 1장 | ₩1,100    |
| `com.offsidelab.app.scout_5`   | 프리미엄 스카우트권 5장 | ₩4,400    |

- 로그인한 구단주만 산다(아이템이 구단주 계정에 들어온다). 웹에서는 팔지 않고, 가진 아이템은 웹에서도 쓴다.
- 스토어가 가격을 알려 준 상품만 보인다. 상품을 등록하기 전에는 아무것도 보이지 않는다.
- 새 앱 빌드는 필요 없다(expo-iap는 1.1.0 빌드에 들어 있다). 서버 배포 + OTA로 나가고, Apple은 상품마다 심사한다.

## 강화권 규칙

- 강화권 한 장 = 시도 한 번(`tryBoost(s, 'ticket')`, `boostTicketOpen`). 이번 시즌의 한 번을 썼거나(done) 자금이 모자랄 때(short)
  쓴다. T-11-184(2026-10-10 결정)부터 광고 · 구단 자금의 추가 시도 상한(`BAL.boostExtraTotal`, 한 선수에 2번)과 선수 자금에
  묶이지 않는다 — 광고 제거 구매자도 강화권을 살 이유가 생긴다. 강화권 시도는 그 상한에 세지 않는다. 단계(+4) · 나이(29세) ·
  성공 확률은 같다. 기록에는 `tk`로 남는다.
- 서버는 장수만 뺀다(`POST /v1/items/boost/use`, 멱등 키). 강화는 응답을 받은 기기가 한다(구단 자금 보상과 같다).
- 광고 강화(T-11-172)와 구단 자금 강화(T-11-173)에 하루 횟수가 없어서, 강화권은 "광고 한 번 건너뛰기"에 가까웠다.
  강화권 묶음은 광고 제거 구매자에게도 판다(T-11-184).
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
- [ ] 출시 전 실기기 확인: 배포 전에 secret `IAP_TESTERS`(쉼표 구분 프로필 id)를 넣으면 그 구단주에게만 상품이 보인다.
      Android 실기기로 라이선스 테스터 구매를 확인한 뒤 `wrangler secret delete IAP_TESTERS --env production`으로 모두에게 연다
- [ ] Play Console 결제 프로필 인증(2026-11-06 전)
- [ ] App Store Connect · Play Console에 상품 5종 등록, Apple 상품 심사 제출
- [ ] TestFlight · 라이선스 테스터로 Sandbox 구매 한 번씩 확인(`iap_purchases.test = 1`)
- [ ] 상품이 보이기 시작하면 릴리즈 노트를 따로 올린다(이 PR은 보이는 변화가 없어 노트 없음)

## 후속

- 환불 알림(App Store Server Notifications · Google RTDN)으로 환불된 구매의 아이템 회수. 지금은 운영 DB에서 `iap_purchases`로 확인한다.

## 프리미엄 스카우트권 규칙 (T-11-196, 2026-10-10 결정)

- 확률을 바꾸는 첫 유료 아이템이다. 사용자 결정: 돈을 쓴 유저가 위로 올라가는 구조를 받아들이고, 확률은 반드시 공개한다.
- 한 장 = 후보 3명 새로 뽑기(`premiumScoutCandidates`). 새 스카우트 시드를 뽑고 그 시드를 `ft_scout_premium`·`ft_scout_reveal`에
  남겨, 새로 고침해도 같은 프리미엄 후보와 공개된 잠재력이 그대로 나온다. 서버는 장수만 뺀다(`POST /v1/items/scout/use`, 멱등 키).
- 확률(`packages/game/src/candidates.ts` `premiumPot`·`scoutOdds`): 일반 후보 한 명의 S 확률을 p(정규분포 꼬리, 밸런스 평균·편차로
  계산)라 할 때, 프리미엄은 모든 후보의 S 확률이 정확히 2p다. 무작위 한 명(보장 후보)은 S가 아니면 A, 나머지 둘은 S가 아니면 일반
  분포의 A~D 비율을 그대로 따른다. 등급을 먼저 정한 뒤 그 등급 구간 안에서 같은 정규분포로 값을 뽑는다.
- 공개: 후보 선택 화면 · 구단주 화면 상점의 '확률 보기'(소수 둘째 자리), 확률 도감 '확률과 공정성', 공개 페이지 `/fairness/`·FAQ.
- 출시: 상품 등록(ASC·Play) 뒤 서버 배포 + OTA. 1.1.2 심사(첫 소모성 IAP 5종)가 끝난 뒤 상품을 따로 심사 제출한다.
