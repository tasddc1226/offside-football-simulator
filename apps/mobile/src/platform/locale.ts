// T-11-102 화면 문구 언어. 고른 언어는 이 기기(saveKey)에 두고, 없으면 기기 언어를 따른다(core.AUTO_DETECT).
// 기기 언어는 네이티브 모듈 없이 Intl로 읽는다 — 옛 빌드에도 OTA로 그대로 보낼 수 있게.
// 영어 사전은 앱 번들에 함께 넣는다(웹처럼 나눠 받을 이유가 없다). 바꾸면 루트를 다시 그린다(_layout의 key).
import { LOCALE_KEY, resolveLocale, setLocale, type Locale } from '@offside/app-core/i18n/core';
import { en } from '@offside/app-core/i18n/en/index';
import { loadKey, saveKey } from '@offside/game/season';

function deviceLocales(): string[] {
  try {
    return [Intl.DateTimeFormat().resolvedOptions().locale];
  } catch {
    return [];
  }
}

export function applyLocale(locale: Locale) {
  setLocale(locale, locale === 'en' ? en : undefined);
}

/** 앱 시작 때 한 번(setup.ts). 이번 실행의 언어를 정해 등록하고 돌려준다. */
export function bootLocale(): Locale {
  const locale = resolveLocale(loadKey(LOCALE_KEY), deviceLocales());
  applyLocale(locale);
  return locale;
}

/** 설정에서 언어를 고른다 — 저장하고 등록한다. 화면은 부른 쪽이 prefs.lang을 바꿔 다시 그린다. */
export function saveLocale(locale: Locale) {
  saveKey(LOCALE_KEY, locale);
  applyLocale(locale);
}
