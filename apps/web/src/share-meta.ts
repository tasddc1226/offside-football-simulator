// T-10-031 공유 링크(/career/<id>) 미리보기. 카카오톡·디스코드 같은 링크 미리보기 봇은 JS를 돌리지 않으므로
// 워커가 앱 셸의 제목·설명·이미지 메타를 그 선수 기록으로 바꿔 내려 준다. 이미지는 워커가 선수마다 굽는 카드
// (/og/career/<id>.png, T-10-068)이고, 굽지 못하면 빌드 때 만든 레전드 등급별 카드(scripts/seo.mjs
// CAREER_OG_BANDS)로 돌려보낸다. 게임 코드를 끌어오지 않게 순수 함수로만 둔다.
import type { PublicHofEntry } from '@offside/contracts';
import { legendBand } from '@offside/game/legend-bands';
import { gLegend as bandEn } from '@offside/game/i18n/en/gLegend';
import { gLegend as bandJa } from '@offside/game/i18n/ja/gLegend';
import { gLegend as bandZh } from '@offside/game/i18n/zh/gLegend';
import { shareMetaText as ko } from '@offside/app-core/i18n/ko/shareMeta';
import { shareMeta as en } from '@offside/app-core/i18n/en/shareMeta';
import { shareMeta as ja } from '@offside/app-core/i18n/ja/shareMeta';
import { shareMeta as zh } from '@offside/app-core/i18n/zh/shareMeta';
import { TRANSLATED_LOCALES, type Locale } from '@offside/contracts/i18n';
import { anonName } from '@offside/game/pos-label';
import { hashStr } from '@offside/game/hash';
import { ogCardPath } from './share-path.js';
import { escXml } from '@offside/game/xml';

/** scripts/seo.mjs BRAND_VERSION과 같다(미리보기 이미지 파일명). */
export const OG_VERSION = 'v7';

/** 선수 카드를 굽지 못했을 때 쓰는 레전드 등급별 정적 카드. */
export const bandCardPath = (score: number, dpos: string | null | undefined) =>
  `/og-career-${legendBand(score, dpos).id}-${OG_VERSION}.png`;

/** og-card.ts 카드 모양이 바뀌면 올린다 — 이미지 URL이 바뀌어 미리보기 캐시(카카오톡 등)가 새로 받는다. */
const CARD_VERSION = 1;

/** 기록이 바뀌면(이름 공개·점수 등) 달라지는 이미지 URL 꼬리표. 카드에 안 그려지는 필드까지 넣어 og-card.ts와 따로 맞출 필요가 없다. */
export const cardVersion = (e: PublicHofEntry): string =>
  hashStr(`${CARD_VERSION}|${JSON.stringify(e)}`).toString(36);

export type ShareMeta = { title: string; description: string; image: string; url: string };

// T-11-588 워커는 언어를 바꾸지 않으므로(setLocale 없음) 언어별 문구를 직접 고른다.
const TEXT = { ko, en, ja, zh };
const BAND: Record<Exclude<Locale, 'ko'>, Record<string, string>> = {
  en: bandEn,
  ja: bandJa,
  zh: bandZh,
};

/** 공유 링크의 ?lang=(공유한 사람의 화면 언어). 없거나 모르는 값이면 한국어. */
export const shareLang = (v: string | null): Locale =>
  (TRANSLATED_LOCALES as readonly string[]).includes(v ?? '') ? (v as Locale) : 'ko';

export function careerShareMeta(e: PublicHofEntry, origin: string, lang: Locale = 'ko'): ShareMeta {
  const T = TEXT[lang];
  const who = e.name ?? anonName(e.pos, e.number, lang);
  const band = legendBand(e.legendScore, e.dpos);
  const club = e.lastClub && lang === 'ko' ? T.club({ club: e.lastClub }) : '';
  return {
    title: T.title({
      who,
      band: lang === 'ko' ? band.name : (BAND[lang][band.id] ?? band.name),
      score: e.legendScore,
    }),
    description: `${T.description({ age: e.retireAge, apps: e.apps, goals: e.goals, assists: e.assists, trophies: e.trophies })}${club}.`,
    image: `${origin}${ogCardPath(e.id)}?v=${cardVersion(e)}`,
    url: `${origin}/career/${e.id}${lang === 'ko' ? '' : `?lang=${lang}`}`,
  };
}

/** 앱 셸 HTML의 제목·설명·og 메타를 바꾸고 og:url을 붙인다. 없는 태그는 건드리지 않는다.
 * 값은 유저 입력(공개 이름·구단 이름)이라 치환 문자열이 아닌 함수로 넣는다 — `$'` 같은 패턴이
 * 문서 나머지를 끌어오지 않게(T-10-034). */
export function injectShareMeta(html: string, m: ShareMeta): string {
  const setMeta = (h: string, attr: string, key: string, value: string) =>
    h.replace(
      new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`),
      (_, open: string, close: string) => open + escXml(value) + close,
    );
  let out = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escXml(m.title)}</title>`);
  out = setMeta(out, 'name', 'description', m.description);
  out = setMeta(out, 'property', 'og:title', m.title);
  out = setMeta(out, 'property', 'og:description', m.description);
  out = setMeta(out, 'property', 'og:image', m.image);
  return out.replace(
    /<meta property="og:image" [^>]*>/,
    (tag) => `${tag}<meta property="og:url" content="${escXml(m.url)}" />`,
  );
}
