// ───────── 화면·게임 문구 다국어(T-11-102, 게임 엔진도 쓰도록 T-11-106에서 contracts로) ─────────
// 한국어 원문은 화면별 네임스페이스(i18n/ko/<화면>.ts)에 두고, 쓰는 화면이 그 파일을 import한다 — 문구가 지금처럼
// 그 화면의 청크에 남는다. 영어는 i18n/en/<화면>.ts에 같은 키로 두고 i18n/en/index.ts가 묶어 영어 사용자에게만
// 불러온다(웹은 지연 청크, 앱은 정적 import). 값은 문자열이거나, 숫자·이름이 끼는 문장이면 (p) => 문자열 함수다.
//
// 읽을 때마다 지금 언어로 고른다(getter). 반응성은 없다 — 언어를 바꾸면 웹은 새로고침, 앱은 루트를 다시 그린다.
// 그래서 모듈 최상위에서 문구를 꺼내 상수로 굳히지 않는다(화면을 그릴 때·함수 안에서 읽는다).

export type Locale = 'ko' | 'en';
export const LOCALES: readonly Locale[] = ['ko', 'en'];
/** 설정 화면에 보이는 언어 이름 — 각 언어 자기 표기라 번역하지 않는다. */
export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English' };
/** 이 기기에 고른 언어를 저장하는 키(웹 localStorage · 앱 saveKey). 없으면 기기 언어를 따른다. */
export const LOCALE_KEY = 'ft_lang';

/**
 * 기기 언어를 따라 자동으로 영어를 켤지. 1단계(화면 문구)만으로는 이벤트·기록이 한국어로 섞여 보여 껐다가,
 * 게임 내용 번역(2단계, T-11-106)과 함께 켰다 — 고른 언어가 없으면 기기 첫 언어가 한국어가 아닐 때 영어다.
 */
export const AUTO_DETECT = true;

type Msg = string | ((p: never) => string);
export type Dict = Record<string, Msg>;
/** 영어 사전의 모양 — 한국어 네임스페이스와 키가 같고, 함수 문구는 같은 인자를 받는다. 빠진 키는 타입 오류다. */
export type Translation<D extends Dict> = { [K in keyof D]: D[K] extends string ? string : D[K] };

let current: Locale = 'ko';
const overrides = new Map<string, Dict>();
const sources = new Map<string, Dict>();

/**
 * 네임스페이스를 만든다. 돌려받은 객체의 키를 읽으면 지금 언어의 문구가 나온다(영어에 없으면 한국어).
 * name은 앱 전체에서 하나뿐이어야 한다(en/index.ts의 키와 같다).
 */
export function ns<D extends Dict>(name: string, ko: D): D {
  if (sources.has(name)) throw new Error(`i18n namespace duplicated: ${name}`);
  sources.set(name, ko);
  const out = {} as D;
  for (const key of Object.keys(ko)) {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => overrides.get(name)?.[key] ?? ko[key],
    });
  }
  return out;
}

/** 언어를 바꾼다. 영어면 en/index.ts의 사전 묶음({ 네임스페이스: 사전 })을 함께 넘긴다. */
export function setLocale(locale: Locale, dicts?: Record<string, object>): void {
  current = locale;
  overrides.clear();
  if (locale !== 'ko' && dicts)
    for (const [name, d] of Object.entries(dicts)) overrides.set(name, d as Dict);
}

export const getLocale = (): Locale => current;

/** Intl·toLocaleString에 넘길 언어 태그(숫자·날짜 서식). */
export const intlLocale = (): string => (current === 'en' ? 'en-US' : 'ko-KR');

/**
 * 네임스페이스가 아닌 언어별 자료(T-11-106 — 게임의 저장된 이름 대응표 `__names`, 이벤트 문구 `__events` 등).
 * 한국어거나 그 언어 묶음에 없으면 undefined다. 이름은 `__`로 시작한다(ns 이름과 겹치지 않게).
 */
export const localeData = <T>(name: string): T | undefined =>
  current === 'ko' ? undefined : (overrides.get(name) as T | undefined);

/** 지금까지 import된 한국어 네임스페이스(검사용). */
export const koSources = (): ReadonlyMap<string, Dict> => sources;

const isLocale = (v: unknown): v is Locale => v === 'ko' || v === 'en';

/**
 * 이번 실행의 언어. 고른 값이 있으면 그것, 없으면 기기 언어 목록의 첫 항목이 한국어면 한국어, 아니면 영어
 * (AUTO_DETECT가 꺼져 있으면 한국어).
 */
export function resolveLocale(saved: unknown, device: readonly string[]): Locale {
  if (isLocale(saved)) return saved;
  if (!AUTO_DETECT) return 'ko';
  const first = device.find(Boolean)?.toLowerCase();
  return !first || first.startsWith('ko') ? 'ko' : 'en';
}
