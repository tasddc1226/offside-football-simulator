# 광고 유입과 검증 거래 연결

main `5acbeb1e`에서 분리한 뒤 최신 main `14d35d31`을 반영한 구현이다. 운영 활성화·병합·배포·유료 구매는 하지 않는다. 과거 91건 소급 귀속이나 100% 추적을 제공하지 않는다.

## 수집과 동의

웹 빌드 `VITE_ACQUISITION_ENABLED=true`와 API `ACQUISITION_ENABLED=1`을 모두 설정해야 작동한다. 기본은 꺼짐이며 이번 작업에서 운영 변수는 바꾸지 않는다. 기존 GA4 동의에 추가해 **계정 유입·결제 연결 별도 동의**를 받는다. 기존 분석 동의만으로 수집하지 않는다. Google/Meta에는 프로필 ID, 거래 ID, 캠페인과 연결한 개인 정보를 추가 전송하지 않는다. 기존 모바일 GA4 선택 및 광고 동의 false는 그대로다.

동의 전 게임 시작은 재생하지 않는다. 동의 후 허용 UTM만 고정 순서로 정규화해 서버 수신 시각과 함께 기록한다. OAuth 코드·fbclid·광고 ID·이메일·기기 지문·원본 URL·선수/커리어 정보는 새 수집 경로에 넣지 않는다. 명시적인 동의만 익명 프로필 발급을 요청할 수 있고 로그인은 강제하지 않는다.

하나의 탭에서 30분 길이의 세션을 `sessionStorage` UUID로 구분한다. 동의·활동 요청 때만 서버에 쓰며 폴링하지 않는다. 시작과 스토어 클릭은 세션당 최초 한 번만 표시한다. 새 탭은 독립 세션이며 opener가 복사한 저장소의 UUID는 같은 세션으로 합쳐질 수 있다. App Store 열기는 `noopener`를 유지한다. 저장소 차단 시 게임은 정상 동작하고 계측만 빠진다.

서버의 현재 프로필이 Google/Apple로 연결됐을 때만 `linked_at`을 설정한다. 같은 익명 프로필에 로그인 자격을 연결하면 그 프로필의 동의된 세션을 연결할 수 있다. 기존 다른 계정으로 전환하면 이전 익명 세션을 이전시키지 않는다. 서로 다른 프로필·익명 앱 설치는 미연결이다. GA4 app-instance ID 대신 프로필 ID를 넣지 않는다.

철회는 새 전송을 즉시 막고 서버 동의·세션을 삭제한다. 구매의 first/last FK는 NULL로 바뀌므로 이후 보고서는 미귀속이다. 결제 이행 원장은 유지된다. 오프라인 철회는 로컬 대기열에 남고 다음 접속 때 같은 프로필에서만 다시 전송한다. 다른 계정이면 409로 차단한다. 계정 삭제는 소프트 삭제이므로 새 테이블을 명시적으로 삭제한다. 90일이 지난 세션은 매일 최대 1,000건씩 삭제한다. 이 처리량을 넘는 유입은 삭제 지연이 생길 수 있어 운영 활성화 전 보존 처리량을 확인해야 한다.

## App Store 링크

`VITE_APPLE_PROVIDER_TOKEN`은 **이 앱 계정의 공식 App Store Connect 캠페인 링크에서 검증한 pt 값만** 설정한다. 앱 ID·팀 ID·계정 숫자를 대입하지 않는다. 없거나 비정상이면 기존 일반 App Store 링크로 안전하게 보낸다. 홈·안내 시트·설정·상점 이동 함수와 AppConversion의 앵커가 공용 링크 함수를 사용한다. Safari 시스템 Smart App Banner는 현재 정적 app-id 메타이므로 캠페인 전달은 미완료이며, 공식 token 확보 뒤 초기 HTML 단계의 별도 검증이 필요하다.

ct=`os1.<source>.<medium>.<campaign>.<content>`는 공유 allowlist 각 값의 (0부터 시작한 위치+1)을 base36으로 표시한다. 누락은 0, 최대 30자 이하다. allowlist 순서는 append-only이며 기존 위치를 재정렬하지 않는다. 예시 테스트의 pt는 합성값으로 운영 설정이 아니다.

2026-10-17 공식 앱의 Analytics → Acquisition → Campaigns 및 링크 미리보기 대화상자까지 읽었다. 기존 캠페인 데이터 부족, 링크 필드는 비어 있었다. 캠페인명 입력은 자동 승인 검토에서 외부 캠페인 생성 가능성이 있는 쓰기로 거절됐으며 **실행되지 않았다**. 다른 경로로 재시도하지 않았다. 공식 링크 제공 또는 해당 폼 입력/캠페인 링크 생성 승인이 필요하다.

Apple의 캠페인 표시 privacy threshold와 첫 다운로드 24시간/최종 캠페인 규칙은 내부 30일 규칙과 다르다. 이 데이터를 서로 같은 전환 수로 합치지 않는다. [Apple 공식 안내](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links/).

## 거래 정본과 매출

현재 범위의 정본은 서버 검증 후 `iap_purchases`에 들어간 **소모성 상품 거래**다. `(store, transaction_id)` PK와 같은 D1 batch에서 지급·유입 snapshot을 확정한다. 앱 응답 손실·충돌·복원 재전송은 기존 행을 바꾸거나 다시 지급하지 않는다. 신규 구매, 복원, 재시도 요청 횟수를 매출 건수로 세지 않는다. 대기·취소·검증 실패는 행을 만들지 않는다. Sandbox/test는 운영 집계에서 제외한다. 새 GA4 `purchase`/`in_app_purchase` 이벤트는 보내지 않는다.

Apple 서명 JWS의 `purchaseDate`, `price`(milliunits), `currency`, `storefront`만 선택적으로 저장한다. 검증된 원문에 없거나 형식이 맞지 않으면 NULL이다. Google `products.get`의 검증된 purchaseTimeMillis만 저장하고 이 API에 없는 금액/통화는 NULL로 둔다. 표시가격·하드코딩 가격·아이템 qty·임의 환율·수수료로 매출을 만들지 않는다. 저장 금액은 검증 거래의 원시 가격 필드이며 정산금·세후수익을 뜻하지 않는다.

검증된 구매시각 이전 30일의 같은 연결 프로필 세션에서 최초와 최종을 각각 snapshot한다. 거래 저장 후 새 접점이나 재전송으로 재귀속하지 않는다. 구매시각이 없거나 연동/동의가 없으면 미귀속이다. 익명 세션의 연결이 구매 후 발생했다면 해당 과거 구매에 소급 연결하지 않는다.

중요한 **미포함 경로**: `apps/mobile/src/platform/adFree.ts`의 비소모성 광고 제거는 현재 서버 없이 스토어 기록으로 지급되고 요청에 appAccountToken이 없다. 기존 App Store 사용자 복원도 프로필 소유를 검증할 수 없다. 이 경로를 소모성 원장에 가짜 qty로 끼우지 않는다. 전체 IAP 수익·고유 결제자 완료로 표시하면 안 된다. 후속은 별도 공통 검증 거래 원장, 새 구매의 선택적 account token 연결, 기존 복원의 미귀속 유지, 영구 권한을 바꾸지 않는 백필 없는 기록·환불 테스트가 필요하다. #649 미병합 구독도 집계하지 않는다.

## GA4/StoreKit 확인과 추가 승인

expo-iap 5.8.2는 StoreKit 2 경로이며 앱 코드에 Firebase `logTransaction` 호출은 없다. RNFirebase analytics의 수집 기본값 off, 명시적 opt-in, ad_storage/ad_user_data/ad_personalization false를 유지한다. Firebase 공식 문서는 StoreKit 1 자동 수집과 StoreKit 2 `Analytics.logTransaction` 경로 및 수동 이벤트의 자동 중복 제거 부재를 설명한다. 따라서 자동 구매 수집이 실제 운영 app stream에 존재한다고 단정하지 않는다. [Firebase 공식 안내](https://firebase.google.com/docs/analytics/ios/measure-in-app-purchases).

실제 app stream/BigQuery 또는 DebugView의 consent-on sandbox 증거는 아직 없다. 새 Firebase 구매 이벤트·Measurement Protocol·Meta App Events·MMP는 활성화하지 않는다. 향후 SDK를 추가하면 전송 항목·목적·보존기간, ATT 적용 여부, App Store privacy/Google Data Safety 신고, SDK privacy manifest 및 새 바이너리·심사 필요성을 검토하고 별도로 승인받아야 한다. GA4 자동 이벤트와 내부 구매 원장을 더해 총매출로 세지 않는다.

## 집계 API

관리자 전용 `GET /v1/admin/acquisition?start=<UTC ISO>&end=<UTC ISO>&model=first|last`, private/no-store. 반열린 구간 `[start,end)`, 최대 93일이다. 반환은 개인 식별자 없는 합계다. 세션은 서버 수신일, 구매는 검증 구매일(과거 원장만 receipt fallback, missing_purchase_time 표시), 환불은 처리일 기준이다. 구매 cohort와 세션 cohort가 다르므로 단순 나눗셈을 설치 전환율이라고 부르지 않는다.

통화별 transactions·unique_purchasers·가격 검증된 unique_payers·신규 결제자·반복 거래·금액 합계·환불·가격 누락·0원·sandbox를 분리한다. 신규 결제자는 모든 운영 소모성 거래의 최초 행이며 검증 금액이 양수인 경우에만 센다. 과거 금액 미확인 거래가 먼저 있으면 신규로 추정하지 않으므로 보수적 하한이다. 미확인 가격 거래를 유료 결제자로 확정하지 않는다. `repeat_transactions`는 모든 운영 소모성 반복 거래이며 유료 확인 여부는 가격 coverage와 함께 해석한다. 통화끼리 합산하지 않는다. 직접 유입은 빈 campaign, 연결 없는 구매는 `unattributed`다.

Migration 0109와 snapshot 0109는 열린 PR 772/774의 0108과 파일명이 겹치지 않게 생성했다. journal index도 109로 예약했다. 그 PR을 수정하지 않았다. 병합 순서에 따라 최신 main으로 재생성·충돌 검증을 다시 해야 한다. 작업 중 #774가 main에 병합되어 해당 0108까지 반영한 뒤 0109를 다시 생성했다. 현재 schema generate는 변경 없음이다.

Drizzle 0.31.10이 coalesce 식 인덱스의 쉼표를 열 구분으로 잘못 직렬화한 SQL을 로컬 테스트에서 발견해 표현식 SQL만 바로잡았다. ADD COLUMN FK의 ON DELETE SET NULL도 명시했다. schema/snapshot은 생성본을 유지하며 재생성 drift 없음과 빈 D1 전체 적용을 다시 검증한다.
