# 앱 광고 미디에이션 (AppLovin MAX)

T-11-159(앱 1.1.1)에서 앱 광고 SDK를 AdMob 직접 연동에서 **AppLovin MAX 미디에이션**으로 바꿨다. MAX가 광고 단위마다
AdMob·메타 Audience Network 입찰을 붙여 가장 높은 광고를 고른다. AdMob 계정에 게재 제한이 걸려도 메타·AppLovin 광고가 채운다.
(처음 T-11-119에서 준비한 AdMob 미디에이션 + 메타 어댑터 방식은 이것으로 대신했다.)

## 앱 쪽 (스토어 빌드 필요)

- SDK: `react-native-applovin-max`. Expo 플러그인이 없어 `apps/mobile/plugins/with-applovin-max.js`가 네이티브 설정을 넣는다.
  - 어댑터: iOS 포드 `AppLovinMediationGoogleAdapter`·`AppLovinMediationFacebookAdapter`, 안드로이드 `com.applovin.mediation:google-adapter`·`facebook-adapter`.
    SDK를 올리면 [MAX 통합 문서](https://developers.applovin.com/en/max/react-native/preparing-mediated-networks/)에서 맞는 버전을 다시 고른다.
  - AdMob 앱 ID(구글 어댑터가 요구): iOS `GADApplicationIdentifier`, 안드로이드 `com.google.android.gms.ads.APPLICATION_ID`.
  - iOS SKAdNetwork: `plugins/skadnetwork-ids.json`(AppLovin·Google·Facebook 목록,
    `https://skadnetwork-ids.applovin.com/v1/skadnetworkids.json?adNetworks=AppLovin,Google,Facebook`). 네트워크를 늘리면 다시 받는다.
- SDK 키·광고 단위: `apps/mobile/src/platform/ads.ts`의 `SDK_KEY`·`UNITS`(JS라 OTA로 바꿀 수 있다). 비어 있으면 광고가 꺼지고 광고 제거 구매자만 보상을 받는다.
- 개인정보: 맞춤 광고 동의를 받지 않는다. 모든 지역에서 `setHasUserConsent(false)`·`setDoNotSell(true)`로 비개인화 광고만 받고,
  iOS 추적 허용(ATT) 창·MAX 약관 흐름·구글 UMP(유럽 동의) 창은 띄우지 않는다.
- 테스트 광고: MAX에는 테스트 광고 단위가 없어 개발 빌드(`__DEV__`)는 광고를 끈다. 운영자 기기는 MAX 대시보드 Test Mode로 테스트 광고를 받는다.
- 네이티브 코드라 OTA로 보낼 수 없다. 1.1.0 이하 앱은 기존 AdMob 광고 그대로다.

## 콘솔 쪽 (배포 없이)

1. AppLovin 계정 → SDK 키 확인, MAX 광고 단위 생성(배너 1 + 보상형 후보·엿보기·강화 3, iOS·안드로이드 각각) → `ads.ts`에 넣는다.
2. MAX → Mediation → Manage → Networks에서 Google bidding(AdMob)·Meta Audience Network 연결, 광고 단위마다 켠다.
   AdMob 쪽은 MAX용 광고 단위를 따로 만들어 연결하고, 메타는 Monetization Manager의 광고 위치 ID를 넣는다.
3. 웹 `app-ads.txt`에 AppLovin·메타 줄을 더한다(웹 배포).
4. App Store Connect 앱 개인정보 보호·Google Play 데이터 보안에서 광고 SDK(AppLovin·메타) 수집 항목을 확인한다.

계정 로그인·약관 동의·결제·세금 정보는 운영자가 직접 한다.
