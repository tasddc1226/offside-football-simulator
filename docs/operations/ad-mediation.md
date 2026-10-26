# 앱 광고 미디에이션 (AdMob)

T-11-453(앱 1.1.4)부터 AdMob을 미디에이션 플랫폼으로 두고 **Meta Audience Network · Pangle · Liftoff Monetize** 어댑터를 붙인다.
AdMob이 광고 단위마다 이 네트워크들의 입찰을 함께 받아 가장 높은 광고를 고른다. 앱 코드(배너 · 보상형 광고 단위 ID)는 그대로다.

이전 경과: T-11-159(1.1.1)에서 AppLovin MAX로 바꿨지만 MAX 계정이 거절돼 1.1.1은 광고가 꺼진 채 나갔고, T-11-194(1.1.2)에서
AdMob 직접 연동으로 되돌렸다. 그래서 이번에는 AppLovin을 빼고 AdMob 미디에이션으로 간다.

## 앱 쪽 (스토어 빌드 필요)

- 어댑터는 `apps/mobile/plugins/withAdMediation.js`가 네이티브 설정에 넣는다(react-native-google-mobile-ads 플러그인은 어댑터를 넣지 않는다).
  - iOS 포드: `GoogleMobileAdsMediationFacebook` · `GoogleMobileAdsMediationPangle` · `GoogleMobileAdsMediationVungle`(Liftoff).
  - 안드로이드: `com.google.ads.mediation:facebook` · `pangle` · `vungle`을 `runtimeOnly`로. Pangle SDK는 Maven Central에 없어
    `artifact.bytedance.com` 저장소를 기본 저장소 뒤에 두고 `com.pangle.global` 묶음만 받는다.
  - 버전은 react-native-google-mobile-ads가 고정한 Google Mobile Ads SDK(지금 iOS 13.6.0 · Android 25.4.0)를 받는 어댑터로 골랐다.
    그 패키지를 올리면 `apps/mobile/scripts/ad-mediation.test.mjs`가 멈추니, 각 어댑터의 SDK 범위(iOS podspec ·
    Android pom의 `play-services-ads`)를 다시 보고 고른다.
- iOS SKAdNetwork ID: `plugins/skadnetwork-ids.json`(Google · Meta · Pangle · Liftoff 152개,
  `https://skadnetwork-ids.applovin.com/v1/skadnetworkids.json?adNetworks=Google,Facebook,ByteDance,Vungle`). 네트워크를 늘리면 다시 받는다.
- 개인정보: 그대로다. 추적 허용(ATT) 창은 띄우지 않고, 유럽 · 영국 · 스위스는 UMP 동의 창(`platform/adConsent.ts`)을 쓴다.
  UMP는 동의 결과를 AdMob이 고른 광고 파트너에게 넘기므로, AdMob 콘솔 → 개인정보 보호 및 메시지 → 광고 파트너 목록에
  Meta · Pangle · Liftoff가 들어 있는지 확인한다.
- 네이티브 코드라 OTA로 보낼 수 없다. 1.1.3 이하 앱은 미디에이션 없이 AdMob 광고만 받는다.

### 1.1.3 OTA 호환 (`prepare-ota-113.mjs`)

어댑터는 JS를 바꾸지 않는다. 운영 배포의 OTA는 `current(1.1.4) / 1.1.3 / 1.1.2 × ios / android`로 돈다. `1.1.3`은 앱 설정
(`app.json` · `app.config.js`)만 1.1.3 빌드 때 모양(`9cac4fb9`)으로 되돌리고 미디에이션 플러그인을 지운 뒤, 지문이
1.1.3 스토어 빌드(iOS 17 · Android 21)와 정확히 같을 때만 게시한다. 다른 네이티브 변경이 끼면 실패한다(무시하지 않는다).

**머지 순서:** 이 변경을 main에 넣으면 `current` 지문이 1.1.4가 된다. 운영 배포는 그 지문의 완료된 production 빌드가 있어야
통과하므로, ① PR 브랜치에서 1.1.4 production 빌드(iOS · Android)를 만들고 ② `ota-store-runtime.mjs`의 `STORE_RUNTIMES`를
그 빌드의 지문으로 바꾼 뒤 ③ 머지 · 배포한다. 스토어 심사 · 출시는 머지와 따로 진행해도 된다(1.1.3 경로가 기존 사용자를 받는다).

## 콘솔 쪽 (운영자가 직접, 배포 없이)

계정 가입 · 약관 동의 · 세금 · 정산 정보는 운영자가 직접 한다.

1. **Meta Audience Network**: Meta Business(기존 OFFSIDE-Lab 비즈니스)에서 Monetization Manager → 앱 등록(iOS · 안드로이드) →
   광고 위치(배너 1 · 보상형 3)를 만들고, 입찰 파트너로 AdMob을 고른다.
2. **Pangle**: pangleglobal.com 가입 → 앱 등록 → 광고 위치(배너 · 보상형) 생성.
3. **Liftoff Monetize**: monetize.liftoff.io 가입 → 앱 등록 → 광고 위치(배너 · 보상형) 생성, Reporting API 키 확인.
4. **AdMob** → 미디에이션 → 미디에이션 그룹을 플랫폼 · 형식(배너 · 보상형)마다 만들고, 입찰 소스에 Meta · Pangle · Liftoff를
   더한 뒤 위에서 만든 광고 위치 ID를 넣는다. 지금 쓰는 광고 단위 6개(배너 · 보상형 후보 · 엿보기 · 강화 × iOS · 안드로이드)를 그룹에 넣는다.
5. 웹 `apps/web/public/app-ads.txt`에 각 네트워크 대시보드가 주는 줄을 더한다(웹 배포). 지금은 AdMob 줄만 있다.
6. App Store Connect 앱 개인정보 보호 · Google Play 데이터 보안에서 광고 SDK(Meta · Pangle · Liftoff)가 모으는 항목
   (기기 ID · 대략적 위치 · 광고 상호작용 등)을 확인해 고친다.

## 확인

- 운영자 기기(테스트 기기, `adConsent.ts`의 `TEST_DEVICES`)에서 AdMob **광고 검사기**로 각 어댑터가 초기화됐는지,
  미디에이션 그룹의 입찰이 돌아오는지 본다.
- 출시 뒤 AdMob 보고서 → 미디에이션에서 네트워크별 노출 · eCPM · 채움률을 1~2주 보고 그룹을 조정한다.
