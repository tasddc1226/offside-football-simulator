// T-11-279 한국어 조사 보정. 구단명·능력치 라벨처럼 받침이 갈리는 값 뒤에 조사를 붙일 때 쓴다.
// app-core/format.ts의 같은 함수를 game 패키지에서도 쓸 수 있게 옮겨 두었다(의존 방향상 app-core를 가져올 수 없다).
// 숫자로 끝나면 한국어 읽기(영·일·이·삼·사·오·육·칠·팔·구)의 받침을 쓴다: ㅇ(21)·ㄹ(8)·ㅁ(16)·ㄱ(1).
const DIGIT_JONG = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];

/** 마지막 글자의 종성 번호(0 = 받침 없음). 한글·숫자가 아니면 -1. */
export function jongOf(word: string): number {
  const last = word.charCodeAt(word.length - 1);
  if (last >= 48 && last <= 57) return DIGIT_JONG[last - 48]!;
  const code = last - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : -1;
}

/** 이름 뒤에 '로/으로'를 붙인다. 받침이 없거나 ㄹ이면 '로', 한글이 아니면 '(으)로'. */
export function withRo(name: string): string {
  const jong = jongOf(name);
  if (jong < 0) return `${name}(으)로`;
  return `${name}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}

/** 받침이 있으면 '이', 없으면(한글이 아니어도) '가'. */
export const iGa = (word: string): string => (jongOf(word) > 0 ? '이' : '가');
/** 받침이 있으면 '은', 없으면(한글이 아니어도) '는'. */
export const eunNeun = (word: string): string => (jongOf(word) > 0 ? '은' : '는');
/** 받침이 있으면 '과', 없으면(한글이 아니어도) '와'. */
export const waGwa = (word: string): string => (jongOf(word) > 0 ? '과' : '와');
