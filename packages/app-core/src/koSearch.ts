// 한글 검색(T-10-099) — 국적 고르기(NationPicker, 선수 생성 지연 청크)만 쓴다. 첫 화면 번들에 드는 format.ts와 떼어 둔다.
// 초성(ㅂㄹㅈ)과 타이핑 중인 마지막 글자(브랒 → 브라질)도 맞는 것으로 본다.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
// 홑받침 번호 → 같은 소리의 초성 번호. 겹받침은 다음 글자로 넘기지 않는다.
const JONG_CHO: Record<number, number> = {
  1: 0,
  2: 1,
  4: 2,
  7: 3,
  8: 5,
  16: 6,
  17: 7,
  19: 9,
  20: 10,
  21: 11,
  22: 12,
  23: 14,
  24: 15,
  25: 16,
  26: 17,
  27: 18,
};

const syl = (c: string): number => {
  const n = c.charCodeAt(0) - 0xac00;
  return n >= 0 && n <= 11171 ? n : -1;
};
const choOf = (c: string): number => {
  const n = syl(c);
  return n < 0 ? -1 : Math.floor(n / 588);
};

/** 검색어 한 글자 q가 이름의 name[i]에 맞는가. last면 받침이 다음 글자의 초성으로 넘어가는 경우도 본다. */
function charMatches(q: string, name: string, i: number, last: boolean): boolean {
  const c = name[i]!;
  if (q === c) return true;
  const qc = CHO.indexOf(q);
  if (qc >= 0) return choOf(c) === qc;
  const qs = syl(q);
  const cs = syl(c);
  if (!last || qs < 0 || cs < 0 || Math.floor(qs / 28) !== Math.floor(cs / 28)) return false;
  const qj = qs % 28;
  // '브' → 브·블·븐… / '블' → 브 + 다음 글자 초성 ㄹ(브라질)
  if (qj === 0) return true;
  const next = name[i + 1];
  return cs % 28 === 0 && next !== undefined && choOf(next) === JONG_CHO[qj];
}

/** 이름에서 한글 검색어가 시작하는 위치(띄어쓰기·대소문자 무시). 없으면 -1, 빈 검색어는 0. */
export function koMatchAt(name: string, query: string): number {
  const q = query.replace(/\s+/g, '').toLowerCase();
  const n = name.replace(/\s+/g, '').toLowerCase();
  outer: for (let s = 0; s + q.length <= n.length; s++) {
    for (let k = 0; k < q.length; k++)
      if (!charMatches(q[k]!, n, s + k, k === q.length - 1)) continue outer;
    return s;
  }
  return -1;
}
