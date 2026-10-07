// T-11-146 사용자가 쓴 글(댓글·채팅)의 "번역 보기"(웹·앱 공통). 누를 때만 서버에 묻고, 받은 번역은 이 세션 동안 기억한다.
import { getLocale, type Locale } from '@offside/contracts/i18n';
import { translate } from './api/translate.js';
import type { ApiResult } from './api/client.js';

// i18n-ignore: 한글 글자 범위
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿]/;
const LATIN = /[a-z]/i;

/** 지금 언어와 다른 글자로 쓴 글에만 버튼을 단다(같은 언어 글·이모지·숫자만 있는 글은 부르지 않는다). */
export function canTranslate(text: string, locale: Locale = getLocale()): boolean {
  const hangul = HANGUL.test(text);
  const japanese = KANA.test(text) || HAN.test(text);
  if (locale === 'ko') return !hangul && (japanese || LATIN.test(text));
  if (locale === 'ja') return hangul || (!japanese && LATIN.test(text));
  return hangul || japanese;
}

const memo = new Map<string, Promise<ApiResult<string>>>();

/** 같은 글은 한 번만 묻는다(동시에 눌러도 하나로). 실패는 기억하지 않는다. */
export function translateUserText(
  text: string,
  to: Locale = getLocale(),
): Promise<ApiResult<string>> {
  const key = `${to}\n${text}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const result = translate(text, to).then((r) =>
    r.ok ? { ok: true as const, data: r.data.text } : r,
  );
  memo.set(key, result);
  void result.then((r) => {
    if (!r.ok) memo.delete(key);
  });
  return result;
}
