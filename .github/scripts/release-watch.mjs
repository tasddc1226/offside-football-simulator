// T-11-824 운영 배포 뒤 자동 확인. 웹 · API 배포가 끝나고 WATCH_MINUTES가 지나면 서버 상태(/v1/status 5분 칸)를
// 배포 전 1시간과 비교하고, 배포 뒤 처음 보인 앱 오류 종류(운영 지표 DB client_errors)를 센다. 결과는 디스코드
// 운영 배포 채널로 보내고, 문제가 있으면 잡을 실패시킨다(자동 되돌리기는 하지 않는다 — 사람이 mode=rollback을 고른다).
//
// 11-08 명예의 전당 503 · 11-17 효과음 OTA 크래시를 사람이 직접 보고 알았던 빈틈을 막는다.
// 앱 오류 메시지 · 스택은 선수 이름 같은 원문이 섞일 수 있어 옮기지 않고 종류 · 플랫폼 · 버전 · 건수만 쓴다.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionDb, sendSlack, slackMessage } from '../../tooling/scripts/slack-ops-client.mjs';

export const API = 'https://api.offside-lab.com';
export const WEB = 'https://offside-lab.com';
export const WATCH_MINUTES = 10;
const BUCKET_MS = 5 * 60_000;
const BEFORE_MS = 60 * 60_000;

/**
 * 판정 기준. 배포 뒤 칸은 10분이라 요청 수가 적으면 비율이 크게 흔들린다 — minRequests 밑이면 비율로 실패시키지 않는다.
 * 오류율은 1%(또는 배포 전의 2배) 중 큰 값을 넘고 오류가 10건 이상일 때, 느린 요청은 5%(또는 2배)를 넘을 때 문제로 본다.
 */
export const LIMITS = Object.freeze({
  minRequests: 200,
  minErrors: 10,
  errorRate: 0.01,
  slowRate: 0.05,
  ratio: 2,
  newErrorCount: 20,
});

const sum = (rows) =>
  rows.reduce(
    (a, r) => ({
      requests: a.requests + (r.requests ?? 0),
      errors: a.errors + (r.errors ?? 0),
      slow: a.slow + (r.slow ?? 0),
      ms: a.ms + (r.avgMs ?? 0) * (r.requests ?? 0),
    }),
    { requests: 0, errors: 0, slow: 0, ms: 0 },
  );

/** 5분 칸을 배포 전 1시간(배포 시각에 걸친 칸 제외)과 배포 뒤(배포 시각 이후에 시작한 칸)로 나눠 더한다. */
export function splitBuckets(buckets, deployAt) {
  const t = Date.parse(deployAt);
  if (!Number.isFinite(t)) throw new Error('DEPLOY_AT must be an ISO timestamp');
  const at = (b) => Date.parse(b.at);
  return {
    before: sum(buckets.filter((b) => at(b) >= t - BEFORE_MS && at(b) + BUCKET_MS <= t)),
    after: sum(buckets.filter((b) => at(b) >= t)),
  };
}

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(2)}%` : '—');
const avg = (s) => (s.requests ? Math.round(s.ms / s.requests) : 0);

/** 비교 결과와 새 앱 오류로 문제 목록 · 보고 줄을 만든다. */
export function judgeRelease({ before, after, newErrors = [], probes = [] }, L = LIMITS) {
  const problems = [];
  const rate = (s, k) => (s.requests ? s[k] / s.requests : 0);
  if (after.requests === 0)
    problems.push('배포 뒤 서버 요청 집계가 비어 있어요(집계 지연이거나 API가 응답하지 않아요).');
  else if (after.requests >= L.minRequests) {
    const errLimit = Math.max(L.errorRate, rate(before, 'errors') * L.ratio);
    if (after.errors >= L.minErrors && rate(after, 'errors') > errLimit)
      problems.push(
        `오류율 ${pct(after.errors, after.requests)}(배포 전 ${pct(before.errors, before.requests)})로 기준 ${(errLimit * 100).toFixed(2)}%를 넘었어요.`,
      );
    const slowLimit = Math.max(L.slowRate, rate(before, 'slow') * L.ratio);
    if (rate(after, 'slow') > slowLimit)
      problems.push(
        `느린 요청 ${pct(after.slow, after.requests)}(배포 전 ${pct(before.slow, before.requests)})로 기준 ${(slowLimit * 100).toFixed(2)}%를 넘었어요.`,
      );
  }
  const fresh = newErrors.reduce((a, e) => a + Number(e.count ?? 0), 0);
  if (fresh >= L.newErrorCount)
    problems.push(`배포 뒤 처음 보인 앱 오류가 ${newErrors.length}종 ${fresh}건이에요.`);
  for (const p of probes.filter((x) => !x.ok)) problems.push(`${p.name} 확인 실패(${p.detail}).`);
  const lines = [
    `서버(배포 뒤 ${after.requests.toLocaleString('en-US')}건): 오류 ${pct(after.errors, after.requests)} · 느린 요청 ${pct(after.slow, after.requests)} · 평균 ${avg(after)}ms`,
    `배포 전 1시간(${before.requests.toLocaleString('en-US')}건): 오류 ${pct(before.errors, before.requests)} · 느린 요청 ${pct(before.slow, before.requests)} · 평균 ${avg(before)}ms`,
    newErrors.length
      ? `새 앱 오류 ${newErrors.length}종 ${fresh}건: ` +
        newErrors
          .slice(0, 3)
          .map((e) => `${e.platform}/${e.kind} ${e.version} ×${e.count}`)
          .join(', ')
      : '새 앱 오류: 없음',
  ];
  return { problems, lines };
}

/** 공개 주소 세 곳을 읽기 전용으로 부른다. 프로필을 만들지 않게 인증 없는 프로필 GET은 부르지 않는다. */
export async function probe(fetcher = fetch) {
  const one = async (name, url, check) => {
    try {
      const r = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
      const body = await r.text();
      return { name, ok: r.ok && check(body), detail: `HTTP ${r.status}` };
    } catch {
      return { name, ok: false, detail: '응답 없음' };
    }
  };
  return Promise.all([
    one('API 상태', `${API}/v1/health`, () => true),
    one('서버 상태 화면', `${API}/v1/status`, (b) => b.includes('"buckets"')),
    one('웹 첫 화면', `${WEB}/`, (b) => b.includes('오프사이드')),
  ]);
}

/** 배포 뒤 처음 나타난 앱 오류 종류. 배포 전 사흘 안에 한 번이라도 보인 지문은 뺀다. */
export const NEW_ERRORS_SQL = `SELECT fingerprint, platform, kind, max(last_version) AS version, sum(count) AS count
  FROM client_errors WHERE first_at >= ?1 AND day >= ?2
    AND fingerprint NOT IN (SELECT fingerprint FROM client_errors WHERE day >= ?3 AND first_at < ?1)
  GROUP BY fingerprint ORDER BY count DESC LIMIT 20`;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

export async function main(env = process.env, deps = {}) {
  const fetcher = deps.fetcher ?? fetch;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const deployAt = env.DEPLOY_AT;
  const t = Date.parse(deployAt ?? '');
  if (!Number.isFinite(t)) throw new Error('DEPLOY_AT must be an ISO timestamp');
  const wait = t + Number(env.WATCH_MINUTES ?? WATCH_MINUTES) * 60_000 - now();
  if (wait > 0) await sleep(wait);

  const status = await fetcher(`${API}/v1/status`, { signal: AbortSignal.timeout(20_000) });
  if (!status.ok) throw new Error(`Status lookup failed (HTTP ${status.status})`);
  const buckets = (await status.json())?.data?.buckets;
  if (!Array.isArray(buckets)) throw new Error('Status response has no buckets');
  const { before, after } = splitBuckets(buckets, deployAt);

  const ops = await (deps.opsDb ?? (() => productionDb(env, fetcher, 'offside-ops-production')))();
  const newErrors = await ops.query(NEW_ERRORS_SQL, [deployAt, day(t), day(t - 3 * 86_400_000)]);
  const probes = await probe(fetcher);
  const { problems, lines } = judgeRelease({ before, after, newErrors, probes });

  const sha = String(env.EXPECTED_SHA ?? '').slice(0, 8);
  const extra = [];
  if (env.OTA_RESULT && env.OTA_RESULT !== 'success') extra.push(`앱 OTA 잡: ${env.OTA_RESULT}`);
  if (env.AGENTS_DRIFT === 'true')
    extra.push(
      env.AGENTS_DEPLOYED === 'true'
        ? '에이전트 Worker: 밀린 변경을 이번에 배포했어요.'
        : '에이전트 Worker: 배포 안 된 변경이 있어요(apps/agents에서 wrangler deploy).',
    );
  const title = problems.length
    ? `⚠️ OFFSIDE 운영 배포 뒤 확인: 문제 ${problems.length}건`
    : '✅ OFFSIDE 운영 배포 뒤 확인: 이상 없음';
  const body = [
    `커밋: ${sha} · 배포 ${Math.round((now() - t) / 60_000)}분 뒤`,
    ...problems.map((p) => `• ${p}`),
    ...lines,
    ...extra,
    ...(problems.length
      ? [
          '되돌리려면 Production Release를 mode=rollback, confirmation=ROLLBACK_PRODUCTION으로 실행하세요(DB는 그대로).',
        ]
      : []),
  ];
  const links = env.RUN_URL ? [{ label: '배포 실행', url: env.RUN_URL }] : [];
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `## ${title}\n\n${body.join('\n\n')}\n`);
  if (env.SLACK_RELEASES_WEBHOOK)
    await (deps.send ?? sendSlack)(
      env.SLACK_RELEASES_WEBHOOK,
      slackMessage(title, body, links),
      fetcher,
    );
  else console.log('SLACK_RELEASES_WEBHOOK not set; summary only.');
  return problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (e) {
    console.error(`Release watch failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}
