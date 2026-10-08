# 스토어 미리보기 이미지

App Store(6.9", 1320×2868)·Google Play(1080×2160) 스크린샷과 Play 그래픽 이미지(1024×500)를 만든다.
문구는 `frames.json`(언어별 제목·부제, `*강조*`는 라임색), 등록 문구 정본은 [`docs/operations/store-listing.md`](../../../docs/operations/store-listing.md)다.

1. 실제 앱 화면을 `shots/<ko|en|ja>/01.png`~`07.png`로 둔다. iPhone 17 Pro Max(iOS 26) 시뮬레이터의 Release 빌드를
   스테이징 API로 띄우고 `xcrun simctl io <기기> screenshot`으로 찍는다(상태 표시줄은 `simctl status_bar … override --time 9:41`).
   운영 데이터가 섞이지 않게 운영 API로 띄우지 않는다.
2. `PW_FROM=$PWD/../../web/package.json node render.mjs [ko|en|ja] [ios|android] [장 번호]` → `out/<ios|android>/<lang>/0N.png`
3. `PW_FROM=$PWD/../../web/package.json node feature.mjs` → `out/android/<lang>/feature-graphic.png`

`shots/`·`out/`은 커밋하지 않는다(용량). 렌더러는 Google Fonts·jsDelivr에서 글꼴을 받는다.
