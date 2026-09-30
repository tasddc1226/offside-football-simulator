// T-11-010 앱 OTA(EAS Update) — 웹 update.svelte.ts와 같은 역할. 새 JS 번들은 앱을 켤 때 expo-updates가
// 알아서 받고(ON_LOAD), 앱으로 돌아올 때·10분마다는 여기서 확인해 받아 둔다. 받아 두면 UpdateBanner가
// '다시 시작'을 띄운다 — 자동 재시작은 하지 않는다(진행 중인 화면을 갑자기 날리지 않게). 안 눌러도 다음 실행 때 적용된다.
// 네이티브가 바뀐 번들은 runtimeVersion(fingerprint)이 달라 옛 앱으로 내려오지 않는다. 개발 빌드에서는 꺼져 있다.
import * as Updates from 'expo-updates';

export const UPDATE_GAP_MS = 10 * 60_000;
const MIN_GAP_MS = 60_000;
let lastCheck = Date.now(); // 켤 때의 확인은 expo-updates가 한다.

export async function checkForUpdate(): Promise<void> {
  if (!Updates.isEnabled || Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  try {
    if ((await Updates.checkForUpdateAsync()).isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    /* 오프라인이면 다음에 다시 본다. */
  }
}

export const applyUpdate = () => void Updates.reloadAsync();
