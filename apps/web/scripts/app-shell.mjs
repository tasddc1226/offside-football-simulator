// T-10-041: 첫 화면을 index.html에 Svelte 서버 렌더 결과로 넣고, main.ts가 mount 대신 hydrate로 이 노드를
// 그대로 이어받는다. 예전에는 손으로 옮긴 홈 히어로를 부팅 때 지우고 다시 그렸는데, Chrome LCP는 같은 자리의
// 같은 노드는 다시 세지 않지만 새로 붙인 노드(옮기거나 복제한 것 포함)는 새 후보로 센다 — 웹폰트가 적용된 새
// 제목이 JS 실행 뒤에 더 크게 그려지면서 LCP가 첫 페인트보다 한참 늦게 잡혔다.
//
// 렌더 상태는 세이브 없는 첫 방문자(홈 · 로딩 자리표시)다. 진행 중인 커리어가 있거나 다른 경로(app-shell.html)면
// hydrate가 다른 갈래만 새로 그리거나(불일치 복구) 통째로 비우고 mount한다.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createServer } from 'vite';

export const APP_SHELL_MARK = '<!-- app-shell -->';

async function renderApp(server) {
  const { render } = await server.ssrLoadModule('svelte/server');
  const { default: App } = await server.ssrLoadModule('/src/ui/App.svelte');
  return render(App).body;
}

/** @param {{ define: Record<string, string> }} options */
export function appShellPlugin({ define }) {
  let root = process.cwd();
  /** @type {import('vite').ViteDevServer | undefined} */
  let dev;
  return {
    name: 'offside-app-shell',
    configResolved(c) {
      root = c.root;
    },
    configureServer(server) {
      dev = server;
    },
    async transformIndexHtml(html) {
      // dev 공개 페이지(seo.mjs)는 #app 을 본문으로 갈아 끼우므로 표시를 미리 지워 렌더를 건너뛴다.
      if (dev)
        return html.includes(APP_SHELL_MARK)
          ? html.replace(APP_SHELL_MARK, await renderApp(dev))
          : html;
      if (!html.includes(APP_SHELL_MARK))
        throw new Error(`app-shell: index.html #app 안에 ${APP_SHELL_MARK} 표시가 없다`);
      // 빌드: 클라이언트 번들과 따로 SSR용 Vite 서버를 잠깐 띄워 렌더한다.
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        appType: 'custom',
        plugins: [svelte()],
        define,
        server: { middlewareMode: true, hmr: false, ws: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      try {
        return html.replace(APP_SHELL_MARK, await renderApp(server));
      } finally {
        await server.close();
      }
    },
  };
}
