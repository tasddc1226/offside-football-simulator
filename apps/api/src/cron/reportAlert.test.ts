import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { REPORT_ALERT_KEY, alertNewReports, plainName, reportAlertText } from './reportAlert.js';

// T-11-616 새 신고 알림: 이름 · 채팅 · 댓글 신고를 5분 단위로 묶어 운영 알림 채널에 한 번만 알린다.

const HOOK = 'https://discord.com/api/webhooks/123456/secret-token';
const NOW = Date.parse('2026-11-02T03:05:00.000Z');
const at = (min: number, sec = 0) => new Date(NOW + min * 60_000 + sec * 1000).toISOString();

let ctx: TestD1;
let sent: { content: string }[];
let fail: boolean;
const env = (over: Record<string, string | undefined> = {}) =>
  ({
    ...ctx.env,
    ENVIRONMENT: 'production',
    BILLING_SLACK_WEBHOOK: HOOK,
    ...over,
  }) as typeof ctx.env;
const run = (sql: string, ...params: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...params)
    .run();
const cursor = async () =>
  (
    await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?')
      .bind(REPORT_ALERT_KEY)
      .first<{ value: string }>()
  )?.value;

async function seedParents() {
  await run(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}',?1,?1)",
    at(-1000),
  );
  await run(
    `INSERT INTO owner_teams(id,profile_id,name,formation,slots_json,filled,ovr,created_at,updated_at)
     VALUES ('tem_1','owner','가짜 구단','4-4-2','[]',0,0,?1,?1)`,
    at(-1000),
  );
  await run(
    `INSERT INTO board_posts(id,board,title,body,author_profile_id,created_at,updated_at)
     VALUES ('post_1','free','t','b','owner',?1,?1)`,
    at(-1000),
  );
  await run(
    `INSERT INTO board_comments(id,post_id,profile_id,nickname,body,created_at)
     VALUES ('cmt_1','post_1','owner','작성자','본문은 알림에 없어요',?1)`,
    at(-1000),
  );
  await run(
    `INSERT INTO team_comments(id,team_id,profile_id,nickname,body,created_at)
     VALUES ('tcm_1','tem_1','owner','작성자','팀 댓글 본문',?1)`,
    at(-1000),
  );
}
const nameReport = (target: string, reporter: string, name: string, createdAt: string) =>
  run(
    `INSERT INTO name_reports(kind,target_id,profile_id,name,created_at) VALUES ('team',?1,?2,?3,?4)`,
    target,
    reporter,
    name,
    createdAt,
  );

beforeEach(async () => {
  ctx = await createTestD1();
  sent = [];
  fail = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init: RequestInit) => {
      if (fail) return new Response('no', { status: 500 });
      sent.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await ctx.dispose();
});

describe('새 신고 알림 (T-11-616)', () => {
  it('네 종류의 신고를 한 글로 알리고 본문은 넣지 않으며 같은 신고를 다시 알리지 않는다', async () => {
    await seedParents();
    await nameReport('tem_1', 'r1', '나쁜 이름', at(-3));
    await nameReport('tem_1', 'r2', '나쁜 이름', at(-2));
    await run(
      `INSERT INTO chat_reports(message_id,profile_id,reason,author_profile_id,nickname,body,created_at,room)
       VALUES ('msg_1','r1','abuse','a1','채팅닉','채팅 본문 원문',?1,'en')`,
      at(-2),
    );
    await run(
      `INSERT INTO board_comment_reports(comment_id,profile_id,reason,created_at) VALUES ('cmt_1','r1','sexual',?1)`,
      at(-1),
    );
    await run(
      `INSERT INTO team_comment_reports(comment_id,profile_id,reason,created_at) VALUES ('tcm_1','r1','spam',?1)`,
      at(-1),
    );

    const r = await alertNewReports(env(), NOW);
    expect(r).toEqual({ names: 1, chats: 1, boardComments: 1, teamComments: 1 });
    expect(sent).toHaveLength(1);
    const text = sent[0]!.content;
    expect(text).toContain('이름 신고 1건');
    expect(text).toContain('구단 `tem_1` "나쁜 이름" · 2명이 신고');
    expect(text).toContain('메시지 `msg_1` · 방 en · 사유 abuse · 작성자 "채팅닉"');
    expect(text).toContain('댓글 `cmt_1` · 사유 sexual');
    expect(text).toContain('댓글 `tcm_1` · 사유 spam');
    expect(text).not.toContain('본문');
    expect(await cursor()).toBe(at(0, -30));

    // 같은 구간 · 다음 틱에는 새 신고가 없으니 보내지 않고 기록도 쓰지 않는다.
    expect(await alertNewReports(env(), NOW)).toBeNull();
    expect(await alertNewReports(env(), NOW + 5 * 60_000)).toBeNull();
    expect(sent).toHaveLength(1);
    expect(await cursor()).toBe(at(0, -30));

    // 다음 구간에 들어온 신고만 새로 알린다.
    await nameReport('tem_1', 'r3', '또 다른 이름', at(1));
    expect(await alertNewReports(env(), NOW + 5 * 60_000)).toMatchObject({ names: 1, chats: 0 });
    expect(sent).toHaveLength(2);
    expect(sent[1]!.content).toContain('또 다른 이름');
    expect(sent[1]!.content).not.toContain('나쁜 이름');
  });

  it('신고가 없으면 알림도 DB 쓰기도 없고, 처리된 이름 신고 · 막 들어온(30초 안) 신고는 건너뛴다', async () => {
    expect(await alertNewReports(env(), NOW)).toBeNull();
    await nameReport('tem_9', 'r1', '처리됨', at(-2));
    await run("UPDATE name_reports SET resolved_at = ?1 WHERE target_id = 'tem_9'", at(-1));
    await nameReport('tem_8', 'r1', '방금', at(0, -10));
    expect(await alertNewReports(env(), NOW)).toBeNull();
    expect(sent).toHaveLength(0);
    expect(await cursor()).toBeUndefined();
    // 30초가 지나면 같은 신고가 알림 구간에 들어온다.
    expect(await alertNewReports(env(), NOW + 60_000)).toMatchObject({ names: 1 });
    expect(sent[0]!.content).toContain('tem_8');
    expect(sent[0]!.content).not.toContain('tem_9');
  });

  it('알림이 실패하면 던지고 구간을 되돌려 다음 틱이 다시 보낸다(신고 저장은 그대로)', async () => {
    await nameReport('tem_1', 'r1', '이름', at(-2));
    fail = true;
    await expect(alertNewReports(env(), NOW)).rejects.toThrow('rejected');
    expect(await cursor()).toBeUndefined();
    expect(
      (await ctx.env.DB.prepare('SELECT count(*) AS n FROM name_reports').first<{ n: number }>())
        ?.n,
    ).toBe(1);

    fail = false;
    expect(await alertNewReports(env(), NOW + 5 * 60_000)).toMatchObject({ names: 1 });
    expect(sent).toHaveLength(1);

    // 기록이 있을 때의 실패도 이전 기록으로 되돌린다.
    const before = await cursor();
    await nameReport('tem_2', 'r1', '둘째', at(6));
    fail = true;
    await expect(alertNewReports(env(), NOW + 10 * 60_000)).rejects.toThrow();
    expect(await cursor()).toBe(before);
    fail = false;
    expect(await alertNewReports(env(), NOW + 15 * 60_000)).toMatchObject({ names: 1 });
    expect(sent).toHaveLength(2);
  });

  it('운영 환경이 아니거나 웹훅이 없거나 디스코드 주소가 아니면 아무것도 하지 않는다', async () => {
    await nameReport('tem_1', 'r1', '이름', at(-2));
    expect(await alertNewReports(env({ ENVIRONMENT: 'staging' }), NOW)).toBeNull();
    expect(await alertNewReports(env({ BILLING_SLACK_WEBHOOK: undefined }), NOW)).toBeNull();
    expect(
      await alertNewReports(env({ BILLING_SLACK_WEBHOOK: 'https://example.com/hook' }), NOW),
    ).toBeNull();
    expect(sent).toHaveLength(0);
    expect(await cursor()).toBeUndefined();
  });

  it('두 틱이 같은 구간을 동시에 잡아도 한 번만 알린다', async () => {
    await nameReport('tem_1', 'r1', '이름', at(-2));
    await run('INSERT INTO app_meta(key,value) VALUES (?1,?2)', REPORT_ALERT_KEY, at(-4));
    const results = await Promise.all([alertNewReports(env(), NOW), alertNewReports(env(), NOW)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('한 번에 쏟아져도 글은 하나이고 줄 수는 제한되며 이름의 서식 · 멘션 문자는 막는다', async () => {
    for (let i = 0; i < 30; i++) await nameReport(`tem_${i}`, 'r1', `이름${i}`, at(-2, i));
    await alertNewReports(env(), NOW);
    expect(sent).toHaveLength(1);
    const text = sent[0]!.content;
    expect(text).toContain('이름 신고 25건 넘게');
    expect(text).toContain('외 17건 넘게');
    expect(text.split('\n').length).toBeLessThan(15);
    expect(text.length).toBeLessThan(2000);

    expect(plainName('**굵게**\n<@1> `코드` @all')).toBe(
      '\\*\\*굵게\\*\\* \\<\\@1\\> \\`코드\\` \\@all',
    );
    expect(plainName('가'.repeat(40))).toBe(`${'가'.repeat(24)}…`);
    expect(
      reportAlertText({ names: [], chats: [], boardComments: [], teamComments: [] }, at(-5), at(0)),
    ).toBeNull();
  });

  it('신고 조회는 인덱스 범위로만 읽는다', async () => {
    const plan = async (sql: string) =>
      (
        await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
          .bind(at(-5), at(0))
          .all<{ detail: string }>()
      ).results
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan(
        'SELECT kind FROM name_reports WHERE resolved_at IS NULL AND created_at > ?1 AND created_at <= ?2 GROUP BY kind, target_id',
      ),
    ).toContain('name_reports_resolved_idx');
    expect(
      await plan(
        'SELECT message_id FROM chat_reports WHERE resolved_at IS NULL AND created_at > ?1 AND created_at <= ?2 GROUP BY message_id',
      ),
    ).toMatch(/chat_reports_(open|created)_idx/);
    expect(
      await plan(
        'SELECT comment_id FROM board_comment_reports WHERE created_at > ?1 AND created_at <= ?2 GROUP BY comment_id',
      ),
    ).toContain('board_comment_reports_created_idx');
    expect(
      await plan(
        'SELECT comment_id FROM team_comment_reports WHERE created_at > ?1 AND created_at <= ?2 GROUP BY comment_id',
      ),
    ).toContain('team_comment_reports_created_idx');
  });
});
