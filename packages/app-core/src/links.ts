// 여러 화면이 같이 쓰는 바깥 링크만 둔다 — 디시 갤러리는 웹·앱 홈 타일과 푸터가 같이 쓴다.
// T-11-016 안드로이드 비공개 테스터 모집(구글 폼)은 웹 홈과 안드로이드 앱 홈 타일이 쓴다.
export const DC_GALLERY_URL = 'https://gall.dcinside.com/mgallery/board/lists?id=offsidegame';
export const ANDROID_TESTER_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdDeAm0SoOh4wnYRcmpILYcB02yWlKaIziSRauEtnn5z1bSBA/viewform';
/** T-11-092 iOS 앱(App Store). 웹에서 앱으로 이어 주는 안내(스마트 배너 · 홈 타일 · 설정)가 쓴다. */
const IOS_APP_ID = '6817463687'; // apps/web/index.html apple-itunes-app 메타에도 같은 값
export const IOS_APP_STORE_URL = `https://apps.apple.com/kr/app/id${IOS_APP_ID}`;
