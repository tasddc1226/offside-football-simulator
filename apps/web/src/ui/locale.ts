// T-11-102 화면 문구 언어. 고른 언어는 이 기기(saveKey, 앱과 같은 형식)에 두고, 바꾸면 새로고침해 처음부터 그 언어로 그린다.
// 한국어는 추가로 불러올 것이 없다. 영어·일본어 사전은 그 언어 사용자에게만 지연 청크로 받는다(첫 화면 예산 밖).
import {
  deviceLocales,
  LOCALE_KEY,
  resolveLocale,
  setLocale,
  type Locale,
} from '@offside/app-core/i18n/core';
import { loadKey, saveKey } from '@offside/game/storage';

// 한국어가 아닌 사전은 그 언어일 때만 지연 청크로.
const LOADERS: Partial<Record<Locale, () => Promise<Parameters<typeof setLocale>[1]>>> = {
  en: () => import('@offside/app-core/i18n/en/index').then((m) => m.en),
  ja: () => import('@offside/app-core/i18n/ja/index').then((m) => m.ja),
};

/** 이번 방문의 언어(고른 값 → 브라우저 언어). */
export function bootLocale(): Locale {
  return resolveLocale(loadKey(LOCALE_KEY), deviceLocales());
}

/** 그 언어의 사전을 등록하고 문서 언어를 맞춘다. 첫 렌더 전에 끝나야 한다. */
export async function applyLocale(locale: Locale): Promise<void> {
  const load = LOADERS[locale];
  setLocale(locale, load ? await load() : undefined);
  document.documentElement.lang = locale;
}

/** 설정에서 언어를 고른다 — 저장하고 새로고침한다(저장 공간을 못 쓰면 바꾸지 않는다). */
export function changeLocale(locale: Locale) {
  if (saveKey(LOCALE_KEY, locale)) location.reload();
}
