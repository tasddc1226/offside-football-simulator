# AdMob 미디에이션 (메타 Audience Network)

T-11-119(앱 1.1.1)에서 AdMob 미디에이션에 메타 Audience Network를 붙인다. 앱 안에서 광고를 부르는 코드는 그대로이고,
AdMob이 광고 단위마다 미디에이션 그룹에 따라 메타 광고를 함께 경쟁시킨다.

## 앱 쪽 (스토어 빌드 필요)

- 어댑터: 안드로이드 `com.google.ads.mediation:facebook`, iOS `GoogleMobileAdsMediationFacebook`. 버전은 `apps/mobile/app.config.js`의 `MEDIATION`.
  광고 SDK(`react-native-google-mobile-ads`)를 올리면 [안드로이드](https://developers.google.com/admob/android/mediation/meta)·[iOS](https://developers.google.com/admob/ios/mediation/meta) 문서에서 맞는 어댑터 버전을 다시 고른다.
- iOS SKAdNetwork: `app.json`의 `react-native-google-mobile-ads` 플러그인 `skAdNetworkItems`(구글 권장 목록, 메타 `v9wttpbfk9`·`n38lu8286q` 포함).
- iOS 추적 허용(ATT): 문구는 `NSUserTrackingUsageDescription`(`app.json` 기본 영어, `locales/ko.json`·`en.json`). 창은 앱 코드가 직접 띄우지 않고
  AdMob 개인정보 보호 및 메시지의 **IDFA 설명 메시지**가 동의 흐름(`adConsent.ts`)에서 띄운다. 허용하지 않아도 광고는 비개인화로 나간다.
- 어댑터는 네이티브 코드라 OTA로 보낼 수 없다. 1.1.0 이하 앱에서는 메타가 입찰하지 않고 AdMob 광고만 나간다.

## 콘솔 쪽 (배포 없이)

1. 메타 비즈니스 관리자 → Audience Network에 앱 등록(iOS·안드로이드), 광고 위치(배너·보상형) 생성.
2. AdMob → 미디에이션 → 광고 단위별 미디에이션 그룹에 메타 Audience Network(입찰) 추가, 메타 광고 위치 ID 연결.
3. AdMob → 개인정보 보호 및 메시지 → iOS IDFA 설명 메시지 게시.
4. App Store Connect 앱 개인정보 보호: 제3자 광고용 기기 ID·추적 항목 확인. Google Play 데이터 보안: 광고 ID 수집 항목 확인.
5. 메타가 `app-ads.txt` 줄을 요구하면 웹 `app-ads.txt`에 더한다(웹 배포).

계정 로그인·약관 동의·결제·세금 정보는 운영자가 직접 한다.
