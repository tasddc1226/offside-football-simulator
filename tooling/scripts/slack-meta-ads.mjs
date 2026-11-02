import { pathToFileURL } from 'node:url';
import { deliverOnce, digest, productionDb, sendSlack, slackMessage } from './slack-ops-client.mjs';

const statusNames = {
  ACTIVE: '게재 활성',
  PAUSED: '중단',
  DISAPPROVED: '심사 거절',
  PENDING_REVIEW: '심사 중',
  WITH_ISSUES: '게재 문제',
  CAMPAIGN_PAUSED: '캠페인 중단',
  ADSET_PAUSED: '광고 세트 중단',
  PENDING_BILLING_INFO: '결제 정보 필요',
  IN_PROCESS: '처리 중',
  ARCHIVED: '보관됨',
  DELETED: '삭제됨',
};
const problems = new Set(['DISAPPROVED', 'WITH_ISSUES', 'PENDING_BILLING_INFO']);
export function accountYesterday(zone, now = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1))
    .toISOString()
    .slice(0, 10);
}
const day = (ymd, add) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
};
/** 광고 계정 시간대로 지난 완결 주(월~일)와 그 전 주. 월요일에 돌면 어제(일요일)까지가 지난주다. */
export function accountLastWeek(zone, now = Date.now()) {
  const yesterday = accountYesterday(zone, now);
  const until = day(yesterday, -new Date(`${yesterday}T00:00:00Z`).getUTCDay());
  const since = day(until, -6);
  return { since, until, prevSince: day(since, -7), prevUntil: day(until, -7) };
}
/** 계정 시간대 날짜의 0시를 UTC ISO로(acquisition_sessions.received_at 비교용). */
export function accountDayStartUtc(zone, ymd) {
  const guess = Date.parse(`${ymd}T00:00:00Z`);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(guess)
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (local - guess)).toISOString();
}
export function metaClient(env, fetcher = fetch) {
  if (
    !/^\d+$/.test(env.META_AD_ACCOUNT_ID ?? '') ||
    !/^v\d+\.0$/.test(env.META_GRAPH_VERSION ?? '') ||
    !env.META_ADS_ACCESS_TOKEN
  )
    throw new Error('Meta configuration unavailable');
  const account = `act_${env.META_AD_ACCOUNT_ID}`;
  const base = `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${account}`;
  async function get(path = '', params = {}) {
    const u = new URL(base + path);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const r = await fetcher(u.toString(), {
      headers: { Authorization: `Bearer ${env.META_ADS_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error('Meta read request failed');
    const data = await r.json();
    if (!data || data.error) throw new Error('Meta read response failed');
    return data;
  }
  async function list(path, params) {
    const rows = [];
    let after;
    for (let i = 0; i < 10; i++) {
      const data = await get(path, { ...params, limit: '100', ...(after ? { after } : {}) });
      if (!Array.isArray(data.data)) throw new Error('Malformed Meta list');
      rows.push(...data.data);
      if (!data.paging?.next) return rows;
      const cursor = data.paging?.cursors?.after;
      if (typeof cursor !== 'string' || cursor === after)
        throw new Error('Incomplete Meta pagination');
      after = cursor; // Never follow next URLs: they can contain tokens or unexpected hosts.
    }
    throw new Error('Meta list exceeds bounded collection');
  }
  return { account, get, list };
}
const fmt = (n) => Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const number = (v) => {
  const n = Number(v);
  if (v == null || !Number.isFinite(n) || n < 0) throw new Error('Invalid insight metric');
  return n;
};
const lpvOf = (actions) => {
  if (actions != null && !Array.isArray(actions)) throw new Error('Invalid insight actions');
  return (actions ?? [])
    .filter((a) => a.action_type === 'landing_page_view')
    .reduce((n, a) => n + number(a.value), 0);
};
const change = (cur, prev) =>
  prev ? `${cur >= prev ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%` : '전주 없음';
const per = (spend, n, currency) => (n ? `${fmt(Math.round(spend / n))} ${currency}` : '-');
/**
 * T-11-610 주간 성과: 지난 완결 주(계정 시간대 월~일) 광고별 지출 · 랜딩 조회와, 같은 주 우리 서버 1차 유입
 * (acquisition_sessions, utm_source=meta · facebook)의 방문 · 커리어 시작 · 스토어 클릭을 전주와 비교한다.
 */
async function weeklyReport(db, env, api, info, prefix, link, now, fetcher) {
  const w = accountLastWeek(info.timezone_name, now),
    key = `${prefix}:weekly`;
  if ((await db.get(key))?.version === w.since) return;
  const ads = async (since, until) =>
    (
      await api.list('/insights', {
        fields: 'ad_id,ad_name,adset_name,spend,actions,date_start,date_stop',
        level: 'ad',
        time_range: JSON.stringify({ since, until }),
      })
    ).map((r) => {
      if (
        !/^\d+$/.test(r.ad_id ?? '') ||
        typeof r.ad_name !== 'string' ||
        r.date_start !== since ||
        r.date_stop !== until
      )
        throw new Error('Invalid insight period');
      return {
        name: `${String(r.adset_name ?? '').slice(0, 40)} / ${r.ad_name.slice(0, 40)}`,
        spend: number(r.spend),
        lpv: lpvOf(r.actions),
      };
    });
  const visits = async (since, until) => {
    const rows = await db.query(
      `SELECT campaign, count(*) n, sum(started_at IS NOT NULL) started, sum(store_clicked_at IS NOT NULL) store
       FROM acquisition_sessions WHERE received_at >= ? AND received_at < ? GROUP BY campaign LIMIT 500`,
      [
        accountDayStartUtc(info.timezone_name, since),
        accountDayStartUtc(info.timezone_name, day(until, 1)),
      ],
    );
    const by = new Map();
    for (const r of rows) {
      const q = new URLSearchParams(String(r.campaign).replace(/^\?/, ''));
      if (!['meta', 'facebook'].includes(q.get('utm_source') ?? '')) continue;
      const c = q.get('utm_content') || '(없음)';
      const o = by.get(c) ?? { content: c, n: 0, started: 0, store: 0 };
      o.n += number(r.n);
      o.started += number(r.started);
      o.store += number(r.store);
      by.set(c, o);
    }
    return [...by.values()].sort((a, b) => b.n - a.n);
  };
  const sum = (rows, ...keys) =>
    Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]));
  const [cur, prev, srv, srvPrev] = await Promise.all([
    ads(w.since, w.until),
    ads(w.prevSince, w.prevUntil),
    visits(w.since, w.until),
    visits(w.prevSince, w.prevUntil),
  ]);
  const t = sum(cur, 'spend', 'lpv'),
    p = sum(prev, 'spend', 'lpv'),
    s = sum(srv, 'n', 'started', 'store'),
    sp = sum(srvPrev, 'n', 'started', 'store'),
    c = info.currency;
  await deliverOnce(
    db,
    key,
    w.since,
    env.SLACK_DAILY_WEBHOOK,
    slackMessage(
      `📊 ${w.since}~${w.until} 메타 광고 주간 성과`,
      [
        `${info.name} · 광고 계정 시간대 ${info.timezone_name} · 전주 ${w.prevSince}~${w.prevUntil}`,
        `지출 ${fmt(Math.round(t.spend))} ${c} (${change(t.spend, p.spend)}) · 랜딩 조회 ${fmt(t.lpv)} (${change(t.lpv, p.lpv)}) · 조회당 ${per(t.spend, t.lpv, c)} (전주 ${per(p.spend, p.lpv, c)})`,
        `서버 기준 방문 ${fmt(s.n)} · 커리어 시작 ${fmt(s.started)} · 스토어 클릭 ${fmt(s.store)} (전주 ${fmt(sp.n)} · ${fmt(sp.started)} · ${fmt(sp.store)})`,
        `방문당 ${per(t.spend, s.n, c)} · 시작당 ${per(t.spend, s.started, c)} · 스토어 클릭당 ${per(t.spend, s.store, c)} (전주 ${per(p.spend, sp.n, c)} · ${per(p.spend, sp.started, c)} · ${per(p.spend, sp.store, c)})`,
        '광고별 (지출순):',
        ...cur
          .filter((r) => r.spend > 0)
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 8)
          .map(
            (r) =>
              `- ${r.name}: ${fmt(Math.round(r.spend))} ${c} · 랜딩 ${fmt(r.lpv)} · 조회당 ${per(r.spend, r.lpv, c)}`,
          ),
        'utm_content별 서버 유입:',
        ...srv
          .slice(0, 6)
          .map(
            (r) =>
              `- ${r.content.slice(0, 40)}: 방문 ${fmt(r.n)} · 시작 ${fmt(r.started)} · 스토어 ${fmt(r.store)}`,
          ),
        '서버 기준은 우리 1차 유입 기록(acquisition_sessions)이고 Meta 크롤러 방문이 섞일 수 있습니다. 광고·예산은 바꾸지 않습니다.',
      ],
      [link],
    ),
    fetcher,
  );
}
export async function metaAds(db, env, mode, now = Date.now(), fetcher = fetch) {
  if (!['daily', 'weekly', 'monitor'].includes(mode)) throw new Error('Unknown Meta mode');
  const api = metaClient(env, fetcher);
  const link = {
    label: '광고 관리자',
    url: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${env.META_AD_ACCOUNT_ID}`,
  };
  const info = await api.get('', { fields: 'id,name,currency,timezone_name,account_status' });
  if (
    info.id !== api.account ||
    typeof info.name !== 'string' ||
    !/^[A-Z]{3}$/.test(info.currency ?? '') ||
    typeof info.timezone_name !== 'string' ||
    !Number.isInteger(info.account_status)
  )
    throw new Error('Malformed Meta account');
  const prefix = `slack:ops:meta:${env.META_AD_ACCOUNT_ID}`;
  if (mode === 'daily') {
    const day = accountYesterday(info.timezone_name, now),
      key = `${prefix}:daily`;
    if ((await db.get(key))?.version === day) return;
    const rows = await api.list('/insights', {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop',
      level: 'campaign',
      time_range: JSON.stringify({ since: day, until: day }),
    });
    const records = rows.map((r) => {
      if (
        !/^\d+$/.test(r.campaign_id ?? '') ||
        typeof r.campaign_name !== 'string' ||
        r.date_start !== day ||
        r.date_stop !== day
      )
        throw new Error('Invalid insight period');
      return {
        name: r.campaign_name.slice(0, 100),
        spend: number(r.spend),
        impressions: number(r.impressions),
        clicks: number(r.clicks),
        lpv: lpvOf(r.actions),
      };
    });
    const total = records.reduce(
      (s, r) => ({
        spend: s.spend + r.spend,
        impressions: s.impressions + r.impressions,
        clicks: s.clicks + r.clicks,
        lpv: s.lpv + r.lpv,
      }),
      { spend: 0, impressions: 0, clicks: 0, lpv: 0 },
    );
    await deliverOnce(
      db,
      key,
      day,
      env.SLACK_DAILY_WEBHOOK,
      slackMessage(
        `📣 ${day} 메타 광고 요약`,
        [
          `${info.name} · 광고 계정 시간대 ${info.timezone_name}`,
          `지출 ${fmt(total.spend)} ${info.currency} · 노출 ${fmt(total.impressions)} · 클릭 ${fmt(total.clicks)}`,
          `랜딩 페이지 조회 ${fmt(total.lpv)} · 조회당 비용 ${total.lpv ? `${fmt(total.spend / total.lpv)} ${info.currency}` : '계산 불가 (조회 0건)'}`,
          ...records
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 10)
            .map((r) => `${r.name}: ${fmt(r.spend)} ${info.currency} / 랜딩 ${fmt(r.lpv)}`),
          `집계된 캠페인 ${records.length}개. Meta 보고값은 지연·보정될 수 있습니다. 랜딩 조회는 가입·앱 설치·구매가 아닙니다.`,
        ],
        [link],
      ),
      fetcher,
    );
  } else if (mode === 'weekly') {
    await weeklyReport(db, env, api, info, prefix, link, now, fetcher);
  } else {
    const rows = await api.list('/ads', { fields: 'id,name,effective_status' });
    const current = {};
    const alerts = [];
    const key = `${prefix}:status`,
      previous = await db.get(key);
    for (const r of rows) {
      if (
        !/^\d+$/.test(r.id ?? '') ||
        typeof r.name !== 'string' ||
        typeof r.effective_status !== 'string'
      )
        throw new Error('Malformed ad status');
      current[r.id] = r.effective_status;
      if (
        previous?.ads?.[r.id] !== r.effective_status &&
        (previous?.ads?.[r.id] || problems.has(r.effective_status))
      )
        alerts.push(
          `${r.name.slice(0, 100)}: ${statusNames[r.effective_status] ?? r.effective_status}`,
        );
    }
    if (info.account_status !== 1 && previous?.accountStatus !== info.account_status)
      alerts.unshift(`광고 계정 상태 코드 ${info.account_status} · 콘솔 확인 필요`);
    else if (info.account_status === 1 && previous?.accountStatus && previous.accountStatus !== 1)
      alerts.unshift('광고 계정 정상 상태로 복구');
    const signature = digest({ ads: current, accountStatus: info.account_status });
    if (alerts.length)
      await sendSlack(
        env.SLACK_ALERTS_WEBHOOK,
        slackMessage(
          '📣 메타 광고 상태 변경',
          [
            info.name,
            ...alerts.slice(0, 15),
            ...(alerts.length > 15
              ? [`그 외 ${alerts.length - 15}개 변경은 콘솔에서 확인하세요.`]
              : []),
            '시간별 조회에서 관찰한 변경입니다. 광고·예산 설정은 변경하지 않습니다.',
          ],
          [link],
        ),
        fetcher,
      );
    if (previous?.signature !== signature)
      await db.set(key, {
        signature,
        ads: current,
        accountStatus: info.account_status,
        checkedAt: new Date(now).toISOString(),
      });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    db = await productionDb();
    await metaAds(db, process.env, process.argv[2]);
    const old = await db.get('slack:ops:meta-api-error');
    if (old?.failed) {
      await sendSlack(
        process.env.SLACK_ALERTS_WEBHOOK,
        slackMessage('✅ 메타 광고 조회 정상 복구', ['광고 API 조회가 다시 성공했습니다.']),
      );
      await db.set('slack:ops:meta-api-error', { failed: false });
    }
  } catch {
    console.error('Meta report failed. Credentials, URLs and response bodies are not logged.');
    try {
      const old = db && (await db.get('slack:ops:meta-api-error'));
      if (!old?.failed || Date.now() - old.at >= 21600000) {
        await sendSlack(
          process.env.SLACK_ALERTS_WEBHOOK,
          slackMessage('🚨 메타 광고 조회 실패', [
            '토큰·조회 권한·API 응답을 확인하세요. 실패를 지출·성과 0건으로 보고하지 않았습니다. 같은 실패는 6시간 간격으로 재안내합니다.',
          ]),
        );
        if (db) await db.set('slack:ops:meta-api-error', { failed: true, at: Date.now() });
      }
    } catch {
      /* CI retains failure if Slack is unavailable. */
    }
    process.exitCode = 1;
  }
}
