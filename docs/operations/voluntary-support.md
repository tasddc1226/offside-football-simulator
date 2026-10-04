# 자발적 개발자 후원

2026-10-04 확인. 웹 메인 하단에 기존 공개 후원 계좌와 복사 버튼을 둔다. 환경설정에는 중복 노출하지 않는다. 후원은 선택이며 게임 혜택·광고 제거를 제공하지 않는다. 개발자 지원을 자선기부나 공인 비영리 모금으로 표현하지 않는다.

## 앱 결제 결정 대기

현재 앱에 웹 계좌 복사 UI를 그대로 추가하지 않는다. 새 상품·계정·계좌를 만들지 않았다.

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 3.1.1은 개발자 팁에 IAP 사용을 명시한다. 3.2.1(vii)의 개인 간 선물은 선택성·수령인 100% 전달 조건을 요구하며 디지털 콘텐츠/서비스와 연결된 선물은 IAP 대상이다. 이 게임 개발자 후원에 그 예외가 적용된다고 단정하지 않는다. 3.2.1(vi)의 승인 비영리 예외는 별개다.
- Apple 3.1.1(a)의 미국 storefront 외부 안내 예외를 한국·호주에 확대하지 않는다. 한국·호주 storefront에 대한 현재 앱의 링크 entitlement 보유 근거는 확인되지 않았다.
- [Apple 한국 외부결제](https://developer.apple.com/support/storekit-external-entitlement-kr/): 승인 entitlement·새 한국 전용 bundle/binary·PSP·필수 StoreKit API·고지·보고 조건이 있고 같은 앱의 Apple IAP와 병용 불가다. 일반 계좌 표시/복사로 충족한다고 보지 않는다.
- [Google Payments FAQ](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en): 수령인에게 팁 100% 전달, 디지털 콘텐츠·서비스(배지 포함) 없음이면 P2P로 보아 Play billing이 필수가 아니다. 기존 개인사업자 개발자 지원 및 계좌 이체가 이 예외에 해당하는지는 별도 확인이 필요하다. 모든 팁이 IAP 필수라는 기존 보드 설명은 지나치게 넓다.
- 같은 Google FAQ: 미국 대체결제/외부안내는 해당 프로그램 등록 조건, 한국 대체결제는 추가 요구사항과 서비스 수수료 조건이 있다.
- [Google 사용자 선택 결제](https://support.google.com/googleplay/android-developer/answer/12570971?hl=en): 호주는 대상 국가지만 게임은 해당 pilot의 호주 대상 앱에 포함되지 않는다. EEA·미국·일본의 게임 허용을 호주에 확대하지 않는다.

권장 다음 결정: iOS는 광고 제거 비소모성 상품과 별개의 무보상 팁 IAP 상품·금액·스토어 등록/심사 여부를 정한다. Android는 100% 직접 팁 예외 적용을 확인하거나 별도 정책에 맞는 결제 방식을 결정한다. 광고 제거와 합치거나 자선기부로 이름만 바꾸지 않는다. 심사에 기능을 숨기지 않는다.

## 배포 기준과 확인 한계

작업 기준은 원격 main `1565488ba471b33861352c3f3cdaf612b0d9dae0`, [운영 release v2026.10.04.21](https://github.com/tasddc1226/offside-football-simulator/releases/tag/v2026.10.04.21)이다. [한국 App Store 공개 페이지](https://apps.apple.com/kr/app/id6817463687)는 2026-10-04 확인 당시 1.0.2를 표시했다. 저장소 앱 설정은 1.1.0이며 공개 스토어 버전과 같다고 보지 않는다. Android 비공개 테스트 배포 버전 및 현재 스토어 제출/심사 상태는 확인하지 못했다. 공개 release의 OTA 완료와 실제 기기 수신은 별개다.

열린 앱 PR #475(영구결번 성능), #470(보상형 스카우트 광고)는 작업 기준에 병합되지 않았다. 원본 체크아웃의 변경과 Simulator/Xcode를 건드리지 않았다. 이번 변경은 웹 전용이며 앱 확장 완료를 주장하지 않는다.
