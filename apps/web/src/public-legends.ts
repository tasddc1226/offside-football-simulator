// T-11-231 명예의 전당 공개 페이지. 크롤러가 자바스크립트 없이 읽도록 워커가 /legends/ 아래 HTML을 서버에서 그린다
// (public-news.ts와 같은 셸·같은 방식). 서버 부담을 줄이려고 기존 공개 API만 읽고, 그린 HTML은 엣지 캐시에 오래 둔다
// (worker.ts legendsCached). 검색 노출(색인)은 이름이 공개된 상위권 선수로 좁힌다 — 7만 명을 같은 틀로 모두 내면
// 빈약한 자동 생성 페이지로 보일 수 있다(docs/tracking/public-legends-plan.md §2).
import type { HofDetailResponse, PublicHofEntry } from '@offside/contracts';
import { fmtValue } from '@offside/contracts/market-value';
import { hofText as H } from '@offside/app-core/i18n/ko/hof';
import { publicLegendsText as L } from '@offside/app-core/i18n/ko/publicLegends';
import { shellText as S } from '@offside/app-core/i18n/ko/shell';
import { boardText as D } from '@offside/app-core/i18n/ko/board';
import { resolveApiBaseUrl } from './api/base-url.js';

export const LEGENDS_SORTS = [
  'score',
  'goals',
  'assists',
  'ga',
  'apps',
  'trophies',
  'ballon',
  'value',
] as const;
type Sort = (typeof LEGENDS_SORTS)[number];
const POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;
type Pos = (typeof POSITIONS)[number];
const ID = /^[0-9a-f-]{36}$/;

/** 그린 HTML을 엣지에 두는 시간(초). 선수 기록은 은퇴 뒤 바뀌지 않는다. */
export const LEGENDS_TTL = { list: 3600, player: 86400, index: 86400 } as const;
/** 상위 목록 크기. 순위 · 포지션 페이지 100명, 허브 50명, 색인 대상은 레전드 점수 상위 1,000명 + 포지션별 100명. */
const LIST = 100;
const HUB = 50;
// T-11-452 색인 대상을 상위 100명 + 포지션별 20명으로 줄였다(사이트맵의 대부분이 선수 기록표라 '가치가 별로 없는 콘텐츠' 재거절).
const INDEX_PAGES = 1;
const INDEX_POS = 20;

const sortLabel = (sort: Sort) =>
  ({
    score: H.sortScore,
    goals: H.sortGoals,
    assists: H.sortAssists,
    ga: H.sortGa,
    apps: H.sortApps,
    trophies: H.sortTrophies,
    ballon: H.sortBallon,
    value: H.sortValue,
  })[sort];

const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const num = (n: number) => n.toLocaleString('ko-KR');

export const legendsPath = {
  hub: '/legends/',
  rank: (sort: Sort) => `/legends/rank/${sort}/`,
  pos: (pos: Pos) => `/legends/pos/${pos.toLowerCase()}/`,
  player: (id: string) => `/legends/p/${id}/`,
};

type Route =
  | { kind: 'hub' }
  | { kind: 'rank'; sort: Sort }
  | { kind: 'pos'; pos: Pos }
  | { kind: 'player'; id: string };

/** 정규 경로만 받는다. 대소문자 · index.html · 끝 슬래시가 다르면 canonical로 보낸다(캐시 키가 늘지 않게). */
export function parseLegendsPath(pathname: string): { route: Route; path: string } | null {
  const raw = pathname.replace(/\/index\.html$/, '/');
  const m = /^\/legends(?:\/(rank|pos|p)\/([^/]+))?\/?$/i.exec(raw);
  if (!m) return null;
  const [, kind, arg] = m;
  if (!kind) return { route: { kind: 'hub' }, path: legendsPath.hub };
  const k = kind.toLowerCase();
  const a = arg!.toLowerCase();
  if (k === 'rank' && (LEGENDS_SORTS as readonly string[]).includes(a))
    return { route: { kind: 'rank', sort: a as Sort }, path: legendsPath.rank(a as Sort) };
  if (k === 'pos' && (POSITIONS as readonly string[]).includes(a.toUpperCase())) {
    const pos = a.toUpperCase() as Pos;
    return { route: { kind: 'pos', pos }, path: legendsPath.pos(pos) };
  }
  if (k === 'p' && ID.test(a))
    return { route: { kind: 'player', id: a }, path: legendsPath.player(a) };
  return null;
}

async function read<T>(path: string, hostname: string): Promise<T | null> {
  const response = await fetch(`${resolveApiBaseUrl(undefined, hostname)}${path}`, {
    signal: AbortSignal.timeout(4000),
    redirect: 'manual',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Legends unavailable');
  return ((await response.json()) as { data: T }).data;
}

type HofList = { entries: PublicHofEntry[]; total: number };
const readList = async (
  hostname: string,
  q: { sort?: Sort; pos?: Pos; limit?: number; page?: number },
) => {
  const params = new URLSearchParams({
    limit: String(q.limit ?? LIST),
    page: String(q.page ?? 1),
    sort: q.sort ?? 'score',
  });
  if (q.pos) params.set('pos', q.pos);
  const data = await read<HofList>(`/v1/hof?${params}`, hostname);
  if (!data || !Array.isArray(data.entries)) throw new Error('Invalid hof list');
  return data;
};

/** 검색에 내보내는 선수 ID: 레전드 점수 상위 100명 + 포지션별 상위 20명 중 이름 공개 · 시즌별 기록이 있는 선수.
 * worker.ts가 하루 동안 엣지에 둔다(사이트맵과 선수 페이지가 함께 쓴다). */
export async function readLegendsIndex(hostname: string): Promise<string[]> {
  const lists = await Promise.all([
    ...Array.from({ length: INDEX_PAGES }, (_, i) => readList(hostname, { page: i + 1 })),
    ...POSITIONS.map((pos) => readList(hostname, { pos, limit: INDEX_POS })),
  ]);
  const ids = new Set<string>();
  for (const list of lists)
    for (const e of list.entries) if (e.name && e.hasDetail && ID.test(e.id)) ids.add(e.id);
  return [...ids];
}

const nationName = (code: string | null | undefined) => {
  const c = code ?? 'KR';
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(c) ?? c;
  } catch {
    return c;
  }
};
const note = (sort: Sort) =>
  ({
    score: L.noteScore,
    goals: L.noteGoals,
    assists: L.noteAssists,
    ga: L.noteGa,
    apps: L.noteApps,
    trophies: L.noteTrophies,
    ballon: L.noteBallon,
    value: L.noteValue,
  })[sort];
const posLabel = (pos: Pos) => ({ FW: L.posFW, MF: L.posMF, DF: L.posDF, GK: L.posGK })[pos];
const nameOf = (e: PublicHofEntry) => e.name ?? L.anonymous;
const posOf = (e: Pick<PublicHofEntry, 'pos' | 'dpos'>) =>
  e.dpos ?? posLabel(e.pos as Pos) ?? e.pos;
const valueOf = (e: PublicHofEntry, sort: Sort): string => {
  switch (sort) {
    case 'score':
      return num(e.legendScore);
    case 'ga':
      return num(e.goals + e.assists);
    case 'value':
      return e.value == null ? '-' : fmtValue(e.value);
    default:
      return num(e[sort]);
  }
};

const nav = () =>
  `<nav class="public-news-nav"><a href="/">OFFSIDE</a><a href="${legendsPath.hub}">${escape(L.hubTitle)}</a><a href="/guide/">${escape(S.footGuide)}</a><a href="/faq/">${escape(S.footFaq)}</a><a href="/news/">${escape(D.publicNews)}</a></nav>`;

function table(entries: PublicHofEntry[], sort: Sort, offset = 0) {
  const rows = entries
    .map(
      (e, i) =>
        `<tr><td>${offset + i + 1}</td><td><a href="${legendsPath.player(e.id)}">${escape(nameOf(e))}</a></td><td>${escape(posOf(e))}</td><td>${escape(e.lastClub)}</td><td class="num">${escape(valueOf(e, sort))}</td></tr>`,
    )
    .join('');
  return `<div class="legends-table"><table><thead><tr><th>${escape(L.colRank)}</th><th>${escape(L.colPlayer)}</th><th>${escape(L.colPos)}</th><th>${escape(L.colClub)}</th><th>${escape(sortLabel(sort))}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const linkLists = () =>
  `<section class="os-panel"><h2>${escape(L.rankingsTitle)}</h2><ul class="legends-links">${LEGENDS_SORTS.map((s) => `<li><a href="${legendsPath.rank(s)}">${escape(L.rankTitle({ sort: sortLabel(s) }))}</a></li>`).join('')}</ul><h2>${escape(L.positionsTitle)}</h2><ul class="legends-links">${POSITIONS.map((p) => `<li><a href="${legendsPath.pos(p)}">${escape(L.posTitle({ pos: posLabel(p) }))}</a></li>`).join('')}</ul></section>`;

const outro = () =>
  `<p><a href="/">${escape(L.startCareer)}</a> · <a href="${legendsPath.hub}">${escape(L.backToHub)}</a></p>`;

type Page = { title: string; description: string; content: string; indexable: boolean };

async function hubPage(hostname: string): Promise<Page> {
  const list = await readList(hostname, { limit: HUB });
  const description = L.hubDescription;
  const content =
    `<header><p class="os-eyebrow">${escape(L.eyebrow)}</p><h1>${escape(L.hubTitle)}</h1><p>${escape(L.hubLead({ total: num(list.total) }))}</p></header>` +
    `<section class="os-panel"><h2>${escape(L.howTitle)}</h2>${[L.how1, L.how2, L.how3].map((t) => `<p>${escape(t)}</p>`).join('')}</section>` +
    `<section class="os-panel"><h2>${escape(L.topTitle)}</h2>${table(list.entries, 'score')}</section>` +
    linkLists() +
    outro();
  return { title: `${L.hubTitle} | OFFSIDE`, description, content, indexable: true };
}

async function rankPage(hostname: string, sort: Sort): Promise<Page> {
  const list = await readList(hostname, { sort });
  const label = sortLabel(sort);
  const lead = L.rankLead({ sort: label, n: list.entries.length });
  const content =
    `<header><p class="os-eyebrow">${escape(L.eyebrow)}</p><h1>${escape(L.rankTitle({ sort: label }))}</h1><p>${escape(lead)} ${escape(note(sort))}</p></header>` +
    `<section class="os-panel">${table(list.entries, sort)}</section>` +
    linkLists() +
    outro();
  return {
    title: `${L.rankTitle({ sort: label })} | ${L.hubTitle}`,
    description: `${lead} ${note(sort)}`,
    content,
    indexable: list.entries.length > 0,
  };
}

async function posPage(hostname: string, pos: Pos): Promise<Page> {
  const list = await readList(hostname, { pos });
  const n = list.entries.length;
  const avg = (f: (e: PublicHofEntry) => number) =>
    n ? (list.entries.reduce((a, e) => a + f(e), 0) / n).toFixed(1) : '-';
  const label = posLabel(pos);
  const lead = L.posLead({ pos: label, n, peak: avg((e) => e.peak), age: avg((e) => e.retireAge) });
  const content =
    `<header><p class="os-eyebrow">${escape(L.eyebrow)}</p><h1>${escape(L.posTitle({ pos: label }))}</h1><p>${escape(lead)}</p></header>` +
    `<section class="os-panel">${table(list.entries, 'score')}</section>` +
    linkLists() +
    outro();
  return {
    title: `${L.posTitle({ pos: label })} | OFFSIDE`,
    description: lead,
    content,
    indexable: n > 0,
  };
}

const dl = (items: [string, string][]) =>
  `<dl class="legends-dl">${items.map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl>`;
const ul = (items: string[]) =>
  items.length ? `<ul>${items.map((t) => `<li>${escape(t)}</li>`).join('')}</ul>` : '';

async function playerPage(hostname: string, id: string, index: Set<string>): Promise<Page | null> {
  const data = await read<HofDetailResponse>(`/v1/hof/${id}`, hostname);
  if (!data) return null;
  const e = data.entry;
  const snap = data.snapshot;
  const name = nameOf(e);
  const pos = posOf(e);
  const profile: [string, string][] = [
    [L.colPos, pos],
    [L.nation, nationName(e.nation)],
    ...(e.number != null ? ([[L.number, String(e.number)]] as [string, string][]) : []),
    [L.peak, String(e.peak)],
    ...(e.potReal != null ? ([[L.potential, String(e.potReal)]] as [string, string][]) : []),
    [L.retireAge, String(e.retireAge)],
    [L.lastClub, e.lastClub],
    [L.legendScore, num(e.legendScore)],
    ...(e.value != null ? ([[L.value, fmtValue(e.value)]] as [string, string][]) : []),
    ...(e.retiredNumber
      ? ([[L.retiredNumber, `${e.retiredNumber.club} ${e.retiredNumber.number}`]] as [
          string,
          string,
        ][])
      : []),
  ];
  const totals: [string, string][] = [
    [L.apps, num(e.apps)],
    [L.goals, num(e.goals)],
    [L.assists, num(e.assists)],
    [L.trophies, num(e.trophies)],
    [L.awards, num(e.awards)],
    [L.caps, num(e.caps)],
    [L.ballon, num(e.ballon)],
  ];
  let detail = `<p>${escape(L.noDetail)}</p>`;
  if (snap) {
    const seasons = snap.career
      .map(
        (s) =>
          `<tr><td>${s.year}</td><td>${s.age}</td><td>${escape(s.club)}</td><td>${escape(s.league)}</td><td class="num">${s.apps}</td><td class="num">${s.goals}</td><td class="num">${s.assists}</td><td class="num">${s.rating ? s.rating.toFixed(2) : '-'}</td><td class="num">${escape(String(s.rank))}</td><td class="num">${s.ovr}</td></tr>`,
      )
      .join('');
    const heads = [
      L.colYear,
      L.colAge,
      L.colClub,
      L.colLeague,
      L.colApps,
      L.colGoals,
      L.colAssists,
      L.colRating,
      L.colLeagueRank,
      L.colOvr,
    ];
    detail =
      `<section class="os-panel"><h2>${escape(L.seasons)}</h2><div class="legends-table"><table><thead><tr>${heads.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${seasons}</tbody></table></div></section>` +
      (snap.trophies.length
        ? `<section class="os-panel"><h2>${escape(L.trophyList)}</h2>${ul(snap.trophies.map((t) => `${t.year} ${t.t} (${t.club})`))}</section>`
        : '') +
      (snap.awards.length
        ? `<section class="os-panel"><h2>${escape(L.awardList)}</h2>${ul(snap.awards.map((a) => `${a.year} ${a.t}`))}</section>`
        : '') +
      (snap.ballon.length
        ? `<section class="os-panel"><h2>${escape(L.ballonList)}</h2>${ul(snap.ballon.map((b) => L.ballonRank(b)))}</section>`
        : '') +
      (snap.nat.caps
        ? `<section class="os-panel"><h2>${escape(L.national)}</h2><p>${escape(L.nationalLine({ caps: snap.nat.caps, goals: snap.nat.goals ?? 0, assists: snap.nat.assists ?? 0 }))}</p></section>`
        : '') +
      (snap.storyLog.length
        ? `<section class="os-panel"><h2>${escape(L.stories)}</h2>${ul(snap.storyLog.map((s) => L.storyLine(s)))}</section>`
        : '') +
      (snap.miles.length
        ? `<section class="os-panel"><h2>${escape(L.milestones)}</h2>${ul(snap.miles.map((m) => `${m.year} ${m.t}`))}</section>`
        : '');
  }
  const content =
    `<article><header><p class="os-eyebrow">${escape(L.eyebrow)}</p><h1>${escape(name)}</h1><p>${escape(pos)} · ${escape(e.lastClub)}</p></header>` +
    `<section class="os-panel"><h2>${escape(L.profile)}</h2>${dl(profile)}</section>` +
    `<section class="os-panel"><h2>${escape(L.totals)}</h2>${dl(totals)}</section>` +
    detail +
    `</article><p><a href="/career/${e.id}">${escape(L.playInGame)}</a></p>` +
    outro();
  const description = L.playerDescription({
    name,
    age: e.retireAge,
    club: e.lastClub,
    apps: e.apps,
    goals: e.goals,
    assists: e.assists,
    trophies: e.trophies,
    score: e.legendScore,
  });
  // 이름 공개 · 시즌별 기록이 있고 상위권(또는 영구결번)인 선수만 검색에 내보낸다.
  const indexable = Boolean(e.name && snap && (index.has(e.id) || e.retiredNumber));
  return {
    title: `${L.playerTitle({ name, pos })} | OFFSIDE`,
    description,
    content,
    indexable,
  };
}

/** 소식 셸(news-shell.html)에 제목 · 메타 · 본문을 넣는다. */
function render(template: string, origin: string, path: string, indexing: boolean, page: Page) {
  const robots = indexing ? 'index, follow' : 'noindex, follow';
  const canonical = `${origin}${path}`;
  const meta = `<meta name="description" content="${escape(page.description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="${path.startsWith('/legends/p/') ? 'profile' : 'website'}"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="OFFSIDE"><meta name="twitter:card" content="summary">`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(page.title)}</title>`)
    .replace(/<!-- offside-seo:start -->[\s\S]*?<!-- offside-seo:end -->/, () => meta)
    .replace(
      '<!-- public-news-body -->',
      () => `<div class="os-screen public-news public-legends">${nav()}${page.content}</div>`,
    );
}

/**
 * /legends/ 아래 페이지 한 장. 404 · 리디렉션 · 실패는 짧게, 200은 worker.ts가 엣지에 둔다.
 * readIndex는 색인 대상 ID 목록(엣지 캐시)을 돌려준다 — 선수 페이지만 부른다.
 */
export async function serveLegends(
  request: Request,
  template: string,
  indexing: boolean,
  readIndex: () => Promise<string[]>,
): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parseLegendsPath(url.pathname);
  const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (!parsed) return new Response('Not Found', { status: 404, headers: noStore });
  if (url.pathname !== parsed.path || url.search)
    return new Response(null, {
      status: 308,
      headers: { Location: parsed.path, 'Cache-Control': 'no-store' },
    });
  const { route, path } = parsed;
  let page: Page | null;
  let status = 200;
  try {
    page =
      route.kind === 'hub'
        ? await hubPage(url.hostname)
        : route.kind === 'rank'
          ? await rankPage(url.hostname, route.sort)
          : route.kind === 'pos'
            ? await posPage(url.hostname, route.pos)
            : await playerPage(
                url.hostname,
                route.id,
                new Set(await readIndex().catch(() => [] as string[])),
              );
    if (!page) {
      status = 404;
      page = {
        title: 'Not Found | OFFSIDE',
        description: L.notFound,
        content: `<h1>404</h1><p>${escape(L.notFound)}</p>${outro()}`,
        indexable: false,
      };
    }
  } catch {
    status = 503;
    page = {
      title: `${L.hubTitle} | OFFSIDE`,
      description: L.hubDescription,
      content: `<h1>${escape(L.hubTitle)}</h1><p>${escape(L.failed)}</p>`,
      indexable: false,
    };
  }
  const index = indexing && status === 200 && page.indexable;
  const html = render(template, url.origin, path, index, page);
  const ttl = status !== 200 ? 0 : route.kind === 'player' ? LEGENDS_TTL.player : LEGENDS_TTL.list;
  return new Response(request.method === 'HEAD' ? null : html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-store',
      'X-Robots-Tag': index ? 'index, follow' : 'noindex, follow',
      ...(status === 503 ? { 'Retry-After': '60' } : {}),
    },
  });
}

/** 사이트맵에 더할 경로: 허브 · 순위 · 포지션 · 색인 대상 선수. */
export const legendsSitemapPaths = (ids: string[]) => [
  legendsPath.hub,
  ...LEGENDS_SORTS.map(legendsPath.rank),
  ...POSITIONS.map(legendsPath.pos),
  ...ids.map(legendsPath.player),
];
