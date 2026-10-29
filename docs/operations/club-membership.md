# 클럽 멤버십 (T-11-512)

한 달마다 자동으로 다시 결제되는 구독이다(한국 4,900원). 상품 ID는 `com.offsidelab.app.club_monthly`이다.
구독하는 동안 세 가지 혜택이 있다.

- 출석 보상 2배: 출석할 때 서버가 구독 여부를 보고 그날 보상을 2배로 준다(`MEMBER_ATTENDANCE_MULT`).
- 매일 잠재력 강화권 1장(T-11-517): 구독 중 출석하면 2배와 따로 강화권 1장을 더 준다(`MEMBER_DAILY_BONUS`). 강화권 팩(10장 2,200원) 기준으로 한 달 약 6,200원어치라 강화권 팩 판매와 멤버 선수 강화 속도를 지켜본다.
- 광고 제거 구매자 감사 선물(T-11-517): 멤버십에 광고 제거가 들어가면서 먼저 광고 제거를 산 구단주를 챙긴다. 2026-11-01 00:00 UTC 전에 산 서버 구매 기록(`iap_ad_free_purchases`, 프로필에 묶인 것, 환불 · 시험 제외)이 있는 로그인 구단주가 홈 선물 칸에서 잠재력 강화권 5장 · 리롤권 5장을 한 번 받는다(`AD_FREE_THANKS_GIFT`, `gift_claims`로 한 번만).
- 광고 제거: 앱은 혜택 끝 시각을 기기에 남겨 그때까지 광고를 끄고, 보상형 광고는 광고 없이 준다. 웹은 구단주 · 멤버십 화면이 받은 값으로 광고를 끈다. 평생 광고 제거 구매와는 따로다.
- 서포터 뱃지: 내 구단 화면과 친구 목록에서 이름 옆에 보인다(`member`).

## 구독 원장

`memberships`는 스토어 구독 하나(Apple originalTransactionId, Google purchaseToken의 SHA-256)마다 한 줄이다. 한 구독은 처음 묶인 구단주를 떠나지 않는다. 혜택은 `until`까지다. 이 값은 스토어가 알려 준 다음 결제일이고, 결제 유예 중이면 유예 끝이다.

- 앱: 가입하면 거래를 `POST /v1/membership/iap`로 보낸다. 서버가 묶은 뒤에만 스토어 거래를 마무리한다. 앱을 시작할 때 스토어에 구독이 살아 있고 아는 혜택 끝이 하루 안으로 가까우면 다시 보내 다음 기간을 받는다. 구독하지 않은 사람은 서버를 부르지 않는다.
- Apple 서버 알림(SUBSCRIBED · DID_RENEW · EXPIRED · DID_FAIL_TO_RENEW · REFUND · DID_CHANGE_RENEWAL_STATUS 등)은 거래와 갱신 정보로 `until` · 자동 갱신 여부를 고친다. 늦게 서명된 정보만 앞선 정보를 고친다.
- Google RTDN 구독 알림은 종류와 상관없이 subscriptionsv2를 다시 읽어 고친다. 보류 · 일시중지 · 만료면 `until`을 그 시각으로 당긴다. 앱보다 먼저 온 알림도 구단주 표시로 묶고 승인한다(승인하지 않으면 사흘 뒤 Google이 환불한다). RTDN 경로는 `BILLING_ALERTS_ENABLED=1`일 때만 받는다.
- 환불은 Apple REFUND의 revocationDate, Google 만료 상태로 바로 혜택을 끈다. 이미 받은 출석 아이템은 회수하지 않는다.
- 결제 알림 슬랙(billing-slack.md)에는 서버 알림이 "클럽 멤버십 (월 구독)"으로 남긴다.

## 출시 순서

1. App Store Connect에 구독 그룹과 자동 갱신 구독 `com.offsidelab.app.club_monthly`(1개월)을 만든다. 첫 구독은 새 앱 버전과 함께 심사받는다. Play 콘솔에는 같은 ID의 구독과 월 기본 요금제를 만든다.
2. App Store 서버 알림 V2 주소가 운영 API의 알림 경로인지, Play RTDN이 켜져 있는지 확인한다.
3. 서버 변수 `MEMBERSHIP_ENABLED=1`을 켠다(운영은 `wrangler.jsonc` production vars, 2026-10-26 켬). 꺼져 있으면 GET이 `stores: []`라 앱이 가입 버튼을 보이지 않는다. 이미 가입한 구독의 확인과 혜택은 스위치와 상관없다.
4. `MEMBERSHIP_LIVE`(contracts)를 `true`로 바꿔 웹 · 앱 구단주 화면에 입구를 연다. 같은 PR에서 공개 가이드(`apps/web/scripts/seo.mjs` GUIDE_SECTIONS) · FAQ에 멤버십을 더한다. 앱의 구독 결제는 네이티브 변경이 없어 OTA로 나가지만, Apple 첫 구독 심사에는 이 화면이 든 빌드가 필요하다.

`MEMBERSHIP_LIVE`가 false인 동안 입구는 개발 빌드(`import.meta.env.DEV`, `__DEV__`)에서만 보인다. iOS 앱은 `MEMBERSHIP_IOS_LIVE`도 true여야 입구가 보인다(T-11-516). App Store 구독 심사가 끝나기 전에는 가입 버튼이 없어서 iOS만 닫아 두고, 승인되면 true로 바꿔 운영 배포(OTA)로 연다. 2026-10-29 1.1.5 출시 뒤 true로 열었다(T-11-566).
