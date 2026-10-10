# 앱 푸시 로고 정비와 스토어 심사 준비

2026-10-05 사용자 요청으로 T-11-099의 알림함·재방문 푸시 기능과 분리한 후속 작업이다. 추적 목록은 `push-logo-store-review`다. 2026-10-06 T-11-119(앱 1.1.1)에서 아래 1·2번을 적용했다. 스토어 문구·미리보기 이미지는 [`store-listing.md`](store-listing.md)에 있다.

## 확인한 현재 상태

- 최신 main `3abd99e9`과 T-11-099의 앱 아이콘 이미지·설정은 동일하다. 앱 아이콘 원본은 `apps/web/brand/build-icons.mjs`의 v7이다.
- iOS 앱 아이콘은 라이트·다크·틴트 모두 v7 파일을 가리킨다. 현재 실행 중인 iOS 18.1 시뮬레이터의 설치 앱 1.1.0(1)에서도 v7 앱 아이콘 리소스를 확인했다. 실제 알림 표시와 운영 사용자 설치 앱의 아이콘은 검증하지 않았다.
- Android 적응형 앱 아이콘은 v7이다. `expo-notifications` 플러그인에는 전용 알림 아이콘이 지정되지 않았다. 설치된 SDK 57의 알림 구현은 별도 설정이 없으면 앱 아이콘으로 대체한다.
- `apps/mobile/scripts/icons.mjs`는 이전 v6 SVG를 참조한다. 현재 이미지가 v6인 것은 아니지만, 해당 스크립트를 다시 실행하면 최신 이미지를 덮어쓸 수 있다.

## 별도 작업 범위

1. 최신 main의 별도 작업환경에서 v7 마크를 사용한 Android 알림용 흰색·투명 PNG를 준비하고 `expo-notifications`의 `icon`에 지정한다. 96×96 규격과 작은 크기의 식별성을 확인한다.
2. v6 생성 경로를 정리하고 v7 생성기를 단일 원본으로 사용한다. 재생성 후 iOS·Android 앱 아이콘과 스플래시가 최신 브랜드를 유지하는지 확인한다.
3. 새 릴리즈 바이너리에서 Android 상태 표시줄·알림 카드, iOS 알림 카드의 아이콘을 확인한다. 수동 테스트 푸시로 앱 종료·백그라운드·포그라운드 표시와 탭 이동을 실제 기기에서 검증한다.
4. 현재 스토어 버전/빌드 번호·배포 트랙과 runtime fingerprint를 확인하고 새 네이티브 빌드 및 제출 자료를 준비한다. 버전·빌드 번호는 이 문서에서 선점하지 않는다.
5. Android 알림 아이콘 변경은 새 네이티브 빌드에 포함한다. iOS는 이미 v7 앱 아이콘을 쓰므로, 추가 네이티브 변경이 없다면 로고 때문에만 새 심사가 필요한 것은 아니다. iOS 제출 필요성은 실제 변경 범위로 결정한다.

## T-11-119 적용 (앱 1.1.1, 2026-10-06)

- `build-icons.mjs`가 `notification-icon.png`(96×96, 흰색·투명)를 만든다. 테마 아이콘(단색)과 같은 OFF + 오프사이드 라인 모양이고, 24dp에서도 OFF가 읽히는지 축소본으로 확인했다.
- `app.json`의 `expo-notifications` 플러그인에 `icon`과 `color`(#E8412C, 브랜드 라인색)를 지정했다. prebuild 결과 `drawable-*/notification_icon.png`와 `default_notification_icon`·`default_notification_color` 메타데이터가 들어간다.
- v6 SVG를 읽던 `apps/mobile/scripts/icons.mjs`를 지웠다(원본 SVG가 이미 없어 실행해도 실패했다).
- 다국어(T-11-102·106)에 맞춰 앱 이름을 기기 언어로 나눴다: 한국어 `오프사이드`, 그 밖의 언어 `OFFSIDE`(`apps/mobile/locales/`). 사진 권한 문구도 두 벌이다. `expo.name`이 `OFFSIDE`가 되면서 iOS 네이티브 타깃 이름이 바뀌지만 번들 ID·키체인 서비스(`expo-secure-store` 기본값 `app`)는 그대로라 세션·세이브는 유지된다.
- iOS 알림은 앱 아이콘을 쓰므로 1.1.1 빌드의 v7 아이콘이 그대로 나온다.
- 버전은 `1.1.1`. fingerprint가 바뀌므로 1.1.0 앱에는 이후 OTA가 가지 않는다 — 두 스토어에 1.1.1이 올라간 뒤 `APP_VERSIONS`의 `min`을 올린다.

## T-11-099와의 분리

- 알림함·7일 보류·개인 발송 큐·재방문 트리거의 PR과 아이콘/스토어 빌드 PR을 분리한다.
- T-11-099에는 새 네이티브 의존성이 없다. 기존 스토어 앱에 기능을 전달할 수 있는지는 운영 도입 때 해당 앱의 runtime/OTA 호환성을 따로 확인한다.
- 로고 후속 작업 때문에 T-11-099에서 앱 버전·EAS 설정·runtime을 변경하지 않는다.
- 추적 목록 등록은 스토어 심사 제출을 의미하지 않는다. 실제 빌드·제출·승인·출시는 각각 증거를 남긴다.

공식 규격과 빌드 적용 조건: [Expo SDK 57 알림 설정](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#app-config), [Android 알림 아이콘과 색상](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#custom-notification-icon-and-colors).
