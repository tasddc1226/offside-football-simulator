# 광고 유입과 검증 거래 연결

main `5acbeb1e`에서 분리한 뒤 최신 main `14d35d31`을 반영한 구현이다. 운영 활성화·병합·배포·유료 구매는 하지 않는다. 과거 91건 소급 귀속이나 100% 추적을 제공하지 않는다.

## 수집과 동의

웹 빌드 `VITE_ACQUISITION_ENABLED=true`와 API `ACQUISITION_ENABLED=1`을 모두 설정해야 작동한다. 기본은 꺼짐이며 이번 작업에서 운영 변수는 바꾸지 않는다. 기존 GA4 동의에 추가해 **계정 유입·결제 연결 별도 동의**를 받는다. 기존 분석 동의만으로 수집하지 않는다. Google/Meta에는 프로필 ID, 거래 ID, 캠페인과 연결한 개인 정보를 추가 전송하지 않는다. 기존 모바일 GA4 선택 및 광고 동의 false는 그대로다.

동의 전 게임 시작은 재생하지 않는다. 동의 후 허용 UTM만 고정 순서로 정규화해 서버 수신 시각과 함께 기록한다. OAuth 코드·fbclid·광고 ID·이메일·기기 지문·원본 URL·선수/커리어 정보는 새 수집 경로에 넣지 않는다. 명시적인 동의만 익명 프로필 발급을 요청할 수 있고 로그인은 강제하지 않는다.

하나의 탭에서 30분 길이의 세션을 `sessionStorage` UUID로 구분한다. 동의·활동 요청 때만 서버에 쓰며 폴링하지 않는다. 시작과 스토어 클릭은 세션당 최초 한 번만 표시한다. 새 탭은 독립 세션이며 opener가 복사한 저장소의 UUID는 같은 세션으로 합쳐질 수 있다. App Store 열기는 `noopener`를 유지한다. 저장소 차단 시 게임은 정상 동작하고 계측만 빠진다.

서버의 현재 프로필이 Google/Apple로 연결됐을 때만 `linked_at`을 설정한다. 같은 익명 프로필에 로그인 자격을 연결하면 그 프로필의 동의된 세션을 연결할 수 있다. 기존 다른 계정으로 전환하면 이전 익명 세션을 이전시키지 않는다. 서로 다른 프로필·익명 앱 설치는 미연결이다. GA4 app-instance ID 대신 프로필 ID를 넣지 않는다.

철회는 새 전송을 즉시 막고 서버 동의·세션을 삭제한다. 구매의 first/last FK는 NULL로 바뀌므로 이후 보고서는 미귀속이다. 결제 이행 원장은 유지된다. 오프라인 철회는 로컬 대기열에 남고 다음 접속 때 같은 프로필에서만 다시 전송한다. 다른 계정이면 409로 차단한다. 계정 삭제는 소프트 삭제이므로 새 테이블을 명시적으로 삭제한다. 90일이 지난 세션은 매일 최대 1,000건씩 삭제한다. 이 처리량을 넘는 유입은 삭제 지연이 생길 수 있어 운영 활성화 전 보존 처리량을 확인해야 한다.

## App Store 링크

`VITE_APPLE_PROVIDER_TOKEN`은 **이 앱 계정의 공식 App Store Connect 캠페인 링크에서 검증한 pt 값만** 설정한다. 앱 ID·팀 ID·계정 숫자를 대입하지 않는다. 없거나 비정상이면 기존 일반 App Store 링크로 안전하게 보낸다. 홈·안내 시트·설정·상점 이동 함수와 AppConversion의 앵커가 공용 링크 함수를 사용한다. Safari Smart App Banner는 edge worker가 최초 HTML의 apple-itunes-app 메타에 같은 pt/ct를 넣는다. worker의 APPLE_PROVIDER_TOKEN과 웹 빌드 VITE_APPLE_PROVIDER_TOKEN은 같은 검증값을 설정해야 한다. 캠페인 HTML은 private/no-store이고 ETag·Content-Length·Content-Encoding을 제거한다. 변환 오류·토큰 누락 때 일반 배너를 유지한다. 실제 Safari 시스템 배너는 실기기 확인이 남아 있다.

ct=`os1.<source>.<medium>.<campaign>.<content>`는 공유 allowlist 각 값의 (0부터 시작한 위치+1)을 base36으로 표시한다. 누락은 0, 최대 30자 이하다. allowlist 순서는 append-only이며 기존 위치를 재정렬하지 않는다. 예시 테스트의 pt는 합성값으로 운영 설정이 아니다.

2026-10-17 공식 앱의 Analytics → Acquisition → Campaigns 및 링크 미리보기 대화상자까지 읽었다. 기존 캠페인 데이터 부족, 링크 필드는 비어 있었다. 캠페인명 입력은 자동 승인 검토에서 외부 캠페인 생성 가능성이 있는 쓰기로 거절됐으며 **실행되지 않았다**. 다른 경로로 재시도하지 않았다. 공식 링크 제공 또는 해당 폼 입력/캠페인 링크 생성 승인이 필요하다.

Apple의 캠페인 표시 privacy threshold와 첫 다운로드 24시간/최종 캠페인 규칙은 내부 30일 규칙과 다르다. 이 데이터를 서로 같은 전환 수로 합치지 않는다. [Apple 공식 안내](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links/).

## 거래 정본과 매출

현재 범위의 정본은 서버 검증 후 `iap_purchases`(소모성), `iap_ad_free_purchases`(광고 제거)에 들어간 거래다. 소모성은 `(store, transaction_id)` PK와 같은 D1 batch에서 지급·유입 snapshot을 확정한다. 앱 응답 손실·충돌·복원 재전송은 기존 행을 바꾸거나 다시 지급하지 않는다. 신규 구매, 복원, 재시도 요청 횟수를 매출 건수로 세지 않는다. 대기·취소·검증 실패는 행을 만들지 않는다. Sandbox/test는 운영 집계에서 제외한다. 새 GA4 `purchase`/`in_app_purchase` 이벤트는 보내지 않는다.

Apple 서명 JWS의 `purchaseDate`, `price`(milliunits), `currency`, `storefront`만 선택적으로 저장한다. 검증된 원문에 없거나 형식이 맞지 않으면 NULL이다. Google `products.get`의 검증된 purchaseTimeMillis만 저장하고 이 API에 없는 금액/통화는 NULL로 둔다. 표시가격·하드코딩 가격·아이템 qty·임의 환율·수수료로 매출을 만들지 않는다. 저장 금액은 검증 거래의 원시 가격 필드이며 정산금·세후수익을 뜻하지 않는다.

검증된 구매시각 이전 30일의 같은 연결 프로필 세션에서 최초와 최종을 각각 snapshot한다. 거래 저장 후 새 접점이나 재전송으로 재귀속하지 않는다. 구매시각이 없거나 연동/동의가 없으면 미귀속이다. 익명 세션의 연결이 구매 후 발생했다면 해당 과거 구매에 소급 연결하지 않는다.

광고 제거 비소모성 상품도 `iap_ad_free_purchases` 원장에 기록한다. 아이템 qty를 만들거나 기존 영구 광고 제거 권한을 바꾸지 않는다. 새 Apple 구매는 검증된 프로필 UUID를 appAccountToken으로 붙이고, Google은 obfuscatedAccountId를 사용한다. 로그인 강제는 없다. 토큰 없는 과거 복원은 profile_id=NULL로 미귀속이며 나중에 임의로 계정을 붙이지 않는다. Apple 비소모성은 originalTransactionId와 originalPurchaseDate를 우선해 복원 시 새 transactionId가 와도 최초 구매 한 건으로 센다. Family Sharing은 추가 구매로 기록하지 않는다.

네이티브 활성화는 `OFFSIDE_ACCOUNT_PURCHASES_ENABLED=true`, 앱 분석 동의 granted, 해당 프로필의 서버 연결 동의가 모두 필요하다. 하나라도 거절이면 추가 계정/거래 요청을 보내지 않거나 서버에서 기록하지 않는다. 연결 동의 조회는 cachedGet을 쓴다. 동의 여부 조회/기록이 일시 실패하면 기존 광고 제거 권한은 즉시 제공하면서 거래 마무리를 미뤄 다음 StoreKit 동기화 때 같은 거래를 재전송한다. 복원은 새 매출이 아니다. 앱 config와 fingerprint가 바뀌므로 실제 스토어 앱에는 별도 바이너리/런타임 검증 후 출시 승인이 필요하다. 이번 작업에서 빌드·제출·OTA·판매 설정 변경은 하지 않았다.

두 상품 원장을 동일한 명시적 열의 UNION ALL로 투영해 계정별 최초 구매 순서를 한 번만 계산한다. 같은 서명 거래가 서로 다른 상품 원장으로 들어가려는 요청은 검증 상품 ID/type이 막는다. 익명 거래는 고유 결제자에 추정 합산하지 않고 unknown_account_transactions로 표시한다. 새 비소모성 데이터는 동의된 구매·복원만 수신하므로 전체 App Store 매출과 동일한 coverage를 주장하지 않는다. #649 미병합 구독도 포함하지 않는다.

검증된 환불이 기록보다 먼저 오면 iap_refund_markers에 거래 키를 먼저 남기고, 나중에 수신한 두 상품 원장이 이를 읽는다. 소모성 거래는 환불 상태로 저장하고 아이템을 지급하지 않는다. 환불 알림 재전송은 같은 키 하나이며 가짜 구매 행을 만들지 않는다. 원장에 연결된 환불 거래 수·그 거래의 구매가격 합계만 보고한다. purchase_value_of_refunded_transactions_milliunits는 실제 현금 환불액이 아니며 부분 환불/수수료/순수익으로 해석하거나 차감하지 않는다.

## GA4/StoreKit 확인과 추가 승인

expo-iap 5.8.2는 StoreKit 2 경로이며 앱 코드에 Firebase `logTransaction` 호출은 없다. RNFirebase analytics의 수집 기본값 off, 명시적 opt-in, ad_storage/ad_user_data/ad_personalization false를 유지한다. Firebase 공식 문서는 StoreKit 1 자동 수집과 StoreKit 2 `Analytics.logTransaction` 경로 및 수동 이벤트의 자동 중복 제거 부재를 설명한다. 따라서 자동 구매 수집이 실제 운영 app stream에 존재한다고 단정하지 않는다. [Firebase 공식 안내](https://firebase.google.com/docs/analytics/ios/measure-in-app-purchases).

실제 app stream/BigQuery 또는 DebugView의 consent-on sandbox 증거는 아직 없다. 새 Firebase 구매 이벤트·Measurement Protocol·Meta App Events·MMP는 활성화하지 않는다. 향후 SDK를 추가하면 전송 항목·목적·보존기간, ATT 적용 여부, App Store privacy/Google Data Safety 신고, SDK privacy manifest 및 새 바이너리·심사 필요성을 검토하고 별도로 승인받아야 한다. GA4 자동 이벤트와 내부 구매 원장을 더해 총매출로 세지 않는다.

## 집계 API

관리자 전용 `GET /v1/admin/acquisition?start=<UTC ISO>&end=<UTC ISO>&model=first|last`, private/no-store. 반열린 구간 `[start,end)`, 최대 93일이다. 반환은 개인 식별자 없는 합계다. 세션은 서버 수신일, 구매는 검증 구매일(과거 원장만 receipt fallback, missing_purchase_time 표시), 환불은 처리일 기준이다. 구매 cohort와 세션 cohort가 다르므로 단순 나눗셈을 설치 전환율이라고 부르지 않는다.

통화별 transactions·unique_purchasers·가격 검증된 unique_payers·신규 결제자·반복 거래·금액 합계·환불·가격 누락·0원·sandbox를 분리한다. 신규 결제자는 두 원장의 모든 운영 거래 중 계정별 최초 행이며 검증 금액이 양수인 경우에만 센다. 과거 금액 미확인 거래가 먼저 있으면 신규로 추정하지 않으므로 보수적 하한이다. 미확인 가격 거래를 유료 결제자로 확정하지 않는다. `repeat_transactions`는 두 원장의 모든 운영 반복 거래이며 유료 확인 여부는 가격 coverage와 함께 해석한다. 통화끼리 합산하지 않는다. 직접 유입은 빈 campaign, 연결 없는 구매는 `unattributed`다.

Migration은 PR782의 0109를 피한 0110이며 journal index와 snapshot도 110/0110이다. 현재 main 14d35d31 기준 schema generate 추가 변경 없음이다. PR782 병합 후 snapshot 재생성 조건은 마지막 절을 따른다.

Drizzle 0.31.10이 coalesce 식 인덱스의 쉼표를 열 구분으로 잘못 직렬화한 SQL을 로컬 테스트에서 발견해 표현식 SQL만 바로잡았다. ADD COLUMN FK의 ON DELETE SET NULL도 명시했다. schema/snapshot은 생성본을 유지하며 재생성 drift 없음과 빈 D1 전체 적용을 다시 검증한다.

## 2026-10-17 추가 검증 및 활성화 조건

사용자가 이전에 검증한 Threads 링크를 제공했다: [기존 캠페인 링크](https://apps.apple.com/app/apple-store/id6817463687?pt=128166757&ct=threads_s1_bio&mt=8). pt=128166757은 과거 검증 근거이며 추측한 값이 아니다. 앞서 공식 로그인 화면에서 동일 앱 ID와 현재 계정의 앱 소유는 확인했지만 provider 번호 자체의 현재 계정 일치는 확인하지 못했다. 기존 로컬 저장소·Codex 세션 검색에도 추가 증거가 없어 현재 검증된 운영 기본값으로 설정하지 않았다. 거절된 새 캠페인 폼 입력은 재시도하거나 우회하지 않았다.

활성화 전: (1) 기존 공식 기록으로 현재 provider 일치 검증, (2) 웹 VITE_APPLE_PROVIDER_TOKEN과 worker APPLE_PROVIDER_TOKEN 같은 값 적용, (3) 웹/API 동시 acquisition 플래그, (4) 별도 연결 동의, (5) 모바일 설정 플래그와 사용자 분석 동의·서버 연결 동의, (6) 같은 runtime/새 바이너리의 실제 StoreKit·Safari 검증. 서버·빌드 플래그는 모두 기본 off/미설정이며 이번 작업에서 운영 값을 변경하지 않았다.

실제 Sandbox 검증은 테스트 Apple/Google 계정 로그인, StoreKit 구매·보류·취소·복원·환불, GA4 테스트 앱 스트림 DebugView 접근, 필요한 개발 바이너리 실행이 필요하다. 이 계정 동작은 현재 승인되지 않았고 실행하지 않았다. 운영 계정/거래/광고 설정은 대상이 아니다. 이번 실행에서는 push/PR 쓰기를 시도하지 않았다. 인계의 과거 쓰기403은 정확한 실패 동작이 확인되지 않았으며 collaborator-permission 조회403만으로 쓰기 불가를 단정하지 않는다. 현재 gh auth status는 확인 실패, gh repository API는 네트워크 연결 실패여서 유효 인증/쓰기 권한을 판정하지 못했다. 다른 설치·자격증명으로 우회하지 않는다.

회귀 검증 결과는 acquisition-iap-pr.md의 추가 구현과 최종 검증을 따른다. API 전체 병렬 실행은 Miniflare 런타임 오류 후 중단했으므로 전체 통과로 보지 않는다. 0110은 기능 off여도 환불 경로에서 필요하므로 코드 배포 전 적용이 필수다.

### PR782 충돌 재검증

2026-10-17 읽기 확인: 최신 main은 14d35d31이다. PR782(head b999bdd8)는 열림/미병합이며 0109_owner_attendance, journal idx109, meta/0109_snapshot.json을 추가한다. PR772는 현재 closed/미병합으로 확인됐다. 기존 "여전히 열림" 기록보다 이 상태가 최신이다. 다른 PR은 수정하지 않았다.

우리 migration을 0110_acquisition_iap.sql, journal idx110, meta/0110_snapshot.json으로 옮겼다. 현재 main 기준 drizzle generate 추가 변경 없음이며 번호·파일명은 PR782와 겹치지 않는다. 아직 PR782가 main에 없으므로 0110 snapshot은 현재 main 0108을 부모로 가진다. **PR782가 먼저 병합되면 반드시 최신 main을 반영해 0110 snapshot/journal을 다시 생성하고 전체 schema drift·migration·번들을 재검증해야 한다.** 파일 번호 변경만으로 미래 snapshot 병합까지 완료됐다고 보지 않는다. 이 조건을 충족하기 전 운영 배포하지 않는다.

리뷰 수정: 오프라인 철회는 네트워크보다 먼저 원래 프로필 대상을 영속화한다. 프로필을 한 번도 확인하지 못한 철회는 `unresolved`로 남겨 다른 계정에 자동 적용하지 않으며 원래 계정에서 명시적 재시도가 필요하다. 광고 제거 INSERT에서 현행 동의/미삭제 프로필을 원자적으로 재검사하고, 소모성 환불 선도착 marker는 구매 원장에 즉시 반영해 아이템 지급을 막는다.

철회 복구: 환경설정에서 분석 동의가 꺼져 있어도 철회 대기 카드는 표시된다. 원래 계정 A 대상 철회가 대기 중인 상태에서 B로 바꿨다면 A에 다시 로그인하여 같은 카드의 거절/철회 버튼을 누른다. A의 철회가 완료될 때까지 B의 새 연결 동의는 차단한다. 대상 미확정(`unresolved`)인 경우에도 원래 계정으로 로그인 후 거절 버튼을 명시적으로 다시 누른다. 자동으로 현재 B의 기록을 삭제하지 않는다.
