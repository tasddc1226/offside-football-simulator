// T-11-824 OTA 경로(스토어 빌드 버전)별 사용 비율. 운영 배포는 플랫폼 × 스토어 버전마다 OTA 잡을 하나씩 돈다
// (deploy-production.yml app-update matrix). 경로가 늘수록 prepare-ota-legacy.mjs의 예외 · 주석과 실패 지점이 는다.
// 최근 DAYS일에 갱신된 알림 기기(push_devices.app_version = 네이티브 앱 버전)로 비율을 보고 PRUNE_SHARE 밑인 옛 경로를
// 정리 후보로 낸다. 정리는 사람이 정한다: 그 버전보다 높게 APP_VERSIONS.min을 올리고(닫을 수 없는 업데이트 팝업),
// 그다음 배포에서 matrix · targets를 뺀다.
//
// 알림을 켠 기기만 잡히므로 안드로이드는 표본이 작다. 읽기 전용, 운영 피크(KST 19~24시)를 피해 돌린다.
// 사용: CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node .github/scripts/ota-lane-usage.mjs
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionDb } from '../../tooling/scripts/slack-ops-client.mjs';
import { STORE_BUILDS } from './ota-store-runtime.mjs';
import { targets } from './prepare-ota-legacy.mjs';

export const DAYS = 7;
export const PRUNE_SHARE = 0.02;

/** 플랫폼별 OTA 경로 이름 → 스토어 버전. current는 STORE_BUILDS의 버전. */
export function lanes(store = STORE_BUILDS, legacy = targets) {
  const out = [];
  for (const platform of ['ios', 'android']) {
    if (store[platform]) out.push({ platform, lane: 'current', version: store[platform].version });
    for (const [version, t] of Object.entries(legacy))
      if (t.runtimes?.[platform]) out.push({ platform, lane: version, version });
  }
  return out;
}

/** 버전별 기기 수 행으로 경로별 비율 · 정리 후보를 만든다. 경로가 없는 버전(이미 OTA를 끊은 버전)은 따로 센다. */
export function laneUsage(rows, laneList = lanes(), prune = PRUNE_SHARE) {
  const result = [];
  for (const platform of ['ios', 'android']) {
    const mine = rows.filter((r) => r.platform === platform);
    const total = mine.reduce((a, r) => a + Number(r.n), 0);
    const known = new Set();
    for (const l of laneList.filter((x) => x.platform === platform)) {
      known.add(l.version);
      const n = mine
        .filter((r) => r.app_version === l.version)
        .reduce((a, r) => a + Number(r.n), 0);
      const share = total ? n / total : 0;
      result.push({ ...l, n, total, share, prune: l.lane !== 'current' && share < prune });
    }
    const rest = mine.filter((r) => !known.has(r.app_version)).reduce((a, r) => a + Number(r.n), 0);
    if (rest)
      result.push({
        platform,
        lane: '(경로 없음)',
        version: '-',
        n: rest,
        total,
        share: rest / total,
        prune: false,
      });
  }
  return result;
}

export async function main(env = process.env, now = Date.now()) {
  const db = await productionDb(env);
  const since = new Date(now - DAYS * 86_400_000).toISOString();
  const rows = await db.query(
    'SELECT platform, app_version, count(*) AS n FROM push_devices WHERE updated_at >= ?1 GROUP BY platform, app_version',
    [since],
  );
  console.log(`OTA lane usage, push devices updated since ${since}`);
  for (const u of laneUsage(rows))
    console.log(
      `${u.platform.padEnd(8)} ${u.lane.padEnd(10)} ${String(u.n).padStart(6)} / ${u.total}  ${(u.share * 100).toFixed(1).padStart(5)}%${u.prune ? '  ← 정리 후보' : ''}`,
    );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
