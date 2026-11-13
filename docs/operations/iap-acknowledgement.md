# Google 구매 승인 후처리 진단

T-11-717. 소모성 아이템과 시즌 패스의 지급 후 Google 승인 실패를 조사하는 기준이다.
멤버십 구독 승인, 광고 제거의 네이티브 승인, 구매 확인 실패는 이번 변경 범위 밖이다.

## 처리 순서

1. 서버가 스토어 거래와 계정 소유권을 확인한다.
2. 원장과 권리를 기록한다. 같은 Google 거래의 재전송은 기존 원장을 먼저 읽고 추가 지급·Google 호출 없이 응답한다.
3. 승인 전 거래에만 기존 `waitUntil`에서 Google 승인을 한 번 요청한다. 승인 실패가 지급 성공 응답을 바꾸지 않는다.
4. 앱은 서버 성공 응답을 받은 뒤 `finishTransaction({ isConsumable: true })`으로 소비한다.
   소비도 승인 역할을 한다([Google 일회성 구매 수명 주기](https://developer.android.com/google/play/billing/lifecycle/one-time)).
   서버 승인과 앱 소비가 겹칠 수 있지만, HTTP 400만으로 경합·소비 완료를 확정할 수 없다.

요청 횟수·지급·앱 소비·재전송 정책을 바꾸지 않았다. 서버 승인 재시도 큐나 폴링은 추가하지 않았다.

## 실패 로그

아이템은 `job=iap-ack`, 시즌 패스는 `job=pass-ack`를 조회한다. 성공 때 새 로그는 남기지 않는다.

| 필드 | 의미 |
| --- | --- |
| `store`, `productId`, `test` | 검증된 거래의 스토어·상품·테스트 구매 여부 |
| `grantCompleted` | 원장/권리 기록 뒤 승인 후처리에 들어왔음. 스토어 승인·소비 완료의 증거는 아님 |
| `id` | 기존 `billingAlertId`와 같은 SHA-256 지문. 결제 알림이 켜져 있으면 `billing_alerts.id`와 대조 가능. 알림이 꺼져 있어도 계산하지만 새 DB 행은 만들지 않음 |
| `failure` | `http`: Google 승인 HTTP 오류. `request`: 인증·네트워크 등 HTTP 승인 응답 이전의 실패 |
| `httpStatus` | HTTP 오류에서만 제공. 원래 상태를 보존 |
| `reason`, `googleStatus` | 허용 목록에 있는 Google 코드만 제공. 알 수 없는 reason은 `unknown`, 알 수 없는 status는 생략 |

오류 응답은 스트림에서 최대 8 KiB까지만 읽는다. 초과·파싱 실패·읽기 실패도 원래 HTTP 상태와 `reason=unknown`으로 기록한다.
원문 메시지·응답·URL·스택·구매 토큰·계정 ID·인증 토큰은 출력하지 않는다. 지문 계산이 실패해도 `id` 없이 오류를 남긴다.
Google 오류 코드의 참고 자료는 [Developer API 오류 표](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions#Error_codes)다.
구독 문서의 설명만으로 일회성 상품의 특정 원인을 확정하지 않는다.

## 조사와 검증 경계

- `invalidPurchaseState` 등 코드와 발생 시각·상품·알림 지문을 함께 대조한다. `400`을 성공이나 이미 소비됨으로 일괄 처리하지 않는다.
- 결제 알림 행의 존재는 승인 완료 증거가 아니다. 실제 거래 상태는 접근이 허용된 스토어/원장의 근거로 별도 확인한다.
- 이 진단 변경은 과거의 상태 코드만 남은 로그에서 원인을 복원하지 못한다. 다음 실패부터 분류할 수 있다.
- 로컬 회귀 검사는 승인 응답 지연·실패 중에도 HTTP 200, 지급량, 원장 1행, 재전송 시 추가 Google 호출 없음과 로그의 민감정보 제외를 확인한다.
- 모의 Google 응답을 쓴 서버 검사와 기존 앱 단위 검사는 실제 Play 결제·기기 소비 완료를 증명하지 않는다.
