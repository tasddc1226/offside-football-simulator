# 자발적 개발자 후원

2026-10-04 확인. 웹 메인 하단에 기존 공개 후원 계좌와 복사 버튼을 둔다. 환경설정에는 중복 노출하지 않는다. 후원은 선택이며 게임 혜택·광고 제거를 제공하지 않는다. 개발자 지원을 자선기부나 공인 비영리 모금으로 표현하지 않는다.

## 앱 적용과 정책 확인 사항

**앱에는 아직 보이지 않는다(2026-10-04 사용자 결정, T-11-085).** 앱용 카드(`apps/mobile/src/screens/home/VoluntarySupport.tsx`)는 만들어 두었지만 홈에 붙이지 않았다. 아래 Apple 3.1.1 때문에 심사를 거치지 않는 OTA로 계좌 후원을 앱에 내보내지 않는다. 팁 IAP 상품을 만든 뒤 연다. 기존 expo-clipboard를 사용하며 네이티브 의존성·앱 버전·EAS 설정을 바꾸지 않았다. 새 상품·계정·계좌를 만들지 않았다. 호환 런타임에 OTA로 전달할 수 있는 JS UI 변경이며 실제 OTA 게시·수신은 별도다. OTA라는 이유로 아래 스토어 정책 검토가 면제되지는 않는다.

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 3.1.1은 개발자 팁에 IAP 사용을 명시한다. 3.2.1(vii)의 개인 간 선물은 선택성·수령인 100% 전달 조건을 요구하며 디지털 콘텐츠/서비스와 연결된 선물은 IAP 대상이다. 이 게임 개발자 후원에 그 예외가 적용된다고 단정하지 않는다. 3.2.1(vi)의 승인 비영리 예외는 별개다.
- Apple 3.1.1(a)의 미국 storefront 외부 안내 예외를 한국·호주에 확대하지 않는다. 한국·호주 storefront에 대한 현재 앱의 링크 entitlement 보유 근거는 확인되지 않았다.
- [Apple 한국 외부결제](https://developer.apple.com/support/storekit-external-entitlement-kr/): 승인 entitlement·새 한국 전용 bundle/binary·PSP·필수 StoreKit API·고지·보고 조건이 있고 같은 앱의 Apple IAP와 병용 불가다. 일반 계좌 표시/복사로 충족한다고 보지 않는다.
- [Google Payments FAQ](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en): 수령인에게 팁 100% 전달, 디지털 콘텐츠·서비스(배지 포함) 없음이면 P2P로 보아 Play billing이 필수가 아니다. 기존 개인사업자 개발자 지원 및 계좌 이체가 이 예외에 해당하는지는 별도 확인이 필요하다. 모든 팁이 IAP 필수라는 기존 보드 설명은 지나치게 넓다.
- 같은 Google FAQ: 미국 대체결제/외부안내는 해당 프로그램 등록 조건, 한국 대체결제는 추가 요구사항과 서비스 수수료 조건이 있다.
- [Google 사용자 선택 결제](https://support.google.com/googleplay/android-developer/answer/12570971?hl=en): 호주는 대상 국가지만 게임은 해당 pilot의 호주 대상 앱에 포함되지 않는다. EEA·미국·일본의 게임 허용을 호주에 확대하지 않는다.

스토어 정책 관련 후속 확인: iOS는 광고 제거 비소모성 상품과 별개의 무보상 팁 IAP 상품·금액·스토어 등록/심사 여부를 정한다. Android는 100% 직접 팁 예외 적용을 확인하거나 별도 정책에 맞는 결제 방식을 결정한다. 광고 제거와 합치거나 자선기부로 이름만 바꾸지 않는다. 심사에 기능을 숨기지 않는다.

## 배포 기준과 확인 한계

작업 기준은 원격 main `1565488ba471b33861352c3f3cdaf612b0d9dae0`, [운영 release v2026.10.04.21](https://github.com/tasddc1226/offside-football-simulator/releases/tag/v2026.10.04.21)이다. [한국 App Store 공개 페이지](https://apps.apple.com/kr/app/id6817463687)는 2026-10-04 확인 당시 1.0.2를 표시했다. 저장소 앱 설정은 1.1.0이며 공개 스토어 버전과 같다고 보지 않는다. Android 비공개 테스트 배포 버전 및 현재 스토어 제출/심사 상태는 확인하지 못했다. 공개 release의 OTA 완료와 실제 기기 수신은 별개다.

열린 앱 PR #475(영구결번 성능), #470(보상형 스카우트 광고)는 작업 기준에 병합되지 않았다. 원본 체크아웃의 변경과 Simulator/Xcode를 건드리지 않았다. 이번 변경은 웹·앱 메인 UI 구현이며 배포·실제 기기 수신 완료를 주장하지 않는다.

## 현재 OTA 런타임 제약

[운영 배포 실행](https://github.com/tasddc1226/offside-football-simulator/actions/runs/37202172381)의 2026-10-04 21:30 KST 대조 결과, iOS `55f5823c8cb4c8b7476a9836552fcb233fca32f7`과 일치하는 완료 production 빌드가 없다는 경고가 있었다. Android `f527ee4f7f00bc3d64540ebf4fd76b70f79676c2`는 완료 production 빌드와 일치했다. 이는 이 PR 최종 fingerprint나 기기 수신 확인이 아니다.

따라서 이 UI 자체가 JS 변경이라는 사실과 현재 iOS 1.0.2에 최신 main OTA가 전달되는지는 분리한다. iOS는 기존 런타임 호환 기반으로 별도 backport하거나 호환 바이너리 출시가 필요하다. 이번 작업에서 버전·네이티브 설정을 되돌리거나 새 바이너리를 제출하지 않았다. Android도 실제 사용자 설치 버전과 수신은 별도 확인한다. 공지 availability는 `web-app-pending`, appVersion은 현재 소스 기준 `1.1.0`으로 두어 앱 출시 완료로 안내하지 않는다.
