// T-10-068 공유 미리보기 카드 워커(offside-og). 웹 워커(worker.ts)가 서비스 바인딩으로 `/og/career/<id>.png`를
// 넘기면 선수 카드를 PNG로 구워 돌려준다. 공개 주소가 없고, 캐시는 웹 워커가 맡는다. 굽지 못하면(글꼴·wasm
// 실패) 레전드 등급별 정적 카드로 돌려보낸다 — 미리보기가 비지 않게.
import { fetchHofEntry } from './hof-entry.js';
import { renderCareerCard, warmUp } from './og-render.js';
import { bandCardPath, cardVersion } from './share-meta.js';
import { OG_CARD_PATH } from './share-path.js';

const redirect = (location: string, maxAge: number) =>
  new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': `public, max-age=${maxAge}` },
  });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = OG_CARD_PATH.exec(url.pathname)?.[1];
    if (id) warmUp(); // 기록을 받는 동안 wasm을 준비한다
    const entry = id ? await fetchHofEntry(id, url.hostname) : null;
    if (!entry) return new Response('Not Found', { status: 404 });
    // 꼬리표가 지금 기록과 다르면(옛 링크·임의 값) 굽지 않고 지금 주소로 — 임의 ?v=로 캐시를 비켜 굽게 하지 못하게.
    const v = cardVersion(entry);
    if (url.searchParams.get('v') !== v)
      return redirect(`${url.origin}${url.pathname}?v=${v}`, 3600);
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
      return redirect(new URL(bandCardPath(entry.legendScore), url.origin).toString(), 600);
    }
  },
};
