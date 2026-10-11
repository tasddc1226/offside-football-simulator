import { parseBody } from '@offside/app-core/boardText';
import { boardText as D } from '@offside/app-core/i18n/ko/board';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';
import { boardLabelText as B } from '@offside/app-core/i18n/ko/boardLabel';
import { resolveApiBaseUrl } from './api/base-url.js';

export const NEWS_ID = /^pst_(?:release_\d{8}|[0-9a-f-]{36})$/;
export type NewsSummary = {
  id: string;
  board: 'notice' | 'release';
  title: string;
  createdAt: string;
  updatedAt: string;
};
export type NewsPost = NewsSummary & { body: string };
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const newsPath = (id: string) => `/news/${id}/`;
const isSummary = (p: NewsSummary) =>
  p &&
  NEWS_ID.test(p.id) &&
  (p.board === 'notice' || p.board === 'release') &&
  typeof p.title === 'string' &&
  typeof p.createdAt === 'string' &&
  typeof p.updatedAt === 'string';

async function read(path: string, hostname: string) {
  const response = await fetch(`${resolveApiBaseUrl(undefined, hostname)}${path}`, {
    signal: AbortSignal.timeout(3000),
    redirect: 'error',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('News unavailable');
  return (await response.json()) as { data: { posts?: NewsSummary[]; post?: NewsPost } };
}
export async function readNewsIndex(hostname: string): Promise<NewsSummary[]> {
  const pages = await Promise.all(
    ['notice', 'release'].map(async (board) => {
      const result = await read(`/v1/public-news/${board}`, hostname);
      const posts = result?.data.posts;
      if (
        !Array.isArray(posts) ||
        posts.length > 1000 ||
        !posts.every((p) => isSummary(p) && p.board === board)
      )
        throw new Error('Invalid news index');
      return posts;
    }),
  );
  return pages.flat();
}
const nav = () =>
  `<nav class="public-news-nav"><a href="/">OFFSIDE</a><a href="/news/">${escape(D.publicNews)}</a><a href="/guide/">${escape(L.footGuide)}</a><a href="/faq/">${escape(L.footFaq)}</a><a href="/fairness/">${escape(L.footFairness)}</a></nav>`;
const bodyHtml = (body: string) =>
  parseBody(body)
    .map((b) =>
      b.kind === 'h'
        ? `<h2>${escape(b.text)}</h2>`
        : b.kind === 'ul'
          ? `<ul>${b.items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`
          : `<p>${b.lines.map(escape).join('<br>')}</p>`,
    )
    .join('');

export function newsHtml(
  template: string,
  origin: string,
  path: string,
  indexing: boolean,
  title: string,
  description: string,
  content: string,
) {
  const robots = indexing ? 'index, follow' : 'noindex, nofollow';
  const canonical = `${origin}${path}`;
  const meta = `<meta name="description" content="${escape(description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="${path === '/news/' ? 'website' : 'article'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="OFFSIDE"><meta name="twitter:card" content="summary">`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace(/<!-- offside-seo:start -->[\s\S]*?<!-- offside-seo:end -->/, () => meta)
    .replace(
      '<!-- public-news-body -->',
      () => `<div class="os-screen public-news">${nav()}${content}</div>`,
    );
}
export async function serveNews(
  request: Request,
  template: string,
  indexing: boolean,
): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.pathname.replace(/\/index\.html$/, '/');
  const match = /^\/news(?:\/([^/]+))?\/?$/.exec(raw);
  const id = match?.[1];
  if (!match || (id && !NEWS_ID.test(id)))
    return new Response('Not Found', {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' },
    });
  const path = id ? newsPath(id) : '/news/';
  if (url.pathname !== path || url.search)
    return new Response(null, {
      status: 308,
      headers: { Location: path, 'Cache-Control': 'no-store' },
    });
  let status = 200;
  let title = `${D.publicNews} | OFFSIDE`;
  let description = D.publicNewsDescription;
  let content: string;
  try {
    if (id) {
      const data = await read(`/v1/public-news/posts/${id}`, url.hostname);
      if (!data) {
        status = 404;
        title = 'Not Found';
        content = '<h1>404</h1>';
      } else {
        const post = data.data.post;
        if (!post || !isSummary(post) || post.id !== id || typeof post.body !== 'string')
          throw new Error('Invalid news post');
        title = `${post.title} | OFFSIDE`;
        description =
          post.body
            .replace(/[#*\s]+/g, ' ')
            .trim()
            .slice(0, 160) || post.title;
        content = `<article><header><p class="os-eyebrow">${escape(post.board === 'notice' ? B.noticeLabel : B.releaseLabel)}</p><h1>${escape(post.title)}</h1><time datetime="${escape(post.createdAt)}">${escape(post.createdAt.slice(0, 10))}</time></header><section class="os-panel board-body">${bodyHtml(post.body)}</section></article><p><a href="/?news=${encodeURIComponent(id)}&amp;board=${post.board}">${escape(D.publicNewsDiscuss)}</a></p>`;
      }
    } else {
      const posts = await readNewsIndex(url.hostname);
      content =
        `<header><p class="os-eyebrow">OFFSIDE NEWS</p><h1>${escape(D.publicNews)}</h1><p>${escape(description)}</p></header>` +
        ['notice', 'release']
          .map(
            (board) =>
              `<section class="os-panel"><h2>${escape(board === 'notice' ? B.noticeLabel : B.releaseLabel)}</h2><ul class="board-list">${posts
                .filter((p) => p.board === board)
                .map(
                  (p) =>
                    `<li><a class="board-row" href="${newsPath(p.id)}"><b>${escape(p.title)}</b><time datetime="${escape(p.createdAt)}">${escape(p.createdAt.slice(0, 10))}</time></a></li>`,
                )
                .join('')}</ul></section>`,
          )
          .join('');
    }
  } catch {
    status = 503;
    indexing = false;
    content = `<h1>${escape(D.publicNews)}</h1><p>${escape(D.publicNewsFailed)}</p>`;
  }
  indexing = indexing && status === 200;
  const html = newsHtml(template, url.origin, path, indexing, title, description, content);
  return new Response(request.method === 'HEAD' ? null : html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': indexing ? 'index, follow' : 'noindex, nofollow',
      ...(status === 503 ? { 'Retry-After': '60' } : {}),
    },
  });
}
export async function newsSitemap(asset: Response, url: URL): Promise<Response> {
  try {
    const posts = await readNewsIndex(url.hostname);
    const urls = ['/news/', ...posts.map((p) => newsPath(p.id))];
    const xml = (await asset.text()).replace(
      '</urlset>',
      () =>
        `${urls.map((path) => `<url><loc>${escape(url.origin + path)}</loc></url>`).join('\n')}\n</urlset>`,
    );
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('Service Unavailable', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'Retry-After': '60',
      },
    });
  }
}
