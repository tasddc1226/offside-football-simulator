// ───────── 새 배포 감지 (T-10-023) ─────────
// 탭을 오래 열어 두면 배포 후에도 옛 번들로 계속 돈다. /version.json(빌드 때 커밋 SHA)을 이따금
// 확인해 지금 번들과 다르면 새로고침 배너를 띄운다. 배포로 지워진 옛 청크를 불러오다 실패해도 같은
// 배너를 띄운다 — 자동 새로고침은 하지 않는다(진행 중인 화면을 갑자기 날리지 않게).
import { APP_VERSION } from './helpers.js';

export const updateState = $state({ ready: false });

const MIN_GAP_MS = 60_000;
const INTERVAL_MS = 10 * 60_000;
let lastCheck = 0;

async function checkForUpdate(): Promise<void> {
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

const checkIfVisible = () => {
  if (document.visibilityState === 'visible') void checkForUpdate();
};

export function watchForUpdates(): void {
  // 방금 로드한 번들은 최신이므로 시작 직후에는 확인하지 않는다 — 탭 복귀·주기 확인부터.
  lastCheck = Date.now();
  document.addEventListener('visibilitychange', checkIfVisible);
  setInterval(checkIfVisible, INTERVAL_MS);
  // 빌드의 동적 import는 모두 Vite 프리로드 헬퍼를 거쳐, 청크를 못 불러오면 이 이벤트가 온다.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    updateState.ready = true;
  });
}
