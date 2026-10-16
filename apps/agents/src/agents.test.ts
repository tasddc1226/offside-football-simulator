import { afterEach, describe, expect, it, vi } from 'vitest';
import { costOf, MODEL, MODELS, runAgent, withCacheTail, type Tool } from './claude.ts';
import { modelFor, roleSpec } from './roles.ts';
import { checkNotes, mktInteraction, releaseTask } from './mkt.ts';
import { ga4Tools, reportBody } from './ga4.ts';
import { deployCard, deployPlan } from './deploy.ts';
import { digestTools } from './tools/digest.ts';
import {
  maskAddress,
  newMail,
  parseMessage,
  replyRaw,
  supportInteraction,
  type Gmail,
  type MailDraft,
  type RawMessage,
} from './support.ts';
import type { Env } from './env.ts';
import { decide } from './index.ts';
import { slackClient, verifySlack } from './slack.ts';
import { failureText } from './thread.ts';
import { ClaudeError } from './claude.ts';
import { readOnlySql } from './tools/ops.ts';
import { alertSignature } from './ledger.ts';
import { mcpTools, parseRpc } from './mcp.ts';
import { linkRoles, parseHandoffs, shouldReturn } from './handoff.ts';
import { collect, fetchDc, meaningful, parseDcList, triagePrompt } from './reactions.ts';
import { nextRuns, kstText } from './cron.ts';
import { devInteraction, devTools, mergeBlocker } from './dev.ts';
import { appJwt, type Gh } from './github.ts';
import type { Task } from './thread.ts';

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
  it('대화 끝 블록 하나에만 캐시 표시를 달고 원본은 바꾸지 않는다', () => {
    const msgs = [
      { role: 'user' as const, content: '질문' },
      {
        role: 'assistant' as const,
        content: [{ type: 'tool_use', id: 't', name: 'x', input: {} }],
      },
      { role: 'user' as const, content: [{ type: 'tool_result', tool_use_id: 't', content: 'r' }] },
    ];
    const out = withCacheTail(msgs);
    expect(out[2]!.content).toEqual([
      { type: 'tool_result', tool_use_id: 't', content: 'r', cache_control: { type: 'ephemeral' } },
    ]);
    expect(JSON.stringify(out.slice(0, 2))).not.toContain('cache_control');
    expect(JSON.stringify(msgs)).not.toContain('cache_control');
    expect(withCacheTail([{ role: 'user', content: '질문' }])[0]!.content).toEqual([
      { type: 'text', text: '질문', cache_control: { type: 'ephemeral' } },
    ]);
  });

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

  it('일마다 모델을 고른다: 분류 · 경보 첫 정리 Haiku, 아침 보고 Sonnet, 나머지 Opus', () => {
    expect(modelFor('triage')).toBe(MODELS.haiku);
    expect(modelFor('alert')).toBe(MODELS.haiku);
    expect(modelFor('report')).toBe(MODELS.sonnet);
    for (const k of ['mention', 'reply', 'handoff'] as const) expect(modelFor(k)).toBe(MODELS.opus);
  });

  it('운영 · 기획은 게임 용어집을 함께 읽는다(킵은 후보 킵, 잠금과 다름)', () => {
    const task = { kind: 'mention', text: '' } as Task;
    for (const role of ['ops', 'plan'] as const) {
      const { system } = roleSpec({ GITHUB_REPO: 'o/r' } as Env, role, task);
      expect(system).toContain('## 게임 용어');
      expect(system).toContain('ft_scout_keep');
    }
  });

  it('고른 모델로 요청하고 그 모델 단가로 비용을 센다', async () => {
    const sent: { model: string }[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return reply({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', usage, content: [] });
    }) as unknown as typeof fetch;
    const r = await runAgent({
      apiKey: 'k',
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: 'hi' }],
      maxTurns: 5,
      budgetUsd: 1,
      model: MODELS.haiku,
      fetcher,
    });
    expect(sent[0]!.model).toBe('claude-haiku-5-5');
    // 1000 × 0.1 + 2000 × 0.01 + 100 × 0.5 = 170 / 1e6
    expect(r.costUsd).toBeCloseTo(170 / 1e6);
    expect(costOf(usage, MODELS.sonnet)).toBeCloseTo(costOf(usage) / 2);
    // Haiku는 프롬프트가 10만 토큰을 넘으면 5배
    expect(costOf({ input_tokens: 120_000, output_tokens: 0 }, MODELS.haiku)).toBeCloseTo(0.06);
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

  it('슬랙에 올릴 때 역할 키를 봇 멘션으로 바꾸고, 코드 표기 · 메일 주소는 그대로 둔다', () => {
    const env = { AGENT_BOT_USERS: 'UOPS,UPLAN,UDEV,UMKT' } as unknown as Env;
    expect(linkRoles(env, '@plan 결론부터요.\n→ @ops: 확인해 주세요')).toBe(
      '<@UPLAN> 결론부터요.\n→ <@UOPS>: 확인해 주세요',
    );
    expect(linkRoles(env, '`→ @dev:` 줄 · co***@ops.com · @planning')).toBe(
      '`→ @dev:` 줄 · co***@ops.com · @planning',
    );
  });

  it('넘겨받은 일의 결과는 넘긴 역할에게 한 번만 돌려준다', () => {
    expect(shouldReturn({ kind: 'handoff', from: 'plan' }, [])).toBe(true);
    expect(shouldReturn({ kind: 'handoff', from: 'plan', back: true }, [])).toBe(false);
    expect(shouldReturn({ kind: 'handoff', from: 'plan' }, [{ to: 'plan', request: 'x' }])).toBe(
      false,
    );
    expect(shouldReturn({ kind: 'mention' }, [])).toBe(false);
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

describe('@dev', () => {
  const gh =
    (routes: Record<string, unknown>, calls: string[] = []): Gh =>
    async (path, init) => {
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      const hit = Object.keys(routes).find((k) => path.startsWith(k));
      return { status: 200, data: (hit ? routes[hit] : {}) as never };
    };
  const pr = (o: Record<string, unknown> = {}) =>
    ({
      number: 7,
      title: 'T-11-999: 고침',
      state: 'open',
      html_url: '',
      head: { sha: 'abc', ref: 'agent-dev/1' },
      base: { ref: 'main' },
      ...o,
    }) as Parameters<typeof mergeBlocker>[1];
  const green = { check_runs: [{ name: 'PR plan', status: 'completed', conclusion: 'success' }] };

  it('검사 통과 · main 최신 · 승인한 커밋일 때만 머지한다', async () => {
    expect(
      await mergeBlocker(gh({ '/commits/': green, '/compare/': { behind_by: 0 } }), pr(), 'abc'),
    ).toBeNull();
    expect(await mergeBlocker(gh({}), pr(), 'zzz')).toMatch('커밋이 바뀌었어요');
    expect(
      await mergeBlocker(gh({}), pr({ head: { sha: 'abc', ref: 'feature/x' } }), 'abc'),
    ).toMatch('@dev가 연');
    const red = { check_runs: [{ name: 'e2e', status: 'completed', conclusion: 'failure' }] };
    expect(await mergeBlocker(gh({ '/commits/': red }), pr(), 'abc')).toMatch('통과하지 않았어요');
    const calls: string[] = [];
    expect(
      await mergeBlocker(
        gh({ '/commits/': green, '/compare/': { behind_by: 2 } }, calls),
        pr(),
        'abc',
      ),
    ).toMatch('최신 main으로 맞췄어요');
    expect(calls).toContain('PUT /pulls/7/update-branch');
  });

  it('작업 시작 도구는 운영자가 맡긴 일에만 있다', () => {
    const env = { GITHUB_REPO: 'o/r' } as Env;
    const task = (kind: Task['kind']) =>
      ({
        kind,
        role: 'dev',
        channel: 'C',
        threadTs: '1.1',
        eventId: 'e',
        sourceTs: '',
        text: '',
      }) as Task;
    const names = (k: Task['kind']) =>
      devTools(env, task(k), async () => gh({})).map((t) => t.name);
    expect(names('mention')).toContain('start_work');
    expect(names('reply')).toContain('start_work');
    expect(names('handoff')).not.toContain('start_work');
  });

  it('앱 JWT를 RS256으로 서명한다', async () => {
    const pair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const der = new Uint8Array(
      (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer,
    );
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
    const jwt = await appJwt('123', pem, 1_000_000_000_000);
    const [h, b, s] = jwt.split('.');
    const dec = (x: string) =>
      Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    expect(JSON.parse(new TextDecoder().decode(dec(b!)))).toMatchObject({
      iss: '123',
      iat: 999_999_970,
    });
    expect(
      await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        pair.publicKey,
        dec(s!),
        new TextEncoder().encode(`${h}.${b}`),
      ),
    ).toBe(true);
  });
});

describe('report_digest', () => {
  it('예약 워크플로 24시간 결과 · 로그 오류 집계 · 백업 기록을 한 번에 모은다', async () => {
    const urls: string[] = [];
    const json = (b: unknown) => new Response(JSON.stringify(b));
    const fetcher = (async (u: string, init?: RequestInit) => {
      urls.push(u);
      if (u.endsWith('/actions/workflows?per_page=100'))
        return json({
          workflows: [
            {
              id: 1,
              name: 'Infra health',
              path: '.github/workflows/infra-health.yml',
              state: 'active',
            },
          ],
        });
      if (u.includes('raw.githubusercontent.com'))
        return new Response("on:\n  schedule:\n    - cron: '17 * * * *'\n");
      if (u.includes('/actions/workflows/1/runs'))
        return json({
          workflow_runs: [
            {
              status: 'completed',
              conclusion: 'failure',
              created_at: '2026-10-16T00:17:00Z',
              html_url: 'https://x/1',
              event: 'schedule',
            },
            {
              status: 'completed',
              conclusion: 'success',
              created_at: '2026-10-15T23:17:00Z',
              html_url: 'https://x/2',
              event: 'schedule',
            },
          ],
        });
      if (u.endsWith('/schedules'))
        return json({ success: true, result: { schedules: [{ cron: '*/5 * * * *' }] } });
      if (u.endsWith('/telemetry/query')) {
        const q = JSON.parse(String(init?.body)) as {
          parameters: { groupBys: { value: string }[] };
        };
        return json({
          success: true,
          result: {
            calculations: [
              {
                aggregates: [
                  { count: 3, groups: [{ key: q.parameters.groupBys[0]!.value, value: 'backup' }] },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`unexpected ${u}`);
    }) as unknown as typeof fetch;
    const sqls: string[] = [];
    const [tool] = digestTools({
      repo: 'o/r',
      accountId: 'a',
      cfToken: 't',
      workers: ['offside-api'],
      fetcher,
      d1: async (sql) => (sqls.push(sql), '{"rows":[]}'),
    });
    const out = JSON.parse(await tool!.run({})) as {
      actions: { last24h: Record<string, number>; problems: { url: string }[] }[];
      logs_24h: { 'offside-api': { logs_by_job: { job: string; count: number }[] } };
      backup: { meta: string };
    };
    expect(out.actions[0]).toMatchObject({
      last24h: { failure: 1, success: 1 },
      problems: [{ url: 'https://x/1' }],
    });
    expect(out.logs_24h['offside-api'].logs_by_job).toEqual([{ job: 'backup', count: 3 }]);
    expect(out.backup.meta).toBe('{"rows":[]}');
    expect(sqls[0]).toContain('cron:backup:last');
    expect(urls.some((u) => u.includes('per_page=40&created=%3E%3D'))).toBe(true);
  });
});

describe('고객 문의', () => {
  const enc = (t: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(t)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const raw = (
    id: string,
    at: number,
    from: string,
    text: string,
    extra: Partial<RawMessage> = {},
  ): RawMessage => ({
    id,
    threadId: `t-${id}`,
    internalDate: String(at),
    payload: {
      mimeType: 'multipart/alternative',
      headers: [
        { name: 'From', value: from },
        { name: 'Subject', value: '결제 문의' },
        { name: 'Message-ID', value: `<${id}@mail>` },
      ],
      parts: [{ mimeType: 'text/plain', body: { data: enc(text) } }],
    },
    ...extra,
  });

  it('본문에서 인용된 앞 메일을 빼고 주소를 가린다', () => {
    const m = parseMessage(
      raw(
        '1',
        1000,
        '유저 <someone@example.com>',
        '광고 제거가 안 돼요\n\nOn Mon, a wrote:\n> 이전 답장',
      ),
    );
    expect(m.body).toBe('광고 제거가 안 돼요');
    expect(maskAddress(m.from)).toBe('so***@example.com');
  });

  it('커서 뒤 문의만, 자동 메일 · 우리가 보낸 메일은 빼고 오래된 순으로', async () => {
    const msgs: Record<string, RawMessage> = {
      a: raw('a', 3000, 'u1@example.com', '두 번째'),
      b: raw('b', 2000, 'u2@example.com', '첫 번째'),
      c: raw('c', 2500, 'no-reply@example.com', '영수증'),
      d: raw('d', 2600, 'me@example.com', '우리 답', { labelIds: ['SENT'] }),
      e: raw('e', 500, 'u3@example.com', '예전 것'),
    };
    const qs: string[] = [];
    const g = (async (path: string) => {
      if (path.startsWith('/messages?')) {
        qs.push(decodeURIComponent(path));
        return { messages: Object.keys(msgs).map((id) => ({ id })) };
      }
      return msgs[path.split('/')[2]!.split('?')[0]!];
    }) as Gmail;
    const r = await newMail({ SUPPORT_QUERY: 'to:contact@offside-lab.com' } as Env, 1000, g);
    expect(r.mails.map((m) => m.body)).toEqual(['첫 번째', '두 번째']);
    expect(r).toMatchObject({ skipped: 1, latest: 3000 });
    expect(qs[0]).toContain('to:contact@offside-lab.com after:1 -from:me');
  });

  it('답장 헤더에 줄바꿈을 끼워 넣지 못한다', () => {
    const r = replyRaw({
      to: 'u@example.com\r\nBcc: evil@example.com',
      subject: '문의',
      inReplyTo: '<1@mail>',
      references: '',
      body: '안녕하세요',
    });
    const text = atob(r.replace(/-/g, '+').replace(/_/g, '/'));
    expect(text).toContain('To: u@example.com Bcc: evil@example.com\r\n');
    expect(text).not.toMatch(/\r\nBcc:/);
    expect(text).toContain('In-Reply-To: <1@mail>');
    const named = atob(
      replyRaw({
        from: '오프사이드 <contact@offside-lab.com>',
        to: 'u@example.com',
        subject: 's',
        inReplyTo: '',
        references: '',
        body: 'b',
      })
        .replace(/-/g, '+')
        .replace(/_/g, '/'),
    );
    expect(named).toMatch(/^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <contact@offside-lab\.com>\r\n/);
  });

  describe('답장 승인 버튼', () => {
    afterEach(() => vi.unstubAllGlobals());
    const draft: MailDraft = {
      draftId: 'r1',
      threadId: 't',
      to: 'u@example.com',
      subject: 's',
      body: 'b',
    };
    const setup = (to: string) => {
      const slack: string[] = [];
      vi.stubGlobal('fetch', async (u: string) => {
        slack.push(u.split('/').pop()!);
        return new Response('{"ok":true}');
      });
      const records: unknown[] = [];
      const book = {
        mailDraft: async () => draft,
        recordMailApproval: async (a: unknown) => void records.push(a),
      };
      const env = {
        OPERATOR_USER_ID: 'UOP',
        APPROVAL_CHANNEL: 'C',
        SLACK_PLAN_BOT_TOKEN: 'x',
        LEDGER: { idFromName: () => 'id', get: () => book },
      } as unknown as Env;
      const calls: string[] = [];
      const g = (async (path: string, init?: { method?: string }) => {
        calls.push(`${init?.method ?? 'GET'} ${path.split('?')[0]}`);
        if (path.startsWith('/drafts/r1'))
          return { message: { payload: { headers: [{ name: 'To', value: to }] } } };
        return { id: 'sent1' };
      }) as Gmail;
      return { env, g, calls, slack, records };
    };
    const press = (user: string, action = 'mail_send') => ({
      type: 'block_actions',
      user: { id: user },
      channel: { id: 'C' },
      message: { ts: '1.0', blocks: [] },
      actions: [{ action_id: action, value: JSON.stringify({ draft: 'r1' }) }],
    });

    it('운영자가 아니면 보내지 않는다', async () => {
      const s = setup('u@example.com');
      expect(await supportInteraction(s.env, press('UOTHER'), async () => s.g)).toBe('forbidden');
      expect(s.calls).toEqual([]);
    });
    it('받는 사람이 바뀌었으면 보내지 않는다', async () => {
      const s = setup('other@example.com');
      expect(await supportInteraction(s.env, press('UOP'), async () => s.g)).toBe('blocked');
      expect(s.calls).toEqual(['GET /drafts/r1']);
    });
    it('운영자 승인이면 초안을 보내고 기록한다', async () => {
      const s = setup('User <U@example.com>');
      expect(await supportInteraction(s.env, press('UOP'), async () => s.g)).toBe('sent');
      expect(s.calls).toEqual(['GET /drafts/r1', 'POST /drafts/send']);
      expect(s.records).toMatchObject([{ draft: 'r1', action: 'send', user: 'UOP' }]);
      expect(s.slack).toContain('chat.update');
    });
  });
});

describe('@mkt 드림보트 요약', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('요약 형식: 1~3줄, "- "로 시작, 60자 안쪽, 내부 표기 없음', () => {
    expect(checkNotes('- 검색이 빨라졌어요\n- 결제에 카카오페이가 생겼어요')).toBeNull();
    expect(checkNotes('')).toMatch(/1~3/);
    expect(checkNotes('- a\n- b\n- c\n- d')).toMatch(/1~3/);
    expect(checkNotes('검색이 빨라졌어요')).toMatch(/- /);
    expect(checkNotes(`- ${'가'.repeat(61)}`)).toMatch(/60자/);
    expect(checkNotes('- T-11-294 킵 수정')).toMatch(/작업 번호/);
    expect(checkNotes('- 프롬프트 40편 · 디시 32편')).toMatch(/가운뎃점/);
  });

  it('배포 알림은 올바른 커밋만 받는다', async () => {
    await expect(releaseTask({} as Env, { sha: 'abc' })).rejects.toThrow(/bad sha/);
  });

  describe('승인 버튼', () => {
    const setup = (
      draft: { id: string; notes: string; at: number; done?: boolean } | undefined,
    ) => {
      const slack: string[] = [];
      vi.stubGlobal('fetch', async (u: string) => {
        slack.push(u.split('/').pop()!);
        return new Response('{"ok":true}');
      });
      const records: unknown[] = [];
      const saved: unknown[] = [];
      const book = {
        mktDraft: async () => draft,
        setMktDraft: async (d: unknown) => void saved.push(d),
        recordMktApproval: async (a: unknown) => void records.push(a),
      };
      const env = {
        OPERATOR_USER_ID: 'UOP',
        APPROVAL_CHANNEL: 'C',
        SLACK_MKT_BOT_TOKEN: 'x',
        DREAMBOAT_URL: 'https://dreamboat.example.com/api/in/k',
        LEDGER: { idFromName: () => 'id', get: () => book },
      } as unknown as Env;
      const posts: string[] = [];
      const db = (async (_u: string, init?: { body?: string }) => {
        posts.push(String(init?.body));
        return new Response('{"ok":true,"scheduled":"내일 새벽 4시에 게시돼요"}');
      }) as unknown as typeof fetch;
      return { env, db, posts, slack, records, saved };
    };
    const press = (user: string, action = 'dreamboat_send') => ({
      type: 'block_actions',
      user: { id: user },
      channel: { id: 'C' },
      message: { ts: '1.0', blocks: [] },
      actions: [{ action_id: action, value: JSON.stringify({ draft: 'd1' }) }],
    });
    const d = { id: 'd1', notes: '- 검색이 빨라졌어요', at: 1 };

    it('운영자가 아니면 보내지 않는다', async () => {
      const s = setup(d);
      expect(await mktInteraction(s.env, press('UOTHER'), s.db)).toBe('forbidden');
      expect(s.posts).toEqual([]);
    });
    it('운영자 승인이면 그 초안을 보내고 기록한다', async () => {
      const s = setup(d);
      expect(await mktInteraction(s.env, press('UOP'), s.db)).toBe('sent');
      expect(s.posts).toEqual([JSON.stringify({ notes: '- 검색이 빨라졌어요' })]);
      expect(s.records).toMatchObject([{ draft: 'd1', action: 'send', user: 'UOP' }]);
      expect(s.slack).toContain('chat.update');
    });
    it('이미 처리한 초안은 다시 보내지 않는다', async () => {
      const s = setup({ ...d, done: true });
      expect(await mktInteraction(s.env, press('UOP'), s.db)).toBe('missing');
      expect(s.posts).toEqual([]);
    });
  });
});

describe('@mkt GA4', () => {
  it('보고서 요청을 기간 · 이름 형식 · 개수 상한으로 좁힌다', () => {
    const b = reportBody({
      metrics: ['sessions', 'bad name!', 'a', 'b', 'c', 'd', 'e'],
      dimensions: ['sessionSourceMedium'],
      filter: { dimension: 'eventName', value: 'career_start' },
      limit: 500,
    });
    expect(b.dateRanges).toEqual([{ startDate: '7daysAgo', endDate: 'yesterday' }]);
    expect(b.metrics.map((m) => m.name)).toEqual(['sessions', 'a', 'b', 'c', 'd', 'e']);
    expect(b.limit).toBe(50);
    expect(b.orderBys).toEqual([{ metric: { metricName: 'sessions' }, desc: true }]);
    expect(() => reportBody({ metrics: ['sessions'], start_date: '1; drop' })).toThrow(/날짜/);
    expect(() => reportBody({ metrics: [] })).toThrow(/metrics/);
  });

  it('서비스 계정 JWT로 토큰을 받아 보고서를 표로 돌려준다(키가 없으면 도구를 열지 않는다)', async () => {
    expect(ga4Tools({} as Env, 'mention')).toEqual([]);
    const { privateKey } = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const der = new Uint8Array((await crypto.subtle.exportKey('pkcs8', privateKey)) as ArrayBuffer);
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
    const env = {
      GA4_SA_KEY: pem,
      GA4_SA_EMAIL: 'sa@example.com',
      GA4_KEY_ID: 'k1',
      GA4_PROPERTY_ID: '1',
    } as unknown as Env;
    const calls: string[] = [];
    const f = (async (u: string, init?: { body?: unknown }) => {
      calls.push(u);
      if (u.includes('oauth2')) {
        const jwt = new URLSearchParams(String(init?.body)).get('assertion')!;
        expect(JSON.parse(atob(jwt.split('.')[0]!))).toMatchObject({ alg: 'RS256', kid: 'k1' });
        return Response.json({ access_token: 't', expires_in: 3600 });
      }
      return Response.json({
        dimensionHeaders: [{ name: 'date' }],
        metricHeaders: [{ name: 'sessions' }],
        rows: [{ dimensionValues: [{ value: '20261015' }], metricValues: [{ value: '12' }] }],
        rowCount: 1,
      });
    }) as unknown as typeof fetch;
    const [report] = ga4Tools(env, 'mention', f);
    expect(JSON.parse(await report!.run({ metrics: ['sessions'], dimensions: ['date'] }))).toEqual({
      head: ['date', 'sessions'],
      rows: [['20261015', '12']],
      rowCount: 1,
    });
    expect(calls[1]).toContain('/properties/1:runReport');
  });
});

describe('@dev 운영 배포 승인 (T-11-312)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const SHA = 'a'.repeat(40);
  const setup = (main = SHA, migrations: string[] = []) => {
    const slack: { method: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (u: string, init?: { body?: string }) => {
      slack.push({ method: u.split('/').pop()!, body: JSON.parse(init?.body ?? '{}') });
      return new Response('{"ok":true}');
    });
    const records: { action: string; result: string }[] = [];
    const claimed = new Set<string>();
    const book = {
      recordApproval: async (a: { action: string; result: string }) => void records.push(a),
      claimDeploy: async (sha: string, mode: string) =>
        claimed.has(`${sha}:${mode}`) ? false : (claimed.add(`${sha}:${mode}`), true),
    };
    const env = {
      OPERATOR_USER_ID: 'UOP',
      APPROVAL_CHANNEL: 'CAPP',
      GITHUB_REPO: 'o/r',
      SLACK_DEV_BOT_TOKEN: 'x',
      LEDGER: { idFromName: () => 'id', get: () => book },
    } as unknown as Env;
    const calls: { path: string; method: string; body?: unknown }[] = [];
    const g = (async (path: string, init?: { method?: string; body?: unknown }) => {
      calls.push({ path, method: init?.method ?? 'GET', body: init?.body });
      if (path === '/commits/main') return { status: 200, data: { sha: main } };
      if (path === '/releases/latest') return { status: 200, data: { tag_name: 'v2026.10.16.1' } };
      if (path.startsWith('/compare/'))
        return {
          status: 200,
          data: {
            ahead_by: 2,
            commits: [
              { commit: { message: 'T-1: 첫째' } },
              { commit: { message: 'T-2: 둘째\n\n본문' } },
            ],
            files: migrations.map((filename) => ({ filename })),
          },
        };
      if (path.includes('/dispatches')) return { status: 204, data: {} };
      return { status: 404, data: {} };
    }) as Gh;
    return { env, g, calls, slack, records };
  };
  const press = (user: string, action: string, sha = SHA) => ({
    type: 'block_actions',
    user: { id: user },
    channel: { id: 'CAPP' },
    message: { ts: '1.0', blocks: [{ type: 'section' }, { type: 'actions' }] },
    actions: [
      { action_id: action, value: JSON.stringify({ sha, o: { channel: 'CD', threadTs: '9.9' } }) },
    ],
  });
  const dispatches = (calls: { path: string; body?: unknown }[]) =>
    calls.filter((c) => c.path.includes('/dispatches'));

  it('카드에 지난 배포 뒤 커밋과 마이그레이션을 적고, 마이그레이션이 있으면 프리플라이트 버튼을 붙인다', async () => {
    const s = setup(SHA, ['apps/api/migrations/0102_x.sql', 'apps/api/src/a.ts']);
    const plan = await deployPlan(s.g, SHA);
    expect(plan).toMatchObject({
      since: 'v2026.10.16.1',
      ahead: 2,
      migrations: ['apps/api/migrations/0102_x.sql'],
    });
    expect(plan.commits).toEqual(['T-2: 둘째', 'T-1: 첫째']);
    const card = deployCard(s.env, plan);
    const ids = (card.blocks[1] as { elements: { action_id: string }[] }).elements.map(
      (e) => e.action_id,
    );
    expect(ids).toEqual(['dev_preflight', 'dev_deploy', 'dev_deploy_reject']);
    expect(JSON.stringify(card)).toContain('0102_x.sql');
    const plain = deployCard(s.env, { ...plan, migrations: [] });
    expect((plain.blocks[1] as { elements: unknown[] }).elements).toHaveLength(2);
  });

  it('운영자가 아니면 띄우지 않는다', async () => {
    const s = setup();
    expect(await devInteraction(s.env, press('UOTHER', 'dev_deploy'), async () => s.g)).toBe(
      'forbidden',
    );
    expect(s.calls).toEqual([]);
  });

  it('운영자 승인이면 main 최신 커밋으로 deploy를 한 번만 띄우고 기록한다', async () => {
    const s = setup();
    expect(await devInteraction(s.env, press('UOP', 'dev_deploy'), async () => s.g)).toBe('deploy');
    expect(dispatches(s.calls)).toEqual([
      {
        path: '/actions/workflows/deploy-production.yml/dispatches',
        method: 'POST',
        body: {
          ref: 'main',
          inputs: { mode: 'deploy', expected_sha: SHA, confirmation: 'DEPLOY_PRODUCTION' },
        },
      },
    ]);
    expect(s.records).toMatchObject([{ action: 'deploy', result: 'dispatched' }]);
    // 카드 갱신 + 요청 스레드 답.
    expect(s.slack.map((c) => c.method)).toEqual(['chat.update', 'chat.postMessage']);
    expect(await devInteraction(s.env, press('UOP', 'dev_deploy'), async () => s.g)).toBe(
      'duplicate',
    );
    expect(dispatches(s.calls)).toHaveLength(1);
  });

  it('프리플라이트는 확인 문구 없이 띄우고 배포 버튼을 남긴다', async () => {
    const s = setup();
    expect(await devInteraction(s.env, press('UOP', 'dev_preflight'), async () => s.g)).toBe(
      'preflight',
    );
    expect(dispatches(s.calls)[0]!.body).toEqual({
      ref: 'main',
      inputs: { mode: 'preflight', expected_sha: SHA },
    });
    const update = s.slack.find((c) => c.method === 'chat.update')!;
    expect((update.body.blocks as { type: string }[]).map((b) => b.type)).toEqual([
      'section',
      'actions',
      'context',
    ]);
  });

  it('main이 바뀌었으면 띄우지 않고 새 커밋의 카드를 올린다', async () => {
    const s = setup('b'.repeat(40));
    expect(await devInteraction(s.env, press('UOP', 'dev_deploy'), async () => s.g)).toBe('stale');
    expect(dispatches(s.calls)).toEqual([]);
    const posted = s.slack
      .filter((c) => c.method === 'chat.postMessage')
      .map((c) => c.body.channel);
    expect(posted).toContain('CAPP');
  });

  it('거절은 기록만 한다', async () => {
    const s = setup();
    expect(await devInteraction(s.env, press('UOP', 'dev_deploy_reject'), async () => s.g)).toBe(
      'rejected',
    );
    expect(s.calls).toEqual([]);
    expect(s.records).toMatchObject([{ action: 'deploy_reject' }]);
  });
});
