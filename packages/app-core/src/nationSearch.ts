// ───────── 국적 고르기 목록·검색 (웹·앱 공용, T-10-099 · 공용 T-11-044) ─────────
// 연맹별로 묶어 가나다순, 대한민국은 맨 위. 검색은 한글·초성으로 찾는다(koSearch).
import { CONFEDS, CONF_ORDER, DEFAULT_NATION, NATIONS } from '@offside/contracts/nations';
import { KR, type Nation } from '@offside/game/nation';
import { koMatchAt } from './koSearch.js';

export interface NationGroup {
  key: string;
  label: string;
  /** 앱 SectionList가 이 이름을 그대로 쓴다. */
  data: Nation[];
}

const byKo = new Intl.Collator('ko').compare;

export const NATION_GROUPS: NationGroup[] = [
  { key: 'KR', label: '기본', data: [KR] },
  ...CONF_ORDER.map((conf) => ({
    key: conf,
    label: `${CONFEDS[conf].region} (${conf})`,
    data: NATIONS.filter((n) => n.conf === conf && n.code !== DEFAULT_NATION).sort((a, b) =>
      byKo(a.ko, b.ko),
    ),
  })),
];

/** 검색어가 없으면 연맹 묶음, 있으면 한 목록으로 — 이름이 검색어로 시작하는 나라부터. 없으면 빈 배열. */
export function nationGroups(query: string | null): NationGroup[] {
  if (!query) return NATION_GROUPS;
  const hits = NATIONS.map((n) => ({ n, at: koMatchAt(n.ko, query) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at || byKo(a.n.ko, b.n.ko));
  return hits.length
    ? [{ key: 'hits', label: `검색 결과 ${hits.length}`, data: hits.map((h) => h.n) }]
    : [];
}
