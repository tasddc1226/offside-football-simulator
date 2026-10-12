import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { productionDb, deliverOnce, slackMessage } from './slack-ops-client.mjs';
export async function releaseUpdate(db, env, event, fetcher = fetch) {
  const run = event.workflow_run;
  if (
    !run ||
    run.name !== 'Production Release' ||
    run.head_branch !== 'main' ||
    run.status !== 'completed'
  )
    return;
  if (!Number.isSafeInteger(run.id)) throw new Error('Invalid run');
  const repo = 'tasddc1226/offside-football-simulator';
  const response = await fetcher(
    `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error('Release job lookup failed');
  const payload = await response.json();
  if (!Array.isArray(payload.jobs) || payload.total_count > 100)
    throw new Error('Incomplete release jobs');
  const jobs = payload.jobs;
  if (!jobs.some((j) => j.name === 'Deploy production')) return; // Read-only preflight is not a release.
  const status = {
    success: '성공',
    failure: '실패',
    cancelled: '취소',
    skipped: '건너뜀',
    timed_out: '시간 초과',
  };
  await deliverOnce(
    db,
    `slack:ops:release:${run.id}`,
    `${run.run_attempt}:${run.conclusion}`,
    env.SLACK_RELEASES_WEBHOOK,
    slackMessage(
      '🚀 OFFSIDE 운영 배포 실행 결과',
      [
        `커밋: ${String(run.head_sha).slice(0, 8)}`,
        ...jobs.map(
          (j) =>
            `${j.name === 'Deploy production' ? '웹·API 배포' : j.name}: ${status[j.conclusion] ?? '결과 확인 필요'}`,
        ),
        '웹·API 배포와 앱 OTA 결과를 구분합니다. 스토어 심사 승인을 뜻하지 않습니다.',
      ],
      [{ label: '실행·각 단계 확인', url: `https://github.com/${repo}/actions/runs/${run.id}` }],
    ),
    fetcher,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await releaseUpdate(
      await productionDb(),
      process.env,
      JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    );
  } catch {
    console.error('Release notification failed. No credentials or response bodies logged.');
    process.exitCode = 1;
  }
}
