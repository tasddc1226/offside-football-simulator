// T-11-824 에이전트 Worker(offside-agents)가 main보다 밀려 있는지 본다. 운영 배포(웹 · API)는 이 Worker를 올리지 않아
// 11-02~11-17에 머지된 변경이 배포되지 않은 채 KPI 원천 5개가 비었다. 마지막 Worker 배포 시각보다 늦게 main에 들어온
// 커밋 중 Worker 번들에 들어가는 경로를 바꾼 것이 있으면 밀린 것으로 본다(손으로 배포한 것도 시각으로 함께 잡힌다).
//
// 사용: node agents-drift.mjs <wrangler deployments list --json 결과 파일>
// GITHUB_OUTPUT에 drift=true|false, 요약에 밀린 커밋을 남긴다.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Worker 번들에 들어가는 경로. 다른 워크스페이스 패키지를 import하지 않는다(API 스키마 ?raw는 테스트에서만 읽는다). */
export const AGENT_PATHS = ['apps/agents'];

/** 가장 최근 Worker 배포 시각(ms). 배포 기록이 없으면 null. */
export function lastDeployAt(deployments) {
  if (!Array.isArray(deployments)) throw new Error('Expected a deployments array');
  const times = deployments.map((d) => Date.parse(d?.created_on)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

/** git log 줄(%H\t%cI\t%s)에서 배포 뒤에 들어온 커밋만 고른다. */
export function undeployed(logLines, deployedAt) {
  return logLines
    .filter(Boolean)
    .map((l) => {
      const [sha, at, ...subject] = l.split('\t');
      return { sha, at, subject: subject.join('\t') };
    })
    .filter((c) => deployedAt === null || Date.parse(c.at) > deployedAt);
}

export function main(argv = process.argv.slice(2), env = process.env, exec = execFileSync) {
  const [file] = argv;
  if (!file) throw new Error('Usage: agents-drift.mjs <deployments.json>');
  const deployedAt = lastDeployAt(JSON.parse(readFileSync(file, 'utf8')));
  const log = exec(
    'git',
    ['log', '-n', '30', '--format=%H%x09%cI%x09%s', 'HEAD', '--', ...AGENT_PATHS],
    {
      encoding: 'utf8',
    },
  );
  const commits = undeployed(log.split('\n'), deployedAt);
  const drift = commits.length > 0;
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `drift=${drift}\n`);
  const when = deployedAt === null ? '기록 없음' : new Date(deployedAt).toISOString();
  const lines = drift
    ? [
        `에이전트 Worker 마지막 배포(${when}) 뒤에 들어온 변경 ${commits.length}개:`,
        ...commits.slice(0, 10).map((c) => `- ${c.sha.slice(0, 8)} ${c.at} ${c.subject}`),
      ]
    : [`에이전트 Worker가 main과 같아요(마지막 배포 ${when}).`];
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `## Agents worker\n\n${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  return drift;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
