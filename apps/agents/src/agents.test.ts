import { describe, expect, it } from 'vitest';
import { costOf, MODEL, runAgent, type Tool } from './claude.ts';
import type { Env } from './env.ts';
import { decide } from './index.ts';
import { slackClient, verifySlack } from './slack.ts';
import { failureText } from './thread.ts';
import { ClaudeError } from './claude.ts';
import { readOnlySql } from './tools/ops.ts';
import { alertSignature } from './ledger.ts';
import { mcpTools, parseRpc } from './mcp.ts';
import { parseHandoffs } from './handoff.ts';
import { collect, fetchDc, meaningful, parseDcList, triagePrompt } from './reactions.ts';
import { nextRuns, kstText } from './cron.ts';

async function sign(secret: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v0:${ts}:${body}`)),
  );
  return `v0=${[...mac].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

describe('verifySlack', () => {
  it('맞는 서명만 받고, 5분 지난 요청은 거절한다', async () => {
    const body = '{"type":"event_callback"}';
    const sig = await sign('s3cret', '1000', body);
    expect(await verifySlack('s3cret', '1000', sig, body, 1000)).toBe(true);
    expect(await verifySlack('other', '1000', sig, body, 1000)).toBe(false);
    expect(await verifySlack('s3cret', '1000', sig, `${body} `, 1000)).toBe(false);
    expect(await verifySlack('s3cret', '1000', sig, body, 1000 + 301)).toBe(false);
    expect(await verifySlack('', '1000', sig, body, 1000)).toBe(false);
  });

  it('글을 올릴 때만 한글 작성자 이름을 붙인다', async () => {
    const sent: Record<string, unknown>[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response('{"ok":true}');
    }) as unknown as typeof fetch;
    const slack = slackClient('xoxb-t', fetcher, '이운재 · 운영');
    await slack('chat.postMessage', { channel: 'C1', text: 'hi' });
    await slack('reactions.add', { channel: 'C1', timestamp: '1', name: 'eyes' });
    expect(sent[0]).toMatchObject({ username: '이운재 · 운영', text: 'hi' });
    expect(sent[1]).not.toHaveProperty('username');
  });
});

describe('readOnlySql', () => {
  it('SELECT · WITH 한 문장만 통과시킨다', () => {
    expect(readOnlySql('SELECT 1;')).toBe('SELECT 1');
    expect(readOnlySql('-- 메모\nWITH a AS (SELECT 1) SELECT * FROM a')).toContain('WITH');
    expect(readOnlySql("SELECT * FROM t WHERE note = 'delete me'")).toContain('delete me');
    for (const bad of [
      'DELETE FROM t',
      'SELECT 1; DROP TABLE t',
      'PRAGMA table_info(t)',
      'select 1 /* x */; update t set a=1',
      'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x',
      '',
    ])
      expect(() => readOnlySql(bad)).toThrow();
  });
});

describe('runAgent', () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const usage = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000 };

  it('도구를 부르고 결과를 넘긴 뒤 답과 비용을 돌려준다', async () => {
    const sent: { model: string; messages: unknown[] }[] = [];
    const responses = [
      reply({
        model: MODEL,
        stop_reason: 'tool_use',
        usage,
        content: [{ type: 'tool_use', id: 't1', name: 'echo', input: { v: 'x' } }],
      }),
      reply({
        model: MODEL,
        stop_reason: 'end_turn',
        usage,
        content: [{ type: 'text', text: '끝났어요' }],
      }),
    ];
    const fetcher = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return responses.shift()!;
    }) as unknown as typeof fetch;
    const tool: Tool = {
      name: 'echo',
      description: '',
      input_schema: { type: 'object' },
      run: async (i) => `got ${String(i.v)}`,
    };
    const r = await runAgent({
      apiKey: 'k',
      system: 's',
      tools: [tool],
      messages: [{ role: 'user', content: 'hi' }],
      maxTurns: 5,
      budgetUsd: 1,
      fetcher,
    });
    expect(r).toMatchObject({ text: '끝났어요', turns: 2 });
    expect(r.costUsd).toBeCloseTo(2 * costOf(usage));
    expect(sent.every((b) => b.model === MODEL)).toBe(true);
    expect(JSON.stringify(sent[1]!.messages)).toContain('got x');
  });

  it('응답 모델이 Opus 5.5가 아니면 실패한다', async () => {
    const fetcher = (async () =>
      reply({
        model: 'claude-sonnet-5-5',
        stop_reason: 'end_turn',
        usage,
        content: [],
      })) as unknown as typeof fetch;
    await expect(
      runAgent({
        apiKey: 'k',
        system: 's',
        tools: [],
        messages: [],
        maxTurns: 5,
        budgetUsd: 1,
        fetcher,
      }),
    ).rejects.toThrow(/unexpected model/);
  });

  it('작업 한도 금액에 닿으면 도구 없이 마지막 답을 받고 멈춘다', async () => {
    const big = { input_tokens: 1_000_000, output_tokens: 0 };
    const bodies: { tool_choice?: unknown; messages: { content: unknown }[] }[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? reply({
            model: MODEL,
            stop_reason: 'tool_use',
            usage: big,
            content: [{ type: 'tool_use', id: 't', name: 'none', input: {} }],
          })
        : reply({
            model: MODEL,
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 10 },
            content: [{ type: 'text', text: '확인한 것까지 정리' }],
          });
    }) as unknown as typeof fetch;
    const r = await runAgent({
      apiKey: 'k',
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: '봐 줘' }],
      maxTurns: 5,
      budgetUsd: 1,
      fetcher,
    });
    expect(r).toMatchObject({ stopped: 'budget', turns: 2, text: '확인한 것까지 정리' });
    expect(bodies[0]!.tool_choice).toBeUndefined();
    expect(bodies[1]!.tool_choice).toEqual({ type: 'none' });
    expect(JSON.stringify(bodies[1]!.messages.at(-1))).toContain('조회 한도에 닿았어요');
  });

  it('API 오류는 상태 코드로 알린다', async () => {
    const fetcher = (async () =>
      reply({ error: { type: 'authentication_error' } }, 401)) as unknown as typeof fetch;
    const e = await runAgent({
      apiKey: 'k',
      system: 's',
      tools: [],
      messages: [],
      maxTurns: 5,
      budgetUsd: 1,
      fetcher,
    }).catch((x: unknown) => x);
    expect(failureText(e)).toContain('키를 확인');
    expect(failureText(new ClaudeError(529, 'overloaded'))).toContain('바빠서');
  });
});

describe('decide', () => {
  const env = {
    OPERATOR_USER_ID: 'UOP',
    AGENT_APP_IDS: 'AOPS,APLAN',
    AGENT_BOT_USERS: 'UBOTOPS,UBOTPLAN',
    ALERT_CHANNELS: 'CALERT',
  } as Env;
  const ev = (e: Record<string, unknown>) =>
    ({ channel: 'CDESK', ts: '1.1', ...e }) as Parameters<typeof decide>[3];

  it('한글로 부른 글은 부른 역할만 멘션으로 받는다', () => {
    const call = (role: 'ops' | 'plan', e: Record<string, unknown>) =>
      decide(
        env,
        role,
        'EK',
        ev({ type: 'message', user: 'UOP', ...e }),
        role === 'ops' ? 'UBOTOPS' : 'UBOTPLAN',
      );
    expect(call('ops', { text: '@이운재 오늘 가입 수' })).toMatchObject({
      kind: 'mention',
      threadTs: '1.1',
      text: '오늘 가입 수',
    });
    expect(call('plan', { text: '@이운재 오늘 가입 수' })).toBeNull();
    expect(call('plan', { text: '@기획 댓글 정리해 줘', thread_ts: '0.9' })).toMatchObject({
      kind: 'mention',
      threadTs: '0.9',
    });
    // 박지성이 연 스레드라도 이운재를 불렀으면 박지성은 답하지 않는다.
    expect(call('plan', { text: '@운영 서버 봐 줘', thread_ts: '0.9' })).toBeNull();
    expect(call('ops', { text: '@운영팀 이야기' })).toBeNull();
    expect(
      decide(
        env,
        'ops',
        'EK2',
        ev({ type: 'message', user: 'USTRANGER', text: '@이운재 hi' }),
        'UBOTOPS',
      ),
    ).toBeNull();
  });

  it('운영자 멘션만 받는다', () => {
    expect(
      decide(
        env,
        'ops',
        'E1',
        ev({ type: 'app_mention', user: 'UOP', text: '<@UBOTOPS> 오늘 가입 수' }),
        'UBOTOPS',
      ),
    ).toMatchObject({ kind: 'mention', threadTs: '1.1', text: '오늘 가입 수' });
    expect(
      decide(
        env,
        'ops',
        'E2',
        ev({ type: 'app_mention', user: 'USTRANGER', text: 'hi' }),
        'UBOTOPS',
      ),
    ).toBeNull();
  });

  it('경보 채널의 웹훅 글을 경보로 받고, 정상 복구 · 에이전트 글은 건너뛴다', () => {
    expect(
      decide(
        env,
        'ops',
        'E3',
        ev({
          type: 'message',
          subtype: 'bot_message',
          bot_id: 'B1',
          channel: 'CALERT',
          text: '🚨 점검 필요',
        }),
        'UBOTOPS',
      ),
    ).toMatchObject({ kind: 'alert' });
    expect(
      decide(
        env,
        'ops',
        'E4',
        ev({
          type: 'message',
          subtype: 'bot_message',
          bot_id: 'B1',
          channel: 'CALERT',
          text: '✅ 정상 복구',
        }),
        'UBOTOPS',
      ),
    ).toBeNull();
    expect(
      decide(
        env,
        'ops',
        'E5',
        ev({ type: 'message', bot_id: 'B2', app_id: 'APLAN', channel: 'CALERT', text: '🚨' }),
        'UBOTOPS',
      ),
    ).toBeNull();
    expect(
      decide(
        env,
        'ops',
        'E6',
        ev({
          type: 'message',
          subtype: 'bot_message',
          bot_id: 'B1',
          channel: 'CALERT',
          thread_ts: '0.9',
          text: '🚨',
        }),
        'UBOTOPS',
      ),
    ).toBeNull();
  });

  it('운영자 스레드 답글은 이어 받고, 멘션이 든 글은 app_mention 쪽에 맡긴다', () => {
    expect(
      decide(
        env,
        'ops',
        'E7',
        ev({ type: 'message', user: 'UOP', thread_ts: '0.5', text: '더 봐 줘' }),
        'UBOTOPS',
      ),
    ).toMatchObject({ kind: 'reply', threadTs: '0.5' });
    expect(
      decide(
        env,
        'ops',
        'E8',
        ev({ type: 'message', user: 'UOP', thread_ts: '0.5', text: '<@UBOTOPS> 더' }),
        'UBOTOPS',
      ),
    ).toBeNull();
    expect(
      decide(
        env,
        'ops',
        'E9',
        ev({ type: 'message', subtype: 'message_changed', user: 'UOP', thread_ts: '0.5' }),
        'UBOTOPS',
      ),
    ).toBeNull();
  });
});

describe('alertSignature', () => {
  it('숫자만 다른 재안내는 같은 경보로 본다', () => {
    const a = '🚨 점검 필요 D1 할당 용량: 4.41 GB / 10 GB 용량 소진 예상: 15.1일';
    const b = '🚨 점검 필요 D1 할당 용량: 4.34 GB / 10 GB 용량 소진 예상: 14.0일';
    expect(alertSignature(a)).toBe(alertSignature(b));
    expect(alertSignature(a)).not.toBe(alertSignature('🚨 운영 API 응답 실패'));
  });
});

describe('mcpTools', () => {
  it('SSE 응답을 읽고, 세션을 이어 가며 도구를 옮긴다', async () => {
    expect(parseRpc('event: message\ndata: {"result":{"ok":1}}\n\n')).toEqual({
      result: { ok: 1 },
    });
    const calls: { method: string; session: string | null; auth: string | null }[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      const h = new Headers(init.headers);
      const msg = JSON.parse(String(init.body)) as {
        method: string;
        params?: { arguments?: unknown };
      };
      calls.push({
        method: msg.method,
        session: h.get('mcp-session-id'),
        auth: h.get('authorization'),
      });
      const result =
        msg.method === 'tools/list'
          ? { tools: [{ name: 'execute', description: 'run', inputSchema: { type: 'object' } }] }
          : msg.method === 'tools/call'
            ? { content: [{ type: 'text', text: `ran ${JSON.stringify(msg.params?.arguments)}` }] }
            : {};
      return new Response(
        `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\n`,
        {
          headers: { 'mcp-session-id': 'S1', 'content-type': 'text/event-stream' },
        },
      );
    }) as unknown as typeof fetch;
    const tools = await mcpTools(
      { name: 'cloudflare', url: 'https://mcp.example/mcp', token: 't' },
      fetcher,
    );
    expect(tools.map((t) => t.name)).toEqual(['cloudflare_execute']);
    expect(await tools[0]!.run({ code: 'x' })).toBe('ran {"code":"x"}');
    expect(calls.map((c) => c.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
      'tools/call',
    ]);
    expect(calls.slice(1).every((c) => c.session === 'S1' && c.auth === 'Bearer t')).toBe(true);
  });
});

describe('parseHandoffs', () => {
  it('줄 머리의 → @역할: 만 넘기고, 자기 자신 · 모르는 역할 · 중복은 뺀다', () => {
    const text = [
      '정리했어요. 본문 중간의 → @ops: 는 넘기지 않아요.',
      '→ @ops: 10-15 20시쯤 시즌 저장 실패가 있었는지 확인해 주세요',
      '- **→ @dev:** 작업 후보',
      '→ @plan: 자기 자신',
      '→ @ops: 두 번째',
      '-> @boss: 모르는 역할',
    ].join('\n');
    expect(parseHandoffs(text, 'plan')).toEqual([
      { to: 'ops', request: '10-15 20시쯤 시즌 저장 실패가 있었는지 확인해 주세요' },
      { to: 'dev', request: '작업 후보' },
    ]);
    expect(parseHandoffs('→ @이운재: 서버 확인\n→ @마케팅: 공지 초안', 'plan')).toEqual([
      { to: 'ops', request: '서버 확인' },
      { to: 'mkt', request: '공지 초안' },
    ]);
  });
});

describe('collect', () => {
  const env = {
    CF_ACCOUNT_ID: 'acc',
    D1_DATABASE_ID: 'db',
    CF_D1_READ_TOKEN: 'd1',
    API_BASE: 'https://api.test',
    AGENTS_READ_TOKEN: 'salt',
  } as Env;
  const now = Date.parse('2026-10-15T12:00:00Z');

  it('댓글 · 채팅을 가명으로 모으고 짧은 글은 빼며, 실패한 쪽 커서는 그대로 둔다', async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).includes('/d1/')) {
        const { params } = JSON.parse(String(init?.body)) as { params: string[] };
        expect(params[0]).toBe('2026-10-15T11:00:00.000Z');
        return Response.json({
          success: true,
          result: [
            {
              results: [
                {
                  id: 'c1',
                  created_at: '2026-10-15T11:10:00.000Z',
                  profile_id: 'p1',
                  body: '저장하면 선수가 사라져요',
                  post_id: 'n1',
                  title: '업데이트',
                  board: 'release',
                },
                {
                  id: 'c2',
                  created_at: '2026-10-15T11:20:00.000Z',
                  profile_id: 'p1',
                  body: 'ㅋㅋㅋㅋ',
                  post_id: 'n1',
                  title: '업데이트',
                  board: 'release',
                },
              ],
            },
          ],
        });
      }
      return new Response('down', { status: 503 });
    }) as typeof fetch;
    const r = await collect(env, { chat: 123 }, now, fetcher);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      source: 'comment',
      at: '2026-10-15 20:10',
      body: '저장하면 선수가 사라져요',
      link: 'https://offside-lab.com/?news=n1&board=release',
    });
    expect(r.items[0]!.author).toMatch(/^u[0-9a-f]{8}$/);
    expect(JSON.stringify(r.items)).not.toContain('p1');
    expect(r.cursors).toEqual({
      comments: { at: '2026-10-15T11:20:00.000Z', id: 'c2' },
      chat: 123,
    });
    expect(r.errors).toEqual(['Error: chat 503']);
    expect(calls[1]).toBe('https://api.test/v1/internal/agents/chat?since=123&limit=200');

    const prompt = triagePrompt(r.items, '2026-10-15 21:00');
    expect(prompt).toContain('<reactions>');
    expect(prompt).toContain('"출처":"게임 댓글"');
  });

  it('meaningful은 웃음 · 기호만 있는 글을 뺀다', () => {
    expect(meaningful('ㅋㅋㅋ!!')).toBe(false);
    expect(meaningful('골키퍼 버그')).toBe(true);
  });
});

describe('nextRuns', () => {
  it('*/5 · 매일 · 매시 n분을 KST로 다음 실행을 낸다', () => {
    const at = Date.parse('2026-10-15T18:58:30Z');
    expect(nextRuns('*/5 * * * *', at, 2).map(kstText)).toEqual([
      '2026-10-16 04:00',
      '2026-10-16 04:05',
    ]);
    expect(nextRuns('0 19 * * *', at, 1).map(kstText)).toEqual(['2026-10-16 04:00']);
    expect(nextRuns('17 * * * *', at, 1).map(kstText)).toEqual(['2026-10-16 04:17']);
    expect(nextRuns('0 9 * * 1', Date.parse('2026-10-15T00:00:00Z'), 1).map(kstText)).toEqual([]);
    expect(() => nextRuns('* *', at)).toThrow();
  });
});

describe('디시 갤러리', () => {
  const row = (no: number, title: string, at: string, replies = 0, notice = false) =>
    `<tr class="ub-content us-post" data-no="${no}" data-type="${notice ? 'icon_notice' : 'icon_txt'}" >
      <td class="gall_tit ub-word"><a href="/mgallery/board/view/?id=offsidegame&no=${no}&page=1"><em class="icon_img"></em>${title}</a>
      ${replies ? `<a class="reply_numbox"><span class="reply_num">[${replies}]</span></a>` : ''}</td>
      <td class="gall_writer ub-writer" data-nick="닉${no}" data-uid="" data-ip="1.2" data-loc="list"></td>
      <td class="gall_date" title="${at}">x</td></tr>`;
  const list = (rows: string[]) => `<table class="gall_list">${rows.join('')}</table>`;
  const env = { AGENTS_READ_TOKEN: 'salt' } as Env;
  const now = Date.parse('2026-10-15T12:00:00Z'); // 21:00 KST

  it('목록에서 공지를 빼고 시각 · 댓글 수를 읽는다', () => {
    const rows = parseDcList(
      list([
        row(1, '공지', '2026-10-01 10:00:00', 0, true),
        row(270, '렉 &amp; 끊김', '2026-10-15 20:32:38', 4),
      ]),
    );
    expect(rows).toEqual([
      {
        no: 270,
        title: '렉 & 끊김',
        at: Date.parse('2026-10-15T11:32:38Z'),
        author: '닉270@1.2',
        replies: 4,
      },
    ]);
  });

  it('빈 응답은 다시 받고, 끝내 비면 실패로 던진다(커서는 그대로)', async () => {
    let n = 0;
    const flaky = (async () => new Response(++n < 3 ? '' : list([]))) as unknown as typeof fetch;
    expect((await fetchDc(env, undefined, now, flaky)).items).toEqual([]);
    expect(n).toBe(3);
    const empty = (async () => new Response('')) as unknown as typeof fetch;
    await expect(fetchDc(env, undefined, now, empty)).rejects.toThrow('dc empty response');
  });

  it('새 글 본문과 새 댓글만 모으고 링크는 지우며, 다음엔 늘어난 글만 다시 연다', async () => {
    const calls: string[] = [];
    let listing = list([
      row(270, '렉 해결 시급', '2026-10-15 20:32:38', 2),
      row(200, '옛 글', '2026-10-10 10:00:00', 5),
    ]);
    let comments = [
      {
        no: '492',
        user_id: '',
        name: 'ㅇㅇ',
        ip: '1.1',
        reg_date: '10.15 20:40:00',
        memo: '<a href="https://spam.example/x">https://spam.example/x</a> 여기서 보세요',
        del_yn: 'N',
        is_delete: '0',
      },
      {
        no: '493',
        user_id: 'u1',
        name: '갤러',
        ip: '',
        reg_date: '10.15 20:45:00',
        memo: '저도 경기 화면이 멈춰요',
        del_yn: 'N',
        is_delete: '0',
      },
    ];
    const fetcher = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('/lists/')) return new Response(listing);
      if (String(url).includes('/view/'))
        return new Response(
          '<input id="e_s_n_o" name="e_s_n_o" value="tok"><div class="write_div" style="x">경기 중에 <b>렉</b>이 심해요</div>',
        );
      return Response.json({ comments });
    }) as typeof fetch;
    const first = await fetchDc(env, undefined, now, fetcher);
    expect(first.items.map((x) => [x.source, x.body])).toEqual([
      ['dc-post', '렉 해결 시급 / 경기 중에 렉 이 심해요'],
      ['dc-comment', '[링크] 여기서 보세요'],
      ['dc-comment', '저도 경기 화면이 멈춰요'],
    ]);
    expect(JSON.stringify(first.items)).not.toMatch(/닉270|갤러|spam\.example/);
    expect(first.cursor).toEqual({ post: 270, comment: 493, counts: { 270: 2, 200: 5 } });
    expect(calls.filter((u) => u.includes('/view/'))).toHaveLength(1);

    // 옛 글에 댓글이 하나 늘었다: 그 글만 열고 새 댓글만 가져온다.
    calls.length = 0;
    listing = list([
      row(270, '렉 해결 시급', '2026-10-15 20:32:38', 2),
      row(200, '옛 글', '2026-10-10 10:00:00', 6),
    ]);
    comments = [
      { ...comments[1]!, no: '501', memo: '아직도 안 고쳐졌네요', reg_date: '10.15 21:10:00' },
      comments[1]!,
    ];
    const next = await fetchDc(env, first.cursor, now + 3600_000, fetcher);
    expect(next.items.map((x) => [x.source, x.body, x.post])).toEqual([
      ['dc-comment', '아직도 안 고쳐졌네요', '옛 글'],
    ]);
    expect(calls.filter((u) => u.includes('/view/'))).toEqual([
      'https://gall.dcinside.com/mgallery/board/view/?id=offsidegame&no=200',
    ]);
    expect(next.cursor?.comment).toBe(501);
  });
});
