// T-11-102 화면 문구 언어. 고른 언어는 이 기기(saveKey)에 두고, 없으면 기기 언어를 따른다(core.AUTO_DETECT).
// 기기 언어는 네이티브 모듈 없이 Intl로 읽는다 — 옛 빌드에도 OTA로 그대로 보낼 수 있게.
// 영어·일본어 사전은 앱 번들에 함께 넣되 그 언어일 때만 읽는다(require — 한국어 시작 경로에서 평가하지 않는다).
// 바꾸면 부른 쪽(설정 화면)이 prefs.lang을 바꿔 _layout이 루트를 다시 그린다. store는 여기서 가져오지 않는다 —
// setup.ts가 저장소(MMKV)를 정하기 전에 store가 평가되면 테마 설정을 못 읽는다.
import { LOCALE_KEY, resolveLocale, setLocale, type Locale } from '@offside/app-core/i18n/core';
import type { en as EnDicts } from '@offside/app-core/i18n/en/index';
import type { ja as JaDicts } from '@offside/app-core/i18n/ja/index';
import { loadKey, saveKey } from '@offside/game/storage';

function deviceLocales(): string[] {
  try {
    return [Intl.DateTimeFormat().resolvedOptions().locale];
  } catch {
    return [];
  }
}

function applyLocale(locale: Locale) {
  if (locale === 'en') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { en } = require('@offside/app-core/i18n/en/index') as { en: typeof EnDicts };
    setLocale('en', en);
  } else if (locale === 'ja') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ja } = require('@offside/app-core/i18n/ja/index') as { ja: typeof JaDicts };
    setLocale('ja', ja);
  } else setLocale(locale);
}

/** 앱 시작 때 한 번(setup.ts). 이번 실행의 언어를 정해 등록한다. store의 prefs.lang이 getLocale()로 읽는다. */
export function bootLocale() {
  applyLocale(resolveLocale(loadKey(LOCALE_KEY), deviceLocales()));
}

/** 설정에서 언어를 고른다 — 저장하고 등록한다. 화면은 부른 쪽이 prefs.lang을 바꿔 다시 그린다. */
export function saveLocale(locale: Locale) {
  saveKey(LOCALE_KEY, locale);
  applyLocale(locale);
}
