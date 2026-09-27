// T-10-068 공유 미리보기 카드 워커(offside-og). 웹 워커(worker.ts)가 서비스 바인딩으로 `/og/career/<id>.png`를
// 넘기면 선수 카드를 PNG로 구워 돌려준다. 공개 주소가 없고, 캐시는 웹 워커가 맡는다. 굽지 못하면(글꼴·wasm
// 실패) 레전드 등급별 정적 카드로 돌려보낸다 — 미리보기가 비지 않게.
import { fetchHofEntry } from './hof-entry.js';
import { renderCareerCard } from './og-render.js';
import { bandCardPath } from './share-meta.js';

const CARD = /^\/og\/career\/([0-9a-f-]{36})\.png$/i;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = CARD.exec(url.pathname)?.[1];
    const entry = id ? await fetchHofEntry(id, url.hostname) : null;
    if (!entry) return new Response('Not Found', { status: 404 });
    try {
      const png = await renderCareerCard(entry);
      return new Response(png as BodyInit, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
          'X-Robots-Tag': 'noindex',
        },
      });
    } catch {
      return Response.redirect(
        new URL(bandCardPath(entry.legendScore), url.origin).toString(),
        302,
      );
    }
  },
};
