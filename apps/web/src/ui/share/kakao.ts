// T-11-621 카카오톡 카드 공유(웹). 공유 화면에서만 SDK를 불러온다. 키(VITE_KAKAO_JS_KEY, 등록 도메인에서만 쓰이는 공개 키)가
// 없으면 버튼을 그리지 않는다. 한국어 화면에만 보인다.
import { getLocale } from '@offside/app-core/i18n/core';

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
const SDK_INTEGRITY = 'sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka';

type KakaoLink = { mobileWebUrl: string; webUrl: string };
export type KakaoFeed = {
  objectType: 'feed';
  content: { title: string; description: string; imageUrl: string; link: KakaoLink };
  buttons: { title: string; link: KakaoLink }[];
};
type KakaoSdk = {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(feed: KakaoFeed): void };
};

export class KakaoShareError extends Error {}

const key = (): string => import.meta.env.VITE_KAKAO_JS_KEY ?? '';

export const kakaoAvailable = (): boolean => !!key() && getLocale() === 'ko';

export function kakaoFeed(p: {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  button: string;
}): KakaoFeed {
  const link = { mobileWebUrl: p.url, webUrl: p.url };
  return {
    objectType: 'feed',
    content: { title: p.title, description: p.description, imageUrl: p.imageUrl, link },
    buttons: [{ title: p.button, link }],
  };
}

let sdk: Promise<KakaoSdk> | null = null;
function loadSdk(): Promise<KakaoSdk> {
  sdk ??= new Promise<KakaoSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const kakao = (window as unknown as { Kakao?: KakaoSdk }).Kakao;
      if (!kakao) return reject(new KakaoShareError('sdk'));
      if (!kakao.isInitialized()) kakao.init(key());
      resolve(kakao);
    };
    script.onerror = () => reject(new KakaoShareError('load'));
    document.head.append(script);
  }).catch((e: unknown) => {
    sdk = null; // 실패는 기억하지 않는다. 다음 누름에서 다시 불러온다.
    throw e;
  });
  return sdk;
}

/** 공유 화면이 열릴 때 미리 불러 둔다(누른 뒤 받으면 PC 브라우저가 팝업을 막는다). */
export function preloadKakao() {
  loadSdk().catch(() => {});
}

export async function shareKakao(p: Parameters<typeof kakaoFeed>[0]) {
  try {
    (await loadSdk()).Share.sendDefault(kakaoFeed(p));
  } catch {
    throw new KakaoShareError('send');
  }
}
