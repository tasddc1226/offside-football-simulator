// ───────── 새 배포 감지 (T-10-023) ─────────
// 탭을 오래 열어 두면 배포 후에도 옛 번들로 계속 돈다. /version.json(빌드 때 커밋 SHA)을 이따금
// 확인해 지금 번들과 다르면 새로고침 배너를 띄운다. 옛 번들이 지운 청크를 불러오다 실패해도 같은
// 배너를 띄운다 — 자동 새로고침은 하지 않는다(진행 중인 화면을 갑자기 날리지 않게).
import { APP_VERSION } from './helpers.js';

export const updateState = $state({ ready: false });

const MIN_GAP_MS = 60_000;
const INTERVAL_MS = 10 * 60_000;
let lastCheck = 0;

export async function checkForUpdate(): Promise<void> {
  if (updateState.ready || Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version?: unknown };
    if (typeof version === 'string' && version !== APP_VERSION) updateState.ready = true;
  } catch {
    /* 오프라인·개발 서버(version.json 없음)는 조용히 넘긴다. */
  }
}

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function watchForUpdates(): void {
  void checkForUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  }, INTERVAL_MS);
  // 배포로 사라진 옛 청크를 불러오다 실패한 경우.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    updateState.ready = true;
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (CHUNK_ERROR.test(String((e.reason as Error | undefined)?.message ?? e.reason))) updateState.ready = true;
  });
}
