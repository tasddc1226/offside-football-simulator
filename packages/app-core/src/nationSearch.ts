// ───────── 국적 고르기 목록·검색 (웹·앱 공용, T-10-099 · 공용 T-11-044) ─────────
// 연맹별로 묶어 가나다순, 대한민국은 맨 위. 검색은 한글·초성으로 찾는다(koSearch).
import { CONFEDS, CONF_ORDER, DEFAULT_NATION, NATIONS } from '@offside/contracts/nations';
import { KR, type Nation } from '@offside/game/nation';
import { tn } from '@offside/game/i18n/names';
import { getLocale } from './i18n/core.js';
import { createText as L } from './i18n/ko/create.js';
import { koMatchAt } from './koSearch.js';

export interface NationGroup {
  key: string;
  label: string;
  /** 앱 SectionList가 이 이름을 그대로 쓴다. */
  data: Nation[];
}

const byKo = new Intl.Collator('ko').compare;
const byEn = new Intl.Collator('en').compare;

/** 연맹별 묶음. 정렬은 그 언어의 이름순(영어는 A-Z). 연맹 이름은 읽을 때 지금 언어로. */
function build(en: boolean): NationGroup[] {
  const cmp = en
    ? (a: Nation, b: Nation) => byEn(tn(a.ko), tn(b.ko))
    : (a: Nation, b: Nation) => byKo(a.ko, b.ko);
  return [
    {
      key: 'KR',
      // 모듈이 불릴 때가 아니라 읽을 때 지금 언어로(언어 등록 전에 굳지 않게).
      get label() {
        return L.groupBase;
      },
      data: [KR],
    },
    ...CONF_ORDER.map((conf) => ({
      key: conf,
      get label() {
        return `${tn(CONFEDS[conf].region)} (${conf})`;
      },
      data: NATIONS.filter((n) => n.conf === conf && n.code !== DEFAULT_NATION).sort(cmp),
    })),
  ];
}

export const NATION_GROUPS: NationGroup[] = build(false);
let enGroups: NationGroup[] | undefined;
const groupsNow = (): NationGroup[] =>
  getLocale() === 'en' ? (enGroups ??= build(true)) : NATION_GROUPS;

/** 검색어가 없으면 연맹 묶음, 있으면 한 목록으로 — 이름이 검색어로 시작하는 나라부터. 없으면 빈 배열.
 * 영어일 때는 영어 이름(대소문자 무시)으로 찾고, 한글 검색어도 그대로 통한다. */
export function nationGroups(query: string | null): NationGroup[] {
  if (!query) return groupsNow();
  const en = getLocale() === 'en';
  const q = query.trim().toLowerCase();
  const at = (n: Nation): number => {
    const ko = koMatchAt(n.ko, query);
    if (!en) return ko;
    const e = tn(n.ko).toLowerCase().indexOf(q);
    return ko >= 0 && (e < 0 || ko < e) ? ko : e;
  };
  const cmp = en
    ? (a: Nation, b: Nation) => byEn(tn(a.ko), tn(b.ko))
    : (a: Nation, b: Nation) => byKo(a.ko, b.ko);
  const hits = NATIONS.map((n) => ({ n, at: at(n) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at || cmp(a.n, b.n));
  return hits.length
    ? [{ key: 'hits', label: L.groupHits({ n: hits.length }), data: hits.map((h) => h.n) }]
    : [];
}
