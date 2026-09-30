// T-11-010 앱 OTA(EAS Update) — 웹 update.svelte.ts와 같은 역할. 새 JS 번들은 앱을 켤 때 expo-updates가
// 알아서 받고(ON_LOAD), 앱으로 돌아올 때·10분마다는 여기서 확인해 받아 둔다. 받아 두면 UpdateBanner가
// '다시 시작'을 띄운다 — 자동 재시작은 하지 않는다(진행 중인 화면을 갑자기 날리지 않게). 안 눌러도 다음 실행 때 적용된다.
// 네이티브가 바뀐 번들은 runtimeVersion(fingerprint)이 달라 옛 앱으로 내려오지 않는다. 개발 빌드에서는 꺼져 있다.
import * as Updates from 'expo-updates';

export const UPDATE_GAP_MS = 10 * 60_000;
const MIN_GAP_MS = 60_000;
let lastCheck = Date.now(); // 켤 때의 확인은 expo-updates가 한다.
let pending = false; // 받아 둔 번들이 있으면 다시 시작할 때까지 더 보지 않는다.

export async function checkForUpdate(): Promise<void> {
  if (!Updates.isEnabled || pending || Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  try {
    // 새 번들이 없으면 받지 않고 isNew=false로 끝난다 — 확인을 따로 부르지 않는다.
    pending = (await Updates.fetchUpdateAsync()).isNew;
  } catch {
    /* 오프라인이면 다음에 다시 본다. */
  }
}

export const applyUpdate = () => void Updates.reloadAsync();

/** 받아 둔 새 번들이 있다(다시 시작하면 적용). 새 버전 배너가 뜨고, 새 소식 배너는 그동안 물러난다. */
export const useUpdatePending = () => Updates.useUpdates().isUpdatePending;
