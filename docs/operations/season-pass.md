# 시즌 패스 (T-11-511)

한 시즌 동안 쓰는 9,900원 패스다. 자동 갱신 없는 소모성 상품 `com.offsidelab.app.season_pass`로 판다.
그 시즌에 은퇴시킨 커리어 수로 10단계가 열린다. 단계표와 보상은 `packages/contracts/src/season-pass-rules.ts`에 있다.

## 진행도

- 시즌 게이지와 기준이 같다. `service_season = 그 시즌`이고 `retire_age ≥ 35`(SEASON_GAUGE.fullAge)인 은퇴 커리어를 센다. (구단주, KST 날짜)마다 20개(dailyCap)까지만 센다.
- 패스를 시즌 중간에 사도 그 시즌 처음부터 센다. 패스가 없어도 진행도는 보이지만, 보상을 받으려면 패스가 있어야 한다.
- 받기를 누르면 열렸지만 아직 받지 않은 단계를 한꺼번에 준다(`season_passes.claimed` CAS, Idempotency-Key).
- 지난 시즌 패스에 받지 않은 단계가 남아 있으면 계속 보이고 받을 수 있다.

## 구매 · 환불

- 구매는 앱에서만 한다. 웹은 상태와 받기만 보인다. 서버는 `verifyIapClaim`으로 거래를 확인한 뒤 `season_passes`에 (구단주, 시즌) 한 줄을 연다. 같은 거래를 다시 보내면 같은 결과를 돌려준다.
- 같은 시즌에 두 번 사면 다음 시즌 패스가 된다. 시즌 사이(마감 뒤 다음 시즌 전)에 사면 다음 시즌 패스다.
- 환불은 Apple REFUND 알림과 Google voided 대조에서 처리한다. 패스를 닫고(`refunded_at`), 그 패스로 받은 아이템은 지금 가진 만큼만 회수한다(이미 쓴 것은 남긴다).
- 결제 알림 슬랙(billing-slack.md)에는 "시즌 패스"로 남는다.

## 출시 순서

1. App Store Connect · Play 콘솔에 소모성 상품 `com.offsidelab.app.season_pass`를 9,900원(한국 기준)으로 만들고 심사를 받는다.
2. 서버 변수 `SEASON_PASS_ENABLED=1`을 켠다. 꺼져 있으면 GET은 진행도만 주고 `stores: []`라 앱이 사기 버튼을 보이지 않는다. 받기는 스위치와 상관없이 된다.
3. `SEASON_PASS_LIVE`(contracts)를 `true`로 바꿔 웹 · 앱 구단주 화면에 입구를 연다. 앱은 OTA로 나간다. 같은 PR에서 공개 가이드(`apps/web/scripts/seo.mjs` GUIDE_SECTIONS) · FAQ에 시즌 패스를 더한다.

`SEASON_PASS_LIVE`가 false인 동안 입구는 개발 빌드(`import.meta.env.DEV`, `__DEV__`)에서만 보인다.
