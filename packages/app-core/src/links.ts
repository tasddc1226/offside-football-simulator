import { getLocale } from '@offside/contracts/i18n';

// 여러 화면이 같이 쓰는 바깥 링크만 둔다 — 디시 갤러리는 웹·앱 홈 타일과 푸터가 같이 쓴다.
export const DC_GALLERY_URL = 'https://gall.dcinside.com/mgallery/board/lists?id=offsidegame';
/** T-11-092 iOS 앱(App Store) · T-11-095 Android 앱(Google Play). 웹에서 앱으로 이어 주는 안내(스마트 배너 · 홈 타일 · 설정)가 쓴다. */
const IOS_APP_ID = '6817463687'; // apps/web/index.html apple-itunes-app 메타에도 같은 값
export const IOS_APP_STORE_URL = `https://apps.apple.com/kr/app/id${IOS_APP_ID}`;
// 같은 스토어 주소가 apps/api/src/routes/appVersion.ts(업데이트 안내) · apps/mobile/src/platform/review.ts(리뷰)에도 있다.
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.offsidelab.app';

/** T-11-588 게임 가이드 · FAQ는 언어마다 주소가 있다(/en/guide/ 등, apps/web/scripts/seo.mjs GUIDE_LOCALES). 다른 공개 문서는 한국어 한 벌. */
export const publicDocPath = (path: '/guide/' | '/faq/', lang = getLocale()) =>
  lang === 'ko' ? path : `/${lang}${path}`;

/** T-11-588 은퇴 커리어 공유 링크. 한국어가 아니면 ?lang=을 붙여 미리보기(웹 워커 share-meta.ts)를 그 언어로 쓴다. */
export const careerShareUrl = (origin: string, careerId: string, lang = getLocale()) =>
  `${origin}/career/${careerId}${lang === 'ko' ? '' : `?lang=${lang}`}`;
