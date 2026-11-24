// T-11-824 mode=rollback이 되돌아갈 Worker 버전을 고른다. 운영 배포는 API Worker에 버전을 여러 개 만든다(코드 배포 뒤
// Google · 관리자 비밀값 동기화가 버전을 하나씩 더 만든다, annotations "workers/triggered_by": "secret"). 그래서
// "바로 전 버전"으로 돌리면 코드는 새 것 그대로 비밀값 동기화만 되돌린다. 마지막 코드 배포(비밀값이 아닌 배포) 바로 앞의
// 배포가 가리키던 버전 — 지난 배포의 코드와 비밀값이 모두 들어간 버전 — 을 고른다.
//
// 사용: node rollback-target.mjs <wrangler deployments list --json 결과 파일> → 표준 출력에 version id
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const trigger = (d) => d?.annotations?.['workers/triggered_by'];

export function rollbackTarget(deployments) {
  if (!Array.isArray(deployments)) throw new Error('Expected a deployments array');
  const list = deployments
    .map((d) => ({ at: Date.parse(d?.created_on), by: trigger(d), versions: d?.versions ?? [] }))
    .filter((d) => Number.isFinite(d.at))
    .sort((a, b) => a.at - b.at);
  let start = list.length - 1;
  while (start > 0 && list[start].by === 'secret') start--;
  if (start <= 0) throw new Error('No earlier deployment to roll back to');
  const prev = list[start - 1];
  if (prev.versions.length !== 1 || !prev.versions[0]?.version_id)
    throw new Error('Previous deployment was a split rollout; pick a version by hand');
  return {
    versionId: prev.versions[0].version_id,
    deployedAt: new Date(prev.at).toISOString(),
    skipped: list.length - start,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = rollbackTarget(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.error(
    `Rolling back ${t.skipped} deployment(s) to the version live since ${t.deployedAt}.`,
  );
  console.log(t.versionId);
}
