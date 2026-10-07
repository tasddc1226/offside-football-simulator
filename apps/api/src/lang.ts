import { TRANSLATED_LOCALES, type Locale, type TranslatedLocale } from '@offside/contracts/i18n';
import type { Context } from 'hono';
import type { AppEnv } from './env.js';

// T-11-106 서버가 만드는 화면 문구(업적·최초 기록·오류 안내 등)의 언어. 클라이언트가 영어·일본어일 때만 `?lang=en|ja`를
// 붙여 보낸다(T-11-140 일본어). 없거나 다른 값이면 한국어(지금 응답과 한 글자도 다르지 않다). 운영자가 쓴 공지·릴리즈 노트는
// 운영자가 저장한 번역을 고른다(T-11-146). 사용자가 쓴 글(댓글·채팅)과 저장된 이름(구단·리그·트로피)은 옮기지 않는다 — 이름은 화면이 옮긴다.
export type Lang = Locale;

export const reqLang = (c: Context<AppEnv>): Lang => {
  const q = c.req.query('lang');
  return TRANSLATED_LOCALES.includes(q as TranslatedLocale) ? (q as TranslatedLocale) : 'ko';
};

/** 엄격한 쿼리 스키마(strictObject)에 넘길 때 `lang`을 뺀 쿼리. */
export function queryWithoutLang(c: Context<AppEnv>): Record<string, string> {
  const rest = { ...c.req.query() };
  delete rest.lang;
  return rest;
}
