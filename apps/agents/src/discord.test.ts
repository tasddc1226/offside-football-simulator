import { describe, expect, it } from 'vitest';
import { verifyDiscord } from './discord.ts';
import {
  buttonRows,
  mrkdwnToMd,
  slackToDiscord,
  splitContent,
  tablesToCode,
  threadName,
  toSlackEvent,
} from './discordFormat.ts';
import { discordTasks } from './events.ts';
import { handlerFor } from './discordRoutes.ts';
import { linkRoles } from './handoff.ts';
import { threadLink } from './chat.ts';
import type { Env } from './env.ts';

const env = {
  ENABLED_ROLES: 'ops,plan,dev,mkt',
  OPERATOR_USER_ID: '111',
  ALERT_CHANNELS: '900',
  AGENT_APP_IDS: '',
  AGENT_BOT_USERS: '',
  CHAT_PLATFORM: 'discord',
  DISCORD_GUILD_ID: '42',
} as unknown as Env;

describe('슬랙 메시지 → 디스코드', () => {
  it('mrkdwn 굵게 · 지움 · 링크 · 이스케이프를 마크다운으로 옮긴다', () => {
    expect(mrkdwnToMd('*승인 대기* · <https://x.dev/a|스레드> ~옛것~ &lt;b&gt;')).toBe(
      '**승인 대기** · [스레드](<https://x.dev/a>) ~~옛것~~ <b>',
    );
    // 이미 마크다운 굵게인 글은 건드리지 않는다.
    expect(mrkdwnToMd('**그대로**')).toBe('**그대로**');
  });

  it('블록을 본문으로, 버튼을 따로 모은다', () => {
    const { content, buttons } = slackToDiscord({
      text: '대체 글',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*머지 승인* PR #12' } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: '<https://g.h/1|진행 보기>' }] },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '머지' },
              action_id: 'dev_merge',
              value: '{"pr":12}',
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '거절' },
              action_id: 'dev_reject',
              value: '{"pr":12}',
            },
          ],
        },
      ],
    });
    expect(content).toBe('**머지 승인** PR #12\n-# [진행 보기](<https://g.h/1>)');
    expect(buttons.map((b) => [b.action_id, b.style])).toEqual([
      ['dev_merge', 'primary'],
      ['dev_reject', undefined],
    ]);
    expect(buttonRows(buttons, ['k1', 'k2'])).toEqual([
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: '머지', custom_id: 'dev_merge|k1' },
          { type: 2, style: 2, label: '거절', custom_id: 'dev_reject|k2' },
        ],
      },
    ]);
  });

  it('블록이 없으면 text를 mrkdwn으로 옮긴다', () => {
    expect(slackToDiscord({ text: '*안녕*' }).content).toBe('**안녕**');
  });

  it('markdown 블록의 표는 코드 블록으로 감싼다(디스코드는 표를 그리지 않는다)', () => {
    const md = '요약\n| 항목 | 값 |\n|---|---|\n| 오류 | 0 |\n끝';
    expect(tablesToCode(md)).toBe('요약\n```\n| 항목 | 값 |\n|---|---|\n| 오류 | 0 |\n```\n끝');
    // 코드 블록 안 표 · 구분선 없는 줄은 그대로.
    expect(tablesToCode('```\n| a |\n|---|\n```')).toBe('```\n| a |\n|---|\n```');
    expect(tablesToCode('| 혼자 |')).toBe('| 혼자 |');
  });

  it('2,000자를 넘으면 줄 단위로 나누고 코드 블록을 닫았다 다시 연다', () => {
    const long = [
      '앞',
      '```',
      ...Array.from({ length: 60 }, (_, i) => `줄 ${i} ${'가'.repeat(40)}`),
      '```',
      '뒤',
    ].join('\n');
    const parts = splitContent(long, 1000);
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(1000);
      expect((p.match(/```/g) ?? []).length % 2).toBe(0);
    }
    expect(splitContent('')).toEqual([' ']);
    expect(splitContent('가'.repeat(2500)).every((p) => p.length <= 2000)).toBe(true);
  });

  it('스레드 이름은 원글 첫 줄(멘션 · 기호 뺌)', () => {
    expect(threadName('<@1> **서버가 느려요**\n둘째 줄')).toBe('서버가 느려요');
    expect(threadName('')).toBe('작업');
  });
});

describe('디스코드 메시지 → 역할 일', () => {
  const msg = (over: Record<string, unknown>) => ({
    id: '500',
    channel_id: '700',
    guild_id: '42',
    type: 0,
    content: '',
    author: { id: '111' },
    mentions: [],
    ...over,
  });

  it('봇 멘션만 한 운영자 글은 주장(@plan)이 맡는다', () => {
    const { ev, mentioned } = toSlackEvent(
      msg({ content: '<@999> 서버 느린지 봐 줘', mentions: [{ id: '999' }] }),
      '',
      '999',
    );
    expect(mentioned).toBe(true);
    expect(ev).toMatchObject({ text: '서버 느린지 봐 줘', channel: '700', ts: '500', user: '111' });
    const tasks = discordTasks(env, 'discord:500', ev, mentioned);
    expect(tasks.map((t) => [t.role, t.kind, t.threadTs, t.text])).toEqual([
      ['plan', 'mention', '500', '서버 느린지 봐 줘'],
    ]);
  });

  it('한글 이름으로 부르면 그 역할만, 스레드 안이면 스레드 ID가 thread_ts', () => {
    const { ev, mentioned } = toSlackEvent(
      msg({ channel_id: '800', content: '@이운재 로그 봐 줘' }),
      '700',
      '999',
    );
    expect(ev).toMatchObject({ channel: '700', thread_ts: '800' });
    expect(discordTasks(env, 'd', ev, mentioned).map((t) => [t.role, t.threadTs])).toEqual([
      ['ops', '800'],
    ]);
  });

  it('부르지 않은 글 · 운영자 아닌 사람의 멘션은 깨우지 않는다', () => {
    const plain = toSlackEvent(msg({ content: '그냥 메모' }), '', '999');
    expect(discordTasks(env, 'd', plain.ev, plain.mentioned)).toEqual([]);
    const other = toSlackEvent(
      msg({ author: { id: '222' }, content: '<@999> 해 줘', mentions: [{ id: '999' }] }),
      '',
      '999',
    );
    expect(discordTasks(env, 'd', other.ev, other.mentioned)).toEqual([]);
  });

  it('알림 웹훅 글은 경보 채널에서 @ops 경보가 된다', () => {
    const { ev } = toSlackEvent(
      msg({
        channel_id: '900',
        webhook_id: '77',
        author: { id: '77', bot: true },
        content: 'D1 용량 경고',
      }),
      '',
      '999',
    );
    expect(ev).toMatchObject({ subtype: 'bot_message', bot_id: '77' });
    expect(ev.user).toBeUndefined();
    expect(discordTasks(env, 'd', ev, false).map((t) => [t.role, t.kind])).toEqual([
      ['ops', 'alert'],
    ]);
    // 복구 알림은 정리하지 않는다.
    const ok = toSlackEvent(
      msg({ channel_id: '900', webhook_id: '77', content: '✅ 복구' }),
      '',
      '999',
    );
    expect(discordTasks(env, 'd', ok.ev, false)).toEqual([]);
  });
});

describe('디스코드 공통', () => {
  it('버튼 action_id로 처리 함수를 고른다', () => {
    for (const a of ['plan_start', 'review_send', 'mail_discard', 'dev_merge', 'dev_deploy'])
      expect(handlerFor(a)).not.toBeNull();
    expect(handlerFor('unknown')).toBeNull();
  });

  it('역할 키는 한글 이름으로, 스레드 링크는 디스코드 주소로', () => {
    expect(linkRoles(env, '→ @dev: 고쳐 줘 `@ops`')).toBe('→ @손흥민: 고쳐 줘 `@ops`');
    expect(threadLink(env, '700', '500')).toBe('https://discord.com/channels/42/700/500');
    expect(threadLink({ CHAT_PLATFORM: 'slack' } as Env, 'C1', '1.2')).toBe(
      'https://offside-lab.slack.com/archives/C1/p12',
    );
  });

  it('Ed25519 서명을 확인하고 오래된 요청 · 다른 본문은 거절한다', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const raw = new Uint8Array(
      (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
    );
    const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    const ts = '1700000000';
    const body = '{"type":1}';
    const sig = hex(
      new Uint8Array(
        await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(ts + body)),
      ),
    );
    const now = 1_700_000_010;
    expect(await verifyDiscord(hex(raw), sig, ts, body, now)).toBe(true);
    expect(await verifyDiscord(hex(raw), sig, ts, '{"type":2}', now)).toBe(false);
    expect(await verifyDiscord(hex(raw), sig, ts, body, now + 600)).toBe(false);
    expect(await verifyDiscord(undefined, sig, ts, body, now)).toBe(false);
  });
});
