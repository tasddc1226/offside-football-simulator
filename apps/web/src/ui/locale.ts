// T-11-102 화면 문구 언어. 고른 언어는 이 기기(localStorage)에 두고, 바꾸면 새로고침해 처음부터 그 언어로 그린다.
// 한국어는 추가로 불러올 것이 없다. 영어 사전은 영어 사용자에게만 지연 청크로 받는다(첫 화면 예산 밖).
import { LOCALE_KEY, resolveLocale, setLocale, type Locale } from '@offside/app-core/i18n/core';

function savedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

/** 이번 방문의 언어(고른 값 → 브라우저 언어). */
export function bootLocale(): Locale {
  const device =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return resolveLocale(savedLocale(), device);
}

/** 그 언어의 사전을 등록하고 문서 언어를 맞춘다. 첫 렌더 전에 끝나야 한다. */
export async function applyLocale(locale: Locale): Promise<void> {
  if (locale === 'en') {
    const { en } = await import('@offside/app-core/i18n/en/index');
    setLocale('en', en);
  } else setLocale(locale);
  document.documentElement.lang = locale;
}

/** 설정에서 언어를 고른다 — 저장하고 새로고침한다. */
export function changeLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // 저장 공간을 못 쓰면 이번 방문에만 바꾼다.
    void applyLocale(locale);
    return;
  }
  location.reload();
}
