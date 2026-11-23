import { describe, expect, it } from 'vitest';
import schemaSrc from '../../../api/src/db/schema.ts?raw';
import { mcpTools } from '../mcp.ts';
import { CF_MCP_DENY } from '../roles.ts';
import { readOnlySql } from './ops.ts';
import { SENSITIVE_COLUMNS } from './sensitive.ts';

/** schema.ts의 표 · 보기 → 열 이름(text · integer · real). */
function schemaColumns(src: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of src.split(/sqlite(?:Table|View)\(\s*'/).slice(1)) {
    const name = part.slice(0, part.indexOf("'"));
    const body = part.split('\nexport ')[0]!;
    out.set(
      name,
      [...body.matchAll(/(?:text|integer|real)\('([a-z0-9_]+)'/g)].map((m) => m[1]!),
    );
  }
  return out;
}

/**
 * 이름이 식별자 · 비밀값처럼 보이지만 읽어도 되는 열(이유와 함께). 새 열이 이 모양이면 SENSITIVE_COLUMNS나 여기에 더한다.
 */
const ALLOWED: Record<string, string[]> = {
  // 설치 id의 해시. 기기 수 집계에 쓰고 원래 값으로 돌아가지 않는다.
  push_news_deliveries: ['installation_hash'],
  push_deliveries: ['installation_hash'],
  push_devices: ['installation_hash'],
  // 서버가 만든 키 · 해시(알림 출처 · 요청 중복 · 저장소 경로 · 업로드 검증 · 번역 캐시 · 설정 이름 · 복귀 알림 묶음).
  notifications: ['source_key'],
  idempotency: ['key', 'request_hash'],
  careers: ['detail_archive_key', 'snapshot_key'],
  card_enhance_log: ['request_key'],
  career_seasons: ['upload_hash'],
  club_customs: ['img_key'],
  comp_customs: ['img_key'],
  translations: ['key'],
  app_meta: ['key'],
  retention_pushes: ['lapse_key'],
  // 우리가 만든 주문 번호. 엑솔라 주문 번호(xsolla_order_id)는 막는다.
  web_pay_orders: ['order_id'],
};

const LOOKS_SENSITIVE =
  /(^|_)(email|sub|token|hash|verifier|challenge|transaction_id|chain_id|order_id|nickname|secret|password|receipt|ip|key|code|label)$/;

describe('SENSITIVE_COLUMNS와 schema.ts', () => {
  const schema = schemaColumns(schemaSrc);

  it('막는 표 · 열이 schema.ts에 그대로 있다', () => {
    for (const [table, cols] of Object.entries(SENSITIVE_COLUMNS)) {
      expect(schema.has(table), table).toBe(true);
      for (const c of cols) expect(schema.get(table), `${table}.${c}`).toContain(c);
    }
  });

  it('식별자처럼 보이는 열은 막거나 읽어도 되는 이유가 있다', () => {
    const unknown: string[] = [];
    for (const [table, cols] of schema)
      for (const c of cols)
        if (
          LOOKS_SENSITIVE.test(c) &&
          !SENSITIVE_COLUMNS[table]?.includes(c) &&
          !ALLOWED[table]?.includes(c)
        )
          unknown.push(`${table}.${c}`);
    expect(unknown).toEqual([]);
  });
});

describe('readOnlySql 개인 정보 열', () => {
  it('막힌 열을 이름으로 적으면 거절한다', () => {
    for (const bad of [
      'SELECT email FROM profiles LIMIT 5',
      'SELECT id, google_sub FROM profiles',
      'SELECT apple_sub FROM profiles',
      'SELECT recovery_code_hash FROM profiles',
      'SELECT nickname, body FROM board_comments',
      'SELECT token_hash FROM sessions',
      'SELECT google_email, code_verifier FROM app_auth_tickets',
      'SELECT token FROM push_devices',
      'SELECT transaction_id FROM iap_purchases',
      'SELECT xsolla_order_id FROM web_pay_orders',
      'SELECT chain_id FROM memberships',
      'SELECT label FROM report_feed',
      'SELECT count(*) FROM profiles WHERE email IS NOT NULL',
      'SELECT count(*) FROM profiles WHERE google_sub IS NOT NULL',
      "SELECT id FROM profiles WHERE email LIKE 'a%'",
      'SELECT substr(email, 1, 2) FROM profiles',
    ])
      expect(() => readOnlySql(bad), bad).toThrow(/개인 정보/);
  });

  it('별칭 · 대소문자 · 따옴표 · 주석으로 돌아가도 거절한다', () => {
    for (const bad of [
      'SELECT p.email FROM profiles p',
      'SELECT P.EMAIL FROM Profiles AS P',
      'SELECT "email" FROM "profiles"',
      'SELECT `email` FROM `profiles`',
      'SELECT [email] FROM [profiles]',
      'SELECT x.e FROM (SELECT email AS e FROM profiles) x',
      'WITH a(e) AS (SELECT email FROM profiles) SELECT e FROM a',
      'SELECT c.body, p.nickname FROM board_comments c JOIN profiles p ON p.id = c.profile_id',
      'SELECT main.profiles.email FROM main.profiles',
      'SELECT /* x */ email -- y\n FROM profiles',
      // 작은따옴표 '표'는 SQLite가 식별자로 받는다. 식별자 따옴표 안의 '로 문자열 경계를 흐려도 막는다.
      "SELECT email FROM 'profiles'",
      "SELECT x.email FROM 'profiles' x",
      "SELECT * FROM 'profiles'",
      `SELECT 1 AS "a'", email, 2 AS "'b" FROM profiles`,
      `SELECT email AS "'" FROM profiles AS "'"`,
      `SELECT 1 AS "'", *, 2 AS "'" FROM profiles`,
      "SELECT email AS [x'] FROM profiles AS [y']",
      "SELECT 1 AS `a'`, email, 2 AS `'b` FROM profiles",
      "SELECT email AS `'` FROM profiles AS `'`",
      "SELECT 1 AS `'`, *, 2 AS `'` FROM profiles",
    ])
      expect(() => readOnlySql(bad), bad).toThrow(/개인 정보|열 이름/);
  });

  it('막힌 열이 있는 표를 * · 표.*로 읽으면 거절한다', () => {
    for (const bad of [
      'SELECT * FROM profiles LIMIT 1',
      'SELECT p.* FROM profiles p',
      'SELECT DISTINCT * FROM board_comments',
      'SELECT id, * FROM sessions',
      'WITH a AS (SELECT * FROM profiles) SELECT count(*) FROM a',
      'SELECT c . * FROM board_comments c',
      'SELECT * FROM "push_devices"',
    ])
      expect(() => readOnlySql(bad), bad).toThrow(/열 이름/);
  });

  it('profiles 거절에는 로그인 연결 수를 셀 열을 알려 준다', () => {
    expect(() => readOnlySql('SELECT count(*) FROM profiles WHERE google_sub IS NOT NULL')).toThrow(
      /linked_at/,
    );
  });

  it('문자열에 막힌 열 이름이 들어가도 막는다(받아들인 과잉 차단)', () => {
    expect(() =>
      readOnlySql("SELECT body FROM board_comments WHERE body LIKE '%nickname%'"),
    ).toThrow(/개인 정보/);
  });

  it('보통 집계 · 조사 쿼리는 통과한다', () => {
    for (const ok of [
      "SELECT count(*) AS n FROM profiles WHERE created_at >= '2026-11-20'",
      'SELECT count(DISTINCT profile_id) FROM sessions WHERE last_seen_at > ?',
      "SELECT body, created_at FROM board_comments WHERE created_at >= '2026-11-01' AND body LIKE '%컵%' LIMIT 20",
      "SELECT store, product_id, count(*) FROM iap_purchases WHERE created_at >= '2026-11-01' GROUP BY 1, 2",
      'SELECT platform, count(*) FROM push_devices GROUP BY platform',
      'SELECT price_milliunits * 2 AS x FROM iap_purchases LIMIT 1',
      "SELECT * FROM client_errors WHERE day >= '2026-11-20' LIMIT 20",
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name = 'profiles'",
      "SELECT key, value FROM app_meta WHERE key LIKE 'backup%'",
      "SELECT id FROM owner_teams WHERE name = 'email'",
      'SELECT count(*) FROM profiles WHERE linked_at IS NOT NULL OR apple_linked_at IS NOT NULL',
    ])
      expect(() => readOnlySql(ok), ok).not.toThrow();
  });
});

describe('Cloudflare MCP D1 막기', () => {
  it('D1 데이터 경로는 서버에 보내지 않고 D1 분석은 보낸다', async () => {
    const sent: string[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      const msg = JSON.parse(String(init.body)) as { method: string };
      sent.push(msg.method);
      const result =
        msg.method === 'tools/list'
          ? { tools: [{ name: 'execute', inputSchema: { type: 'object' } }] }
          : msg.method === 'tools/call'
            ? { content: [{ type: 'text', text: 'ok' }] }
            : {};
      return Response.json({ jsonrpc: '2.0', id: 1, result });
    }) as unknown as typeof fetch;
    const [exec] = await mcpTools(
      { name: 'cloudflare', url: 'https://mcp.example/mcp', token: 't', deny: CF_MCP_DENY },
      fetcher,
    );
    for (const code of [
      'cloudflare.request({ path: `/accounts/a/d1/database/x/query`, body: { sql: "SELECT 1" } })',
      'api.d1.database.query({ sql: "SELECT email FROM profiles" })',
      "fetch('/accounts/a/D1/database')",
      'cloudflare.request({ path: "/accounts/a/d1/database/x/raw" })',
      'cloudflare.request({ path: "/accounts/a/d1/database/x/export" })',
    ])
      await expect(exec!.run({ code }), code).rejects.toThrow(/d1_query/);
    expect(sent).not.toContain('tools/call');
    for (const code of [
      'cloudflare.request({ path: "/accounts/12d1f/workers/scripts" })',
      'graphql: d1AnalyticsAdaptiveGroups { sum { queryBatchTimeMs readQueries rowsRead rowsWritten } }',
      'cloudflare.request({ path: "/accounts/a/workers/scripts/x-d1c4-y" })',
    ])
      expect(await exec!.run({ code }), code).toBe('ok');
    expect(sent.filter((m) => m === 'tools/call')).toHaveLength(3);
  });
});
