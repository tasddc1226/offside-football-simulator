import type { CupDef } from '@offside/contracts/cup';
import { CUP_EN } from './i18n/en/cup.js';
import { CUP_JA } from './i18n/ja/cup.js';
import { CUP_KO, type CupTextKey } from './i18n/ko/cup.js';
import type { Lang } from './lang.js';

// T-11-145 오프사이드 컵 서버 문구. 오류·알림은 다른 서버 문장처럼 한국어로 만들고(알림함에 한국어로 저장된다),
// 응답을 만들 때 errorText·push/text가 이 표로 요청 언어로 바꾼다.
const TABLES: Record<Lang, Record<CupTextKey, string>> = { ko: CUP_KO, en: CUP_EN, ja: CUP_JA };

const fill = (t: string, vars: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** 한국어 컵 문구. */
export const cupKo = (key: CupTextKey, vars: Record<string, string | number> = {}) =>
  fill(CUP_KO[key], vars);

export const cupTitle = (cup: CupDef) =>
  cupKo('title', { season: cup.season, edition: cup.edition });

/** 자리 안에 다시 컵 문구가 들어가는 자리(대회 이름·라운드·결과). 팀 이름은 구단주가 지은 이름이라 옮기지 않는다. */
const NESTED = new Set(['cup', 'round', 'result', 'stage']);
const SENTENCES = (Object.keys(CUP_KO) as CupTextKey[]).map((key) => {
  const names: string[] = [];
  const src = CUP_KO[key]
    .split(/(\{\w+\})/)
    .map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(m[1]!);
      return '(.+?)';
    })
    .join('');
  return { key, names, re: new RegExp(`^${src}$`) };
});

/** 한국어 컵 문구를 요청 언어로. 컵 문구가 아니면 undefined. */
export function cupText(ko: string, lang: Lang): string | undefined {
  if (lang === 'ko') return ko;
  for (const { key, names, re } of SENTENCES) {
    const m = re.exec(ko);
    if (!m) continue;
    const vars = Object.fromEntries(
      names.map((n, i) => {
        const v = m[i + 1]!;
        return [n, NESTED.has(n) ? (cupText(v, lang) ?? v) : v];
      }),
    );
    return fill(TABLES[lang][key], vars);
  }
  return undefined;
}
