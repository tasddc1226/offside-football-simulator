# 광고 유입과 검증 거래 연결

**현재 migration 상태 (2026-10-18)**: main c1c8f42d(#795)의0110을 부모로 하는 독립0115를 사용한다(journal109→110→115). 열린 PR #777/#779/#780/#781이0111~0114를 사용함을 전체 파일 목록으로 재확인해 우리 SQL·snapshot 번호만0115로 이동했다. SQL/schema 내용과 snapshot ID/부모는 그대로다. 아래0111 표기는 당시 이력이며 현재 번호가 아니다. 타 PR 선병합 시 최신main 기준 snapshot/journal 재검증이 필요하다. 운영 DB 적용은 하지 않았다.

독립 브랜치에서 구현한 뒤 main `ad14d32c`(#793/#794)까지 반영했다. 운영 활성화·병합·배포·유료 구매는 하지 않는다. 과거 91건 소급 귀속이나 100% 추적을 제공하지 않는다.

## 현재 검증 상태 (2026-10-18)

2026-10-18T02:34:09.001Z에 기존 로그인 계정과 앱6817463687·번들com.offsidelab.app을 공식 화면에서 대조하고, App Store Connect → 분석 → 유입 경로 → 캠페인 폼에서 [offside_link_check 링크](https://apps.apple.com/app/apple-store/id6817463687?pt=128166757&ct=offside_link_check&mt=8)를 한 번 출력한 뒤 완료했다. 현재 공식 pt128166757은 과거 공식 링크와 일치한다. ct=offside_link_check, mt=8이다. 계정 메뉴 숫자로 provider를 추정하지 않았다.

캠페인 목록은 당시 Jul19~Oct16 범위의 데이터 부족으로 같은 이름의 기존 집계 노출 여부를 확인할 수 없었다. 별도 이름/접미사 없이 동일 ct만 사용했으며 새 캠페인 행·설치·매출 귀속 검증을 주장하지 않는다. 공식 폼은 서로 다른 Apple 계정 최소5개 설치 후 캠페인 표시를 안내한다. 아래의 provider 미확인·로그인 차단·폼 미실행 기록은 이 확인 전의 이력이다.

운영 변수/기본값은 여전히 미설정·off다. 테스트 환경 설정·배포, 개발앱 설치, 실제 StoreKit Sandbox·GA4 앱 스트림·Safari 시스템 배너 검증은 승인/실행 대기다. 로그인 정보 입력·계정/권한 변경·실제 결제는 하지 않았다.

## 수집과 동의

웹 빌드 `VITE_ACQUISITION_ENABLED=true`와 API `ACQUISITION_ENABLED=1`을 모두 설정해야 작동한다. 기본은 꺼짐이며 이번 작업에서 운영 변수는 바꾸지 않는다. 기존 GA4 동의에 추가해 **계정 유입·결제 연결 별도 동의**를 받는다. 기존 분석 동의만으로 수집하지 않는다. Google/Meta에는 프로필 ID, 거래 ID, 캠페인과 연결한 개인 정보를 추가 전송하지 않는다. 기존 모바일 GA4 선택 및 광고 동의 false는 그대로다.

동의 전 게임 시작은 재생하지 않는다. 동의 후 허용 UTM만 고정 순서로 정규화해 서버 수신 시각과 함께 기록한다. OAuth 코드·fbclid·광고 ID·이메일·기기 지문·원본 URL·선수/커리어 정보는 새 수집 경로에 넣지 않는다. 명시적인 동의만 익명 프로필 발급을 요청할 수 있고 로그인은 강제하지 않는다.

하나의 탭에서 30분 길이의 세션을 `sessionStorage` UUID로 구분한다. 동의·활동 요청 때만 서버에 쓰며 폴링하지 않는다. 시작과 스토어 클릭은 세션당 최초 한 번만 표시한다. 새 탭은 독립 세션이며 opener가 복사한 저장소의 UUID는 같은 세션으로 합쳐질 수 있다. App Store 열기는 `noopener`를 유지한다. 저장소 차단 시 게임은 정상 동작하고 계측만 빠진다.

서버의 현재 프로필이 Google/Apple로 연결됐을 때만 `linked_at`을 설정한다. 같은 익명 프로필에 로그인 자격을 연결하면 그 프로필의 동의된 세션을 연결할 수 있다. 기존 다른 계정으로 전환하면 이전 익명 세션을 이전시키지 않는다. 서로 다른 프로필·익명 앱 설치는 미연결이다. GA4 app-instance ID 대신 프로필 ID를 넣지 않는다.

철회는 새 전송을 즉시 막고 서버 동의를 무효화하고 세션을 삭제한다. 구매의 first/last FK는 NULL로 바뀌므로 이후 보고서는 미귀속이다. 결제 이행 원장은 유지된다. 오프라인 철회는 로컬 대기열에 남고 다음 접속 때 같은 프로필에서만 다시 전송한다. 다른 계정이면 409로 차단한다. 계정 삭제는 소프트 삭제이므로 새 테이블을 명시적으로 삭제한다. 90일이 지난 세션은 매일 최대 1,000건씩 삭제한다. 이 처리량을 넘는 유입은 삭제 지연이 생길 수 있어 운영 활성화 전 보존 처리량을 확인해야 한다.

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

네이티브 활성화는 `OFFSIDE_ACCOUNT_PURCHASES_ENABLED=true`, 앱 분석 동의 granted, 해당 프로필의 서버 연결 동의가 모두 필요하다. 하나라도 거절이면 추가 계정/거래 요청을 보내지 않거나 서버에서 기록하지 않는다. 연결 동의 조회는 cachedGet을 쓴다. 동의/기록 조회 실패·hang·409가 native finishTransaction을 막지 않는다. PURCHASED 광고 제거의 권한과 승인 처리는 독립 실행한다. 명시적 연결 동의가 확인된 프로필의 선택적 토큰만 MMKV 대기열(16건, 논리7일)에 보관해 다음 앱/스토어 활동 때 별도 재전송한다. 만료는 다음 활동 때 삭제하며 동의 철회·앱 세션 변경은 대기열을 즉시 비운다. preflight가 끝난 구매는 첫 await 전에 대기열을 동기 저장한다. 복원에서 아직 동의를 확인하지 못했다면 native finish를 먼저 진행하고, 완료된 비소모성 상품은 다음 getAvailablePurchases에서 다시 발견할 수 있다. 가격 조회 실패나 지연도 승인 재시도를 막지 않는다. 복원은 새 매출이 아니다. 앱 config와 fingerprint가 바뀌므로 실제 스토어 앱에는 별도 바이너리/런타임 검증 후 출시 승인이 필요하다. 이번 작업에서 빌드·제출·OTA·판매 설정 변경은 하지 않았다.

두 상품 원장을 동일한 명시적 열의 UNION ALL로 투영해 계정별 최초 구매 순서를 한 번만 계산한다. 같은 서명 거래가 서로 다른 상품 원장으로 들어가려는 요청은 검증 상품 ID/type이 막는다. 익명 거래는 고유 결제자에 추정 합산하지 않고 unknown_account_transactions로 표시한다. 새 비소모성 데이터는 동의된 구매·복원만 수신하므로 전체 App Store 매출과 동일한 coverage를 주장하지 않는다. #649 미병합 구독도 포함하지 않는다.

검증된 환불이 기록보다 먼저 오면 iap_refund_markers에 거래 키를 먼저 남기고, 나중에 수신한 두 상품 원장이 이를 읽는다. 소모성 거래는 환불 상태로 저장하고 아이템을 지급하지 않는다. 환불 알림 재전송은 같은 키 하나이며 가짜 구매 행을 만들지 않는다. 원장에 연결된 환불 거래 수·그 거래의 구매가격 합계만 보고한다. purchase_value_of_refunded_transactions_milliunits는 실제 현금 환불액이 아니며 부분 환불/수수료/순수익으로 해석하거나 차감하지 않는다.

## GA4/StoreKit 확인과 추가 승인

expo-iap 5.8.2는 StoreKit 2 경로이며 앱 코드에 Firebase `logTransaction` 호출은 없다. RNFirebase analytics의 수집 기본값 off, 명시적 opt-in, ad_storage/ad_user_data/ad_personalization false를 유지한다. Firebase 공식 문서는 StoreKit 1 자동 수집과 StoreKit 2 `Analytics.logTransaction` 경로 및 수동 이벤트의 자동 중복 제거 부재를 설명한다. 따라서 자동 구매 수집이 실제 운영 app stream에 존재한다고 단정하지 않는다. [Firebase 공식 안내](https://firebase.google.com/docs/analytics/ios/measure-in-app-purchases).

실제 app stream/BigQuery 또는 DebugView의 consent-on sandbox 증거는 아직 없다. 새 Firebase 구매 이벤트·Measurement Protocol·Meta App Events·MMP는 활성화하지 않는다. 향후 SDK를 추가하면 전송 항목·목적·보존기간, ATT 적용 여부, App Store privacy/Google Data Safety 신고, SDK privacy manifest 및 새 바이너리·심사 필요성을 검토하고 별도로 승인받아야 한다. GA4 자동 이벤트와 내부 구매 원장을 더해 총매출로 세지 않는다.

## 집계 API

관리자 전용 `GET /v1/admin/acquisition?start=<UTC ISO>&end=<UTC ISO>&model=first|last`, private/no-store. 반열린 구간 `[start,end)`, 최대 93일이다. 반환은 개인 식별자 없는 합계다. 세션은 서버 수신일, 구매는 검증 구매일(과거 원장만 receipt fallback, missing_purchase_time 표시), 환불은 처리일 기준이다. 구매 cohort와 세션 cohort가 다르므로 단순 나눗셈을 설치 전환율이라고 부르지 않는다.

통화별 transactions·unique_purchasers·가격 검증된 unique_payers·신규 결제자·반복 거래·금액 합계·환불·가격 누락·0원·sandbox를 분리한다. 신규 결제자는 두 원장의 모든 운영 거래 중 계정별 최초 행이며 검증 금액이 양수인 경우에만 센다. 과거 금액 미확인 거래가 먼저 있으면 신규로 추정하지 않으므로 보수적 하한이다. 미확인 가격 거래를 유료 결제자로 확정하지 않는다. `repeat_transactions`는 두 원장의 모든 운영 반복 거래이며 유료 확인 여부는 가격 coverage와 함께 해석한다. 통화끼리 합산하지 않는다. 직접 유입은 빈 campaign, 연결 없는 구매는 `unattributed`다.

Migration은 최신 main 0109 기준 독립 0111이며 journal idx111, meta/0111_snapshot.json이다. 현재 schema generate 추가 변경 없음이다. 다른 0110 PR 병합 시 마지막 절의 재생성 조건을 따른다.

Drizzle 0.31.10이 coalesce 식 인덱스의 쉼표를 열 구분으로 잘못 직렬화한 SQL을 로컬 테스트에서 발견해 표현식 SQL만 바로잡았다. ADD COLUMN FK의 ON DELETE SET NULL도 명시했다. schema/snapshot은 생성본을 유지하며 재생성 drift 없음과 빈 D1 전체 적용을 다시 검증한다.

## 2026-10-17 추가 검증 및 활성화 조건

사용자가 이전에 검증한 Threads 링크를 제공했다: [기존 캠페인 링크](https://apps.apple.com/app/apple-store/id6817463687?pt=128166757&ct=threads_s1_bio&mt=8). pt=128166757은 과거 검증 근거이며 추측한 값이 아니다. 앞서 공식 로그인 화면에서 동일 앱 ID와 현재 계정의 앱 소유는 확인했지만 provider 번호 자체의 현재 계정 일치는 확인하지 못했다. 기존 로컬 저장소·Codex 세션 검색에도 추가 증거가 없어 현재 검증된 운영 기본값으로 설정하지 않았다. 거절된 새 캠페인 폼 입력은 재시도하거나 우회하지 않았다.

활성화 전: (1) 기존 공식 기록으로 현재 provider 일치 검증, (2) 웹 VITE_APPLE_PROVIDER_TOKEN과 worker APPLE_PROVIDER_TOKEN 같은 값 적용, (3) 웹/API 동시 acquisition 플래그, (4) 별도 연결 동의, (5) 모바일 설정 플래그와 사용자 분석 동의·서버 연결 동의, (6) 같은 runtime/새 바이너리의 실제 StoreKit·Safari 검증. 서버·빌드 플래그는 모두 기본 off/미설정이며 이번 작업에서 운영 값을 변경하지 않았다.

실제 Sandbox 검증에는 테스트 Apple/Google 계정, 실행 가능한 개발 앱과 GA4 테스트 스트림 접근이 필요하나 현재 확보되지 않아 미실행이다. Xcode 경로는 확인됐지만 simctl 목록 조회는 제한 환경에서 서비스 연결 오류, 허용된 읽기 재조회도 응답 지연으로 중단했다. 기기 부재나 재연결 성공으로 단정하지 않는다. 새 계정/OAuth 생성, 운영 접근 확대와 바이너리 출시는 별도 승인 범위다. 운영 계정/거래/광고 설정은 대상이 아니다. 기존 동일 CLI 인증과 동일 origin의 독립 브랜치 non-force push 및 draft PR 게시가 승인되어 PR #787을 생성했다. 새 인증·권한 변경은 하지 않았다.

회귀 검증 결과는 acquisition-iap-pr.md의 추가 구현과 최종 검증을 따른다. API 전체 병렬 실행은 Miniflare 런타임 오류 후 중단했으므로 전체 통과로 보지 않는다. 0111은 기능 off여도 환불 경로에서 필요하므로 코드 배포 전 적용이 필수다.

### Migration 충돌 재검증

PR782는 병합되어 최신 반영 main 94c76a83에 0109가 포함된다. 우리 0111의 부모는0109이고 출석 테이블·코드를 유지했다. 열린 PR785/781/780/779/777의 0110 파일·snapshot 충돌을 피했다. 이 중 하나가 먼저 병합되면 반드시 최신 main 반영 후 0111 snapshot/journal을 재생성하고 drift·migration을 다시 확인한다. 번호만 다르게 했다고 미래 snapshot 병합까지 완료한 것으로 보지 않는다. 다른 PR은 수정하지 않았다.

리뷰 수정: 오프라인 철회는 네트워크보다 먼저 원래 프로필 대상을 영속화한다. 프로필을 한 번도 확인하지 못한 철회는 `unresolved`로 남겨 다른 계정에 자동 적용하지 않으며 원래 계정에서 명시적 재시도가 필요하다. 광고 제거 INSERT에서 현행 동의/미삭제 프로필을 원자적으로 재검사하고, 소모성 환불 선도착 marker는 구매 원장에 즉시 반영해 아이템 지급을 막는다.

철회 복구: 환경설정에서 분석 동의가 꺼져 있어도 철회 대기 카드는 표시된다. 원래 계정 A 대상 철회가 대기 중인 상태에서 B로 바꿨다면 A에 다시 로그인하여 같은 카드의 거절/철회 버튼을 누른다. A의 철회가 완료될 때까지 B의 새 연결 동의는 차단한다. 대상 미확정(`unresolved`)인 경우에도 원래 계정으로 로그인 후 거절 버튼을 명시적으로 다시 누른다. 자동으로 현재 B의 기록을 삭제하지 않는다.

최신 재확인: PR782는 2026-10-17 15:03 UTC에 병합됐고 main은 94c76a835b051e502b8ccafdbcefdd6b39762c09(#784 문서)다. 기존 CLI의 읽기 전용 fetch로 반영했으며 0109를 부모로 0111 SQL/snapshot/journal을 새로 생성했다. 위의 14d35d31/PR782 미병합은 과거 확인 기록이다. 출석 코드와 두 라우트를 보존했다.

GitHub 권한 재확인: 제한 환경 밖의 승인된 읽기 전용 gh auth status는 tasddc1226(keyring) 정상, repo API는 admin/maintain/pull/push/triage=true를 반환했고 git fetch도 성공했다. 앞선 제한 환경의 인증 확인 실패/연결 오류를 실제 자격증명 실패나 push 불가로 해석하지 않는다. collaborator-permission 403은 권한 조회 실패일 뿐이다. 다른 설치(techinpark 저장소 목록)는 OFFSIDE 권한 근거가 아니다. 후속 게시 승인에 따라 동일 origin의 독립 브랜치를 non-force push하고 draft PR #787을 생성했다. 재인증·권한 변경은 하지 않았다. a4be97bc의 CI 전체가 통과했고 이후 main 병합·native 승인 독립 패치는 새 head의 CI로 다시 검증한다.

고유 결제자 수의 단위는 검증 거래에 연결된 first-party 프로필이다. 동일 인물의 서로 다른 미연결 계정을 합치거나 기기 초기화 뒤 계정을 추정하지 않는다. 통화별 고유 수를 더해 전체 사람 수로 해석하지 않는다. 모바일은 서버 동의/프로필 조회를 기다리는 동안 native 동의가 철회된 경우에도 계정 토큰과 추가 거래 업로드를 차단한다.

서버 동의는 GET의 revision을 조건으로 원자적 grant한다. 철회는 임의의 새 revision과 withdrawn 상태를 남기므로 먼저 발행됐지만 늦게 도착한 첫 grant(null)·기존 grant가 모두 409가 된다. 다시 동의하려면 철회 이후 revision을 조회한 명시적 새 선택이 필요하다. 철회 표식은 프로필·철회 상태·revision·철회 시각만 계정 삭제까지 남기고 기존 동의 시각·캠페인 세션은 지운다. 새 수집을 위한 폴링이나 자동 동의는 없다.

게시 전 열린 PR 대조에서 #785/#781/#780/#779/#777이 각각 0110 SQL·snapshot·journal을 사용함을 확인해 우리 migration을 독립 0111로 이동했다. 현재 main은0109까지이므로 0111의 부모는0109이며 journal108→109→111이다. 해당 PR 중 하나가 먼저 병합되면 최신main 반영 후 0111 snapshot/journal 재생성·drift·migration 재검증을 반드시 수행한다. 번호 회피만으로 미래 snapshot 병합이 완료된 것은 아니다. 다른 PR을 수정하지 않았다.

최종 main ae3cf3ab(#786) 반영: 보드 충돌을 양쪽 행 보존으로 해결했고 index/env/SEO/출석 UI 변경을 유지했다. 0111 snapshot 부모는0109로 여전히 일치한다. Android 선택적 분석 승인 종속 P1은 native finish와 내구적 analytics outbox를 분리해 수정했으며 서버는 큐의 expected profile을 대조한다.

최신 migration 재생성: 게시 중 main be92d4d1(#785)이0110을 추가하여 다시 병합했다. 0111을 병합 schema에서 재생성했고 snapshot 부모0110, journal109→110→111 및 career_renames 보존을 확인했다. Drizzle 재실행 추가 변경 없음. 생성기의 알려진 coalesce 인덱스·ON DELETE SET NULL SQL 교정만 재적용했으며 운영 DB 적용은 하지 않았다. 앞선0109 부모 기록은 당시 검사 이력이다.


## 2026-10-18 배포 경로 보완과 현재 차단

main319aa9b5(#778)을 반영하고 보드의 양쪽 작업 행을 보존했다. main migration은0110까지라 0111 부모0110은 그대로 유효하다. 이 실행에서는 새 migration을 생성하거나 원격 DB에 적용하지 않았다.

staging/production workflow가 환경별 공개 변수 VITE_ACQUISITION_ENABLED, VITE_APPLE_PROVIDER_TOKEN, ACQUISITION_ENABLED, APPLE_PROVIDER_TOKEN을 전달한다. 빈 플래그는 각각 false/0, provider는 빈 값이다. Vite 빌드는 웹 변수, API worker는 ACQUISITION_ENABLED, 웹 worker만 APPLE_PROVIDER_TOKEN을 받는다. OG worker에는 provider를 넣지 않는다. `.github/scripts/acquisition-release.mjs validate`가 잘못된 플래그와 웹/worker provider 불일치를 원격 쓰기 전에 막으며, deploy 하위 명령은 기존 환경/배포 순서를 유지하고 shell 보간 없이 argv로 전달한다. 비어 있는 provider도 명시적으로 전달해 오래된 값을 유지하지 않는다. 숫자 형식 검사는 소유권 검증을 대신하지 않는다.

이 코드는 향후 승인된 배포의 설정 전달을 준비한다. 저장소/환경 변수를 등록하거나 켜지 않았고, deploy 하위 명령·병합·migration·배포·바이너리 빌드/출시를 실행하지 않았다. 기존 동의·광고 동의 false·기능 기본 off는 유지한다. 운영 모양 번들 검사는 합성 provider123456 및 활성화 경로를 포함하며 실제 운영 트래픽을 보내지 않는다.

새 릴리스 노트는 작성하지 않는다. 저장소 AGENTS 및 `.release-notes/README.md`의 공식 면제인 PR 본문 `release-notes: none`을 사용하고 필수 guard는 유지한다.

Apple 확인용 offside_link_check 폼 작업이 승인된 뒤 기존 브라우저로 App Store Connect에 접근했지만 authResult=FAILED 로그인 화면에서 내용이 로딩되지 않았다. 한 번 새로고침 후에도 동일해 폼에 도달하지 못했다. 폼 입력/링크 생성은 이번 실행에서 미시도이며 새 거절이나 불확실한 생성 결과는 없다. 기존 계정 로그인 화면 복구/로그인이 필요하다. pt128166757은 여전히 과거 공식 링크 근거이며 현재 provider 일치 검증값으로 설정하지 않았다. StoreKit Sandbox·GA4 앱 스트림·Safari 시스템 배너도 아직 미검증이다.

CI의 별도 합성 동의 검사에는 analytics.spec과 acquisition.spec을 함께 포함했다. 테스트 전용GA4 tag·localhost·합성provider123456을 쓰며 운영 설정을 읽거나 변경하지 않는다. 로컬 스크립트40개, 배포 호환성14개, 유입/설치/출석E2E14개와 운영모양 활성화 번들144.86KB/145KB가 통과했다.

CI39087673328이 head7fc5fee8에서 전체 성공한 뒤 main7297a213(#790)이 추가되어 보드를 다시 양쪽 행 보존으로 병합했다. migration은0110 그대로이며 일일 실행/이상기록 코드를 보존했다. 새 merge head는 별도 CI로 확인한다.


## #792 병합 검증과 번들 차단

#792는 migration/schema를 변경하지 않았다. 보드 양쪽 행을 보존했고 SEO의 기존 acquisition 개인정보 본문은 이전 head와, 나머지 SEO는 #792 main과 정확히 일치한다. 관련 API65개·공용 모델23개·게임 리포트3개·SEO10개가 로컬 통과했다. 브라우저 회귀30개는 별도 결과를 따른다.

운영 모양의 합성 활성화 빌드는145.21KB gzip으로 기존145KB 예산을 초과한다. 예산·검사를 완화하지 않는다. 우리 UI/캠페인 모듈 분리와 중복 처리 축소는 예산을 해결하지 못해 모두 원복했다. 최종 구현에는 효과 없는 최적화가 남아 있지 않다. 경기 리포트 등 관련 없는 기능도 수정하지 않았다. 이 빌드 차단은 별도 초기 번들 최적화 또는 예산 결정이 필요하다. 원격 CI는 새 merge head로 확인한다. 운영 설정·배포·실제 결제는 실행하지 않았다.


## #794/#793 반영과 번들 예산 복구

동일 Node22.23.1·동일 합성 운영 설정·동일 GITHUB_SHA(c9a75591…)로 독립 main과 PR 대조군을 비교했다. main ad14d32c는144.59KB, 최적화 전 PR은145.23KB, 최적화 후144.96KB gzip이다(145KB 기준). main만 내보낸 독립 소스와 최적화 전 index 소스를 사용했고 설치된 같은 의존성 버전을 읽었다. 이전 #792 예산 실패 기록은 당시 결과이며 이번 head의 원격 CI는 별도로 확인한다.

원인은 Home이 OS 판별 appTarget을 appStore 모듈에서 가져와 캠페인 링크 생성기까지 eager import한 것이다. appTarget 구현을 기존 inapp 모듈로 옮기고 appStore에서 재노출해 기존 API와 OS 판정을 유지했다. 생성기는 이미 지연 로딩되는 앱 이동 UI가 필요할 때 로드하며 실제 클릭의 window.open은 동기식 그대로다.

최초 허용 UTM은 main의 첫 import인 entry-campaign에서 한 번 캡처한다. App Store와 first-party가 같은 정규화된 snapshot을 사용해 SPA 이동 뒤 생성기 로드가 늦어져도 최초 유입을 유지한다. raw URL·fbclid·이메일을 새 저장소에 보관하지 않으며 API/제3자 전송과 동의·철회 정책은 바뀌지 않는다. 해당 초기 snapshot만 이미 eager인 game/contracts 그룹과 묶고, $initial 및 재귀 캡처 금지를 유지했다. 예산·카운터·검사 fixture는 완화하지 않았다.

#794 LM/RM 역할과 #793 감독 상세 표시는 main 코드를 그대로 보존했다. 보드 양쪽 행과 SEO의 main 변경/기존 acquisition 개인정보 본문을 각각 대조했다. migration/schema 변경은 없고 0111 부모0110/journal109→110→111을 유지한다. 로컬 웹94개(지연 초기화/개인정보/OS 회귀3개 포함), owner-team 계약20개, managerCard8개, 웹/e2e 타입·Svelte오류0(기존경고5)·변경 ESLint 검사를 통과했다. 브라우저/원격 CI 결과는 새 head에서 별도로 기록한다. 운영 활성화·병합·배포·환경 설정·개발앱 설치·실제 구매는 실행하지 않았다.
