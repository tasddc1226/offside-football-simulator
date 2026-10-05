import type { Context } from 'hono';
import type { AppEnv } from './env.js';

// T-11-106 서버가 만드는 화면 문구(업적·최초 기록·오류 안내 등)의 언어. 클라이언트가 영어일 때만 `?lang=en`을 붙여
// 보낸다. 없거나 다른 값이면 한국어(지금 응답과 한 글자도 다르지 않다). 사용자·운영자가 쓴 글(게시판·공지·채팅)과
// 저장된 이름(구단·리그·트로피)은 옮기지 않는다 — 화면이 그리는 쪽에서 옮긴다.
export type Lang = 'ko' | 'en';

export const reqLang = (c: Context<AppEnv>): Lang => (c.req.query('lang') === 'en' ? 'en' : 'ko');

/** 엄격한 쿼리 스키마(strictObject)에 넘길 때 `lang`을 뺀 쿼리. */
export function queryWithoutLang(c: Context<AppEnv>): Record<string, string> {
  const rest = { ...c.req.query() };
  delete rest.lang;
  return rest;
}
