import { CUP_DIVISIONS, type CupDef } from '@offside/contracts/cup';
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
  cup.division
    ? cupKo('titleDivision', {
        season: cup.season,
        edition: cup.edition,
        division: cupKo(cup.division),
      })
    : cupKo('title', { season: cup.season, edition: cup.edition });

/** 자리 안에 다시 컵 문구가 들어가는 자리(대회 이름·라운드·결과). 팀 이름은 구단주가 지은 이름이라 옮기지 않는다. */
const NESTED = new Set(['cup', 'round', 'result', 'stage', 'division']);
// T-11-514 문구를 다듬기 전에 알림함에 저장된 옛 한국어 틀. 옛 알림도 같은 키로 옮긴다.
const LEGACY_KO: [CupTextKey, string][] = [
  ['completeTitle', '{cup}이 끝났어요'], // i18n-ignore: 옛 알림 원문
  ['cancelledTitle', '{cup}이 열리지 않아요'], // i18n-ignore: 옛 알림 원문
  ['outTitle', '{cup}을 마쳤어요'], // i18n-ignore: 옛 알림 원문
  ['movedUpBody', '조 추첨 때 팀 OVR이 신청한 구간 상한보다 높아 윗 구간으로 옮겼어요.'], // i18n-ignore: 옛 알림 원문
  ['mergedBody', '신청한 구간 팀이 {n}팀보다 적어 윗 구간과 함께 치러요.'], // i18n-ignore: 옛 알림 원문
  ['drawBody', '{team}은(는) {group}조예요. 첫 경기는 오늘 {time}에 열려요.'], // i18n-ignore: 옛 알림 원문
  ['leaguePlacedBody', '{team}은(는) {tier}부 {league}리그예요. 1라운드는 오늘 {time}에 열려요.'], // i18n-ignore: 옛 알림 원문
];
const SENTENCES = [
  ...(Object.keys(CUP_KO) as CupTextKey[]).map((key) => [key, CUP_KO[key]] as const),
  ...LEGACY_KO,
].map(([key, ko]) => {
  const names: string[] = [];
  const src = ko
    .split(/(\{\w+\})/)
    .map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(m[1]!);
      // T-11-410 구간 이름은 세 낱말 중 하나다(아니면 '{cup} 조 추첨 결과'가 구간 대회 이름으로 잡힌다).
      return m[1] === 'division' ? `(${CUP_DIVISIONS.map((d) => CUP_KO[d]).join('|')})` : '(.+?)';
    })
    .join('');
  return { key, names, re: new RegExp(`^${src}$`) };
});

/** 한국어 컵 문구를 요청 언어로. 컵 문구가 아니면 undefined. */
export function cupText(ko: string, lang: Lang): string | undefined {
  if (lang === 'ko') return ko;
  // T-11-279 전에 저장된 경기 알림 제목은 라운드와 결과를 ' — '로 이었다. 지금 틀로 바꿔 다시 맞춘다.
  if (ko.includes(' — ')) return cupText(ko.replace(' — ', ' · '), lang);
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
