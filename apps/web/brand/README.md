# OFFSIDE brand asset

시즌 1(2026-10-06)부터 쓰는 v7 아이콘(T-11-073): 기울어진 OFF를 빨간 오프사이드 라인이 가르고 라인 오른쪽이 한 칸 앞서 있다.
배경에는 하얀 센터서클과 하프라인을 깐다. 라이트(라임 #D6F24A 배경)와 다크(#0F2219 배경) 두 벌이다.

`build-icons.mjs`가 원본이다. 도형을 고치면 `node apps/web/brand/build-icons.mjs`로 앱 PNG를 다시 만들어 커밋한다.
웹은 빌드 때 seo.mjs가 같은 `brandSvg()`로 파비콘, Apple 터치 아이콘, 매니페스트(maskable 포함) 아이콘, Open Graph 카드를 만든다.

- `apps/mobile/assets/images`: iOS 라이트·다크·틴트 아이콘, 안드로이드 적응형 아이콘(전경·배경·단색), 라이트·다크 스플래시, Expo 웹 파비콘.
- 상단 브랜드 줄 배지: `apps/web/public/brand/offside-icon-v7-*64.png`, `apps/mobile/assets/brand/offside-icon-v7-*180.png`.

`public/brand/offside-flag-v6-*.png`는 AdSense 동의 메시지 로고가 가리키고 있어 남겨 둔다.

`site.webmanifest` supplies install icon metadata only. It does not claim or provide offline/PWA support.
