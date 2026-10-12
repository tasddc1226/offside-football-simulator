import { pathToFileURL } from 'node:url';
import { deliverOnce, digest, productionDb, sendSlack, slackMessage } from './slack-ops-client.mjs';
import { inspectInfraHealth } from './infra-health.mjs';

const HOUR = 3600000;
const issueNames = {
  'd1-storage-70-percent': 'D1 할당 용량이 70%를 넘었습니다.',
  'd1-storage-less-than-30-days': '현재 증가 속도라면 D1 한도까지 30일 이하입니다.',
  'daily-job-missing-or-stale': '일일 작업 기록이 없거나 지연됐습니다.',
  'daily-job-failed': '일일 작업이 실패했습니다.',
  'backup-not-completed': '백업 완료 기록을 확인할 수 없습니다.',
  'season-events-archive-stale': '시즌 이벤트 보관 작업이 지연됐습니다.',
  'backup-binding-unavailable': '백업 저장소 연결이 없습니다.',
  'backup-key-invalid': '백업 파일 경로가 올바르지 않습니다.',
  'backup-object-missing-or-unavailable': '백업 파일이 없거나 접근할 수 없습니다.',
};
export function previousKstDay(now = Date.now()) {
  const endMs = Math.floor((now + 9 * HOUR) / (24 * HOUR)) * 24 * HOUR - 9 * HOUR;
  return {
    day: new Date(endMs - 15 * HOUR).toISOString().slice(0, 10),
    start: new Date(endMs - 24 * HOUR).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}
const healthLink = {
  label: '운영 점검 실행 내역',
  url: 'https://github.com/tasddc1226/offside-football-simulator/actions/workflows/slack-operations.yml',
};
export function productLabel(id) {
  if (id === 'com.offsidelab.app.remove_ads') return '광고 제거';
  const match = /^com\.offsidelab\.app\.(reroll|boost|scout)_(\d+)$/.exec(id);
  return match
    ? `${{ reroll: '리롤권', boost: '잠재력 강화권', scout: '프리미엄 스카우트권' }[match[1]]} ${match[2]}장`
    : id;
}
const fmt = (n) => Number(n ?? 0).toLocaleString('ko-KR');
export async function monitor(db, env, now = Date.now(), fetcher = fetch) {
  const issues = [];
  let state;
  try {
    state = await db.get('cron:infra-health:last');
    inspectInfraHealth(state, now);
    issues.push(...state.issues);
  } catch {
    state = undefined;
    issues.push('인프라 점검 데이터 누락·지연');
  }
  for (const url of ['https://api.offside-lab.com/v1/health', 'https://offside-lab.com/']) {
    try {
      const r = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error('unhealthy');
      if (url.endsWith('/v1/health') && (await r.json())?.data?.ok !== true)
        throw new Error('invalid health');
    } catch {
      issues.push(url.includes('api.') ? '운영 API 응답 실패' : '운영 웹 응답 실패');
    }
  }
  const previous = await db.get('slack:ops:health');
  const signature = digest([...issues].sort());
  const changed = previous?.signature !== signature;
  const remind = issues.length > 0 && now - (previous?.at ?? 0) >= 6 * HOUR;
  if ((changed && (issues.length || previous?.issues?.length)) || remind) {
    await sendSlack(
      env.SLACK_ALERTS_WEBHOOK,
      slackMessage(
        issues.length ? '🚨 OFFSIDE 운영 점검 필요' : '✅ OFFSIDE 운영 정상 복구',
        [
          ...(issues.length
            ? issues.map((x) => issueNames[x] ?? x)
            : ['이전 점검에서 발견한 문제가 해소됐습니다.']),
          ...(state
            ? [
                `D1 할당 용량: ${(state.sizeBytes / 1e9).toFixed(2)} GB / 10 GB (재사용 공간 포함)`,
                `용량 소진 예상: ${state.daysToLimit == null ? '계산할 이력 부족 또는 증가 없음' : `${state.daysToLimit.toFixed(1)}일`}`,
              ]
            : []),
          '동일 상태는 6시간마다 재안내합니다. 정상 복구 시 한 번 알립니다.',
        ],
        [healthLink],
      ),
      fetcher,
    );
    await db.set('slack:ops:health', { signature, issues, at: now });
  } else if (!previous) await db.set('slack:ops:health', { signature, issues, at: now });
  return { issues };
}
export async function daily(db, env, now = Date.now(), fetcher = fetch) {
  const { day, start, end } = previousKstDay(now);
  const billKey = 'slack:ops:daily-billing',
    gameKey = 'slack:ops:daily-game';
  if ((await db.get(billKey))?.version !== day) {
    const rows = await db.query(
      'SELECT store,kind,product_id,COUNT(*) AS n FROM billing_alerts WHERE test=0 AND created_at>=? AND created_at<? GROUP BY store,kind,product_id ORDER BY store,kind,product_id',
      [start, end],
    );
    const kinds = { purchase: '구매', renewal: '갱신', refund: '환불' };
    await deliverOnce(
      db,
      billKey,
      day,
      env.SLACK_PURCHASES_WEBHOOK,
      slackMessage(
        `💳 ${day} 일일 결제 요약`,
        [
          `구매 ${fmt(rows.filter((r) => r.kind === 'purchase').reduce((n, r) => n + r.n, 0))}건 · 갱신 ${fmt(rows.filter((r) => r.kind === 'renewal').reduce((n, r) => n + r.n, 0))}건 · 환불 ${fmt(rows.filter((r) => r.kind === 'refund').reduce((n, r) => n + r.n, 0))}건`,
          ...rows
            .slice(0, 20)
            .map(
              (r) =>
                `${r.store === 'apple' ? 'App Store' : 'Google Play'} · ${kinds[r.kind] ?? r.kind} · ${productLabel(r.product_id)}: ${fmt(r.n)}건`,
            ),
          '한국 시간 전날 00:00–24:00에 서버가 수신한 검증 이벤트 기준입니다. Sandbox·연결 테스트는 제외합니다.',
          '실제 결제 시각 기준 매출·스토어 정산액이 아닙니다. 지연·누락된 스토어 알림은 집계에 차이가 날 수 있습니다.',
        ],
        [healthLink],
      ),
      fetcher,
    );
  }
  if ((await db.get(gameKey))?.version !== day) {
    const [newProfiles] = await db.query(
      'SELECT COUNT(*) AS n FROM profiles WHERE created_at>=? AND created_at<? AND deleted_at IS NULL',
      [start, end],
    );
    const [active] = await db.query(
      'SELECT COUNT(*) AS n FROM profiles WHERE last_seen_at>=? AND deleted_at IS NULL',
      [new Date(now - 24 * HOUR).toISOString()],
    );
    const [created] = await db.query(
      'SELECT COUNT(*) AS n FROM careers WHERE created_at>=? AND created_at<?',
      [start, end],
    );
    const [retired] = await db.query(
      "SELECT COUNT(*) AS n FROM careers WHERE status='retired' AND retired_at>=? AND retired_at<?",
      [start, end],
    );
    const [seasons] = await db.query(
      'SELECT COUNT(*) AS n FROM career_seasons WHERE created_at>=? AND created_at<?',
      [start, end],
    );
    await deliverOnce(
      db,
      gameKey,
      day,
      env.SLACK_DAILY_WEBHOOK,
      slackMessage(
        `☀️ ${day} 오프사이드 아침 리포트`,
        [
          `신규 프로필: ${fmt(newProfiles.n)}개`,
          `최근 24시간 API 활동 프로필: ${fmt(active.n)}개`,
          `선수 생성: ${fmt(created.n)}명 · 은퇴: ${fmt(retired.n)}명`,
          `시즌 요약 저장: ${fmt(seasons.n)}건`,
          '활동은 실행 시점 직전 24시간의 API 마지막 접속 기록이며 GA4 DAU·로그인 가입자 수와 다릅니다.',
          '그 외 항목은 한국 시간 전날 00:00–24:00의 서버 저장 기록입니다. 오프라인 플레이·동기화 지연·삭제에 따라 차이가 납니다.',
        ],
        [healthLink],
      ),
      fetcher,
    );
  }
}
export async function main(mode, env = process.env, fetcher = fetch) {
  const db = await productionDb(env, fetcher);
  if (mode === 'monitor') return monitor(db, env, Date.now(), fetcher);
  if (mode === 'daily') return daily(db, env, Date.now(), fetcher);
  throw new Error('Unknown operations mode');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv[2]).catch(async () => {
    console.error('Operations job failed. Credentials and response bodies are not logged.');
    try {
      await sendSlack(
        process.env.SLACK_ALERTS_WEBHOOK,
        slackMessage(
          '🚨 OFFSIDE 운영 리포트 실행 실패',
          [
            '데이터 조회 또는 Slack 전송에 실패했습니다. 0건으로 보고하지 않았습니다.',
            process.env.GITHUB_RUN_ID ? `실행 번호: ${process.env.GITHUB_RUN_ID}` : '로컬 실행',
          ],
          [healthLink],
        ),
      );
    } catch {
      /* CI failure remains visible if Slack is down. */
    }
    process.exitCode = 1;
  });
